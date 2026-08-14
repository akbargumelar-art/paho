import fs from "fs/promises";
import path from "path";

export type LiveTaskGroup = {
  id: string;
  name: string;
  domain: "personal" | "business" | "work";
  color: string;
  icon: string;
  createdAt: string;
};

const ASSISTANT_ROOT = process.env.ASSISTANT_ROOT || "";
const RUNTIME_DIR = ASSISTANT_ROOT ? path.join(ASSISTANT_ROOT, "shared", "runtime") : "";
const GROUPS_FILE = RUNTIME_DIR ? path.join(RUNTIME_DIR, "task-groups.json") : "";

async function ensureRuntimeDir() {
  if (!RUNTIME_DIR) throw new Error("ASSISTANT_ROOT not configured");
  await fs.mkdir(RUNTIME_DIR, { recursive: true });
}

function normalizeGroup(item: Partial<LiveTaskGroup>): LiveTaskGroup {
  return {
    id: item.id || `g-${Date.now()}`,
    name: item.name || "",
    domain: (item.domain as LiveTaskGroup["domain"]) || "work",
    color: item.color || "#6366f1",
    icon: item.icon || "📁",
    createdAt: item.createdAt || new Date().toISOString().split("T")[0],
  };
}

export async function getAssistantTaskGroups(): Promise<LiveTaskGroup[]> {
  if (!GROUPS_FILE) return [];
  try {
    const raw = await fs.readFile(GROUPS_FILE, "utf-8");
    const data = JSON.parse(raw);
    const items = Array.isArray(data) ? data : (data.taskGroups ?? []);
    return Array.isArray(items) ? items.map(normalizeGroup) : [];
  } catch {
    return [];
  }
}

export async function saveAssistantTaskGroups(items: LiveTaskGroup[]): Promise<void> {
  await ensureRuntimeDir();
  await fs.writeFile(
    GROUPS_FILE,
    JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), taskGroups: items }, null, 2),
    "utf-8",
  );
}

export async function upsertAssistantTaskGroup(group: LiveTaskGroup): Promise<LiveTaskGroup> {
  const items = await getAssistantTaskGroups();
  const idx = items.findIndex((g) => g.id === group.id);
  const normalized = normalizeGroup(group);
  if (idx >= 0) items[idx] = normalized;
  else items.unshift(normalized);
  await saveAssistantTaskGroups(items);
  return normalized;
}

export async function removeAssistantTaskGroup(id: string): Promise<boolean> {
  const items = await getAssistantTaskGroups();
  const filtered = items.filter((g) => g.id !== id);
  if (filtered.length === items.length) return false;
  await saveAssistantTaskGroups(filtered);
  return true;
}
