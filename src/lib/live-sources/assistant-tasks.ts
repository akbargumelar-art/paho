import fs from "fs/promises";
import path from "path";

export type LiveTask = {
  id: string;
  title: string;
  details: string;
  status: "pending" | "in-progress" | "completed";
  owner: "HERMES";
  domain: "personal" | "business" | "work";
  groupId: string | null;
  riskLevel: "low" | "medium" | "high" | "critical";
  dueDate: string;
  createdAt: string;
};

const ASSISTANT_ROOT = process.env.ASSISTANT_ROOT || "";
const RUNTIME_DIR = ASSISTANT_ROOT ? path.join(ASSISTANT_ROOT, "shared", "runtime") : "";
const TASKS_FILE = RUNTIME_DIR ? path.join(RUNTIME_DIR, "tasks.json") : "";

async function ensureRuntimeDir() {
  if (!RUNTIME_DIR) throw new Error("ASSISTANT_ROOT not configured");
  await fs.mkdir(RUNTIME_DIR, { recursive: true });
}

function normalizeTask(item: Partial<LiveTask>): LiveTask {
  return {
    id: item.id || `t-${Date.now()}`,
    title: item.title || "",
    details: item.details || "",
    status: (item.status as LiveTask["status"]) || "pending",
    owner: "HERMES",
    domain: (item.domain as LiveTask["domain"]) || "work",
    groupId: item.groupId ?? null,
    riskLevel: (item.riskLevel as LiveTask["riskLevel"]) || "low",
    dueDate: item.dueDate || new Date().toISOString().split("T")[0],
    createdAt: item.createdAt || new Date().toISOString().split("T")[0],
  };
}

export async function getAssistantTasks(): Promise<LiveTask[]> {
  if (!TASKS_FILE) return [];
  try {
    const raw = await fs.readFile(TASKS_FILE, "utf-8");
    const data = JSON.parse(raw);
    const items = Array.isArray(data) ? data : (data.tasks ?? []);
    return Array.isArray(items) ? items.map(normalizeTask) : [];
  } catch {
    return [];
  }
}

export async function saveAssistantTasks(items: LiveTask[]): Promise<void> {
  await ensureRuntimeDir();
  await fs.writeFile(
    TASKS_FILE,
    JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), tasks: items }, null, 2),
    "utf-8",
  );
}

export async function upsertAssistantTask(task: LiveTask): Promise<LiveTask> {
  const items = await getAssistantTasks();
  const idx = items.findIndex((t) => t.id === task.id);
  const normalized = normalizeTask(task);
  if (idx >= 0) items[idx] = normalized;
  else items.unshift(normalized);
  await saveAssistantTasks(items);
  return normalized;
}

export async function removeAssistantTask(id: string): Promise<boolean> {
  const items = await getAssistantTasks();
  const filtered = items.filter((t) => t.id !== id);
  if (filtered.length === items.length) return false;
  await saveAssistantTasks(filtered);
  return true;
}
