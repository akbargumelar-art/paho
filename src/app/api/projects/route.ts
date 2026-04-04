import { NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { asc, desc } from "drizzle-orm";

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const all = await db.select().from(projects).orderBy(
    asc(projects.status),
    desc(projects.createdAt),
  );
  return NextResponse.json(all);
}
