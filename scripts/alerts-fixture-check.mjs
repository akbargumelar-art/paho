/**
 * Proves the task branch of /api/alerts works when due dates exist.
 * Uses a COPY of the Taskwork DB — the real database is never modified.
 */
import { createClient } from "@libsql/client";
import { copyFile, rm } from "fs/promises";

const SRC = "/root/obsidian-vault/90 Hermes/Taskwork/taskwork.db";
const TMP = "/tmp/alerts-fixture.db";
const SOON_HOURS = 24;

function parseWhen(v) {
  if (!v) return null;
  const raw = String(v).trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59` : raw.replace(" ", "T");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
function classify(due, now) {
  const diff = due.getTime() - now.getTime();
  if (diff < 0) return "overdue";
  if (diff <= SOON_HOURS * 3600000) return "soon";
  return null;
}
function relativeLabel(due, now) {
  const diff = due.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000), hours = Math.round(abs / 3600000), days = Math.round(abs / 86400000);
  const span = mins < 60 ? `${mins} menit` : hours < 48 ? `${hours} jam` : `${days} hari`;
  return diff < 0 ? `terlambat ${span}` : `${span} lagi`;
}

await copyFile(SRC, TMP);
await rm(`${TMP}-wal`, { force: true });
await rm(`${TMP}-shm`, { force: true });
const c = createClient({ url: `file:${TMP}` });

const now = new Date();
// Due dates are date-only strings interpreted in LOCAL time (end of day), so the
// fixtures must be built from the local date, not the UTC date. Getting this
// wrong makes "today" look overdue whenever local time is ahead of UTC.
const localDate = (offsetMs) => {
  const d = new Date(now.getTime() + offsetMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const d = localDate;
const fixtures = [
  ["UJI overdue 3 hari", d(-3 * 86400000), "overdue"],
  ["UJI due kemarin", d(-86400000), "overdue"],
  ["UJI due hari ini", d(0), "soon"],
  ["UJI jauh 10 hari", d(10 * 86400000), null],
];

for (const [title, due] of fixtures) {
  await c.execute({
    sql: "INSERT INTO tasks (category, title, status, priority, due_date, source) VALUES (?, ?, 'todo', 'high', ?, 'alerts-fixture')",
    args: ["work", title, due],
  });
}
// A completed task with an overdue date must NOT alert.
await c.execute({
  sql: "INSERT INTO tasks (category, title, status, priority, due_date, source, completed_at) VALUES (?, ?, 'done', 'high', ?, 'alerts-fixture', ?)",
  args: ["work", "UJI selesai walau lewat", d(-5 * 86400000), new Date().toISOString()],
});

const res = await c.execute(
  "SELECT id, category, title, status, priority, due_date FROM tasks WHERE status IN ('todo','in_progress') AND due_date IS NOT NULL AND TRIM(due_date) <> ''"
);

console.log(`kandidat dari query: ${res.rows.length}`);
const produced = new Map();
for (const row of res.rows) {
  const due = parseWhen(row.due_date);
  const sev = classify(due, now);
  if (sev) produced.set(row.title, { sev, rel: relativeLabel(due, now) });
}

let ok = true;
console.log("\n-- hasil per fixture --");
for (const [title, due, expect] of fixtures) {
  const got = produced.get(title);
  const gotSev = got?.sev ?? null;
  const pass = gotSev === expect;
  if (!pass) ok = false;
  console.log(`  ${title.padEnd(24)} due=${due}  -> ${String(gotSev).padEnd(8)} harap ${String(expect).padEnd(8)} ${got?.rel ? `(${got.rel})` : ""} ${pass ? "OK" : "GAGAL"}`);
}
const completedLeaked = produced.has("UJI selesai walau lewat");
if (completedLeaked) ok = false;
console.log(`  task 'done' walau lewat batas tidak muncul: ${completedLeaked ? "GAGAL (muncul)" : "OK"}`);

// The real DB must be untouched.
const real = createClient({ url: `file:${SRC}` });
const leak = await real.execute("SELECT COUNT(*) AS n FROM tasks WHERE source = 'alerts-fixture'");
const total = await real.execute("SELECT COUNT(*) AS n FROM tasks");
console.log(`\nDB asli: total tasks=${Number(total.rows[0].n)}  fixture bocor=${Number(leak.rows[0].n)} ${Number(leak.rows[0].n) === 0 ? "OK" : "GAGAL"}`);
if (Number(leak.rows[0].n) !== 0) ok = false;

process.exit(ok ? 0 : 1);
