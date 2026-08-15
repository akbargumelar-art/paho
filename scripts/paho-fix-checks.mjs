import { spawn } from "child_process";
import { readdir, copyFile, rm } from "fs/promises";
import { createClient } from "@libsql/client";

const HERMES_BIN = "/root/.local/bin/hermes";
const TASKWORK_SRC = "/root/obsidian-vault/90 Hermes/Taskwork/taskwork.db";

function cleanHermesOutput(raw) {
  const lines = String(raw || "").replace(/\r\n?/g, "\n").split("\n");
  let openIdx = -1;
  for (let i = 0; i < lines.length; i++) if (lines[i].trimStart().startsWith("╭")) openIdx = i;
  const collapse = (arr) => {
    const out = []; let blanks = 0;
    for (const line of arr) {
      if (line.trim() === "") { blanks++; continue; }
      if (out.length && blanks >= 2) out.push("");
      blanks = 0; out.push(line.trimEnd());
    }
    return out.join("\n").trim();
  };
  if (openIdx >= 0) {
    const body = [];
    for (let i = openIdx + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith("╰")) break;
      if (trimmed === "Resume this session with:" || /^(Session|Title|Duration|Messages|Tokens|Cost):\s/.test(trimmed)) break;
      if (/^[─╭╰]/.test(trimmed)) continue;
      body.push(lines[i].replace(/^\s*│\s?/, "").replace(/\s*│\s*$/, ""));
    }
    return collapse(body);
  }
  return collapse(lines.filter((line) => {
    const t = line.trim();
    if (!t) return true;
    if (t.startsWith("Warning: Unknown toolsets:")) return false;
    if (t.startsWith("Query:")) return false;
    if (t === "Initializing agent...") return false;
    if (/^(Session|Title|Duration|Messages|Tokens|Cost):\s/.test(t)) return false;
    if (/^[─╭╰│]/.test(t)) return false;
    return true;
  }));
}

function runHermes(args) {
  return new Promise((resolve) => {
    const events = [];
    let raw = "";
    const start = Date.now();
    const child = spawn(HERMES_BIN, args, {
      env: { ...process.env, HOME: "/root", PATH: `/root/.nvm/versions/node/v24.19.0/bin:${process.env.PATH || ""}` },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => child.kill("SIGTERM"), 120_000);
    child.stdout.on("data", (chunk) => {
      raw += chunk.toString();
      const clean = cleanHermesOutput(raw);
      events.push({ ms: Date.now() - start, rawBytes: raw.length, cleanLen: clean.length });
    });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, events, text: cleanHermesOutput(raw) }); });
  });
}

async function profiles() {
  const names = new Set();
  try { for (const e of await readdir("/root/.hermes/profiles", { withFileTypes: true })) if (e.isDirectory()) names.add(e.name); } catch {}
  return names;
}

async function main() {
  console.log("== streaming ==");
  const stream = await runHermes(["chat", "-q", "Jawab persis tiga kata: merah hijau biru", "-m", "hermes"]);
  console.log(`exit=${stream.code} stdout_chunks=${stream.events.length} first_clean_ms=${stream.events.find(e => e.cleanLen > 0)?.ms ?? -1} final_len=${stream.text.length}`);
  if (stream.events.length < 3 || !stream.text) throw new Error("streaming tidak inkremental");

  console.log("== group profile fallback ==");
  const ps = await profiles();
  const oclaProfile = ps.has("ocla") ? "ocla" : undefined;
  console.log(`profiles=${[...ps].join(",") || "(none)"} oclaProfilePassed=${oclaProfile || "default"}`);
  const group = await runHermes([...(oclaProfile ? ["--profile", oclaProfile] : []), "chat", "-q", "Jawab satu kata: OK", "-m", "hermes"]);
  console.log(`ocla-fallback exit=${group.code} chunks=${group.events.length} text=${JSON.stringify(group.text.slice(0,40))}`);
  if (group.code !== 0 || !group.text) throw new Error("group fallback gagal");

  console.log("== agenda copy DB ==");
  const tmp = "/tmp/paho-agenda-check.db";
  await rm(tmp, { force: true }); await rm(`${tmp}-wal`, { force: true }); await rm(`${tmp}-shm`, { force: true });
  await copyFile(TASKWORK_SRC, tmp);
  const db = createClient({ url: `file:${tmp}` });
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const inserted = await db.execute({ sql: "INSERT INTO tasks (category,title,status,priority,due_date,source) VALUES ('work','UJI Paho agenda','todo','normal',?,'paho-test') RETURNING id", args: [ymd] });
  const id = Number(inserted.rows[0].id);
  await db.execute({ sql: "UPDATE tasks SET status='done', completed_at=datetime('now','localtime') WHERE id=?", args: [id] });
  const row = await db.execute({ sql: "SELECT status, completed_at FROM tasks WHERE id=?", args: [id] });
  await db.close(); await rm(tmp, { force: true }); await rm(`${tmp}-wal`, { force: true }); await rm(`${tmp}-shm`, { force: true });
  console.log(`copy_task id=${id} status=${row.rows[0].status} completed_at=${row.rows[0].completed_at ? "set" : "missing"}`);
  if (row.rows[0].status !== "done" || !row.rows[0].completed_at) throw new Error("agenda toggle copy gagal");

  console.log("ALL_CHECKS_OK");
}
main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
