import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { listPahoOutputs } from "@/lib/paho-outputs";

const TASKWORK_DB = "/root/obsidian-vault/90 Hermes/Taskwork/taskwork.db";

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();
  const today = localToday();
  const db = createClient({ url: `file:${TASKWORK_DB}` });
  try {
    const doneTodayRes = await db.execute({ sql: `SELECT COUNT(*) as c FROM tasks WHERE status='done' AND date(COALESCE(completed_at,updated_at))=?`, args: [today] });
    const pendingCountRes = await db.execute({ sql: `SELECT COUNT(*) as c FROM tasks WHERE status IN ('todo','in_progress')`, args: [] });
    const { jobs, outputs } = await listPahoOutputs(5);
    const countDone = Number(doneTodayRes.rows[0]?.c ?? 0);
    const pending = Number(pendingCountRes.rows[0]?.c ?? 0);
    const workers = [
      { worker: "Corla", source: "Taskwork", running: 0, queued: pending, doneToday: countDone, note: "orchestrator + task decision" },
      { worker: "Hermes Cron", source: "cronjob", running: jobs.filter((j) => j.enabled && j.lastStatus !== "error").length, queued: jobs.filter((j) => j.enabled).length, doneToday: outputs.filter((o) => o.createdAt.slice(0,10) === today).length, note: "scheduled output store" },
      { worker: "Ocla", source: "OpenClaw", running: 0, queued: 0, doneToday: 0, note: "worker backend; not used as output store" },
    ];
    return NextResponse.json({
      ok: true,
      date: new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      targets: { todayDone: countDone, minimum: 3, target: 10, met: countDone >= 3, pendingOpen: pending },
      pipeline: { workers, totalRunning: workers.reduce((s, w) => s + w.running, 0), totalQueued: workers.reduce((s, w) => s + w.queued, 0) },
      outputs: { items: outputs, count: outputs.length },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  } finally {
    db.close();
  }
}

export const runtime = "nodejs";
