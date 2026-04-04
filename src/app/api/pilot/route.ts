import { NextResponse } from "next/server";
import { db } from "@/db";
import { pilotEvaluationItems } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { asc } from "drizzle-orm";

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const all = await db.select().from(pilotEvaluationItems).orderBy(
    asc(pilotEvaluationItems.phase),
    asc(pilotEvaluationItems.id),
  );
  return NextResponse.json(all);
}
