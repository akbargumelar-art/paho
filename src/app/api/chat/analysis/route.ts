import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { execFile } from "child_process";

import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { formatProjectMemory, readIndex, readProjectMemory } from "@/lib/memory-layer";

export const runtime = "nodejs";

type JobStatus = "queued" | "running" | "done" | "error";

type AnalysisJob = {
  id: string;
  projectId: string;
  question: string;
  status: JobStatus;
  result?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

const DATA_DIR = "/root/paho/data/web-chat";
const JOBS_DIR = path.join(DATA_DIR, "analysis-jobs");
const HERMES_BIN = process.env.PAHO_HERMES_BIN || "/root/.local/bin/hermes";
const CHAT_MODEL = process.env.PAHO_CHAT_MODEL || "hermes";

function safeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").slice(0, 80) || "job";
}

function jobPath(jobId: string) {
  return path.join(JOBS_DIR, `${safeId(jobId)}.json`);
}

async function saveJob(job: AnalysisJob) {
  await mkdir(JOBS_DIR, { recursive: true });
  await writeFile(jobPath(job.id), JSON.stringify(job, null, 2), "utf8");
}

async function loadJob(jobId: string): Promise<AnalysisJob | null> {
  try {
    return JSON.parse(await readFile(jobPath(jobId), "utf8")) as AnalysisJob;
  } catch {
    return null;
  }
}

function cleanOutput(raw: string) {
  return raw
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("Warning: Unknown toolsets:")) return false;
      if (trimmed.startsWith("session_id:")) return false;
      if (trimmed.startsWith("Resume this session with:")) return false;
      if (trimmed.startsWith("hermes --resume")) return false;
      return true;
    })
    .join("\n")
    .trim();
}

/**
 * Fire-and-forget deep analysis: uses the FULL project index instead of
 * only retrieved chunks, so it can take minutes without blocking the UI.
 */
function runAnalysis(job: AnalysisJob, prompt: string, profile?: string) {
  const args = profile
    ? ["--profile", profile, "chat", "-q", prompt, "-m", CHAT_MODEL, "-Q"]
    : ["chat", "-q", prompt, "-m", CHAT_MODEL, "-Q"];

  const child = execFile(
    HERMES_BIN,
    args,
    {
      timeout: 900_000,
      maxBuffer: 1024 * 1024 * 8,
      env: { ...process.env, PATH: `/root/.nvm/versions/node/v24.19.0/bin:${process.env.PATH || ""}` },
    },
    async (error, stdout, stderr) => {
      const finished: AnalysisJob = {
        ...job,
        status: error ? "error" : "done",
        result: error ? undefined : cleanOutput(stdout || stderr || ""),
        error: error ? cleanOutput(stderr || error.message).slice(0, 800) : undefined,
        updatedAt: new Date().toISOString(),
      };
      await saveJob(finished).catch(() => undefined);
    }
  );
  child.unref?.();
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId || "").trim();
  const question = String(body?.question || "").trim();
  const profile = body?.profile ? String(body.profile) : undefined;

  if (!projectId) return NextResponse.json({ error: "Project id wajib diisi." }, { status: 400 });
  if (!question) return NextResponse.json({ error: "Pertanyaan wajib diisi." }, { status: 400 });

  const index = await readIndex(projectId);
  if (!index) return NextResponse.json({ error: "Index project belum dibangun. Simpan project atau upload file dulu." }, { status: 400 });

  const memory = await readProjectMemory(projectId);
  const fullContext = index.chunks
    .map((chunk) => `[${chunk.sourceType}${chunk.sourceId ? `: ${chunk.sourceId}` : ""}]\n${chunk.text}`)
    .join("\n\n")
    .slice(0, 200_000);

  const prompt = [
    "Kamu menjalankan deep analysis untuk sebuah project di Paho.",
    "Gunakan SELURUH konteks project di bawah ini, bukan hanya sebagian.",
    "Jawab terstruktur, ringkas, dan berbasis fakta dari konteks.",
    "",
    "=== MEMORY PROJECT ===",
    formatProjectMemory(memory),
    "",
    "=== SELURUH KONTEKS PROJECT ===",
    fullContext,
    "=== END KONTEKS ===",
    "",
    "Pertanyaan analisis:",
    question,
  ].join("\n");

  const timestamp = new Date().toISOString();
  const job: AnalysisJob = {
    id: `analysis-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    projectId,
    question,
    status: "running",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await saveJob(job);
  runAnalysis(job, prompt, profile);

  return NextResponse.json({ ok: true, job, contextChars: fullContext.length });
}

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const url = new URL(req.url);
  const jobId = String(url.searchParams.get("jobId") || "").trim();
  if (!jobId) return NextResponse.json({ error: "Job id wajib diisi." }, { status: 400 });

  const job = await loadJob(jobId);
  if (!job) return NextResponse.json({ error: "Job tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ job });
}
