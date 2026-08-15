import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile, readdir } from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { cleanHermesOutput, streamingChatArgs } from "@/lib/hermes-output";
import {
  ROUNDTABLE_DEFAULT_ROUNDS,
  ROUNDTABLE_MAX_ROUNDS,
  decideRoundtable,
  parseStatus,
  roundtableRules,
  stripStatus,
  summaryRules,
  type RoundtableTurn,
  type StopDecision,
  type TurnStatus,
} from "@/lib/roundtable";

export const runtime = "nodejs";
export const maxDuration = 60;

const DATA_DIR = "/root/paho/data/web-chat";
const GROUP_DIR = path.join(DATA_DIR, "group-rooms");
const INDEX_PATH = path.join(DATA_DIR, "group-rooms.json");
const JOBS_PATH = path.join(DATA_DIR, "group-jobs.json");
const HERMES_BIN = "/root/.local/bin/hermes";
const CHAT_MODEL = process.env.PAHO_CHAT_MODEL || "hermes";

type AgentId = "corla" | "oca" | "gadis" | "priska" | "bunga";
type GroupMode = "parallel" | "roundtable";
type GroupRoom = { id: string; title: string; participants: AgentId[]; model: string; mode: GroupMode; maxRounds: number; createdAt: string; updatedAt: string };
type GroupIndex = { rooms: GroupRoom[] };
type GroupMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  agent?: AgentId;
  name?: string;
  content: string;
  createdAt: string;
  pending?: boolean;
  error?: boolean;
  model?: string;
  // Roundtable metadata. Absent for parallel mode so old rooms stay valid.
  round?: number;
  status?: TurnStatus;
  kind?: "turn" | "summary" | "notice";
  discussionId?: string;
};
type GroupStore = { roomId: string; messages: GroupMessage[] };
type JobKind = "reply" | "turn" | "summary";
type GroupJob = {
  id: string;
  roomId: string;
  assistantId: string;
  agent: AgentId;
  prompt: string;
  model: string;
  status: "pending" | "running" | "done" | "error";
  attempts: number;
  createdAt: string;
  updatedAt: string;
  kind: JobKind;
  round?: number;
  discussionId?: string;
};
type JobStore = { jobs: GroupJob[] };

type AgentConfig = { id: AgentId; name: string; profile?: string; systemPrompt: string };
const AGENTS: Record<AgentId, AgentConfig> = {
  corla: { id: "corla", name: "Corla", systemPrompt: "Kamu Corla / Aspri Abay, orchestrator utama Paho. Jawab ringkas, praktis, bahasa Indonesia, panggil user abay." },
  oca: { id: "oca", name: "Ocla", profile: "ocla", systemPrompt: "Kamu Ocla, worker backend pendukung. Fokus teknis, cek risiko, dan beri jawaban ringkas." },
  gadis: { id: "gadis", name: "Gadis", profile: "gadis", systemPrompt: "Kamu Gadis, domain Work/Agrabudi. Untuk group Paho, beri perspektif kerja/support secara ringkas." },
  priska: { id: "priska", name: "Priska", profile: "priska", systemPrompt: "Kamu Priska, domain Personal. Untuk group Paho, beri perspektif personal/agenda/rumah tangga secara ringkas." },
  bunga: { id: "bunga", name: "Bunga", profile: "bunga", systemPrompt: "Kamu Bunga, domain Bisnis non-work. Untuk group Paho, beri perspektif bisnis/proyek secara ringkas." },
};

let workerRunning = false;
const nowIso = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// A declared profile is only passed to Hermes if it actually exists, otherwise
// `hermes --profile X` exits 1 and that agent fails on every message. Verified:
// profile "ocla" does not exist, so Ocla must fall back to the default profile
// with its persona injected purely through the prompt.
let profileCache: { at: number; names: Set<string> } | null = null;
async function availableProfiles(): Promise<Set<string>> {
  if (profileCache && Date.now() - profileCache.at < 60_000) return profileCache.names;
  const names = new Set<string>();
  try {
    const entries = await readdir("/root/.hermes/profiles", { withFileTypes: true });
    for (const e of entries) if (e.isDirectory()) names.add(e.name);
  } catch {
    // No profiles dir → only the default profile exists.
  }
  profileCache = { at: Date.now(), names };
  return names;
}

