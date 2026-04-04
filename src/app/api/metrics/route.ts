import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, handoffJobs, approvalGuardrails, executionLogs } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { ne, eq, or, and, count } from "drizzle-orm";

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const [activeTasksResult] = await db
    .select({ count: count() })
    .from(tasks)
    .where(ne(tasks.status, "completed"));

  const [activeJobsResult] = await db
    .select({ count: count() })
    .from(handoffJobs)
    .where(or(eq(handoffJobs.status, "running"), eq(handoffJobs.status, "queued")));

  const [pendingApprovalsResult] = await db
    .select({ count: count() })
    .from(approvalGuardrails)
    .where(eq(approvalGuardrails.reviewStatus, "pending"));

  const [logsCountResult] = await db.select({ count: count() }).from(executionLogs);

  const [highRiskResult] = await db
    .select({ count: count() })
    .from(approvalGuardrails)
    .where(
      and(
        eq(approvalGuardrails.reviewStatus, "pending"),
        or(
          eq(approvalGuardrails.riskLevel, "high"),
          eq(approvalGuardrails.riskLevel, "critical")
        )
      )
    );

  const [failedCriticalLogsResult] = await db
    .select({ count: count() })
    .from(executionLogs)
    .where(
      and(
        eq(executionLogs.status, "failed"),
        or(
          eq(executionLogs.level, "ERROR"),
          eq(executionLogs.level, "CRITICAL")
        )
      )
    );

  const highRiskPending = highRiskResult.count;
  const failedCriticalLogs = failedCriticalLogsResult.count;
  const systemHealth = Math.max(
    20,
    100 - (pendingApprovalsResult.count * 4) - (highRiskPending * 8) - (failedCriticalLogs * 6)
  );

  const systemStatus =
    failedCriticalLogs >= 3
      ? "offline"
      : highRiskPending > 0 || failedCriticalLogs > 0 || systemHealth < 85
        ? "degraded"
        : "online";

  return NextResponse.json({
    systemStatus,
    activeHermesTasks: activeTasksResult.count,
    activeOpenClawJobs: activeJobsResult.count,
    pendingApprovals: pendingApprovalsResult.count,
    recentLogsCount: logsCountResult.count,
    systemHealth,
    highRiskPending,
  });
}
