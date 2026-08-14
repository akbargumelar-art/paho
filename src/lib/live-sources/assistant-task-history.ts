import fs from "fs/promises";
import path from "path";

export type TaskHistoryItem = {
  id: string;
  taskId: string;
  action: "created" | "updated" | "deleted" | "status_changed";
  title: string;
  status: string;
  domain: "personal" | "business" | "work";
  timestamp: string;
  note?: string;
  sourceType: "task-history-live";
};

const ASSISTANT_ROOT = process.env.ASSISTANT_ROOT || "";
const RUNTIME_DIR = ASSISTANT_ROOT ? path.join(ASSISTANT_ROOT, "shared", "runtime") : "";
const HISTORY_FILE = RUNTIME_DIR ? path.join(RUNTIME_DIR, "task-history.json") : "";

async function ensureRuntimeDir() {
  if (!RUNTIME_DIR) throw new Error("ASSISTANT_ROOT not configured");
  await fs.mkdir(RUNTIME_DIR, { recursive: true });
}

export async function getTaskHistory(): Promise<TaskHistoryItem[]> {
  if (!HISTORY_FILE) return [];
  try {
    const raw = await fs.readFile(HISTORY_FILE, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data?.history) ? data.history : [];
  } catch {
    return [];
  }
}

export async function appendTaskHistory(entry: Omit<TaskHistoryItem, "id" | "timestamp" | "sourceType"> & { timestamp?: string }): Promise<void> {
  await ensureRuntimeDir();
  const current = await getTaskHistory();
  const item: TaskHistoryItem = {
    id: `th-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    taskId: entry.taskId,
    action: entry.action,
    title: entry.title,
    status: entry.status,
    domain: entry.domain,
    timestamp: entry.timestamp || new Date().toISOString(),
    note: entry.note,
    sourceType: "task-history-live",
  };
  const next = [item, ...current].slice(0, 500);
  await fs.writeFile(HISTORY_FILE, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), history: next }, null, 2), "utf-8");
}