async function ensureDirs() { await mkdir(GROUP_DIR, { recursive: true }); }
async function readJson<T>(file: string, fallback: T): Promise<T> { try { return JSON.parse(await readFile(file, "utf8")) as T; } catch { return fallback; } }
async function writeJson(file: string, data: unknown) { await ensureDirs(); await writeFile(file, JSON.stringify(data, null, 2)); }
async function readIndex(): Promise<GroupIndex> {
  const data = await readJson<GroupIndex>(INDEX_PATH, { rooms: [] });
  // Rooms created before roundtable existed have no mode/maxRounds.
  for (const room of data.rooms) {
    if (room.mode !== "roundtable") room.mode = "parallel";
    if (!room.maxRounds) room.maxRounds = ROUNDTABLE_DEFAULT_ROUNDS;
  }
  return data;
}
async function saveIndex(data: GroupIndex) { await writeJson(INDEX_PATH, data); }
async function roomPath(roomId: string) { return path.join(GROUP_DIR, `${roomId}.json`); }
async function readRoom(roomId: string): Promise<GroupStore> { return readJson(await roomPath(roomId), { roomId, messages: [] }); }
async function saveRoom(store: GroupStore) { await writeJson(await roomPath(store.roomId), store); }
async function readJobs(): Promise<JobStore> {
  const data = await readJson<JobStore>(JOBS_PATH, { jobs: [] });
  for (const job of data.jobs) if (!job.kind) job.kind = "reply";
  return data;
}
async function saveJobs(data: JobStore) { await writeJson(JOBS_PATH, data); }
function normalizeAgents(value: unknown): AgentId[] {
  const raw = Array.isArray(value) ? value : ["corla", "oca"];
  const seen = new Set<AgentId>();
  for (const item of raw) {
    const v = String(item || "").toLowerCase() === "ocla" ? "oca" : String(item || "").toLowerCase();
    if (v in AGENTS) seen.add(v as AgentId);
  }
  return Array.from(seen).slice(0, 5) as AgentId[];
}
function normalizeMode(value: unknown, fallback: GroupMode = "parallel"): GroupMode {
  return String(value || "") === "roundtable" ? "roundtable" : String(value || "") === "parallel" ? "parallel" : fallback;
}
function normalizeRounds(value: unknown, fallback = ROUNDTABLE_DEFAULT_ROUNDS): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), 1), ROUNDTABLE_MAX_ROUNDS);
}
function publicAgents() { return Object.values(AGENTS).map(({ id, name }) => ({ id, name })); }
function clamp(text: string, max = 1800) { return text.length <= max ? text : `${text.slice(0, max)}\n[...dipotong...]`; }

function transcript(messages: GroupMessage[], limit = 16) {
  return messages
    .filter((m) => m.content.trim() && !m.pending && m.kind !== "notice")
    .slice(-limit)
    .map((m) => {
      const speaker = m.role === "user" ? "abay" : (m.name || m.agent || "agent");
      const tag = m.round ? ` (ronde ${m.round})` : "";
      return `${speaker}${tag}: ${clamp(m.content, 900)}`;
    })
    .join("\n\n");
}

function buildPrompt(agent: AgentConfig, room: GroupRoom, history: GroupMessage[], prompt: string) {
  const peers = room.participants.filter((p) => p !== agent.id).map((p) => AGENTS[p].name).join(", ") || "-";
  return [
    agent.systemPrompt,
    "",
    "Kamu sedang berada di Group Chat Paho bersama agent lain. Jangan mengaku sudah menjalankan aksi backend kecuali memang ada tool/API yang menjalankannya.",
    `Peserta lain: ${peers}. Jawab sebagai ${agent.name}, maksimal 3 paragraf pendek. Bila tidak relevan untuk domainmu, bilang singkat dan beri perspektif seperlunya.`,
    "",
    "Riwayat terbaru:",
    transcript(history) || "(belum ada)",
    "",
    `Pesan terbaru dari abay: ${prompt}`,
  ].join("\n");
}

/**
 * Roundtable turn prompt. Unlike parallel mode the agent must see what the
 * earlier speakers said IN THIS ROUND, otherwise there is nothing to respond to
 * and the "discussion" degenerates into parallel replies.
 */
