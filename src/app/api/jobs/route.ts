import { NextResponse } from "next/server";
import { db } from "@/db";
import { handoffJobs, tasks } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { parseJobCreate } from "@/lib/api/contracts";
import { handleRouteError, notFound, parseJsonObject } from "@/lib/api/errors";
import { eq } from "drizzle-orm";
import { getCronJobs } from "@/lib/live-sources/openclaw-files";

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const dbJobs = await db.select().from(handoffJobs);
  const orchestrationJobs = dbJobs.map((j) => ({
    id: j.id,
    sourceType: "orchestration_metadata" as const,
    source: "paho" as const,
    taskId: j.taskId,
    contextPack: {
      instruction: j.contextInstruction,
      dataSource: j.contextDataSource,
      schedule: j.contextSchedule,
    },
    worker: j.worker,
    jobType: j.jobType,
    status: j.status,
    returnOutput: j.returnOutput,
    domain: j.domain,
    ownerFinal: j.ownerFinal,
    returnPath: j.returnPath,
    approvalPath: j.approvalPath,
    riskLevel: j.riskLevel,
  }));

  const cronJobs = await getCronJobs().catch(() => []);
  const runtimeJobs = cronJobs.map((j) => ({
    id: j.id,
    sourceType: "runtime_openclaw_cron" as const,
    source: "openclaw" as const,
    taskId: null,
    contextPack: {
      instruction: j.description ?? j.name ?? "",
      dataSource: "runtime:openclaw-cron",
      schedule: j.schedule ?? "",
    },
    worker: "OPENCLAW",
    jobType: "cron",
    status: j.enabled === false ? "disabled" : (j.status ?? "active"),
    returnOutput: j.last_run ? `Last run: ${j.last_run}` : null,
    domain: "work",
    ownerFinal: "OpenClaw",
    returnPath: "runtime/openclaw",
    approvalPath: "OpenClaw-backend-only",
    riskLevel: "low",
    cronName: j.name,
    cronSchedule: j.schedule,
    nextRun: j.next_run ?? null,
    lastRun: j.last_run ?? null,
  }));

  return NextResponse.json({
    orchestrationJobs,
    runtimeJobs,
    combinedView: [...orchestrationJobs, ...runtimeJobs],
    summary: {
      orchestrationCount: orchestrationJobs.length,
      runtimeCount: runtimeJobs.length,
    },
  });
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const job = parseJobCreate(await parseJsonObject(req));

    const [task] = await db
      .select({ id: tasks.id, domain: tasks.domain })
      .from(tasks)
      .where(eq(tasks.id, job.taskId))
      .limit(1);

    if (!task) notFound("Job task not found.");

    if (task.domain !== job.domain) {
      return NextResponse.json(
        { error: "Job domain must match its task domain." },
        { status: 400 },
      );
    }

    await db.insert(handoffJobs).values(job);

    return NextResponse.json(
      {
        ...job,
        source: "paho",
        sourceType: "orchestration_metadata",
        contextPack: {
          instruction: job.contextInstruction,
          dataSource: job.contextDataSource,
          schedule: job.contextSchedule,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
