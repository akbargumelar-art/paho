import { NextResponse } from "next/server";
import fs from "fs/promises";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { taskworkClient } from "@/lib/taskwork";
import { db } from "@/db";
import { tasks, reminders as remindersTable } from "@/db/schema";

/**
 * Notification feed for the topbar bell.
 *
 * Collects anything with a deadline that is近 or already passed, from every
 * source Paho already owns:
 *   - Taskwork SQLite (the Kanban board / Hermes-Telegram tasks)
 *   - Paho's own task + reminder tables
 *   - Hermes cron jobs (jobs.json): overdue next run, paused, last run failed
 *
 * Only real data is reported. A source that is unreadable is surfaced as a
 * `sourceErrors` entry rather than being silently treated as empty.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HERMES_CRON_JOBS = process.env.HERMES_CRON_JOBS || "/root/.hermes/cron/jobs.json";
const SOON_HOURS = 24;
const READ_STATE_FILE = "/root/paho/data/alerts-read.json";

/**
 * Dismiss state.
 *
 * An alert is derived data — an overdue task stays overdue, so simply
 * re-deriving on every poll made the badge un-clearable. We therefore persist
 * which alerts were acknowledged, keyed by alert id plus a SIGNATURE of the
 * thing that mattered (severity + deadline). If the deadline moves or the
 * severity worsens the signature changes and the alert legitimately returns.
 */
type ReadState = Record<string, string>;

function signatureOf(alert: Alert): string {
  return `${alert.severity}|${alert.dueAt || "-"}`;
}

async function readReadState(): Promise<ReadState> {
  try {
    const parsed = JSON.parse(await fs.readFile(READ_STATE_FILE, "utf-8"));
    return parsed && typeof parsed === "object" ? (parsed as ReadState) : {};
  } catch {
    return {};
  }
}

async function writeReadState(state: ReadState) {
  await fs.mkdir("/root/paho/data", { recursive: true });
  await fs.writeFile(READ_STATE_FILE, JSON.stringify(state, null, 2));
}

export type Alert = {
  id: string;
  kind: "task" | "reminder" | "cron";
  severity: "overdue" | "soon" | "failed";
  title: string;
  source: string;
  /** ISO timestamp of the deadline / next run, when known. */
  dueAt: string | null;
  /** Human-friendly relative label, e.g. "terlambat 3 hari". */
  relative: string;
  href: string;
  detail?: string;
};

function parseWhen(value: unknown): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  // Date-only values mean end of that day, otherwise "today" looks overdue at 00:01.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59` : raw.replace(" ", "T");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function relativeLabel(due: Date, now: Date): string {
  const diffMs = due.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const span = mins < 60 ? `${mins} menit` : hours < 48 ? `${hours} jam` : `${days} hari`;
  return diffMs < 0 ? `terlambat ${span}` : `${span} lagi`;
}

