import { NextResponse } from "next/server";
import { db } from "@/db";
import { executionLogs, handoffJobs, reminders, taskGroups, tasks } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { parseTaskGroupUpdate } from "@/lib/api/contracts";
import { handleRouteError, notFound, parseJsonObject } from "@/lib/api/errors";
import { eq, inArray } from "drizzle-orm";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const updates = parseTaskGroupUpdate(await parseJsonObject(req));

    const [existingGroup] = await db
      .select()
      .from(taskGroups)
      .where(eq(taskGroups.id, id))
      .limit(1);

    if (!existingGroup) notFound("Task group not found.");

    await db.update(taskGroups).set(updates).where(eq(taskGroups.id, id));

    if (updates.domain && updates.domain !== existingGroup.domain) {
      const nextDomain = updates.domain as string;

      const groupedTasks = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.groupId, id));

      const taskIds = groupedTasks.map((task) => task.id);

      await db.update(tasks).set({ domain: nextDomain }).where(eq(tasks.groupId, id));

      if (taskIds.length > 0) {
        await db
          .update(reminders)
          .set({ domain: nextDomain })
          .where(inArray(reminders.taskId, taskIds));

        await db
          .update(handoffJobs)
          .set({ domain: nextDomain })
          .where(inArray(handoffJobs.taskId, taskIds));

        const relatedJobs = await db
          .select({ id: handoffJobs.id })
          .from(handoffJobs)
          .where(inArray(handoffJobs.taskId, taskIds));

        const jobIds = relatedJobs.map((job) => job.id);

        if (jobIds.length > 0) {
          await db
            .update(executionLogs)
            .set({ domain: nextDomain })
            .where(inArray(executionLogs.jobId, jobIds));
        }
      }
    }

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

    const [existingGroup] = await db
      .select({ id: taskGroups.id })
      .from(taskGroups)
      .where(eq(taskGroups.id, id))
      .limit(1);

    if (!existingGroup) notFound("Task group not found.");

    await db.update(tasks).set({ groupId: null }).where(eq(tasks.groupId, id));
    await db.delete(taskGroups).where(eq(taskGroups.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
