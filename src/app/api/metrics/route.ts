import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, handoffJobs } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { ne, eq, or, count } from "drizzle-orm";
import { getHermesGatewayState, countHermesSessions } from "@/lib/live-sources/hermes-gateway";
import { countPendingApprovals, getCronJobs } from "@/lib/live-sources/openclaw-files";

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  // ---- DB-authoritative counts (tasks & handoff jobs di aspri.db) ----
  const [activeTasksResult] = await db
    .select({ count: count() })
    .from(tasks)
    .where(ne(tasks.status, "completed"));

  const [activeHandoffResult] = await db
    .select({ count: count() })
    .from(handoffJobs)
    .where(or(eq(handoffJobs.status, "running"), eq(handoffJobs.status, "queued")));

  // ---- Live sources dari VPS (returns 0/null jika env tidak dikonfigurasi) ----
  const [gatewayState, pendingApprovals, cronJobs, sessionCount] = await Promise.allSettled([
    getHermesGatewayState(),
    countPendingApprovals(),
    getCronJobs(),
    countHermesSessions(),
  ]);

  const gateway = gatewayState.status === "fulfilled" ? gatewayState.value : null;
  const approvalCount = pendingApprovals.status === "fulfilled" ? pendingApprovals.value : 0;
  const activeCronJobs =
    cronJobs.status === "fulfilled"
      ? cronJobs.value.filter((j) => j.status !== "disabled").length
      : 0;
  const totalSessions = sessionCount.status === "fulfilled" ? sessionCount.value : 0;

  // ---- Status Hermes dari gateway_state.json ----
  const hermesOnline = gateway?.gateway_state === "running";
  const telegramOk = gateway?.platforms?.telegram?.state === "connected";
  const whatsappOk = gateway?.platforms?.whatsapp?.state === "connected";

  // ---- System health score ----
  const systemHealth = Math.max(
    20,
    100 - approvalCount * 4 - (!hermesOnline ? 20 : 0) - (!telegramOk ? 5 : 0),
  );

  const systemStatus =
    !hermesOnline
      ? "offline"
      : approvalCount > 0 || systemHealth < 85
        ? "degraded"
        : "online";

  return NextResponse.json({
    // Core status
    systemStatus,
    systemHealth,

    // Hermes (live dari gateway_state.json)
    hermesStatus: gateway?.gateway_state ?? "unknown",
    hermesOnline,
    telegramConnected: telegramOk,
    whatsappConnected: whatsappOk,
    hermesUpdatedAt: gateway?.updated_at ?? null,
    hermesPlatforms: gateway?.platforms ?? {},

    // Tasks & jobs (Paho-authoritative dari aspri.db)
    activeHermesTasks: activeTasksResult.count,
    activeHandoffJobs: activeHandoffResult.count,

    // OpenClaw (live dari cron/jobs.json)
    activeOpenClawJobs: activeCronJobs,

    // Approvals (live dari exec-approvals.json)
    pendingApprovals: approvalCount,

    // Session logs (live dari /root/.hermes/sessions/)
    totalSessions,

    // Legacy compat
    recentLogsCount: 0,
    highRiskPending: approvalCount,
  });
}
