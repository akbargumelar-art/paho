import fs from "fs/promises";
import path from "path";

const HERMES_CRON_OUTPUT_DIR = process.env.HERMES_CRON_OUTPUT_DIR || "/root/.hermes/cron/output";
const ASSISTANT_ROOT = process.env.ASSISTANT_ROOT || "";
const RUNTIME_DIR = ASSISTANT_ROOT ? path.join(ASSISTANT_ROOT, "shared", "runtime") : "";
const HISTORY_FILE = RUNTIME_DIR ? path.join(RUNTIME_DIR, "reminder-history.json") : "";

export type HistoricalReminder = {
  id: string;
  taskId: string | null;
  title: string;
  triggerTime: string | null;
  isActive: boolean;
  owner: "HERMES";
  domain: "personal" | "business" | "work";
  status: "completed" | "archived";
  repeat?: "none" | "custom";
  sourceType: "hermes-cron-output";
  jobId: string;
  outputPath: string;
  responsePreview: string;
};

async function ensureRuntimeDir() {
  if (!RUNTIME_DIR) throw new Error("ASSISTANT_ROOT not configured");
  await fs.mkdir(RUNTIME_DIR, { recursive: true });
}

function inferDomain(title: string, content: string): HistoricalReminder["domain"] {
  const text = `${title} ${content}`.toLowerCase();
  if (text.includes('[personal]')) return 'personal';
  if (text.includes('[business]')) return 'business';
  return 'work';
}

function extractBetween(text: string, start: string, end?: string): string {
  const i = text.indexOf(start);
  if (i === -1) return "";
  const sliced = text.slice(i + start.length);
  if (!end) return sliced.trim();
  const j = sliced.indexOf(end);
  return (j === -1 ? sliced : sliced.slice(0, j)).trim();
}

async function parseCronOutputFile(jobId: string, filePath: string): Promise<HistoricalReminder | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const titleLine = (content.split('\n')[0] || '').replace('# Cron Job: ', '').trim();
    const runTime = extractBetween(content, '**Run Time:**', '\n');
    const response = extractBetween(content, '## Response', '');
    const preview = response.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 8).join(' | ');
    if (!titleLine.toLowerCase().includes('reminder') && !titleLine.toLowerCase().includes('pengingat')) return null;
    return {
      id: `hist-${jobId}-${path.basename(filePath, '.md')}`,
      taskId: null,
      title: titleLine,
      triggerTime: runTime || null,
      isActive: false,
      owner: 'HERMES',
      domain: inferDomain(titleLine, content),
      status: 'completed',
      repeat: 'none',
      sourceType: 'hermes-cron-output',
      jobId,
      outputPath: filePath,
      responsePreview: preview,
    };
  } catch {
    return null;
  }
}

export async function ingestHistoricalReminders(): Promise<HistoricalReminder[]> {
  if (!HERMES_CRON_OUTPUT_DIR || !HISTORY_FILE) return [];
  await ensureRuntimeDir();
  const items: HistoricalReminder[] = [];
  try {
    const jobDirs = await fs.readdir(HERMES_CRON_OUTPUT_DIR, { withFileTypes: true });
    for (const dirent of jobDirs) {
      if (!dirent.isDirectory()) continue;
      const jobId = dirent.name;
      const absDir = path.join(HERMES_CRON_OUTPUT_DIR, jobId);
      const files = (await fs.readdir(absDir)).filter((f) => f.endsWith('.md')).sort().reverse();
      for (const file of files) {
        const parsed = await parseCronOutputFile(jobId, path.join(absDir, file));
        if (parsed) items.push(parsed);
      }
    }
  } catch {
    return [];
  }
  const dedup = Object.values(Object.fromEntries(items.map(i => [i.id, i])));
  await fs.writeFile(HISTORY_FILE, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), reminders: dedup }, null, 2), 'utf-8');
  return dedup;
}

export async function getHistoricalReminders(): Promise<HistoricalReminder[]> {
  if (!HISTORY_FILE) return [];
  try {
    const raw = await fs.readFile(HISTORY_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data?.reminders) ? data.reminders : [];
  } catch {
    return [];
  }
}
