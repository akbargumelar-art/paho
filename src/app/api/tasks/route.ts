import { NextResponse } from "next/server";
import { db } from "@/db";
import { taskGroups, tasks } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { handleRouteError, notFound, parseJsonObject } from "@/lib/api/errors";
import { parseTaskCreate } from "@/lib/api/contracts";
import { asc, eq } from "drizzle-orm";
import {
  getAssistantTasks,
  saveAssistantTasks,
  upsertAssistantTask,
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

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const live = await ensureTaskLiveStoreSeeded();
  return NextResponse.json(live);
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const task = parseTaskCreate(await parseJsonObject(req));

    if (task.groupId) {
      const [group] = await db
        .select({ id: taskGroups.id, domain: taskGroups.domain })
        .from(taskGroups)
        .where(eq(taskGroups.id, task.groupId))
        .limit(1);

      if (!group) notFound("Task group not found.");

      if (group.domain !== task.domain) {
        return NextResponse.json(
          { error: "Task domain must match its task group domain." },
          { status: 400 },
        );
      }
    }

    const saved = await upsertAssistantTask(task as never);
    await appendTaskHistory({
      taskId: saved.id,
      action: "created",
      title: saved.title,
      status: saved.status,
      domain: saved.domain,
      note: "Task created from Paho",
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
