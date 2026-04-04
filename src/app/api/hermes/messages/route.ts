import { NextResponse } from "next/server";
import { db } from "@/db";
import { hermesMessages } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { eq, asc } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");
    
    if (!sessionId) {
        return NextResponse.json({ error: "Missing sessionId parameter" }, { status: 400 });
    }

    // Fetch messages for a specific session ordered by time
    const data = await db
        .select()
        .from(hermesMessages)
        .where(eq(hermesMessages.sessionId, sessionId))
        .orderBy(asc(hermesMessages.timestamp));

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("Failed to fetch messages: ", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
