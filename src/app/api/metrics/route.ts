import { NextResponse } from "next/server";
import { db } from "@/db";
import { handoffJobs } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { eq, or, count } from "drizzle-orm";
import { getHermesGatewayState, countHermesSessions } from "@/lib/live-sources/hermes-gateway";
import { countPendingApprovals, getCronJobs } from "@/lib/live-sources/openclaw-files";
import { getAssistantTasks } from "@/lib/live-sources/assistant-tasks";
import { getAssistantReminders } from "@/lib/live-sources/assistant-reminders";
import { getAssistantTaskGroups } from "@/lib/live-sources/assistant-task-groups";

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const [activeHandoffResult] = await db
    .select({ count: count() })
    .from(handoffJobs)
    .where(or(eq(handoffJobs.status, "running"), eq(handoffJobs.status, "queued")));

  const [gatewayState, pendingApprovals, cronJobs, sessionCount, liveTasks, liveReminders, liveGroups] = await Promise.allSettled([
    getHermesGatewayState(),
    countPendingApprovals(),
    getCronJobs(),
    countHermesSessions(),
    getAssistantTasks(),
    getAssistantReminders(),
    getAssistantTaskGroups(),
  ]);

  const gateway = gatewayState.status === "fulfilled" ? gatewayState.value : null;
  const approvalCount = pendingApprovals.status === "fulfilled" ? pendingApprovals.value : 0;
  const activeCronJobs = cronJobs.status === "fulfilled" ? cronJobs.value.filter((j) => j.status !== "disabled").length : 0;
  const totalSessions = sessionCount.status === "fulfilled" ? sessionCount.value : 0;
  const tasks = liveTasks.status === "fulfilled" ? liveTasks.value : [];
  const reminders = liveReminders.status === "fulfilled" ? liveReminders.value : [];
  const taskGroups = liveGroups.status === "fulfilled" ? liveGroups.value : [];

  const activeTaskCount = tasks.filter((t) => t.status !== "completed").length;
  const activeReminderCount = reminders.filter((r) => r.status === "active").length;
  const activeGroupCount = taskGroups.length;

  const hermesOnline = gateway?.gateway_state === "running";
  const telegramOk = gateway?.platforms?.telegram?.state === "connected";
  const whatsappOk = gateway?.platforms?.whatsapp?.state === "connected";

  const systemHealth = Math.max(
    20,
    100 - approvalCount * 4 - (!hermesOnline ? 20 : 0) - (!telegramOk ? 5 : 0),
  );

  const systemStatus = !hermesOnline ? "offline" : approvalCount > 0 || systemHealth < 85 ? "degraded" : "online";

  return NextResponse.json({
    systemStatus,
    systemHealth,
    hermesStatus: gateway?.gateway_state ?? "unknown",
    hermesOnline,
    telegramConnected: telegramOk,
    whatsappConnected: whatsappOk,
    hermesUpdatedAt: gateway?.updated_at ?? null,
    hermesPlatforms: gateway?.platforms ?? {},

    activeHermesTasks: activeTaskCount,
    activeReminders: activeReminderCount,
    activeTaskGroups: activeGroupCount,
    activeHandoffJobs: activeHandoffResult.count,
    activeOpenClawJobs: activeCronJobs,
    pendingApprovals: approvalCount,
    totalSessions,

    dataSources: {
      tasks: "live-backed",
      reminders: "live-backed",
      taskGroups: "live-backed",
      handoffJobs: "orchestration-metadata-db",
      runtimeCron: "openclaw-live",
      approvals: "openclaw-live",
      hermesGateway: "hermes-live",
    },

    recentLogsCount: 0,
    highRiskPending: approvalCount,
  });
}
