import { NextResponse } from "next/server";
import { db } from "@/db";
import { reminders, tasks } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { parseReminderUpdate } from "@/lib/api/contracts";
import { handleRouteError, notFound, parseJsonObject } from "@/lib/api/errors";
import { eq, asc } from "drizzle-orm";
import {
  getAssistantReminders,
  saveAssistantReminders,
  removeAssistantReminder,
  type LiveReminder,
} from "@/lib/live-sources/assistant-reminders";
import { updateHermesReminderCron, removeHermesReminderCron } from "@/lib/runtime/hermes-cron";

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

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const updates = parseReminderUpdate(await parseJsonObject(req));
    const live = await ensureReminderLiveStoreSeeded();

    const idx = live.findIndex((r: { id: string }) => r.id === id);
    if (idx === -1) notFound("Reminder not found.");

    const existingReminder = live[idx] as LiveReminder;
    const nextTaskId = (updates.taskId as string | null | undefined) ?? (existingReminder.taskId as string | null | undefined);
    const nextDomain = (updates.domain as string | undefined) ?? (existingReminder.domain as string | undefined);
    const nextRuntimeMode = (updates.runtimeMode as LiveReminder["runtimeMode"] | undefined) ?? existingReminder.runtimeMode;

    if (nextTaskId) {
      const [task] = await db
        .select({ id: tasks.id, domain: tasks.domain })
        .from(tasks)
        .where(eq(tasks.id, nextTaskId))
        .limit(1);

      if (!task) notFound("Reminder task not found.");

      if (task.domain !== nextDomain) {
        return NextResponse.json(
          { error: "Reminder domain must match its task domain." },
          { status: 400 },
        );
      }
    }

    const merged = { ...existingReminder, ...updates } as LiveReminder;

    if (existingReminder.runtimeMode === "hermes_cron" && existingReminder.runtimeJobId && nextRuntimeMode !== "hermes_cron") {
      await removeHermesReminderCron(existingReminder.runtimeJobId);
      merged.runtimeJobId = null;
    }

    if (nextRuntimeMode === "hermes_cron") {
      if (existingReminder.runtimeJobId) {
        await updateHermesReminderCron(existingReminder.runtimeJobId, {
          title: merged.title,
          triggerTime: merged.triggerTime,
          repeat: merged.repeat,
          deliver: "origin",
        });
        merged.runtimeJobId = existingReminder.runtimeJobId;
      }
    }

    live[idx] = merged;
    await saveAssistantReminders(live as LiveReminder[]);
    return NextResponse.json({ success: true, reminder: live[idx] });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const live = await ensureReminderLiveStoreSeeded();
    const item = live.find((r: { id: string }) => r.id === id) as LiveReminder | undefined;
    if (!item) notFound("Reminder not found.");
    const reminderItem = item as LiveReminder;

    if (reminderItem.runtimeMode === "hermes_cron" && reminderItem.runtimeJobId) {
      await removeHermesReminderCron(reminderItem.runtimeJobId);
    }

    const ok = await removeAssistantReminder(id);
    if (!ok) notFound("Reminder not found.");
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
