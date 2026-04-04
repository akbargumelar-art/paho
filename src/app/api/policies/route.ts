import { NextResponse } from "next/server";
import { db } from "@/db";
import { modelPolicies } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { safeJsonParse } from "@/lib/api/errors";
import { asc } from "drizzle-orm";

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const all = await db.select().from(modelPolicies).orderBy(
    asc(modelPolicies.tier),
    asc(modelPolicies.id),
  );
  // Parse rules JSON back to array
  const mapped = all.map((p: (typeof all)[number]) => ({
    ...p,
    rules: safeJsonParse<string[]>(p.rules || "[]", []),
  }));
  return NextResponse.json(mapped);
}

