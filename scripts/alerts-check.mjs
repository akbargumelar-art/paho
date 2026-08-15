/**
 * Exercises the /api/alerts aggregation against the REAL data sources.
 *
 * The HTTP route itself is auth-gated (verified separately with a 401 probe), so
 * this harness replicates the same logic to prove the aggregation, severity
 * classification and sorting behave correctly on live data.
 */
import fs from "fs/promises";
import { createClient } from "@libsql/client";

const HERMES_CRON_JOBS = "/root/.hermes/cron/jobs.json";
const TASKWORK_DB = "/root/obsidian-vault/90 Hermes/Taskwork/taskwork.db";
const PAHO_DB = "/root/paho/data/aspri.db";
const SOON_HOURS = 24;

function parseWhen(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59` : raw.replace(" ", "T");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
function relativeLabel(due, now) {
  const diff = due.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000), hours = Math.round(abs / 3600000), days = Math.round(abs / 86400000);
  const span = mins < 60 ? `${mins} menit` : hours < 48 ? `${hours} jam` : `${days} hari`;
  return diff < 0 ? `terlambat ${span}` : `${span} lagi`;
}
function classify(due, now) {
  const diff = due.getTime() - now.getTime();
  if (diff < 0) return "overdue";
  if (diff <= SOON_HOURS * 3600000) return "soon";
  return null;
}

const now = new Date();
const alerts = [];
const sourceErrors = [];

// Taskwork
try {
  const c = createClient({ url: `file:${TASKWORK_DB}` });
  const res = await c.execute("SELECT id, category, title, status, priority, due_date FROM tasks WHERE status IN ('todo','in_progress') AND due_date IS NOT NULL AND TRIM(due_date) <> ''");
  console.log(`taskwork: ${res.rows.length} task aktif punya due_date`);
  for (const row of res.rows) {
    const due = parseWhen(row.due_date);
    if (!due) continue;
    const sev = classify(due, now);
    if (!sev) continue;
    alerts.push({ kind: "task", severity: sev, title: row.title, source: `Kanban · ${row.category}`, relative: relativeLabel(due, now) });
  }
} catch (e) { sourceErrors.push(["taskwork", e.message]); }

// Paho tasks + reminders
for (const [table, kind] of [["tasks", "task"], ["reminders", "reminder"]]) {
  try {
    const c = createClient({ url: `file:${PAHO_DB}` });
    const col = table === "tasks" ? "due_date" : "trigger_time";
    const res = await c.execute(`SELECT * FROM ${table}`);
    let considered = 0;
    for (const row of res.rows) {
      if (table === "tasks" && row.status === "completed") continue;
      if (table === "reminders" && (row.status !== "active" || row.is_active === 0)) continue;
      considered += 1;
      const due = parseWhen(row[col]);
      if (!due) continue;
      const sev = classify(due, now);
      if (!sev) continue;
      alerts.push({ kind, severity: sev, title: row.title, source: `${table} · ${row.domain}`, relative: relativeLabel(due, now) });
    }
    console.log(`${table}: ${res.rows.length} baris, ${considered} aktif/belum selesai`);
  } catch (e) { sourceErrors.push([table, e.message]); }
}

// Hermes cron
try {
  const data = JSON.parse(await fs.readFile(HERMES_CRON_JOBS, "utf-8"));
  const jobs = Array.isArray(data?.jobs) ? data.jobs : Array.isArray(data) ? data : [];
  console.log(`hermes-cron: ${jobs.length} job`);
  for (const job of jobs) {
    const name = String(job.name || job.id);
    if (String(job.last_status || "") === "error" || job.last_error) {
      alerts.push({ kind: "cron", severity: "failed", title: name, source: "Hermes cron", relative: "run terakhir gagal" });
      continue;
    }
    if (job.enabled === false || job.state === "paused") {
      alerts.push({ kind: "cron", severity: "failed", title: name, source: "Hermes cron", relative: "dijeda / nonaktif" });
      continue;
    }
    const next = parseWhen(job.next_run_at);
    if (!next) continue;
    const sev = classify(next, now);
    if (!sev) continue;
    alerts.push({ kind: "cron", severity: sev, title: name, source: "Hermes cron", relative: relativeLabel(next, now) });
  }
} catch (e) { sourceErrors.push(["hermes-cron", e.message]); }

const rank = { overdue: 0, failed: 1, soon: 2 };
alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);

console.log(`\nsekarang: ${now.toISOString()}  jendela "mendekati": ${SOON_HOURS} jam`);
console.log(`total alert: ${alerts.length}  (overdue=${alerts.filter(a=>a.severity==="overdue").length} failed=${alerts.filter(a=>a.severity==="failed").length} soon=${alerts.filter(a=>a.severity==="soon").length})`);
for (const a of alerts) console.log(`  [${a.severity.padEnd(7)}] ${a.kind.padEnd(8)} ${a.relative.padEnd(22)} ${String(a.title).slice(0, 52)}  <- ${a.source}`);
if (sourceErrors.length) { console.log("\nsumber gagal dibaca:"); for (const [s, e] of sourceErrors) console.log(`  ${s}: ${e}`); }

// Sanity: classification boundaries
console.log("\n-- uji batas klasifikasi --");
const cases = [
  ["1 menit lalu", new Date(now.getTime() - 60000), "overdue"],
  ["1 jam lagi", new Date(now.getTime() + 3600000), "soon"],
  ["23 jam lagi", new Date(now.getTime() + 23 * 3600000), "soon"],
  ["25 jam lagi", new Date(now.getTime() + 25 * 3600000), null],
  ["7 hari lagi", new Date(now.getTime() + 7 * 86400000), null],
];
let ok = true;
for (const [label, d, expect] of cases) {
  const got = classify(d, now);
  const pass = got === expect;
  if (!pass) ok = false;
  console.log(`  ${label.padEnd(14)} -> ${String(got).padEnd(8)} harap ${String(expect).padEnd(8)} ${pass ? "OK" : "GAGAL"}`);
}
// Date-only due dates must mean end of day, not midnight.
const todayStr = now.toISOString().slice(0, 10);
const endOfToday = parseWhen(todayStr);
const eodOk = endOfToday && endOfToday.getHours() === 23;
console.log(`  due_date "${todayStr}" -> ${endOfToday?.toISOString()} (akhir hari: ${eodOk ? "OK" : "GAGAL"})`);
process.exit(ok && eodOk ? 0 : 1);
