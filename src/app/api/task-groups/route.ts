import { NextResponse } from "next/server";
import { db } from "@/db";
import { taskGroups } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { parseTaskGroupCreate } from "@/lib/api/contracts";
import { handleRouteError, parseJsonObject } from "@/lib/api/errors";
import { asc } from "drizzle-orm";
import {
  getAssistantTaskGroups,
  saveAssistantTaskGroups,
  upsertAssistantTaskGroup,
} from "@/lib/live-sources/assistant-task-groups";

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

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const groups = await ensureTaskGroupLiveStoreSeeded();
  return NextResponse.json(groups);
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const group = parseTaskGroupCreate(await parseJsonObject(req));
    const saved = await upsertAssistantTaskGroup(group as never);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
