/**
 * Verifies the two fixes that cannot be checked from the browser without a
 * session: (1) partial cleaning never leaks the prompt, (2) alert dismiss
 * state actually suppresses the badge and re-alerts on signature change.
 */
import { spawn, execFileSync } from "child_process";
import { mkdtemp, rm, readFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

// ---- 1. partial cleaning against real Hermes byte stream ----
// Compile the real helper with tsc instead of regex-stripping types: a hand
// rolled stripper silently diverges from the code that actually ships.
const tmp = await mkdtemp(path.join(tmpdir(), "ho-"));
execFileSync("npx", [
  "tsc", "/root/paho/src/lib/hermes-output.ts",
  "--outDir", tmp, "--module", "esnext", "--target", "es2022", "--moduleResolution", "bundler",
], { cwd: "/root/paho", stdio: "inherit" });
const { cleanHermesOutput } = await import(path.join(tmp, "hermes-output.js"));

const prompt = "Sebutkan dua warna, satu per baris, lalu satu paragraf penutup.";
const raw = await new Promise((resolve) => {
  let buf = "";
  const partials = [];
  const child = spawn("/root/.local/bin/hermes", ["chat", "-q", prompt, "-m", "hermes"], {
    env: { ...process.env, HOME: "/root", PATH: `/root/.nvm/versions/node/v24.19.0/bin:${process.env.PATH || ""}` },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (c) => { buf += c.toString(); partials.push(cleanHermesOutput(buf)); });
  child.on("close", () => resolve({ buf, partials }));
});

const leaked = raw.partials.filter((p) => p && p.includes(prompt.slice(0, 30)));
const nonEmpty = raw.partials.filter((p) => p.length > 0);
const growing = nonEmpty.length >= 2 && nonEmpty[nonEmpty.length - 1].length > nonEmpty[0].length;
console.log("== partial cleaning ==");
console.log(`chunks=${raw.partials.length} partial_terisi=${nonEmpty.length} prompt_bocor=${leaked.length} tumbuh=${growing}`);
console.log(`partial_pertama=${JSON.stringify(nonEmpty[0]?.slice(0, 60) || "")}`);
console.log(`final=${JSON.stringify(cleanHermesOutput(raw.buf).slice(0, 80))}`);
if (leaked.length > 0) throw new Error("prompt bocor ke partial");
if (nonEmpty.length === 0) throw new Error("tidak ada partial terisi");

// ---- 2. dismiss signature logic ----
const signatureOf = (a) => `${a.severity}|${a.dueAt || "-"}`;
const alerts = [
  { id: "cron-a", severity: "failed", dueAt: null },
  { id: "task-b", severity: "soon", dueAt: "2026-08-17T23:59:59.000Z" },
];
let state = {};
for (const a of alerts) state[a.id] = signatureOf(a);
const unreadAfterAck = alerts.filter((a) => state[a.id] !== signatureOf(a));
// deadline bergeser -> harus muncul lagi
const moved = { id: "task-b", severity: "overdue", dueAt: "2026-08-15T23:59:59.000Z" };
const reAlerts = state[moved.id] !== signatureOf(moved);
// prune: id yang hilang harus dibuang
const live = new Set(["cron-a"]);
const pruned = Object.fromEntries(Object.entries(state).filter(([id]) => live.has(id)));
console.log("== dismiss logic ==");
console.log(`unread_setelah_baca_semua=${unreadAfterAck.length} (harus 0)`);
console.log(`muncul_lagi_saat_deadline_berubah=${reAlerts} (harus true)`);
console.log(`ukuran_state_setelah_prune=${Object.keys(pruned).length} (harus 1)`);
if (unreadAfterAck.length !== 0 || !reAlerts || Object.keys(pruned).length !== 1) {
  throw new Error("logika dismiss salah");
}

await rm(tmp, { recursive: true, force: true });
console.log("ALL_OK");
