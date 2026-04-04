import { NextResponse } from "next/server";
import { db } from "@/db";
import { reminders, tasks } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { parseReminderCreate } from "@/lib/api/contracts";
import { handleRouteError, notFound, parseJsonObject } from "@/lib/api/errors";
import { asc, eq } from "drizzle-orm";

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const all = await db.select().from(reminders).orderBy(asc(reminders.triggerTime));
  return NextResponse.json(all);
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const reminder = parseReminderCreate(await parseJsonObject(req));

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

    await db.insert(reminders).values(reminder);

    return NextResponse.json(reminder, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
