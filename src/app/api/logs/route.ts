import { NextResponse } from "next/server";
import { db } from "@/db";
import { executionLogs } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { safeJsonParse } from "@/lib/api/errors";
import { desc } from "drizzle-orm";

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const all = await db.select().from(executionLogs).orderBy(desc(executionLogs.timestamp));
  // Parse metadata JSON back to object
  const mapped = all.map((l: (typeof all)[number]) => ({
    ...l,
    metadata: safeJsonParse<Record<string, unknown>>(l.metadata || "{}", {}),
  }));
  return NextResponse.json(mapped);
}

