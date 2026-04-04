import { NextResponse } from "next/server";
import { db } from "@/db";
import { taskGroups, tasks } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { handleRouteError, notFound, parseJsonObject } from "@/lib/api/errors";
import { parseTaskCreate } from "@/lib/api/contracts";
import { asc, eq } from "drizzle-orm";

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const allTasks = await db.select().from(tasks).orderBy(
    asc(tasks.dueDate),
    asc(tasks.createdAt),
  );
  return NextResponse.json(allTasks);
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

    await db.insert(tasks).values(task);

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
