import fs from "fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { reminders, tasks } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { parseReminderCreate } from "@/lib/api/contracts";
import { handleRouteError, notFound, parseJsonObject } from "@/lib/api/errors";
import { eq, asc } from "drizzle-orm";
import {
  getAssistantReminders,
  saveAssistantReminders,
  upsertAssistantReminder,
  type LiveReminder,
} from "@/lib/live-sources/assistant-reminders";
import { getHistoricalReminders, ingestHistoricalReminders } from "@/lib/live-sources/hermes-cron-history";
import { createHermesReminderCron } from "@/lib/runtime/hermes-cron";

const HERMES_CRON_JOBS = process.env.HERMES_CRON_JOBS || "/root/.hermes/cron/jobs.json";

async function ensureReminderLiveStoreSeeded() {
  const live = await getAssistantReminders();
  if (live.length > 0) return live;
  const dbItems = await db.select().from(reminders).orderBy(asc(reminders.triggerTime));
  if (dbItems.length > 0) {
    await saveAssistantReminders(dbItems as never[]);
    return dbItems as never[];
  }
  return [];
}

async function getHermesCronReminderItems(runtimeJobIds: Set<string>) {
  try {
    const raw = await fs.readFile(HERMES_CRON_JOBS, "utf-8");
    const data = JSON.parse(raw);
    const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
    return jobs
      .filter((job: Record<string, unknown>) => {
        const name = String(job?.name || "").toLowerCase();
        const prompt = String(job?.prompt || "").toLowerCase();
        const jobId = String(job?.id || "");
        if (runtimeJobIds.has(jobId)) return false;
        return name.includes("pengingat") || prompt.includes("pengingat") || name.includes("reminder") || prompt.includes("reminder");
      })
      .map((job: Record<string, unknown>) => ({
        id: String(job.id),
        taskId: null,
        title: job.name || "Hermes Reminder",
        triggerTime: job.next_run_at || job.last_run_at || null,
        isActive: Boolean(job.enabled) && (job.state === "scheduled" || job.state === "running"),
        owner: "HERMES" as const,
        domain: String(job.name || "").toLowerCase().includes("[personal]")
          ? "personal"
          : String(job.name || "").toLowerCase().includes("[business]")
            ? "business"
            : "work",
        status: Boolean(job.enabled) && (job.state === "scheduled" || job.state === "running") ? "active" : "completed",
        repeat: String(job.schedule_display || "").includes("every") ? "custom" : "none",
        sourceType: "hermes-cron",
        runtimeState: job.state || null,
        nextRunAt: job.next_run_at || null,
        lastRunAt: job.last_run_at || null,
      }));
  } catch {
    return [];
  }
}

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const live = await ensureReminderLiveStoreSeeded();
  const runtimeJobIds = new Set(live.map((r: { runtimeJobId?: string | null }) => r.runtimeJobId).filter(Boolean) as string[]);
  const cronReminders = await getHermesCronReminderItems(runtimeJobIds);
  let historical = await getHistoricalReminders();
  if (historical.length === 0) {
    historical = await ingestHistoricalReminders();
  }

  const liveActive = live.filter((r: LiveReminder) => r.status === "active" && r.isActive !== false)
    .map((r: LiveReminder) => ({ ...r, sourceType: r.runtimeMode === "hermes_cron" ? "live-store-runtime-bound" : "live-store" }));
  const liveHistory = live.filter((r: LiveReminder) => !(r.status === "active" && r.isActive !== false))
    .map((r: LiveReminder) => ({ ...r, sourceType: r.runtimeMode === "hermes_cron" ? "live-store-runtime-bound" : "live-store" }));

  const activeCron = cronReminders.filter((r: Record<string, unknown>) => r.status === "active");
  const historyCron = cronReminders.filter((r: Record<string, unknown>) => r.status !== "active");

  return NextResponse.json({
    active: [...liveActive, ...activeCron],
    history: [...historical, ...liveHistory, ...historyCron],
    liveStore: live,
    cronReminders,
    historicalReminders: historical,
    summary: {
      activeCount: liveActive.length + activeCron.length,
      historyCount: historical.length + liveHistory.length + historyCron.length,
      liveStoreCount: live.length,
      cronCount: cronReminders.length,
      historicalCount: historical.length,
    },
  });
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const reminder = parseReminderCreate(await parseJsonObject(req)) as LiveReminder;

    if (reminder.taskId) {
      const [task] = await db
        .select({ id: tasks.id, domain: tasks.domain })
        .from(tasks)
        .where(eq(tasks.id, reminder.taskId))
        .limit(1);

      if (!task) notFound("Reminder task not found.");

      if (task.domain !== reminder.domain) {
        return NextResponse.json(
          { error: "Reminder domain must match its task domain." },
          { status: 400 },
        );
      }
    }

    let finalReminder = reminder;
    if (reminder.runtimeMode === "hermes_cron") {
      const created = await createHermesReminderCron({
        title: reminder.title,
        triggerTime: reminder.triggerTime,
        repeat: reminder.repeat,
        deliver: "origin",
      });
      finalReminder = { ...reminder, runtimeJobId: created.jobId };
    }

    const saved = await upsertAssistantReminder(finalReminder);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
