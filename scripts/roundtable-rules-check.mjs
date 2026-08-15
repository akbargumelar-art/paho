/**
 * Unit tests for the roundtable stop rules — the part that decides when a
 * discussion ENDS. Run against the compiled lib so the assertions exercise the
 * exact code the API route imports (regex-stripping TS has bitten us before).
 */
import { execFileSync } from "child_process";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

const dir = await mkdtemp(path.join(tmpdir(), "paho-rt-"));
let failures = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) failures += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}: ${got}${ok ? "" : ` (harus ${want})`}`);
};

try {
  execFileSync("npx", [
    "tsc", "src/lib/roundtable.ts", "--outDir", dir,
    "--module", "esnext", "--target", "es2022", "--moduleResolution", "bundler",
  ], { cwd: "/root/paho", stdio: "inherit" });

  const rt = await import(path.join(dir, "roundtable.js"));
  const turn = (agent, round, text, status, error = false) => ({ agent, round, text, status, error });

  // --- status marker parsing ---
  check("parse sepakat", rt.parseStatus("Setuju semua.\nSTATUS: SEPAKAT"), "sepakat");
  check("parse beda", rt.parseStatus("Saya beda.\nstatus: beda"), "beda");
  check("parse butuh_keputusan", rt.parseStatus("Mentok.\nSTATUS: BUTUH_KEPUTUSAN"), "butuh_keputusan");
  check("parse butuh keputusan (spasi)", rt.parseStatus("Mentok.\nSTATUS: BUTUH KEPUTUSAN"), "butuh_keputusan");
  check("tanpa marker = unknown", rt.parseStatus("Jawaban biasa tanpa status."), "unknown");
  check("strip membuang baris status", rt.stripStatus("Isi jawaban.\nSTATUS: SEPAKAT").includes("STATUS"), false);
  check("strip mempertahankan isi", rt.stripStatus("Isi jawaban.\nSTATUS: SEPAKAT").trim(), "Isi jawaban.");

  // --- consensus ---
  check("semua sepakat -> stop consensus", rt.decideRoundtable({
    turns: [turn("Corla", 1, "a", "sepakat"), turn("Ocla", 1, "b", "sepakat")],
    currentRound: 1, maxRounds: 3,
  }).reason, "consensus");

  // --- escalation beats consensus ---
  check("butuh_keputusan menang atas sepakat", rt.decideRoundtable({
    turns: [turn("Corla", 1, "a", "sepakat"), turn("Ocla", 1, "b", "butuh_keputusan")],
    currentRound: 1, maxRounds: 3,
  }).reason, "needs_owner");

  // --- error beats everything ---
  check("agent error menghentikan diskusi", rt.decideRoundtable({
    turns: [turn("Corla", 1, "a", "sepakat"), turn("Ocla", 1, "gagal", "unknown", true)],
    currentRound: 1, maxRounds: 3,
  }).reason, "agent_error");

  // --- keep going when there is real disagreement ---
  check("beda pendapat baru -> lanjut", rt.decideRoundtable({
    turns: [turn("Corla", 1, "pakai sqlite karena ringan dan cepat", "beda"), turn("Ocla", 1, "pakai postgres karena butuh concurrency tinggi", "beda")],
    currentRound: 1, maxRounds: 3,
  }).stop, false);

  // --- repetition deadlock ---
  const repeated = "menurut saya arsitektur queue lebih aman karena retry gagal terkendali dan beban database berkurang";
  check("mengulang argumen -> deadlock_repetition", rt.decideRoundtable({
    turns: [
      turn("Corla", 1, repeated, "beda"), turn("Ocla", 1, "saya usul webhook langsung supaya latensi rendah", "beda"),
      turn("Corla", 2, repeated, "beda"), turn("Ocla", 2, "saya usul webhook langsung supaya latensi rendah sekali", "beda"),
    ],
    currentRound: 2, maxRounds: 5,
  }).reason, "deadlock_repetition");

  // --- stalemate deadlock: same people, same grounds, different words ---
  check("standoff tidak bergerak -> deadlock", ["deadlock_stalemate", "deadlock_repetition"].includes(rt.decideRoundtable({
    turns: [
      turn("Corla", 1, "queue lebih aman retry terkendali beban database", "beda"),
      turn("Ocla", 1, "webhook langsung latensi rendah lebih sederhana", "beda"),
      turn("Corla", 2, "queue lebih aman retry terkendali beban database", "beda"),
      turn("Ocla", 2, "webhook langsung latensi rendah lebih sederhana", "beda"),
    ],
    currentRound: 2, maxRounds: 5,
  }).reason), true);

  // --- hard budget ---
  check("batas ronde -> max_rounds", rt.decideRoundtable({
    turns: [
      turn("Corla", 1, "argumen pertama soal biaya infrastruktur", "beda"), turn("Ocla", 1, "argumen soal kecepatan implementasi", "beda"),
      turn("Corla", 2, "sekarang saya bahas risiko migrasi data", "beda"), turn("Ocla", 2, "saya bahas kebutuhan monitoring baru", "beda"),
    ],
    currentRound: 2, maxRounds: 2,
  }).reason, "max_rounds");

  // --- empty round must not be reported as consensus ---
  check("ronde kosong -> agent_error", rt.decideRoundtable({ turns: [], currentRound: 1, maxRounds: 3 }).reason, "agent_error");

  // --- maxRounds clamped to the documented ceiling ---
  check("maxRounds dibatasi ROUNDTABLE_MAX_ROUNDS", rt.decideRoundtable({
    turns: [turn("Corla", 9, "x", "beda"), turn("Ocla", 9, "y", "beda")],
    currentRound: 9, maxRounds: 99,
  }).reason, "max_rounds");

  // --- rules text must actually instruct the stop protocol ---
  const rules = rt.roundtableRules(2, 3, false);
  check("rules menyebut STATUS", rules.includes("STATUS: SEPAKAT"), true);
  check("rules ronde 2 minta menanggapi", rules.includes("tanggapi"), true);
  check("rules ronde 1 minta posisi awal", rt.roundtableRules(1, 3, true).includes("posisi awal"), true);
  check("summary minta 4 bagian", ["Kesepakatan", "Masih beda", "Rekomendasi", "Perlu keputusan"].every((k) => rt.summaryRules({ label: "x" }, 2).includes(k)), true);

  console.log(`\nfailures=${failures}`);
  if (failures) throw new Error(`${failures} assertion gagal`);
  console.log("ALL_OK");
} finally {
  await rm(dir, { recursive: true, force: true });
}
