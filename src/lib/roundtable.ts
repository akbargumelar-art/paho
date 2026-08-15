/**
 * Roundtable discussion rules for Paho Group Chat.
 *
 * Parallel mode = one question, every agent answers once, no cross-talk.
 * Roundtable mode = agents speak in turn and may respond to what the previous
 * speakers said, for several rounds.
 *
 * The hard part is not making them talk, it is making them STOP. Left alone,
 * LLM agents keep politely agreeing forever or restate the same position with
 * new wording, which burns tokens and produces no decision. Everything below
 * exists to end a discussion on purpose instead of by exhaustion.
 */

/** Status marker every roundtable turn must end with. */
export type TurnStatus = "sepakat" | "beda" | "butuh_keputusan" | "unknown";

export type RoundtableTurn = {
  agent: string;
  round: number;
  text: string;
  status: TurnStatus;
  error?: boolean;
};

export type StopReason =
  | "consensus"
  | "deadlock_repetition"
  | "deadlock_stalemate"
  | "needs_owner"
  | "max_rounds"
  | "agent_error"
  | "continue";

export type StopDecision = {
  stop: boolean;
  reason: StopReason;
  /** Indonesian one-liner shown to abay in the room. */
  label: string;
};

export const ROUNDTABLE_DEFAULT_ROUNDS = 3;
export const ROUNDTABLE_MAX_ROUNDS = 5;

/** Similarity above which a turn counts as "saying the same thing again". */
const REPEAT_THRESHOLD = 0.82;

const STATUS_LINE = /^\s*status\s*[:=-]\s*(sepakat|beda|butuh[_ ]keputusan)\b/im;

/**
 * Reads the trailing status marker. Agents are instructed to emit
 * `STATUS: SEPAKAT | BEDA | BUTUH_KEPUTUSAN`; anything else is "unknown" and is
 * treated as a still-open position rather than silent agreement, because
 * assuming agreement is how a discussion ends with a wrong conclusion.
 */
export function parseStatus(text: string): TurnStatus {
  const m = STATUS_LINE.exec(text || "");
  if (!m) return "unknown";
  const raw = m[1].toLowerCase().replace(" ", "_");
  if (raw === "sepakat") return "sepakat";
  if (raw === "beda") return "beda";
  return "butuh_keputusan";
}

/** Strips the status line so it is not shown twice in the transcript. */
export function stripStatus(text: string): string {
  return (text || "").replace(STATUS_LINE, "").trimEnd();
}

const STOPWORDS = new Set([
  "yang", "dan", "atau", "untuk", "dengan", "pada", "dari", "ini", "itu", "ke",
  "di", "kalau", "bisa", "juga", "saya", "kita", "abay", "tidak", "ada", "jadi",
  "agar", "sudah", "akan", "lebih", "saja", "the", "and", "for", "with", "that",
]);

function tokens(text: string): Set<string> {
  return new Set(
    (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w)),
  );
}

/** Jaccard overlap of content words. 1 = identical vocabulary. */
export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared += 1;
  return shared / (ta.size + tb.size - shared);
}

/**
 * Signature of the current disagreement: who still disagrees, plus the
 * vocabulary they disagree with. Two identical signatures in a row means the
 * discussion is circling — the same people objecting on the same grounds.
 */
function disagreementSignature(turns: RoundtableTurn[]): string {
  const open = turns
    .filter((t) => t.status === "beda" || t.status === "butuh_keputusan" || t.status === "unknown")
    .map((t) => {
      const key = Array.from(tokens(t.text)).sort().slice(0, 12).join(",");
      return `${t.agent}:${key}`;
    })
    .sort();
  return open.join("|");
}

/**
 * Decides whether the roundtable continues after a completed round.
 *
 * Order matters: an error or an explicit request for an owner decision must win
 * over "everyone agreed", otherwise the room reports false consensus.
 */
