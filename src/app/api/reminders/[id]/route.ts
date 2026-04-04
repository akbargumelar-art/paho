import { NextResponse } from "next/server";
import { db } from "@/db";
import { reminders, tasks } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { parseReminderUpdate } from "@/lib/api/contracts";
import { handleRouteError, notFound, parseJsonObject } from "@/lib/api/errors";
import { eq } from "drizzle-orm";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const updates = parseReminderUpdate(await parseJsonObject(req));

    const [existingReminder] = await db
      .select()
      .from(reminders)
      .where(eq(reminders.id, id))
      .limit(1);

    if (!existingReminder) notFound("Reminder not found.");

    const nextTaskId = (updates.taskId as string | null | undefined) ?? existingReminder.taskId;
    const nextDomain = (updates.domain as string | undefined) ?? existingReminder.domain;

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

    await db.update(reminders).set(updates).where(eq(reminders.id, id));
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

    const [existingReminder] = await db
      .select({ id: reminders.id })
      .from(reminders)
      .where(eq(reminders.id, id))
      .limit(1);

    if (!existingReminder) notFound("Reminder not found.");

    await db.delete(reminders).where(eq(reminders.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
