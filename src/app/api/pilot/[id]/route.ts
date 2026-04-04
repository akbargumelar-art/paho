import { NextResponse } from "next/server";
import { db } from "@/db";
import { pilotEvaluationItems } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { parsePilotUpdate } from "@/lib/api/contracts";
import { handleRouteError, notFound, parseJsonObject } from "@/lib/api/errors";
import { eq } from "drizzle-orm";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const updates = parsePilotUpdate(await parseJsonObject(req));

    const [existingItem] = await db
      .select({ id: pilotEvaluationItems.id })
      .from(pilotEvaluationItems)
      .where(eq(pilotEvaluationItems.id, id))
      .limit(1);

    if (!existingItem) notFound("Pilot item not found.");

    await db.update(pilotEvaluationItems).set(updates).where(eq(pilotEvaluationItems.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
