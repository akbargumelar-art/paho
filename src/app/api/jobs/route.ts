import { NextResponse } from "next/server";
import { db } from "@/db";
import { handoffJobs, tasks } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { parseJobCreate } from "@/lib/api/contracts";
import { handleRouteError, notFound, parseJsonObject } from "@/lib/api/errors";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const all = await db.select().from(handoffJobs);
  // Transform flat columns back to contextPack shape for frontend compatibility
  const mapped = all.map((j: (typeof all)[number]) => ({
    id: j.id,
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
  return NextResponse.json(mapped);
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

