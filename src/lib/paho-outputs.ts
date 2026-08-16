import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";

const HERMES_CRON_ROOT = "/root/.hermes/cron";
const HERMES_CRON_JOBS = join(HERMES_CRON_ROOT, "jobs.json");
const HERMES_CRON_OUTPUT = join(HERMES_CRON_ROOT, "output");

export type PahoOutput = {
  id: string;
  jobId: string;
  jobName: string;
  file: string;
  path: string;
  createdAt: string;
  size: number;
  preview: string;
};

export type PahoCronJob = {
  id: string;
  name: string;
  enabled: boolean;
  schedule: string;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  lastStatus?: string | null;
};

async function readCronJobs(): Promise<Record<string, PahoCronJob>> {
  try {
    const raw = JSON.parse(await readFile(HERMES_CRON_JOBS, "utf8"));
    const jobs: Array<Record<string, unknown>> = Array.isArray(raw) ? raw : (raw.jobs || []);
    return Object.fromEntries(jobs.map((j) => {
      const schedule = j.schedule && typeof j.schedule === "object" ? String((j.schedule as Record<string, unknown>).display || j.schedule_display || "") : String(j.schedule_display || j.schedule || "");
      return [String(j.id), {
        id: String(j.id),
        name: String(j.name || j.id),
        enabled: Boolean(j.enabled),
        schedule,
        lastRunAt: j.last_run_at ? String(j.last_run_at) : null,
        nextRunAt: j.next_run_at ? String(j.next_run_at) : null,
        lastStatus: j.last_status ? String(j.last_status) : null,
      } satisfies PahoCronJob];
    }));
  } catch {
    return {};
  }
}

function stripCronBoilerplate(markdown: string): string {
  const response = markdown.split("\n## Response\n").pop() || markdown;
  return response.replace(/\[SILENT\]/g, "").trim();
}

export async function listPahoOutputs(limit = 20): Promise<{ jobs: PahoCronJob[]; outputs: PahoOutput[] }> {
  const jobMap = await readCronJobs();
  const outputs: PahoOutput[] = [];
  let dirs: string[] = [];
  try { dirs = await readdir(HERMES_CRON_OUTPUT); } catch { return { jobs: Object.values(jobMap), outputs: [] }; }
  for (const jobId of dirs) {
    const dir = join(HERMES_CRON_OUTPUT, jobId);
    let files: string[] = [];
    try { files = await readdir(dir); } catch { continue; }
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const path = join(dir, file);
      try {
        const st = await stat(path);
        const raw = await readFile(path, "utf8");
        const preview = stripCronBoilerplate(raw).slice(0, 260) || "[SILENT]";
        outputs.push({
          id: `${jobId}/${file}`,
          jobId,
          jobName: jobMap[jobId]?.name || jobId,
          file,
          path,
          createdAt: st.mtime.toISOString(),
          size: st.size,
          preview,
        });
      } catch {}
    }
  }
  outputs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { jobs: Object.values(jobMap), outputs: outputs.slice(0, limit) };
}
