import fs from "fs/promises";
import path from "path";

// ============================================================
// OPENCLAW FILES — Live Source Adapter
// Membaca dan menulis langsung ke file-file OpenClaw di VPS:
// - /root/.openclaw/exec-approvals.json
// - /root/.openclaw/openclaw.json
// - /root/.openclaw/cron/jobs.json
// - /root/.openclaw/logs/
// ============================================================

const OPENCLAW_APPROVALS = process.env.OPENCLAW_APPROVALS || "";
const OPENCLAW_CONFIG = process.env.OPENCLAW_CONFIG || "";
const OPENCLAW_CRON_JOBS = process.env.OPENCLAW_CRON_JOBS || "";
const OPENCLAW_LOGS_DIR = process.env.OPENCLAW_LOGS_DIR || "";

export type ApprovalItem = {
  id: string;
  job_id?: string;
  description?: string;
  request_payload?: string;
  risk_level?: "low" | "medium" | "high" | "critical";
  approval_channel?: string;
  review_status?: "pending" | "approved" | "rejected";
  is_approved?: boolean;
  created_at?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  [key: string]: unknown;
};

export type CronJob = {
  id: string;
  name?: string;
  schedule?: string;
  command?: string;
  description?: string;
  enabled?: boolean;
  last_run?: string;
  next_run?: string;
  status?: "active" | "disabled" | "error";
  [key: string]: unknown;
};

export type OpenClawConfig = {
  version?: string | number;
  status?: string;
  mode?: string;
  [key: string]: unknown;
};

// ---- APPROVALS ----

export async function getApprovals(): Promise<ApprovalItem[]> {
  if (!OPENCLAW_APPROVALS) return [];
  try {
    const raw = await fs.readFile(OPENCLAW_APPROVALS, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : (data.items ?? data.approvals ?? []);
  } catch {
    return [];
  }
}

export async function updateApprovals(items: ApprovalItem[]): Promise<void> {
  if (!OPENCLAW_APPROVALS) throw new Error("OPENCLAW_APPROVALS path not configured");
  await fs.writeFile(OPENCLAW_APPROVALS, JSON.stringify(items, null, 2), "utf-8");
}

export async function approveItem(id: string, reviewedBy = "dashboard"): Promise<boolean> {
  const items = await getApprovals();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return false;
  items[idx] = {
    ...items[idx],
    is_approved: true,
    review_status: "approved",
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
  };
  await updateApprovals(items);
  return true;
}

export async function rejectItem(id: string, reviewedBy = "dashboard"): Promise<boolean> {
  const items = await getApprovals();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return false;
  items[idx] = {
    ...items[idx],
    is_approved: false,
    review_status: "rejected",
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
  };
  await updateApprovals(items);
  return true;
}

// ---- CRON JOBS ----

export async function getCronJobs(): Promise<CronJob[]> {
  if (!OPENCLAW_CRON_JOBS) return [];
  try {
    const raw = await fs.readFile(OPENCLAW_CRON_JOBS, "utf-8");
    const data = JSON.parse(raw);
    // Format: { version: 1, jobs: [...] } atau array langsung
    return Array.isArray(data) ? data : (data.jobs ?? []);
  } catch {
    return [];
  }
}

export async function saveCronJobs(jobs: CronJob[]): Promise<void> {
  if (!OPENCLAW_CRON_JOBS) throw new Error("OPENCLAW_CRON_JOBS path not configured");
  const current = await fs.readFile(OPENCLAW_CRON_JOBS, "utf-8").then(JSON.parse).catch(() => ({}));
  const updated = { ...current, jobs };
  await fs.writeFile(OPENCLAW_CRON_JOBS, JSON.stringify(updated, null, 2), "utf-8");
}

export async function createCronJob(job: Omit<CronJob, "id">): Promise<CronJob> {
  const jobs = await getCronJobs();
  const newJob: CronJob = {
    ...job,
    id: `cron-${Date.now()}`,
    status: "active",
  };
  await saveCronJobs([...jobs, newJob]);
  return newJob;
}

export async function updateCronJob(id: string, data: Partial<CronJob>): Promise<boolean> {
  const jobs = await getCronJobs();
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx === -1) return false;
  jobs[idx] = { ...jobs[idx], ...data };
  await saveCronJobs(jobs);
  return true;
}

export async function deleteCronJob(id: string): Promise<boolean> {
  const jobs = await getCronJobs();
  const filtered = jobs.filter((j) => j.id !== id);
  if (filtered.length === jobs.length) return false;
  await saveCronJobs(filtered);
  return true;
}

// ---- OPENCLAW CONFIG ----

export async function getOpenClawConfig(): Promise<OpenClawConfig | null> {
  if (!OPENCLAW_CONFIG) return null;
  try {
    const raw = await fs.readFile(OPENCLAW_CONFIG, "utf-8");
    return JSON.parse(raw) as OpenClawConfig;
  } catch {
    return null;
  }
}

// ---- LOGS ----

export async function getOpenClawLogs(limit = 50): Promise<string[]> {
  if (!OPENCLAW_LOGS_DIR) return [];
  try {
    const files = await fs.readdir(OPENCLAW_LOGS_DIR);
    const logFiles = files
      .filter((f) => f.endsWith(".log") || f.endsWith(".jsonl") || f.endsWith(".txt"))
      .sort()
      .reverse()
      .slice(0, 5);

    const lines: string[] = [];
    for (const f of logFiles) {
      const raw = await fs.readFile(path.join(OPENCLAW_LOGS_DIR, f), "utf-8");
      lines.push(...raw.split("\n").filter((l) => l.trim()));
      if (lines.length >= limit) break;
    }
    return lines.slice(0, limit);
  } catch {
    return [];
  }
}

/** Count pending approvals */
export async function countPendingApprovals(): Promise<number> {
  const approvals = await getApprovals();
  return approvals.filter((a) => a.review_status === "pending" || a.is_approved === undefined).length;
}
