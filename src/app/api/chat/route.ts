import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { extractAndSaveChatAttachments } from "@/lib/chat-attachments";
import type { ChatAttachment } from "@/lib/chat-attachments";
import {
  buildProjectIndex,
  deleteThreadSummary,
  formatProjectMemory,
  formatRetrievedContext,
  mergeMemory,
  makeThreadSummary,
  needsSummarization,
  parseMemoryExtraction,
  readIndex,
  readProjectMemory,
  readThreadSummary,
  retrieveChunks,
  saveProjectMemory,
  saveThreadSummary,
} from "@/lib/memory-layer";
import type { ProjectMemory, ThreadSummary } from "@/lib/memory-layer";

type AgentId = "corla" | "oca" | "gadis" | "priska" | "bunga";
type ProjectDomain = "general" | "work" | "personal" | "business";
type ProjectStatus = "active" | "archived";
type ThreadStatus = "active" | "archived";

type UploadedFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  path: string;
  uploadedAt: string;
  extractedChars: number;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  attachments?: ChatAttachment[];
};

type ChatStore = {
  messages: ChatMessage[];
};

type ChatProject = {
  id: string;
  title: string;
  domain: ProjectDomain;
  status?: ProjectStatus;
  instruction: string;
  knowledge: string;
  uploadedFiles?: UploadedFile[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

type ProjectStore = {
  projects: ChatProject[];
};

type ChatThread = {
  id: string;
  title: string;
  agentId: AgentId;
  projectId: string;
  status?: ThreadStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

type ThreadStore = { threads: ChatThread[] };

type AgentConfig = {
  id: AgentId;
  name: string;
  label: string;
  domain: string;
  tone: string;
  profile?: string;
  systemPrompt: string;
};

const AGENTS: Record<AgentId, AgentConfig> = {
  corla: {
    id: "corla",
    name: "Corla",
    label: "Core coordinator",
    domain: "Lintas domain",
    tone: "text-hermes",
    systemPrompt:
      "Kamu adalah Corla / Aspri Abay, orchestrator utama untuk Abay. Boleh menjawab lintas domain Work, Personal, dan Bisnis. Bahasa Indonesia ringkas, jelas, panggil user 'abay'. Untuk aksi sensitif, report dulu lalu minta approval.",
  },
  oca: {
    id: "oca",
    name: "Oca",
    label: "OpenClaw support",
    domain: "Backend worker support",
    tone: "text-openclaw",
    systemPrompt:
      "Kamu adalah Oca, representasi OpenClaw support/backend worker di web chat Paho. Mode ini hanya tanya-jawab dan perencanaan, bukan eksekusi otomatis. Fokus pada backend, automation, node, gateway, monitoring, dan kerja berat. Arahkan keputusan user-facing kembali ke Corla/Hermes.",
  },
  gadis: {
    id: "gadis",
    name: "Gadis",
    label: "Work Agrabudi",
    domain: "Work / Agrabudi / Telkostore",
    tone: "text-blue-500",
    profile: "gadis",
    systemPrompt:
      "Kamu adalah Gadis, agent domain Work. Jawab hanya konteks kerja PT Agrabudi Komunika, Telkostore, KPI/support/reporting kerja, dan task/reminder kerja. Jika permintaan masuk Personal atau Bisnis non-work, tolak singkat dan arahkan ke Priska/Bunga/Corla. Bahasa Indonesia ringkas, panggil user 'abay'.",
  },
  priska: {
    id: "priska",
    name: "Priska",
    label: "Personal",
    domain: "Personal",
    tone: "text-rose-500",
    profile: "priska",
    systemPrompt:
      "Kamu adalah Priska, agent domain Personal. Jawab hanya konteks personal, rumah tangga, agenda pribadi, pengingat pribadi, dan finance pribadi. Jika permintaan Work atau Bisnis non-personal, tolak singkat dan arahkan ke Gadis/Bunga/Corla. Bahasa Indonesia ringkas, panggil user 'abay'.",
  },
  bunga: {
    id: "bunga",
    name: "Bunga",
    label: "Business / SJNet",
    domain: "Bisnis non-work / SJNet",
    tone: "text-emerald-500",
    profile: "bunga",
    systemPrompt:
      "Kamu adalah Bunga, agent domain Bisnis. Jawab hanya konteks bisnis/project non-work seperti SJNet, peluang usaha, project planning, dan operasional bisnis non-Agrabudi. Jika permintaan Work atau Personal, tolak singkat dan arahkan ke Gadis/Priska/Corla. Bahasa Indonesia ringkas, panggil user 'abay'.",
  },
};

const DATA_DIR = "/root/paho/data/web-chat";
const PROJECTS_PATH = path.join(DATA_DIR, "projects.json");
const THREADS_PATH = path.join(DATA_DIR, "threads.json");
const CHAT_MODEL = process.env.PAHO_CHAT_MODEL || "hermes";
const HERMES_BIN = process.env.PAHO_HERMES_BIN || "/root/.local/bin/hermes";
const execFileAsync = promisify(execFile);

export const runtime = "nodejs";

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeAgent(value: unknown): AgentId {
  const raw = String(value || "corla").toLowerCase().trim();
  if (raw === "ocla") return "oca";
  if (raw in AGENTS) return raw as AgentId;
  return "corla";
}

function normalizeProjectId(value: unknown) {
  const raw = String(value || "none").trim();
  return raw && raw !== "null" && raw !== "undefined" ? raw : "none";
}

function safePathPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").slice(0, 80) || "none";
}

function normalizeThreadId(value: unknown) {
  const raw = String(value || "").trim();
  return raw && raw !== "null" && raw !== "undefined" ? raw : "";
}

function normalizeProject(project: ChatProject): ChatProject {
  return {
    ...project,
    status: project.status === "archived" ? "archived" : "active",
    uploadedFiles: Array.isArray(project.uploadedFiles) ? project.uploadedFiles : [],
  };
}

function normalizeThread(thread: ChatThread): ChatThread {
  return { ...thread, status: thread.status === "archived" ? "archived" : "active" };
}

function storePath(agentId: AgentId, projectId = "none", threadId = "") {
  if (threadId) return path.join(DATA_DIR, "threads", `${safePathPart(threadId)}.json`);
  const suffix = projectId === "none" ? agentId : `${agentId}__${safePathPart(projectId)}`;
  return path.join(DATA_DIR, `${suffix}.json`);
}

async function readThreads(): Promise<ThreadStore> {
  try {
    const raw = await readFile(THREADS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<ThreadStore>;
    return { threads: Array.isArray(parsed.threads) ? parsed.threads.map((thread) => normalizeThread(thread as ChatThread)) : [] };
  } catch {
    return { threads: [] };
  }
}

async function saveThreads(store: ThreadStore) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(THREADS_PATH, JSON.stringify({ threads: store.threads.slice(0, 500) }, null, 2), "utf8");
}

async function ensureThread(agentId: AgentId, projectId: string, threadId: string, fallbackTitle: string) {
  const store = await readThreads();
  const found = store.threads.find((thread) => thread.id === threadId);
  if (found) return found;
  const timestamp = nowIso();
  const created: ChatThread = {
    id: threadId || `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title: fallbackTitle.trim().slice(0, 80) || "Chat baru",
    agentId,
    projectId,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await saveThreads({ threads: [created, ...store.threads] });
  return created;
}

async function touchThread(threadId: string, titleFromPrompt?: string) {
  if (!threadId) return null;
  const store = await readThreads();
  let updated: ChatThread | null = null;
  const threads = store.threads.map((thread) => {
    if (thread.id !== threadId) return thread;
    const shouldAutotitle = thread.title === "Chat baru" || thread.title.startsWith("Chat ");
    updated = {
      ...thread,
      title: shouldAutotitle && titleFromPrompt ? titleFromPrompt.trim().slice(0, 80) : thread.title,
      updatedAt: nowIso(),
    };
    return updated;
  });
  if (updated) await saveThreads({ threads });
  return updated;
}

async function readProjects(): Promise<ProjectStore> {
  try {
    const raw = await readFile(PROJECTS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<ProjectStore>;
    return { projects: Array.isArray(parsed.projects) ? parsed.projects.map((project) => normalizeProject(project as ChatProject)) : [] };
  } catch {
    return { projects: [] };
  }
}

async function findProject(projectId: string) {
  if (projectId === "none") return null;
  const store = await readProjects();
  return store.projects.find((project) => project.id === projectId && project.status !== "archived") || null;
}

async function readStore(agentId: AgentId, projectId = "none", threadId = ""): Promise<ChatStore> {
  try {
    const raw = await readFile(storePath(agentId, projectId, threadId), "utf8");
    const parsed = JSON.parse(raw) as Partial<ChatStore>;
    return { messages: Array.isArray(parsed.messages) ? parsed.messages : [] };
  } catch {
    return { messages: [] };
  }
}

async function saveStore(agentId: AgentId, projectId: string, threadId: string, store: ChatStore) {
  const target = storePath(agentId, projectId, threadId);
  await mkdir(path.dirname(target), { recursive: true });
  const compact: ChatStore = { messages: store.messages.slice(-200) };
  await writeFile(target, JSON.stringify(compact, null, 2), "utf8");
}

function publicAgents() {
  return Object.values(AGENTS).map(({ id, name, label, domain, tone }) => ({ id, name, label, domain, tone }));
}

function publicProject(project: ChatProject | null) {
  if (!project) return null;
  const { id, title, domain, status, instruction, knowledge, uploadedFiles, createdAt, updatedAt, archivedAt } = normalizeProject(project);
  return { id, title, domain, status, instruction, knowledge, uploadedFiles, createdAt, updatedAt, archivedAt };
}

function clampText(value: string, max: number) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[...dipotong ${text.length - max} karakter agar prompt tetap ringan...]`;
}

async function buildPrompt(agent: AgentConfig, project: ChatProject | null, history: ChatMessage[], prompt: string, threadId = "") {
  const intro = [
    agent.systemPrompt,
    "",
    "Konteks UI: ini adalah web chat Paho yang dikelompokkan berdasarkan Agent Map. Mode ini fokus chat biasa; jangan klaim sudah menjalankan tool/backend kecuali memang eksplisit tersedia di chat ini.",
    "Jawab natural seperti Claude/AI chat umum: langsung, jelas, tidak bertele-tele.",
    "Jika user meminta file yang bisa di-download, sertakan isi file dalam blok: ```file: nama-file.ext\\nISI FILE\\n``` . Paho akan otomatis membuat attachment download dari blok itu. Jangan hanya menyimpan file ke path VPS.",
  ];

  if (project) {
    let index = await readIndex(project.id);
    if (!index) {
      index = await buildProjectIndex(project.id, {
        instruction: project.instruction,
        knowledge: project.knowledge,
        uploadedFiles: project.uploadedFiles,
      });
    }
    const memory = await readProjectMemory(project.id);
    const retrieved = retrieveChunks(index, prompt);
    intro.push(
      "",
      "=== PROJECT CONTEXT AKTIF ===",
      `Nama project: ${project.title}`,
      `Domain project: ${project.domain}`,
      "Memory project tersimpan:",
      formatProjectMemory(memory),
      "Konteks yang diambil karena relevan dengan pertanyaan ini:",
      formatRetrievedContext(retrieved),
      "=== END PROJECT CONTEXT ==="
    );
  }

  const summary = threadId ? await readThreadSummary(threadId) : null;
  if (summary?.summary) {
    intro.push("", "Ringkasan riwayat percakapan sebelumnya:", clampText(summary.summary, 2_500));
  }

  intro.push("", "Pesan terakhir percakapan ini:");

  const recent = history.slice(-8).flatMap((m) => [
    `${m.role === "user" ? "User" : agent.name}:`,
    clampText(m.content, 1_500),
    "",
  ]);

  return [...intro, ...recent, "Pesan baru dari user:", prompt].join("\n");
}

function cleanHermesOutput(raw: string) {
  const lines = raw
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (trimmed.startsWith("Warning: Unknown toolsets:")) return false;
      if (trimmed.startsWith("session_id:")) return false;
      if (trimmed.startsWith("Query:")) return false;
      if (trimmed === "Initializing agent...") return false;
      if (trimmed.startsWith("Resume this session with:")) return false;
      if (trimmed.startsWith("hermes --resume")) return false;
      if (trimmed.startsWith("hermes -c ")) return false;
      if (/^[─╭╰│]/.test(trimmed)) return false;
      return true;
    });
  return lines.join("\n").trim();
}

async function askHermes(agent: AgentConfig, prompt: string) {
  const args = ["chat", "-q", prompt, "-m", CHAT_MODEL, "-Q"];
  if (agent.profile) {
    args.unshift("--profile", agent.profile);
  }

  try {
    const { stdout, stderr } = await execFileAsync(HERMES_BIN, args, {
      timeout: 240_000,
      maxBuffer: 1024 * 1024 * 2,
      env: {
        ...process.env,
        PATH: `/root/.nvm/versions/node/v24.19.0/bin:${process.env.PATH || ""}`,
      },
    });

    const text = cleanHermesOutput(stdout || stderr || "");
    if (!text) throw new Error("Hermes tidak mengembalikan jawaban.");
    return text;
  } catch (error) {
    const err = error as Error & { stdout?: string; stderr?: string; signal?: string; killed?: boolean };
    const stderr = cleanHermesOutput(err.stderr || err.stdout || "");
    if (err.killed || err.signal === "SIGTERM") {
      throw new Error("Agent terlalu lama menjawab. Coba ringkas context project atau pecah file context menjadi lebih kecil.");
    }
    if (stderr) {
      throw new Error(clampText(stderr, 800));
    }
    throw new Error("Hermes gagal memproses chat project.");
  }
}

const MEMORY_EXTRACT_EVERY = 6;

function shouldExtractMemory(messageCount: number, memory: ProjectMemory) {
  const lastCount = Number((memory as ProjectMemory & { lastExtractCount?: number }).lastExtractCount || 0);
  return messageCount - lastCount >= MEMORY_EXTRACT_EVERY;
}

/**
 * Fire-and-forget memory extraction: reads recent conversation, asks Hermes for
 * a compact JSON memory delta, then merges it into project memory.
 */
function extractProjectMemoryInBackground(agent: AgentConfig, projectId: string, messages: ChatMessage[]) {
  const transcript = messages
    .slice(-12)
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${clampText(message.content, 700)}`)
    .join("\n");

  const prompt = [
    "Tugas kamu HANYA mengekstrak memory project dari percakapan berikut.",
    "Balas HANYA JSON valid tanpa penjelasan tambahan, dengan bentuk:",
    '{"summary": "...", "facts": ["..."], "decisions": ["..."], "todos": ["..."], "preferences": ["..."]}',
    "Aturan:",
    "- summary maksimal 3 kalimat.",
    "- facts hanya fakta teknis/keputusan konkret yang stabil.",
    "- decisions hanya keputusan final yang disepakati.",
    "- todos hanya tugas yang belum selesai.",
    "- preferences hanya preferensi gaya kerja/komunikasi user.",
    "- Jika sebuah kategori tidak ada isinya, kembalikan array kosong.",
    "",
    "Percakapan:",
    transcript,
  ].join("\n");

  const args = agent.profile
    ? ["--profile", agent.profile, "chat", "-q", prompt, "-m", CHAT_MODEL, "-Q"]
    : ["chat", "-q", prompt, "-m", CHAT_MODEL, "-Q"];

  const child = execFile(
    HERMES_BIN,
    args,
    {
      timeout: 180_000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, PATH: `/root/.nvm/versions/node/v24.19.0/bin:${process.env.PATH || ""}` },
    },
    async (error, stdout, stderr) => {
      if (error) return;
      const parsed = parseMemoryExtraction(cleanHermesOutput(stdout || stderr || ""));
      if (!parsed || Object.keys(parsed).length === 0) return;
      try {
        const previous = await readProjectMemory(projectId);
        const merged = mergeMemory(previous, parsed) as ProjectMemory & { lastExtractCount?: number };
        merged.lastExtractCount = messages.length;
        merged.lastSummarizedAt = nowIso();
        await saveProjectMemory(merged);
      } catch {
        // memory extraction must never break the chat flow
      }
    }
  );
  child.unref?.();
}

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const url = new URL(req.url);
  const agentId = normalizeAgent(url.searchParams.get("agent"));
  const projectId = normalizeProjectId(url.searchParams.get("projectId"));
  const threadId = normalizeThreadId(url.searchParams.get("threadId"));
  const agent = AGENTS[agentId];
  const project = await findProject(projectId);
  const activeProjectId = project?.id || "none";
  const store = await readStore(agentId, activeProjectId, threadId);

  return NextResponse.json({
    agent: { id: agent.id, name: agent.name, label: agent.label, domain: agent.domain, tone: agent.tone },
    project: publicProject(project),
    projectId: activeProjectId,
    threadId: threadId || null,
    agents: publicAgents(),
    messages: store.messages,
    model: CHAT_MODEL,
    backend: agent.profile ? `hermes-profile:${agent.profile}` : "hermes-cli",
  });
}

export async function DELETE(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const url = new URL(req.url);
  const agentId = normalizeAgent(url.searchParams.get("agent"));
  const projectId = normalizeProjectId(url.searchParams.get("projectId"));
  const threadId = normalizeThreadId(url.searchParams.get("threadId"));
  const project = await findProject(projectId);
  await saveStore(agentId, project?.id || "none", threadId, { messages: [] });
  return NextResponse.json({ ok: true, agent: AGENTS[agentId].name, project: publicProject(project), threadId: threadId || null });
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const agentId = normalizeAgent(body?.agent);
  const projectId = normalizeProjectId(body?.projectId);
  let threadId = normalizeThreadId(body?.threadId);
  const agent = AGENTS[agentId];
  const project = await findProject(projectId);
  const prompt = String(body?.message || "").trim();

  if (projectId !== "none" && !project) return NextResponse.json({ error: "Project tidak ditemukan." }, { status: 404 });
  if (!prompt) return NextResponse.json({ error: "Pesan kosong." }, { status: 400 });
  if (prompt.length > 8000) return NextResponse.json({ error: "Pesan terlalu panjang." }, { status: 400 });

  const activeProjectId = project?.id || "none";
  if (!threadId) {
    const thread = await ensureThread(agentId, activeProjectId, "", prompt);
    threadId = thread.id;
  } else {
    await ensureThread(agentId, activeProjectId, threadId, prompt);
  }
  const store = await readStore(agentId, activeProjectId, threadId);
  const userMessage: ChatMessage = {
    id: id(),
    role: "user",
    content: prompt,
    createdAt: nowIso(),
  };

  try {
    const promptWithContext = await buildPrompt(agent, project, store.messages, prompt, threadId);
    const reply = await askHermes(agent, promptWithContext);
    const attachmentResult = await extractAndSaveChatAttachments(reply, { projectId: activeProjectId, threadId });
    const assistantMessage: ChatMessage = {
      id: id(),
      role: "assistant",
      content: attachmentResult.content,
      createdAt: nowIso(),
      attachments: attachmentResult.attachments,
    };

    const nextMessages = [...store.messages, userMessage, assistantMessage];
    await saveStore(agentId, activeProjectId, threadId, { messages: nextMessages });
    const thread = await touchThread(threadId, prompt);

    // Summarization trigger
    const summary = await readThreadSummary(threadId);
    if (needsSummarization(nextMessages.length, summary)) {
      const newSummary: ThreadSummary = {
        threadId,
        summary: makeThreadSummary(nextMessages),
        messageCount: nextMessages.length,
        generatedAt: nowIso(),
      };
      await saveThreadSummary(newSummary);
      // Keep memory compact by deleting old ones after new saved
      await deleteThreadSummary(threadId).catch(() => undefined);
      await saveThreadSummary(newSummary);
    }

    if (project) {
      const memory = await readProjectMemory(activeProjectId);
      if (shouldExtractMemory(nextMessages.length, memory)) {
        extractProjectMemoryInBackground(agent, activeProjectId, nextMessages);
      }
    }

    return NextResponse.json({
      ok: true,
      agent: { id: agent.id, name: agent.name, label: agent.label, domain: agent.domain, tone: agent.tone },
      project: publicProject(project),
      projectId: activeProjectId,
      threadId,
      thread,
      message: assistantMessage,
      messages: nextMessages.slice(-200),
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
