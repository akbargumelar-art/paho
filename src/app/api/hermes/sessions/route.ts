import { NextResponse } from "next/server";
import { db } from "@/db";
import { hermesSessions } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { desc, count } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "10");
    
    // Pagination calculus
    const skip = (page - 1) * pageSize;

    // Run parallel queries using Drizzle
    const [data, totalCount] = await Promise.all([
      db
        .select({
           id: hermesSessions.id,
           source: hermesSessions.source,
           model: hermesSessions.model,
           startedAt: hermesSessions.startedAt,
           messageCount: hermesSessions.messageCount,
           actualCostUsd: hermesSessions.actualCostUsd,
           title: hermesSessions.title,
        })
        .from(hermesSessions)
        .orderBy(desc(hermesSessions.startedAt))
        .limit(pageSize)
        .offset(skip),
      db.select({ value: count() }).from(hermesSessions)
    ]);

    return NextResponse.json({
      data,
      metadata: {
        total: totalCount[0].value,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount[0].value / pageSize)
      }
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Failed to fetch sessions: ", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
