import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { getAuthSession, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const DATA_DIR = "/root/paho/data/web-chat";
const GROUP_DIR = path.join(DATA_DIR, "group-rooms");
const INDEX_PATH = path.join(DATA_DIR, "group-rooms.json");
const JOBS_PATH = path.join(DATA_DIR, "group-jobs.json");
const HERMES_BIN = "/root/.local/bin/hermes";
const CHAT_MODEL = process.env.PAHO_CHAT_MODEL || "hermes";

type AgentId = "corla" | "oca" | "gadis" | "priska" | "bunga";
type GroupRoom = { id: string; title: string; participants: AgentId[]; model: string; createdAt: string; updatedAt: string };
type GroupIndex = { rooms: GroupRoom[] };
type GroupMessage = { id: string; role: "user" | "assistant"; agent?: AgentId; name?: string; content: string; createdAt: string; pending?: boolean; error?: boolean; model?: string };
type GroupStore = { roomId: string; messages: GroupMessage[] };
type GroupJob = { id: string; roomId: string; assistantId: string; agent: AgentId; prompt: string; model: string; status: "pending" | "running" | "done" | "error"; attempts: number; createdAt: string; updatedAt: string };
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

async function ensureDirs() { await mkdir(GROUP_DIR, { recursive: true }); }
async function readJson<T>(file: string, fallback: T): Promise<T> { try { return JSON.parse(await readFile(file, "utf8")) as T; } catch { return fallback; } }
async function writeJson(file: string, data: unknown) { await ensureDirs(); await writeFile(file, JSON.stringify(data, null, 2)); }
async function readIndex(): Promise<GroupIndex> { return readJson(INDEX_PATH, { rooms: [] }); }
async function saveIndex(data: GroupIndex) { await writeJson(INDEX_PATH, data); }
async function roomPath(roomId: string) { return path.join(GROUP_DIR, `${roomId}.json`); }
async function readRoom(roomId: string): Promise<GroupStore> { return readJson(await roomPath(roomId), { roomId, messages: [] }); }
async function saveRoom(store: GroupStore) { await writeJson(await roomPath(store.roomId), store); }
async function readJobs(): Promise<JobStore> { return readJson(JOBS_PATH, { jobs: [] }); }
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
function publicAgents() { return Object.values(AGENTS).map(({ id, name }) => ({ id, name })); }
function clamp(text: string, max = 1800) { return text.length <= max ? text : `${text.slice(0, max)}\n[...dipotong...]`; }

function buildPrompt(agent: AgentConfig, room: GroupRoom, history: GroupMessage[], prompt: string) {
  const recent = history.slice(-16).map((m) => {
    const speaker = m.role === "user" ? "abay" : (m.name || m.agent || "agent");
    return `${speaker}: ${clamp(m.content, 900)}`;
  }).join("\n\n");
  const peers = room.participants.filter((p) => p !== agent.id).map((p) => AGENTS[p].name).join(", ") || "-";
  return [
    agent.systemPrompt,
    "",
    "Kamu sedang berada di Group Chat Paho bersama agent lain. Jangan mengaku sudah menjalankan aksi backend kecuali memang ada tool/API yang menjalankannya.",
    `Peserta lain: ${peers}. Jawab sebagai ${agent.name}, maksimal 3 paragraf pendek. Bila tidak relevan untuk domainmu, bilang singkat dan beri perspektif seperlunya.`,
    "",
    "Riwayat terbaru:",
    recent || "(belum ada)",
    "",
    `Pesan terbaru dari abay: ${prompt}`,
  ].join("\n");
}

async function askHermes(agent: AgentConfig, prompt: string, model: string, onPartial: (text: string) => void) {
  const args = ["chat", "-q", prompt, "-m", model || CHAT_MODEL, "-Q"];
  if (agent.profile) args.unshift("--profile", agent.profile);
  let output = "";
  let stderr = "";
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(HERMES_BIN, args, { env: { ...process.env, HOME: "/root" }, stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error("Timeout > 180s")); }, 180_000);
    child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); if (output.length > 120_000) output = output.slice(-120_000); onPartial(output.trim()); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); if (stderr.length > 20_000) stderr = stderr.slice(-20_000); });
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => { clearTimeout(timer); const text = output.trim(); if (code === 0 && text) resolve(text); else reject(new Error(stderr.trim() || `Hermes exit ${code}`)); });
  });
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
        let flush = Promise.resolve();
        try {
          const answer = await askHermes(agent, buildPrompt(agent, room, store.messages, job.prompt), job.model, (partial) => {
            assistant.content = partial;
            assistant.pending = true;
            flush = flush.then(() => saveRoom(store)).catch(() => undefined);
          });
          await flush;
          assistant.content = answer;
          assistant.pending = false;
          assistant.error = false;
          await saveRoom(store);
          job.status = "done"; job.updatedAt = nowIso(); await saveJobs(jobs);
        } catch (error) {
          assistant.content = `Maaf, ${agent.name} gagal menjawab: ${(error as Error).message}`;
          assistant.pending = false;
          assistant.error = true;
          await saveRoom(store);
          job.status = "error"; job.updatedAt = nowIso(); await saveJobs(jobs);
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
  if (!roomId) return NextResponse.json({ rooms: index.rooms.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), agents: publicAgents(), defaultModel: CHAT_MODEL });
  const room = index.rooms.find((r) => r.id === roomId);
  if (!room) return NextResponse.json({ error: "Room tidak ditemukan." }, { status: 404 });
  const store = await readRoom(roomId);
  const pending = store.messages.some((m) => m.pending);
  if (pending) await kickWorker();
  return NextResponse.json({ room, messages: store.messages, pending, agents: publicAgents() });
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "send");
  const index = await readIndex();

  if (action === "create-room") {
    const participants = normalizeAgents(body?.participants);
    const room: GroupRoom = { id: id("grp"), title: String(body?.title || "Group Chat").slice(0, 80), participants, model: String(body?.model || CHAT_MODEL), createdAt: nowIso(), updatedAt: nowIso() };
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
  const store = await readRoom(room.id);
  const userMessage: GroupMessage = { id: id("msg"), role: "user", content: prompt, createdAt: nowIso() };
  store.messages.push(userMessage);
  const jobs = await readJobs();
  for (const agentId of participants) {
    const assistantId = id("msg");
    store.messages.push({ id: assistantId, role: "assistant", agent: agentId, name: AGENTS[agentId].name, content: "", pending: true, createdAt: nowIso(), model });
    jobs.jobs.push({ id: id("gjob"), roomId: room.id, assistantId, agent: agentId, prompt, model, status: "pending", attempts: 0, createdAt: nowIso(), updatedAt: nowIso() });
  }
  room.participants = participants;
  room.model = model;
  room.updatedAt = nowIso();
  if (room.title === "Group Chat" && prompt.length > 0) room.title = prompt.slice(0, 60);
  await saveIndex(index); await saveRoom(store); await saveJobs(jobs); await kickWorker();
  return NextResponse.json({ room, messages: store.messages, pending: true });
}
