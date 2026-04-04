import { NextResponse } from "next/server";
import { db } from "@/db";
import { taskGroups, tasks } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { parseTaskUpdate } from "@/lib/api/contracts";
import { handleRouteError, notFound, parseJsonObject } from "@/lib/api/errors";
import { eq } from "drizzle-orm";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const updates = parseTaskUpdate(await parseJsonObject(req));

    const [existingTask] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);

    if (!existingTask) notFound("Task not found.");

    const nextGroupId = (updates.groupId as string | null | undefined) ?? existingTask.groupId;
    const nextDomain = (updates.domain as string | undefined) ?? existingTask.domain;

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

    await db.update(tasks).set(updates).where(eq(tasks.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { id } = await params;

    const [existingTask] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);

    if (!existingTask) notFound("Task not found.");

    await db.delete(tasks).where(eq(tasks.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
