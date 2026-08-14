import { NextResponse } from "next/server";
import { db } from "@/db";
import { taskGroups, tasks } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { parseTaskGroupUpdate } from "@/lib/api/contracts";
import { handleRouteError, notFound, parseJsonObject } from "@/lib/api/errors";
import { asc } from "drizzle-orm";
import {
  getAssistantTaskGroups,
  saveAssistantTaskGroups,
  removeAssistantTaskGroup,
  type LiveTaskGroup,
} from "@/lib/live-sources/assistant-task-groups";
import { getAssistantTasks, saveAssistantTasks, type LiveTask } from "@/lib/live-sources/assistant-tasks";
import { getAssistantReminders, saveAssistantReminders, type LiveReminder } from "@/lib/live-sources/assistant-reminders";

async function ensureTaskGroupLiveStoreSeeded() {
  const live = await getAssistantTaskGroups();
  if (live.length > 0) return live;
  const dbItems = await db.select().from(taskGroups).orderBy(asc(taskGroups.domain), asc(taskGroups.createdAt));
  if (dbItems.length > 0) {
    await saveAssistantTaskGroups(dbItems as never[]);
    return dbItems as never[];
  }
  return [];
}

async function ensureTaskLiveStoreSeeded() {
  const live = await getAssistantTasks();
  if (live.length > 0) return live;
  const dbItems = await db.select().from(tasks).orderBy(asc(tasks.dueDate), asc(tasks.createdAt));
  if (dbItems.length > 0) {
    await saveAssistantTasks(dbItems as never[]);
    return dbItems as never[];
  }
  return [];
}

async function ensureReminderLiveStoreSeeded() {
  const live = await getAssistantReminders();
  if (live.length > 0) return live;
  return [];
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const updates = parseTaskGroupUpdate(await parseJsonObject(req));
    const liveGroups = await ensureTaskGroupLiveStoreSeeded();
    const idx = liveGroups.findIndex((g: { id: string }) => g.id === id);
    if (idx === -1) notFound("Task group not found.");

    const existingGroup = liveGroups[idx] as LiveTaskGroup;
    const nextGroup = { ...existingGroup, ...updates } as LiveTaskGroup;
    liveGroups[idx] = nextGroup;
    await saveAssistantTaskGroups(liveGroups as LiveTaskGroup[]);

    if (updates.domain && updates.domain !== existingGroup.domain) {
      const nextDomain = updates.domain as LiveTask["domain"];
      const liveTasks = await ensureTaskLiveStoreSeeded();
      const updatedTasks = liveTasks.map((task) =>
        task.groupId === id ? ({ ...task, domain: nextDomain } as LiveTask) : task,
      );
      await saveAssistantTasks(updatedTasks);

      const liveReminders = await ensureReminderLiveStoreSeeded();
      if (liveReminders.length > 0) {
        const affectedTaskIds = updatedTasks.filter((t) => t.groupId === id).map((t) => t.id);
        const updatedReminders = liveReminders.map((reminder) =>
          reminder.taskId && affectedTaskIds.includes(reminder.taskId)
            ? ({ ...reminder, domain: nextDomain } as LiveReminder)
            : reminder,
        );
        await saveAssistantReminders(updatedReminders);
      }
    }

    return NextResponse.json({ success: true, taskGroup: nextGroup });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { id } = await params;
    await ensureTaskGroupLiveStoreSeeded();
    const ok = await removeAssistantTaskGroup(id);
    if (!ok) notFound("Task group not found.");

    const liveTasks = await ensureTaskLiveStoreSeeded();
    const updatedTasks = liveTasks.map((task) =>
      task.groupId === id ? ({ ...task, groupId: null } as LiveTask) : task,
    );
    await saveAssistantTasks(updatedTasks);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