export function decideRoundtable(params: {
  turns: RoundtableTurn[];
  currentRound: number;
  maxRounds: number;
}): StopDecision {
  const { turns, currentRound } = params;
  const maxRounds = Math.min(Math.max(params.maxRounds || ROUNDTABLE_DEFAULT_ROUNDS, 1), ROUNDTABLE_MAX_ROUNDS);
  const thisRound = turns.filter((t) => t.round === currentRound);
  const prevRound = turns.filter((t) => t.round === currentRound - 1);

  if (!thisRound.length) {
    return { stop: true, reason: "agent_error", label: "Diskusi dihentikan: tidak ada jawaban di ronde ini." };
  }

  // 1. A failing agent means the transcript is incomplete. Stop rather than let
  //    the remaining agents "agree" on a partial discussion.
  const errored = thisRound.filter((t) => t.error);
  if (errored.length) {
    return {
      stop: true,
      reason: "agent_error",
      label: `Diskusi dihentikan: ${errored.map((t) => t.agent).join(", ")} gagal menjawab.`,
    };
  }

  // 2. An explicit escalation always beats consensus — the agents are telling
  //    us the call is not theirs to make.
  const needsOwner = thisRound.filter((t) => t.status === "butuh_keputusan");
  if (needsOwner.length) {
    return {
      stop: true,
      reason: "needs_owner",
      label: `Diskusi dihentikan: butuh keputusan abay (diminta ${needsOwner.map((t) => t.agent).join(", ")}).`,
    };
  }

  // 3. Real consensus: everyone who spoke this round said SEPAKAT.
  if (thisRound.every((t) => t.status === "sepakat")) {
    return { stop: true, reason: "consensus", label: "Diskusi selesai: semua agent sepakat." };
  }

  // 4. Repetition deadlock — agents restating themselves with new wording.
  //    Needs a previous round to compare against.
  if (prevRound.length) {
    const repeats = thisRound.filter((t) => {
      const before = prevRound.find((p) => p.agent === t.agent);
      return before ? similarity(before.text, t.text) >= REPEAT_THRESHOLD : false;
    });
    if (repeats.length >= Math.ceil(thisRound.length / 2)) {
      return {
        stop: true,
        reason: "deadlock_repetition",
        label: `Diskusi dihentikan: ${repeats.map((t) => t.agent).join(", ")} mengulang argumen yang sama (tidak ada info baru).`,
      };
    }

    // 5. Stalemate deadlock — identical disagreement structure two rounds in a
    //    row. Different words, same standoff.
    if (disagreementSignature(prevRound) && disagreementSignature(prevRound) === disagreementSignature(thisRound)) {
      return {
        stop: true,
        reason: "deadlock_stalemate",
        label: "Diskusi dihentikan: beda pendapat tidak bergerak dua ronde berturut-turut.",
      };
    }
  }

  // 6. Hard budget. Always last so a real conclusion is reported as such.
  if (currentRound >= maxRounds) {
    return { stop: true, reason: "max_rounds", label: `Diskusi dihentikan: batas ${maxRounds} ronde tercapai.` };
  }

  return { stop: false, reason: "continue", label: "" };
}

/**
 * Rules injected into every roundtable turn. Written as instructions to the
 * agent, deliberately blunt about stopping — the failure mode is endless polite
 * agreement, not premature exit.
 */
export function roundtableRules(round: number, maxRounds: number, isFirst: boolean): string {
  return [
    `Ini DISKUSI ronde ${round} dari maksimal ${maxRounds}. Kamu bicara berurutan, bukan sendirian.`,
    isFirst
      ? "Kamu bicara pertama di ronde ini. Beri posisi awal yang jelas dan bisa dibantah."
      : "Sudah ada agent yang bicara di ronde ini. WAJIB tanggapi isi pendapat mereka secara spesifik, bukan mengulang pendapatmu sendiri.",
    "",
    "Aturan diskusi:",
    "1. Maksimal 2 paragraf pendek. Padat, tanpa pembukaan basa-basi.",
    "2. Kalau setuju, bilang setuju dan JANGAN mengulang alasannya panjang-panjang.",
    "3. Kalau tidak setuju, sebutkan alasan konkret dan apa yang kamu usulkan sebagai gantinya.",
    "4. Jangan mengaku sudah menjalankan aksi backend. Kamu hanya berdiskusi.",
    "5. Kalau tidak punya info baru dibanding ronde sebelumnya, bilang begitu secara jujur dan pakai STATUS: SEPAKAT atau STATUS: BUTUH_KEPUTUSAN. Mengulang argumen lama dengan kata berbeda dianggap deadlock dan diskusi akan dihentikan.",
    "6. Kalau ini keputusan yang butuh wewenang/data abay (biaya, prioritas, akses, risiko produksi), langsung pakai STATUS: BUTUH_KEPUTUSAN.",
    "",
    "Tutup jawabanmu dengan TEPAT SATU baris status di baris terakhir:",
    "STATUS: SEPAKAT        -> kesimpulan sudah cukup, tidak perlu ronde lagi",
    "STATUS: BEDA           -> masih ada perbedaan yang layak dibahas satu ronde lagi",
    "STATUS: BUTUH_KEPUTUSAN-> mentok, harus abay yang memutuskan",
  ].join("\n");
}

/** Prompt for the closing summary written by the moderator agent. */
export function summaryRules(decision: StopDecision, rounds: number): string {
  return [
    `Diskusi roundtable sudah berakhir setelah ${rounds} ronde. Alasan berhenti: ${decision.label}`,
    "",
    "Tulis RINGKASAN AKHIR untuk abay, maksimal 12 baris, format persis begini:",
    "**Kesepakatan:** poin yang benar-benar disetujui (kalau tidak ada, tulis 'belum ada').",
    "**Masih beda:** perbedaan yang belum selesai beserta siapa yang berpendapat apa.",
    "**Rekomendasi:** satu langkah paling masuk akal berikutnya.",
    "**Perlu keputusan abay:** hal yang tidak bisa diputuskan agent (kalau tidak ada, tulis '-').",
    "",
    "Jangan mengarang kesepakatan yang tidak ada di transkrip. Jangan menambah topik baru.",
    "Jangan pakai baris STATUS di ringkasan ini.",
  ].join("\n");
}
