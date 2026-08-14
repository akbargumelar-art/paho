import fs from "fs/promises";
import path from "path";

export type LiveReminder = {
  id: string;
  taskId: string | null;
  title: string;
  triggerTime: string;
  isActive: boolean;
  owner: "HERMES";
  domain: "personal" | "business" | "work";
  status: "active" | "completed" | "archived";
  repeat?: "none" | "daily" | "weekly" | "monthly" | "yearly";
  runtimeMode?: "plan_only" | "hermes_cron";
  runtimeJobId?: string | null;
};

const ASSISTANT_ROOT = process.env.ASSISTANT_ROOT || "";
const RUNTIME_DIR = ASSISTANT_ROOT ? path.join(ASSISTANT_ROOT, "shared", "runtime") : "";
const REMINDERS_FILE = RUNTIME_DIR ? path.join(RUNTIME_DIR, "reminders.json") : "";

async function ensureRuntimeDir() {
  if (!RUNTIME_DIR) throw new Error("ASSISTANT_ROOT not configured");
  await fs.mkdir(RUNTIME_DIR, { recursive: true });
}

function normalizeReminder(item: Partial<LiveReminder>): LiveReminder {
  return {
    id: item.id || `r-${Date.now()}`,
    taskId: item.taskId ?? null,
    title: item.title || "",
    triggerTime: item.triggerTime || new Date().toISOString(),
    isActive: item.isActive ?? (item.status !== "archived"),
    owner: "HERMES",
    domain: (item.domain as LiveReminder["domain"]) || "work",
    status: (item.status as LiveReminder["status"]) || "active",
    repeat: (item.repeat as LiveReminder["repeat"]) || "none",
    runtimeMode: (item.runtimeMode as LiveReminder["runtimeMode"]) || "plan_only",
    runtimeJobId: item.runtimeJobId ?? null,
  };
}

export async function getAssistantReminders(): Promise<LiveReminder[]> {
  if (!REMINDERS_FILE) return [];
  try {
    const raw = await fs.readFile(REMINDERS_FILE, "utf-8");
    const data = JSON.parse(raw);
    const items = Array.isArray(data) ? data : (data.reminders ?? []);
    return Array.isArray(items) ? items.map(normalizeReminder) : [];
  } catch {
    return [];
  }
}

export async function saveAssistantReminders(items: LiveReminder[]): Promise<void> {
  await ensureRuntimeDir();
  await fs.writeFile(
    REMINDERS_FILE,
    JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), reminders: items }, null, 2),
    "utf-8",
  );
}

export async function upsertAssistantReminder(reminder: LiveReminder): Promise<LiveReminder> {
  const items = await getAssistantReminders();
  const idx = items.findIndex((r) => r.id === reminder.id);
  const normalized = normalizeReminder(reminder);
  if (idx >= 0) items[idx] = normalized;
  else items.unshift(normalized);
  await saveAssistantReminders(items);
  return normalized;
}

export async function removeAssistantReminder(id: string): Promise<boolean> {
  const items = await getAssistantReminders();
  const filtered = items.filter((r) => r.id !== id);
  if (filtered.length === items.length) return false;
  await saveAssistantReminders(filtered);
  return true;
}
