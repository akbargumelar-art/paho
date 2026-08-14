import { NextResponse } from "next/server";
import { db } from "@/db";
import { handoffJobs } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { notFound, parseJsonObject } from "@/lib/api/errors";
import { eq } from "drizzle-orm";
import { deleteCronJob, updateCronJob } from "@/lib/live-sources/openclaw-files";

type JobActionPayload = {
  action?: string;
  sourceType?: string;
};

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const url = new URL(req.url);
  const sourceType = url.searchParams.get("sourceType") || "orchestration_metadata";

  if (sourceType === "runtime_openclaw_cron") {
    const ok = await deleteCronJob(id);
    if (!ok) notFound("Runtime job not found.");
    return NextResponse.json({ success: true, sourceType, action: "remove" });
  }

  const result = await db.delete(handoffJobs).where(eq(handoffJobs.id, id)).returning({ id: handoffJobs.id });
  if (!result.length) notFound("Orchestration job not found.");
  return NextResponse.json({ success: true, sourceType, action: "delete" });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const body = (await parseJsonObject(req)) as JobActionPayload;
  const action = String(body.action || "").toLowerCase();
  const sourceType = String(body.sourceType || "orchestration_metadata");

  if (sourceType !== "runtime_openclaw_cron") {
    return NextResponse.json({ error: "Action endpoint only supports runtime jobs." }, { status: 400 });
  }

  if (action === "pause") {
    const ok = await updateCronJob(id, { enabled: false, status: "disabled" });
    if (!ok) notFound("Runtime job not found.");
    return NextResponse.json({ success: true, sourceType, action });
  }

  if (action === "resume") {
    const ok = await updateCronJob(id, { enabled: true, status: "active" });
    if (!ok) notFound("Runtime job not found.");
    return NextResponse.json({ success: true, sourceType, action });
  }

  if (action === "remove") {
    const ok = await deleteCronJob(id);
    if (!ok) notFound("Runtime job not found.");
    return NextResponse.json({ success: true, sourceType, action });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