function classify(due: Date, now: Date): "overdue" | "soon" | null {
  const diffMs = due.getTime() - now.getTime();
  if (diffMs < 0) return "overdue";
  if (diffMs <= SOON_HOURS * 3600000) return "soon";
  return null;
}

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const now = new Date();
  const alerts: Alert[] = [];
  const sourceErrors: { source: string; error: string }[] = [];

  // ---- Taskwork SQLite (Kanban board) ----
  try {
    const client = taskworkClient();
    const res = await client.execute(
      "SELECT id, category, title, status, priority, due_date FROM tasks WHERE status IN ('todo','in_progress') AND due_date IS NOT NULL AND TRIM(due_date) <> ''"
    );
    for (const row of res.rows as unknown as Record<string, unknown>[]) {
      const due = parseWhen(row.due_date);
      if (!due) continue;
      const severity = classify(due, now);
      if (!severity) continue;
      alerts.push({
        id: `taskwork-${row.id}`,
        kind: "task",
        severity,
        title: String(row.title || "(tanpa judul)"),
        source: `Kanban · ${String(row.category || "-")}`,
        dueAt: due.toISOString(),
        relative: relativeLabel(due, now),
        href: "/dashboard/kanban",
        detail: `prioritas ${String(row.priority || "normal")} · status ${String(row.status)}`,
      });
    }
  } catch (err) {
    sourceErrors.push({ source: "taskwork", error: err instanceof Error ? err.message : String(err) });
  }

  // ---- Paho task table ----
  try {
    const rows = await db.select().from(tasks);
    for (const row of rows) {
      if (row.status === "completed") continue;
      const due = parseWhen(row.dueDate);
      if (!due) continue;
      const severity = classify(due, now);
      if (!severity) continue;
      alerts.push({
        id: `task-${row.id}`,
        kind: "task",
        severity,
        title: row.title,
        source: `Tugas · ${row.domain}`,
        dueAt: due.toISOString(),
        relative: relativeLabel(due, now),
        href: "/dashboard/tasks",
        detail: `risiko ${row.riskLevel} · status ${row.status}`,
      });
    }
  } catch (err) {
    sourceErrors.push({ source: "tasks", error: err instanceof Error ? err.message : String(err) });
  }

  // ---- Paho reminder table ----
  try {
    const rows = await db.select().from(remindersTable);
    for (const row of rows) {
      if (row.status !== "active" || row.isActive === false) continue;
      const due = parseWhen(row.triggerTime);
      if (!due) continue;
      const severity = classify(due, now);
      if (!severity) continue;
      alerts.push({
        id: `reminder-${row.id}`,
        kind: "reminder",
        severity,
        title: row.title,
        source: `Reminder · ${row.domain}`,
        dueAt: due.toISOString(),
        relative: relativeLabel(due, now),
        href: "/dashboard/reminders",
      });
    }
  } catch (err) {
    sourceErrors.push({ source: "reminders", error: err instanceof Error ? err.message : String(err) });
  }

  // ---- Hermes cron jobs ----
  try {
    const raw = await fs.readFile(HERMES_CRON_JOBS, "utf-8");
    const data = JSON.parse(raw);
    const jobs: Record<string, unknown>[] = Array.isArray(data?.jobs) ? data.jobs : Array.isArray(data) ? data : [];
    for (const job of jobs) {
      const name = String(job.name || job.id || "cron job");
      const enabled = job.enabled !== false;
      const lastStatus = String(job.last_status || "");
      const lastError = job.last_error ? String(job.last_error) : "";

      if (lastStatus === "error" || lastError) {
        alerts.push({
          id: `cron-err-${job.id}`,
          kind: "cron",
          severity: "failed",
          title: name,
          source: "Hermes cron",
          dueAt: parseWhen(job.last_run_at)?.toISOString() ?? null,
          relative: "run terakhir gagal",
          href: "/dashboard/jobs",
          detail: lastError.slice(0, 160) || "status error",
        });
        continue;
      }

      if (!enabled || job.state === "paused") {
        alerts.push({
          id: `cron-paused-${job.id}`,
          kind: "cron",
          severity: "failed",
          title: name,
          source: "Hermes cron",
          dueAt: parseWhen(job.next_run_at)?.toISOString() ?? null,
          relative: "dijeda / nonaktif",
          href: "/dashboard/jobs",
          detail: job.paused_reason ? String(job.paused_reason).slice(0, 160) : "tidak berjalan",
        });
        continue;
      }

      const next = parseWhen(job.next_run_at);
      if (!next) continue;
      const severity = classify(next, now);
      if (!severity) continue;
      alerts.push({
        id: `cron-${job.id}`,
        kind: "cron",
        severity,
        title: name,
        source: "Hermes cron",
        dueAt: next.toISOString(),
        relative: relativeLabel(next, now),
        href: "/dashboard/jobs",
        detail: job.schedule_display ? String(job.schedule_display) : undefined,
      });
    }
  } catch (err) {
    sourceErrors.push({ source: "hermes-cron", error: err instanceof Error ? err.message : String(err) });
  }

  const rank = { overdue: 0, failed: 1, soon: 2 } as const;
  alerts.sort((a, b) => {
    if (rank[a.severity] !== rank[b.severity]) return rank[a.severity] - rank[b.severity];
    const at = a.dueAt ? Date.parse(a.dueAt) : Number.MAX_SAFE_INTEGER;
    const bt = b.dueAt ? Date.parse(b.dueAt) : Number.MAX_SAFE_INTEGER;
    return at - bt;
  });

  // Split acknowledged items out of the badge count. They remain visible in the
  // panel (marked read) so nothing silently disappears.
  const readState = await readReadState();
  const unread: Alert[] = [];
  const read: Alert[] = [];
  for (const alert of alerts) {
    if (readState[alert.id] === signatureOf(alert)) read.push(alert);
    else unread.push(alert);
  }

  // Drop dismiss records whose alert no longer exists, so the file cannot grow
  // forever after tasks are completed.
  const liveIds = new Set(alerts.map((a) => a.id));
  const pruned = Object.fromEntries(Object.entries(readState).filter(([id]) => liveIds.has(id)));
  if (Object.keys(pruned).length !== Object.keys(readState).length) {
    await writeReadState(pruned).catch(() => undefined);
  }

  return NextResponse.json({
    generatedAt: now.toISOString(),
    soonWindowHours: SOON_HOURS,
    counts: {
      total: unread.length,
      overdue: unread.filter((a) => a.severity === "overdue").length,
      soon: unread.filter((a) => a.severity === "soon").length,
      failed: unread.filter((a) => a.severity === "failed").length,
      read: read.length,
    },
    alerts: unread,
    readAlerts: read,
    sourceErrors,
  });
}

/**
 * Mark alerts as read. Body: { ids: string[] } or { all: true }.
 * Signatures come from the live derivation so a changed deadline re-alerts.
 */
export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const all = body?.all === true;
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.map(String) : [];
  if (!all && ids.length === 0) {
    return NextResponse.json({ error: "Sertakan ids[] atau all: true." }, { status: 400 });
  }

  // Re-derive so we store the CURRENT signature, not one the client invented.
  const current = await GET();
  if (current.status !== 200) return current;
  const payload = await current.json();
  const live: Alert[] = [...(payload.alerts || []), ...(payload.readAlerts || [])];

  const state = await readReadState();
  const wanted = all ? live : live.filter((a) => ids.includes(a.id));
  for (const alert of wanted) state[alert.id] = signatureOf(alert);
  await writeReadState(state);

  return NextResponse.json({ ok: true, marked: wanted.length });
}
