import { NextResponse } from "next/server";
import { db } from "@/db";
import { taskGroups, tasks } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { parseTaskUpdate } from "@/lib/api/contracts";
import { handleRouteError, notFound, parseJsonObject } from "@/lib/api/errors";
import { eq, asc } from "drizzle-orm";
import {
  getAssistantTasks,
  saveAssistantTasks,
  removeAssistantTask,
  type LiveTask,
} from "@/lib/live-sources/assistant-tasks";
import { appendTaskHistory } from "@/lib/live-sources/assistant-task-history";

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

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const updates = parseTaskUpdate(await parseJsonObject(req));
    const live = await ensureTaskLiveStoreSeeded();

    const idx = live.findIndex((t: { id: string }) => t.id === id);
    if (idx === -1) notFound("Task not found.");

    const existingTask = live[idx] as LiveTask;
    const nextGroupId = (updates.groupId as string | null | undefined) ?? (existingTask.groupId as string | null | undefined);
    const nextDomain = (updates.domain as string | undefined) ?? (existingTask.domain as string | undefined);

    if (nextGroupId) {
      const [group] = await db
        .select({ id: taskGroups.id, domain: taskGroups.domain })
        .from(taskGroups)
        .where(eq(taskGroups.id, nextGroupId))
        .limit(1);

      if (!group) notFound("Task group not found.");

      if (group.domain !== nextDomain) {
        return NextResponse.json(
          { error: "Task domain must match its task group domain." },
          { status: 400 },
        );
      }
    }

    const merged = { ...existingTask, ...updates } as LiveTask;
    live[idx] = merged;
    await saveAssistantTasks(live as LiveTask[]);
    await appendTaskHistory({
      taskId: merged.id,
      action: merged.status !== existingTask.status ? "status_changed" : "updated",
      title: merged.title,
      status: merged.status,
      domain: merged.domain,
      note: merged.status !== existingTask.status ? `Status changed from ${existingTask.status} to ${merged.status}` : "Task updated from Paho",
    });
    return NextResponse.json({ success: true, task: live[idx] });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const live = await ensureTaskLiveStoreSeeded();
    const existing = live.find((t: { id: string }) => t.id === id) as LiveTask | undefined;
    const ok = await removeAssistantTask(id);
    if (!ok) notFound("Task not found.");
    if (existing) {
      await appendTaskHistory({
        taskId: existing.id,
        action: "deleted",
        title: existing.title,
        status: existing.status,
        domain: existing.domain,
        note: "Task deleted from Paho",
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
