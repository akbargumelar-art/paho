import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";

const TASKWORK_DB = "/root/obsidian-vault/90 Hermes/Taskwork/taskwork.db";
const WEB_CHAT_DIR = join(process.cwd(), "data/web-chat");
const JOBS_FILE = join(WEB_CHAT_DIR, "jobs.json");
const GROUP_JOBS_FILE = join(WEB_CHAT_DIR, "group-jobs.json");
const GROUP_ROOMS_DIR = join(WEB_CHAT_DIR, "group-rooms");
const GROUP_ROOMS_INDEX = join(WEB_CHAT_DIR, "group-rooms.json");
const ATTACHMENTS_DIR = join(WEB_CHAT_DIR, "attachments");

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function workerLabel(id: string) {
  const x = id.toLowerCase();
  if (x === "oca" || x === "ocla" || x === "openclaw") return "Ocla";
  if (x === "bunga") return "Bunga";
  if (x === "corla" || x === "hermes") return "Corla";
  return id || "unknown";
}

async function readJobList(file: string): Promise<Array<{ worker?: string; agent?: string; status?: string; updatedAt?: string; kind?: string }>> {
  try {
    const text = await readFile(file, "utf8");
    const json = JSON.parse(text);
    return Array.isArray(json) ? json : (json?.jobs || []);
  } catch {
    return [];
  }
}

async function readPipeline() {
  const all = [...await readJobList(JOBS_FILE), ...await readJobList(GROUP_JOBS_FILE)];
  const defaults = ["Corla", "Ocla", "Bunga"];
  const map = new Map(defaults.map((w) => [w, { worker: w, running: 0, queued: 0, doneToday: 0, lastUpdate: null as string | null }]));
  const today = localToday();
  for (const j of all) {
    const worker = workerLabel(String(j.worker || j.agent || "unknown"));
    if (!map.has(worker)) continue;
    const row = map.get(worker)!;
    if (j.status === "running") row.running += 1;
    else if (j.status === "queued" || j.status === "pending") row.queued += 1;
    else if (j.status === "done" && String(j.updatedAt || "").slice(0, 10) === today) row.doneToday += 1;
    if (j.updatedAt && (!row.lastUpdate || j.updatedAt > row.lastUpdate)) row.lastUpdate = j.updatedAt;
  }
  return Array.from(map.values()).sort((a, b) => {
    const ai = defaults.indexOf(a.worker);
    const bi = defaults.indexOf(b.worker);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.worker.localeCompare(b.worker);
  });
}

async function listAttachments() {
  try {
    const files = await readdir(ATTACHMENTS_DIR);
    const out: { id: string; name: string; createdAt: string; size?: number; source: string; preview?: string }[] = [];
    for (const f of files) {
      if (!f.endsWith(".md") && !f.endsWith(".txt")) continue;
      const st = await stat(join(ATTACHMENTS_DIR, f));
      out.push({ id: f, name: f, createdAt: st.mtime.toISOString(), size: st.size, source: "attachment" });
    }
    return out;
  } catch {
    return [];
  }
}

async function listGroupSummaries() {
  try {
    const idx = JSON.parse(await readFile(GROUP_ROOMS_INDEX, "utf8"));
    const rooms: Array<{ id: string; title?: string }> = idx?.rooms || [];
    const out: { id: string; name: string; createdAt: string; source: string; preview: string }[] = [];
    for (const r of rooms) {
      try {
        const data = JSON.parse(await readFile(join(GROUP_ROOMS_DIR, `${r.id}.json`), "utf8"));
        const msgs: Array<{ id: string; kind?: string; role?: string; name?: string; content?: string; createdAt?: string; pending?: boolean }> = data?.messages || [];
        for (const m of msgs) {
          if (m.pending) continue;
          if (m.kind === "summary" || String(m.name || "").toLowerCase().includes("ringkasan")) {
            out.push({
              id: m.id,
              name: `${r.title || "Group Chat"} · ${m.name || "ringkasan"}`,
              createdAt: m.createdAt || "",
              source: "group-chat",
              preview: String(m.content || "").slice(0, 180),
            });
          }
        }
      } catch {}
    }
    return out;
  } catch {
    return [];
  }
}

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();
  const today = localToday();
  const db = createClient({ url: `file:${TASKWORK_DB}` });
  try {
    const doneTodayRes = await db.execute({ sql: `SELECT COUNT(*) as c FROM tasks WHERE status='done' AND date(COALESCE(completed_at,updated_at))=?`, args: [today] });
    const pendingCountRes = await db.execute({ sql: `SELECT COUNT(*) as c FROM tasks WHERE status IN ('todo','in_progress')`, args: [] });
    const workers = await readPipeline();
    const outputs = [...await listAttachments(), ...await listGroupSummaries()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const countDone = Number(doneTodayRes.rows[0]?.c ?? 0);
    const pending = Number(pendingCountRes.rows[0]?.c ?? 0);
    const totalRunning = workers.reduce((s, w) => s + w.running, 0);
    return NextResponse.json({
      ok: true,
      date: new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      targets: { todayDone: countDone, minimum: 3, target: 10, met: countDone >= 3, pendingOpen: pending, totalRunning },
      pipeline: { workers, totalRunning, totalQueued: workers.reduce((s, w) => s + w.queued, 0) },
      outputs: { items: outputs.slice(0, 5), count: outputs.length },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  } finally {
    db.close();
  }
}

export const runtime = "nodejs";
