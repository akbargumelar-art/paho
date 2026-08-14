import { NextResponse } from "next/server";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";

import { getAuthSession, unauthorized } from "@/lib/api-auth";

type AgentId = "corla" | "oca" | "gadis" | "priska" | "bunga";
type ThreadStatus = "active" | "archived";

type ChatThread = {
  id: string;
  title: string;
  agentId: AgentId;
  projectId: string;
  status: ThreadStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

type ThreadStore = { threads: ChatThread[] };

const DATA_DIR = "/root/paho/data/web-chat";
const THREADS_PATH = path.join(DATA_DIR, "threads.json");

export const runtime = "nodejs";

function nowIso() { return new Date().toISOString(); }
function makeId() { return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
function safePathPart(value: string) { return value.toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").slice(0, 80) || "none"; }
function normalizeAgent(value: unknown): AgentId {
  const raw = String(value || "corla").toLowerCase();
  if (["corla", "oca", "gadis", "priska", "bunga"].includes(raw)) return raw as AgentId;
  return "corla";
}
function normalizeProject(value: unknown) {
  const raw = String(value || "none").trim();
  return raw && raw !== "null" && raw !== "undefined" ? raw : "none";
}
function normalizeStatus(value: unknown): ThreadStatus {
  return String(value || "active").toLowerCase() === "archived" ? "archived" : "active";
}
function cleanTitle(value: unknown) { return String(value || "Chat baru").trim().slice(0, 120) || "Chat baru"; }

function normalizeThread(thread: Partial<ChatThread>): ChatThread {
  const timestamp = nowIso();
  return {
    id: String(thread.id || makeId()),
    title: cleanTitle(thread.title),
    agentId: normalizeAgent(thread.agentId),
    projectId: normalizeProject(thread.projectId),
    status: normalizeStatus(thread.status),
    createdAt: String(thread.createdAt || timestamp),
    updatedAt: String(thread.updatedAt || thread.createdAt || timestamp),
    archivedAt: thread.archivedAt,
  };
}

async function readStore(): Promise<ThreadStore> {
  try {
    const raw = await readFile(THREADS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<ThreadStore>;
    return { threads: Array.isArray(parsed.threads) ? parsed.threads.map(normalizeThread) : [] };
  } catch { return { threads: [] }; }
}
async function saveStore(store: ThreadStore) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(THREADS_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();
  const url = new URL(req.url);
  const agentId = normalizeAgent(url.searchParams.get("agent"));
  const projectId = normalizeProject(url.searchParams.get("projectId"));
  const includeArchived = url.searchParams.get("includeArchived") === "true";
  const store = await readStore();
  const threads = store.threads
    .filter((thread) => thread.agentId === agentId && thread.projectId === projectId)
    .filter((thread) => includeArchived || thread.status !== "archived")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return NextResponse.json({ threads });
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const timestamp = nowIso();
  const thread: ChatThread = {
    id: makeId(),
    title: cleanTitle(body?.title),
    agentId: normalizeAgent(body?.agent),
    projectId: normalizeProject(body?.projectId),
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const store = await readStore();
  const next = { threads: [thread, ...store.threads].slice(0, 500) };
  await saveStore(next);
  return NextResponse.json({ thread, threads: next.threads });
}

export async function PUT(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "").trim();
  if (!id) return NextResponse.json({ error: "Thread id wajib diisi." }, { status: 400 });
  const store = await readStore();
  let found: ChatThread | null = null;
  const threads = store.threads.map((thread) => {
    if (thread.id !== id) return thread;
    const nextStatus = body?.status === undefined ? thread.status : normalizeStatus(body?.status);
    found = {
      ...thread,
      title: body?.title === undefined ? thread.title : cleanTitle(body?.title),
      status: nextStatus,
      archivedAt: nextStatus === "archived" ? thread.archivedAt || nowIso() : undefined,
      updatedAt: nowIso(),
    };
    return found;
  });
  if (!found) return NextResponse.json({ error: "Chat tidak ditemukan." }, { status: 404 });
  await saveStore({ threads });
  return NextResponse.json({ thread: found, threads });
}

export async function DELETE(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();
  const url = new URL(req.url);
  const id = String(url.searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Thread id wajib diisi." }, { status: 400 });

  const store = await readStore();
  const target = store.threads.find((thread) => thread.id === id);
  if (!target) return NextResponse.json({ error: "Chat tidak ditemukan." }, { status: 404 });

  const threads = store.threads.filter((thread) => thread.id !== id);
  await saveStore({ threads });
  await rm(path.join(DATA_DIR, "threads", `${safePathPart(id)}.json`), { force: true }).catch(() => undefined);
  return NextResponse.json({ ok: true, thread: target, threads });
}