function buildTurnPrompt(agent: AgentConfig, room: GroupRoom, store: GroupStore, topic: string, round: number, discussionId: string) {
  const discussion = store.messages.filter((m) => m.discussionId === discussionId && m.kind === "turn" && m.content.trim() && !m.pending);
  const thisRound = discussion.filter((m) => m.round === round);
  const earlier = discussion.filter((m) => m.round !== round);
  const peers = room.participants.filter((p) => p !== agent.id).map((p) => AGENTS[p].name).join(", ") || "-";
  const before = store.messages.filter((m) => !m.discussionId && m.content.trim() && !m.pending);
  return [
    agent.systemPrompt,
    "",
    `Peserta diskusi: ${peers} dan kamu (${agent.name}).`,
    roundtableRules(round, room.maxRounds, thisRound.length === 0),
    "",
    `TOPIK dari abay: ${topic}`,
    "",
    before.length ? `Konteks room sebelumnya:\n${transcript(before, 6)}\n` : "",
    earlier.length ? `Ronde sebelumnya:\n${transcript(earlier, 12)}\n` : "",
    thisRound.length ? `Yang sudah bicara di ronde ${round} ini:\n${transcript(thisRound, 6)}\n` : "",
    `Sekarang giliranmu sebagai ${agent.name}.`,
  ].filter(Boolean).join("\n");
}

function buildSummaryPrompt(agent: AgentConfig, store: GroupStore, topic: string, discussionId: string, decision: StopDecision, rounds: number) {
  const turns = store.messages.filter((m) => m.discussionId === discussionId && m.kind === "turn" && m.content.trim());
  return [
    agent.systemPrompt,
    "",
    `Kamu bertindak sebagai moderator diskusi. TOPIK: ${topic}`,
    "",
    "Transkrip diskusi:",
    transcript(turns, 40) || "(kosong)",
    "",
    summaryRules(decision, rounds),
  ].join("\n");
}

