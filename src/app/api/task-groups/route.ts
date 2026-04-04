import { NextResponse } from "next/server";
import { db } from "@/db";
import { taskGroups } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { parseTaskGroupCreate } from "@/lib/api/contracts";
import { handleRouteError, parseJsonObject } from "@/lib/api/errors";
import { asc } from "drizzle-orm";

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const groups = await db.select().from(taskGroups).orderBy(
    asc(taskGroups.domain),
    asc(taskGroups.createdAt),
  );
  return NextResponse.json(groups);
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const group = parseTaskGroupCreate(await parseJsonObject(req));
    await db.insert(taskGroups).values(group);

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
