/**
 * Paho Memory Layer
 *
 * Fase 1–4: long-context support for Paho project chat.
 *
 * - Chunking & indexing of uploaded files / knowledge.
 * - Retrieval (keyword overlap) per query.
 * - Thread summarization (auto-summary every N messages).
 * - Persistent project memory (facts/decisions/todos/summary).
 * - Async deep analysis mode.
 */

import { mkdir, readFile, readdir, rm, stat, writeFile } from "fs/promises";
import path from "path";

// ── Types ───────────────────────────────────────────────

export type MemoryChunk = {
  id: string;
  sourceType: "instruction" | "knowledge" | "file" | "summary";
  sourceId?: string; // file name or "project"
  text: string;
  tokensEstimate: number;
  createdAt: string;
};

export type MemoryIndex = {
  projectId: string;
  chunks: MemoryChunk[];
  updatedAt: string;
};

export type ProjectMemory = {
  projectId: string;
  summary: string; // auto-generated thread summary
  facts: string[]; // key facts extracted from conversations
  decisions: string[]; // decisions made in this project
  todos: string[]; // open tasks
  preferences: string[]; // user preferences for this project
  lastSummarizedAt?: string;
  updatedAt: string;
};

export type ThreadSummary = {
  threadId: string;
  summary: string;
  messageCount: number;
  generatedAt: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export function clampText(value: string, max: number): string {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[...dipotong ${text.length - max} karakter agar prompt tetap ringan...]`;
}

// ── Constants ────────────────────────────────────────────

const DATA_DIR = "/root/paho/data/web-chat";
const MEMORY_DIR = path.join(DATA_DIR, "memory");
const INDEX_PATH = (projectId: string) => path.join(MEMORY_DIR, `${safeId(projectId)}-index.json`);
const MEMORY_PATH = (projectId: string) => path.join(MEMORY_DIR, `${safeId(projectId)}-memory.json`);
const SUMMARY_PATH = (threadId: string) => path.join(MEMORY_DIR, `${safeId(threadId)}-summary.json`);

const CHUNK_SIZE = 1200; // target chars per chunk
const CHUNK_OVERLAP = 150;
const MAX_RETRIEVED_CHUNKS = 6;
const SUMMARIZE_EVERY_N_MESSAGES = 8;

// ── Helpers ──────────────────────────────────────────────

function safeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").slice(0, 80) || "unknown";
}

function nowIso(): string {
  return new Date().toISOString();
}

function estimateTokens(text: string): number {
  // rough: ~4 chars per token for mixed Indonesian/English/code
  return Math.ceil(text.length / 4);
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Chunking ─────────────────────────────────────────────

/**
 * Split text into overlapping chunks.
 */
export function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length <= size) return [cleaned];

  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    let end = start + size;
    // try to break at paragraph boundary
    if (end < cleaned.length) {
      const nextPara = cleaned.indexOf("\n\n", end - 200);
      if (nextPara !== -1 && nextPara > start + size / 2) {
        end = nextPara;
      } else {
        const nextLine = cleaned.indexOf("\n", end - 100);
        if (nextLine !== -1 && nextLine > start + size / 2) {
          end = nextLine;
        }
      }
    }
    chunks.push(cleaned.slice(start, end).trim());
    if (end >= cleaned.length) break;
    start = end - overlap;
  }
  return chunks.filter((c) => c.length > 10);
}

/**
 * Build a memory index from project context.
 */
export async function buildProjectIndex(projectId: string, options: {
  instruction?: string;
  knowledge?: string;
  uploadedFiles?: Array<{ name: string; path: string; extractedChars: number }>;
}): Promise<MemoryIndex> {
  const chunks: MemoryChunk[] = [];

  // Instruction as one chunk
  if (options.instruction?.trim()) {
    chunks.push({
      id: `inst-${makeId()}`,
      sourceType: "instruction",
      sourceId: "project",
      text: options.instruction.trim(),
      tokensEstimate: estimateTokens(options.instruction),
      createdAt: nowIso(),
    });
  }

  // Knowledge chunks
  if (options.knowledge?.trim()) {
    const kChunks = chunkText(options.knowledge);
    for (const text of kChunks) {
      chunks.push({
        id: `know-${makeId()}`,
        sourceType: "knowledge",
        sourceId: "project",
        text,
        tokensEstimate: estimateTokens(text),
        createdAt: nowIso(),
      });
    }
  }

  // File content chunks (read actual uploaded files)
  if (options.uploadedFiles?.length) {
    const uploadDir = path.join(DATA_DIR, "uploads", safeId(projectId));
    for (const file of options.uploadedFiles) {
      try {
        const filePath = path.join(uploadDir, path.basename(file.path));
        const raw = await readFile(filePath, "utf8");
        const fChunks = chunkText(raw);
        for (const text of fChunks) {
          chunks.push({
            id: `file-${makeId()}`,
            sourceType: "file",
            sourceId: file.name,
            text,
            tokensEstimate: estimateTokens(text),
            createdAt: nowIso(),
          });
        }
      } catch {
        // file not readable — skip silently
      }
    }
  }

  const index: MemoryIndex = { projectId, chunks, updatedAt: nowIso() };
  await saveIndex(index);
  return index;
}

// ── Retrieval ───────────────────────────────────────────

/**
 * Simple keyword-based retrieval.
 * Scores by word overlap between query and chunk text.
 */
export function retrieveChunks(index: MemoryIndex, query: string, max = MAX_RETRIEVED_CHUNKS): MemoryChunk[] {
  const queryWords = new Set(
    query.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean)
  );

  if (queryWords.size === 0) {
    // no query words → return first few chunks (instruction + early knowledge)
    return index.chunks.slice(0, max);
  }

  const scored = index.chunks.map((chunk) => {
    const chunkWords = new Set(
      chunk.text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean)
    );
    let score = 0;
    for (const qw of queryWords) {
      if (chunkWords.has(qw)) score += 1;
    }
    // boost instruction and file sources slightly
    if (chunk.sourceType === "instruction") score += 0.5;
    if (chunk.sourceType === "file") score += 0.3;
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score > 0).slice(0, max).map((s) => s.chunk);
}

/**
 * Format retrieved chunks into a compact context block for the prompt.
 */
export function formatRetrievedContext(chunks: MemoryChunk[], maxChars = 6000): string {
  if (!chunks.length) return "(tidak ada konteks relevan ditemukan)";

  let output = "";
  let total = 0;
  for (const chunk of chunks) {
    const header = `[${chunk.sourceType}${chunk.sourceId ? `: ${chunk.sourceId}` : ""}]`;
    const block = `${header}\n${chunk.text}\n`;
    if (total + block.length > maxChars) {
      output += `\n[... ${chunks.length - output.split("\n[").length + 1} chunk lainnya dipotong ...]`;
      break;
    }
    output += block;
    total += block.length;
  }
  return output.trim();
}

// ── Index persistence ────────────────────────────────────

async function ensureDir() {
  await mkdir(MEMORY_DIR, { recursive: true });
}

async function saveIndex(index: MemoryIndex) {
  await ensureDir();
  await writeFile(INDEX_PATH(index.projectId), JSON.stringify(index, null, 2), "utf8");
}

export async function readIndex(projectId: string): Promise<MemoryIndex | null> {
  try {
    const raw = await readFile(INDEX_PATH(projectId), "utf8");
    return JSON.parse(raw) as MemoryIndex;
  } catch {
    return null;
  }
}

export async function deleteIndex(projectId: string): Promise<void> {
  try {
    await rm(INDEX_PATH(projectId), { force: true });
  } catch {
    // ignore
  }
}

// ── Project Memory (Fase 3) ──────────────────────────────

const DEFAULT_MEMORY: ProjectMemory = {
  projectId: "",
  summary: "",
  facts: [],
  decisions: [],
  todos: [],
  preferences: [],
  updatedAt: "",
};

export async function readProjectMemory(projectId: string): Promise<ProjectMemory> {
  try {
    const raw = await readFile(MEMORY_PATH(projectId), "utf8");
    const parsed = JSON.parse(raw) as Partial<ProjectMemory>;
    return { ...DEFAULT_MEMORY, ...parsed, projectId };
  } catch {
    return { ...DEFAULT_MEMORY, projectId, updatedAt: nowIso() };
  }
}

export async function saveProjectMemory(memory: ProjectMemory): Promise<void> {
  await ensureDir();
  memory.updatedAt = nowIso();
  await writeFile(MEMORY_PATH(memory.projectId), JSON.stringify(memory, null, 2), "utf8");
}

export async function deleteProjectMemory(projectId: string): Promise<void> {
  try {
    await rm(MEMORY_PATH(projectId), { force: true });
  } catch {
    // ignore
  }
}

/**
 * Format project memory into a compact prompt section.
 */
export function formatProjectMemory(memory: ProjectMemory, maxChars = 2000): string {
  const parts: string[] = [];

  if (memory.summary) parts.push(`Ringkasan project:\n${memory.summary}`);
  if (memory.facts.length) parts.push(`Fakta penting:\n${memory.facts.map((f) => `- ${f}`).join("\n")}`);
  if (memory.decisions.length) parts.push(`Keputusan:\n${memory.decisions.map((d) => `- ${d}`).join("\n")}`);
  if (memory.todos.length) parts.push(`Tugas terbuka:\n${memory.todos.map((t) => `- [ ] ${t}`).join("\n")}`);
  if (memory.preferences.length) parts.push(`Preferensi:\n${memory.preferences.map((p) => `- ${p}`).join("\n")}`);

  const joined = parts.join("\n\n");
  if (joined.length <= maxChars) return joined || "(belum ada memory project)";
  return `${joined.slice(0, maxChars)}\n\n[... memory dipotong ...]`;
}

// ── Thread Summarization (Fase 1) ────────────────────────

export async function readThreadSummary(threadId: string): Promise<ThreadSummary | null> {
  try {
    const raw = await readFile(SUMMARY_PATH(threadId), "utf8");
    return JSON.parse(raw) as ThreadSummary;
  } catch {
    return null;
  }
}

export async function saveThreadSummary(summary: ThreadSummary): Promise<void> {
  await ensureDir();
  await writeFile(SUMMARY_PATH(summary.threadId), JSON.stringify(summary, null, 2), "utf8");
}

export async function deleteThreadSummary(threadId: string): Promise<void> {
  try {
    await rm(SUMMARY_PATH(threadId), { force: true });
  } catch {
    // ignore
  }
}

/**
 * Check if a thread needs summarization based on message count.
 */
export function needsSummarization(messageCount: number, existingSummary?: ThreadSummary | null): boolean {
  if (!existingSummary) return messageCount >= SUMMARIZE_EVERY_N_MESSAGES;
  return messageCount - existingSummary.messageCount >= SUMMARIZE_EVERY_N_MESSAGES;
}

export function makeThreadSummary(messages: ChatMessage[]): string {
  const older = messages.slice(0, -6);
  if (!older.length) return "";
  const lines = older.slice(-16).map((message) => {
    const speaker = message.role === "user" ? "User" : "Assistant";
    return `${speaker}: ${clampText(message.content, 360).replace(/\s+/g, " ")}`;
  });
  return clampText(lines.join("\n"), 3_500);
}

// ── Cleanup helpers ──────────────────────────────────────

export async function deleteAllProjectData(projectId: string): Promise<void> {
  await Promise.all([
    deleteIndex(projectId),
    deleteProjectMemory(projectId),
  ]);
}