async function askHermes(agent: AgentConfig, prompt: string, model: string, onPartial: (text: string) => void) {
  const profiles = await availableProfiles();
  const profile = agent.profile && profiles.has(agent.profile) ? agent.profile : undefined;
  // Omit -Q for real streaming. Quiet mode buffers the complete answer until
  // process exit. cleanHermesOutput strips the non-quiet TUI frame on every
  // partial, so the stored assistant content is plain text while it grows.
  const args = streamingChatArgs(prompt, model || CHAT_MODEL, profile);
  let output = "";
  let stderr = "";
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(HERMES_BIN, args, {
      env: {
        ...process.env,
        HOME: "/root",
        PATH: `/root/.nvm/versions/node/v24.19.0/bin:${process.env.PATH || ""}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let settled = false;
    const finishError = (message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(message));
    };
    const timer = setTimeout(() => { child.kill("SIGTERM"); finishError("Timeout > 180s"); }, 180_000);
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (output.length > 120_000) output = output.slice(-120_000);
      const partial = cleanHermesOutput(output);
      if (partial) onPartial(partial);
    });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); if (stderr.length > 20_000) stderr = stderr.slice(-20_000); });
    child.on("error", (e) => finishError(e.message));
    child.on("close", (code) => {
      if (settled) return;
      clearTimeout(timer);
      const text = cleanHermesOutput(output || stderr);
      if (code === 0 && text) {
        settled = true;
        resolve(text);
      } else {
        finishError(cleanHermesOutput(stderr) || `Hermes exit ${code}`);
      }
    });
  });
}

function turnsOf(store: GroupStore, discussionId: string): RoundtableTurn[] {
  return store.messages
    .filter((m) => m.discussionId === discussionId && m.kind === "turn" && !m.pending)
    .map((m) => ({
      agent: m.name || m.agent || "agent",
      round: m.round || 1,
      text: m.content,
      status: m.status || "unknown",
      error: m.error,
    }));
}

/**
 * Called after the last turn of a round finishes. Either queues the next round,
 * or closes the discussion with a moderator summary. This is the only place a
 * roundtable can grow, so the stop rules cannot be bypassed.
 */
async function advanceRoundtable(store: GroupStore, room: GroupRoom, job: GroupJob, jobs: JobStore) {
  const discussionId = job.discussionId!;
  const round = job.round || 1;
  const pendingSameRound = store.messages.some((m) => m.discussionId === discussionId && m.kind === "turn" && m.round === round && m.pending);
  if (pendingSameRound) return; // not the last speaker of this round yet

  const topic = job.prompt;
  const decision = decideRoundtable({ turns: turnsOf(store, discussionId), currentRound: round, maxRounds: room.maxRounds });

  if (!decision.stop) {
    for (const agentId of room.participants) {
      const assistantId = id("msg");
      store.messages.push({
        id: assistantId, role: "assistant", agent: agentId, name: AGENTS[agentId].name,
        content: "", pending: true, createdAt: nowIso(), model: job.model,
        round: round + 1, kind: "turn", discussionId,
      });
      jobs.jobs.push({
        id: id("gjob"), roomId: room.id, assistantId, agent: agentId, prompt: topic, model: job.model,
        status: "pending", attempts: 0, createdAt: nowIso(), updatedAt: nowIso(),
        kind: "turn", round: round + 1, discussionId,
      });
    }
    await saveRoom(store);
    await saveJobs(jobs);
    return;
  }

  store.messages.push({
    id: id("msg"), role: "system", content: decision.label, createdAt: nowIso(),
    kind: "notice", discussionId, round,
  });
  const moderator = room.participants[0];
  const summaryId = id("msg");
  store.messages.push({
    id: summaryId, role: "assistant", agent: moderator, name: `${AGENTS[moderator].name} (ringkasan)`,
    content: "", pending: true, createdAt: nowIso(), model: job.model,
    kind: "summary", discussionId, round,
  });
  jobs.jobs.push({
    id: id("gjob"), roomId: room.id, assistantId: summaryId, agent: moderator,
    prompt: JSON.stringify({ topic, decision, rounds: round }), model: job.model,
    status: "pending", attempts: 0, createdAt: nowIso(), updatedAt: nowIso(),
    kind: "summary", round, discussionId,
  });
  await saveRoom(store);
  await saveJobs(jobs);
}

async function kickWorker() {
  if (workerRunning) return;
  workerRunning = true;
  void (async () => {
    try {
      while (true) {
        const jobs = await readJobs();
        const stale = new Date(Date.now() - 5 * 60_000).toISOString();
        for (const job of jobs.jobs) if (job.status === "running" && job.updatedAt < stale) job.status = "pending";
        const job = jobs.jobs.find((j) => j.status === "pending" && j.attempts < 3);
        if (!job) { await saveJobs(jobs); return; }
        job.status = "running"; job.attempts += 1; job.updatedAt = nowIso(); await saveJobs(jobs);
        const index = await readIndex();
        const room = index.rooms.find((r) => r.id === job.roomId);
        const agent = AGENTS[job.agent];
        if (!room || !agent) { job.status = "error"; await saveJobs(jobs); continue; }
        const store = await readRoom(job.roomId);
        const assistant = store.messages.find((m) => m.id === job.assistantId);
        if (!assistant) { job.status = "error"; await saveJobs(jobs); continue; }

        let prompt: string;
        if (job.kind === "turn") {
          prompt = buildTurnPrompt(agent, room, store, job.prompt, job.round || 1, job.discussionId!);
        } else if (job.kind === "summary") {
          const meta = JSON.parse(job.prompt) as { topic: string; decision: StopDecision; rounds: number };
          prompt = buildSummaryPrompt(agent, store, meta.topic, job.discussionId!, meta.decision, meta.rounds);
        } else {
          prompt = buildPrompt(agent, room, store.messages, job.prompt);
        }

        let flush = Promise.resolve();
        try {
          const answer = await askHermes(agent, prompt, job.model, (partial) => {
            assistant.content = job.kind === "turn" ? stripStatus(partial) : partial;
            assistant.pending = true;
            flush = flush.then(() => saveRoom(store)).catch(() => undefined);
          });
          await flush;
          if (job.kind === "turn") {
            assistant.status = parseStatus(answer);
            assistant.content = stripStatus(answer);
          } else {
            assistant.content = answer;
          }
          assistant.pending = false;
          assistant.error = false;
          await saveRoom(store);
          job.status = "done"; job.updatedAt = nowIso(); await saveJobs(jobs);
          if (job.kind === "turn") await advanceRoundtable(store, room, job, jobs);
        } catch (error) {
          assistant.content = `Maaf, ${agent.name} gagal menjawab: ${(error as Error).message}`;
          assistant.pending = false;
          assistant.error = true;
          if (job.kind === "turn") assistant.status = "unknown";
          await saveRoom(store);
          job.status = "error"; job.updatedAt = nowIso(); await saveJobs(jobs);
          // A failed turn still closes the round, otherwise the discussion hangs
          // with a permanently pending placeholder.
          if (job.kind === "turn") await advanceRoundtable(store, room, job, jobs);
        }
      }
    } finally { workerRunning = false; }
  })();
}

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();
  const url = new URL(req.url);
  const roomId = url.searchParams.get("roomId") || "";
  const index = await readIndex();
  if (!roomId) return NextResponse.json({ rooms: index.rooms.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), agents: publicAgents(), defaultModel: CHAT_MODEL, maxRounds: ROUNDTABLE_MAX_ROUNDS });
  const room = index.rooms.find((r) => r.id === roomId);
  if (!room) return NextResponse.json({ error: "Room tidak ditemukan." }, { status: 404 });
  const store = await readRoom(roomId);
  const pending = store.messages.some((m) => m.pending);
  if (pending) await kickWorker();
  return NextResponse.json({ room, messages: store.messages, pending, agents: publicAgents(), maxRounds: ROUNDTABLE_MAX_ROUNDS });
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "send");
  const index = await readIndex();

  if (action === "create-room") {
    const participants = normalizeAgents(body?.participants);
    const room: GroupRoom = {
      id: id("grp"),
      title: String(body?.title || "Group Chat").slice(0, 80),
      participants,
      model: String(body?.model || CHAT_MODEL),
      mode: normalizeMode(body?.mode),
      maxRounds: normalizeRounds(body?.maxRounds),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    index.rooms.unshift(room); await saveIndex(index); await saveRoom({ roomId: room.id, messages: [] });
    return NextResponse.json({ room, messages: [] });
  }

  const roomId = String(body?.roomId || "");
  const room = index.rooms.find((r) => r.id === roomId);
  if (!room) return NextResponse.json({ error: "Room tidak ditemukan." }, { status: 404 });
  const prompt = String(body?.message || "").trim();
  if (!prompt) return NextResponse.json({ error: "Pesan kosong." }, { status: 400 });
  const participants = normalizeAgents(body?.participants?.length ? body.participants : room.participants);
  const model = /^[A-Za-z0-9._\/-]{1,80}$/.test(String(body?.model || "")) ? String(body.model) : room.model;
  const mode = normalizeMode(body?.mode, room.mode);
  const maxRounds = normalizeRounds(body?.maxRounds, room.maxRounds);
  const store = await readRoom(room.id);
  const userMessage: GroupMessage = { id: id("msg"), role: "user", content: prompt, createdAt: nowIso() };
  store.messages.push(userMessage);
  const jobs = await readJobs();

  if (mode === "roundtable") {
    if (participants.length < 2) {
      return NextResponse.json({ error: "Roundtable butuh minimal 2 agent." }, { status: 400 });
    }
    const discussionId = id("disc");
    // Only round 1 is queued here. Later rounds are appended by
    // advanceRoundtable() after the stop rules are evaluated.
    for (const agentId of participants) {
      const assistantId = id("msg");
      store.messages.push({
        id: assistantId, role: "assistant", agent: agentId, name: AGENTS[agentId].name,
        content: "", pending: true, createdAt: nowIso(), model,
        round: 1, kind: "turn", discussionId,
      });
      jobs.jobs.push({
        id: id("gjob"), roomId: room.id, assistantId, agent: agentId, prompt, model,
        status: "pending", attempts: 0, createdAt: nowIso(), updatedAt: nowIso(),
        kind: "turn", round: 1, discussionId,
      });
    }
  } else {
    for (const agentId of participants) {
      const assistantId = id("msg");
      store.messages.push({ id: assistantId, role: "assistant", agent: agentId, name: AGENTS[agentId].name, content: "", pending: true, createdAt: nowIso(), model, kind: "turn" });
      jobs.jobs.push({ id: id("gjob"), roomId: room.id, assistantId, agent: agentId, prompt, model, status: "pending", attempts: 0, createdAt: nowIso(), updatedAt: nowIso(), kind: "reply" });
    }
  }

  room.participants = participants;
  room.model = model;
  room.mode = mode;
  room.maxRounds = maxRounds;
  room.updatedAt = nowIso();
  if (room.title === "Group Chat" && prompt.length > 0) room.title = prompt.slice(0, 60);
  await saveIndex(index); await saveRoom(store); await saveJobs(jobs); await kickWorker();
  return NextResponse.json({ room, messages: store.messages, pending: true });
}
