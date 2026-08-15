/**
 * Real end-to-end roundtable discussion over HTTP.
 *
 * Creates a temporary account (Better Auth cookies are signed and Origin-checked
 * so a raw DB token cannot be replayed), runs a roundtable to completion, prints
 * the full transcript shape, then deletes the account and the test room.
 */
import { execFileSync } from "child_process";

const BASE = "http://127.0.0.1:3000";
const ORIGIN = process.env.PAHO_E2E_ORIGIN || "https://paho.aarasa.click";
const EMAIL = `paho-rt-${Date.now()}@local.test`;
const USERNAME = `pahort${Date.now().toString(36)}`;
const PASSWORD = `Rt-${Math.random().toString(36).slice(2)}-Aa1!`;
const TOPIC = process.argv[2]
  || "Untuk Paho, lebih baik notifikasi dikirim lewat polling tiap menit atau webhook realtime? Pilih satu.";
const ROUNDS = Number(process.argv[3] || 2);
let cookie = "";
let roomId = "";

const req = async (path, init = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", origin: ORIGIN, ...(cookie ? { cookie } : {}), ...(init.headers || {}) },
  });
  const jar = (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).filter(Boolean);
  if (jar.length) cookie = jar.join("; ");
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
};

const cleanup = () => {
  execFileSync("python3", ["-c", `
import sqlite3, json, os
c = sqlite3.connect('/root/paho/data/aspri.db')
row = c.execute("select id from user where email = ?", ("${EMAIL}",)).fetchone()
if row:
    uid = row[0]
    for t in ("session", "account"):
        c.execute(f"delete from {t} where user_id = ?", (uid,))
    c.execute("delete from user where id = ?", (uid,))
    c.commit()
rid = "${roomId}"
if rid:
    idx = '/root/paho/data/web-chat/group-rooms.json'
    if os.path.exists(idx):
        d = json.load(open(idx))
        d['rooms'] = [r for r in d['rooms'] if r['id'] != rid]
        json.dump(d, open(idx, 'w'), indent=2)
    p = f'/root/paho/data/web-chat/group-rooms/{rid}.json'
    if os.path.exists(p):
        os.remove(p)
    j = '/root/paho/data/web-chat/group-jobs.json'
    if os.path.exists(j):
        jj = json.load(open(j))
        jj['jobs'] = [x for x in jj['jobs'] if x['roomId'] != rid]
        json.dump(jj, open(j, 'w'), indent=2)
print("cleanup: akun + room tes dibersihkan")
`], { stdio: "inherit" });
};

try {
  const signup = await req("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: "Roundtable Probe", username: USERNAME }),
  });
  if (signup.status >= 400) throw new Error(`signup gagal: ${JSON.stringify(signup.body).slice(0, 200)}`);

  const created = await req("/api/group-chat", {
    method: "POST",
    body: JSON.stringify({ action: "create-room", title: "RT Probe", participants: ["corla", "oca"], model: "hermes", mode: "roundtable", maxRounds: ROUNDS }),
  });
  if (created.status !== 200) throw new Error(`create-room gagal: ${JSON.stringify(created.body).slice(0, 200)}`);
  roomId = created.body.room.id;
  console.log(`room mode=${created.body.room.mode} maxRounds=${created.body.room.maxRounds}`);

  const sent = await req("/api/group-chat", {
    method: "POST",
    body: JSON.stringify({ roomId, message: TOPIC, participants: ["corla", "oca"], model: "hermes", mode: "roundtable", maxRounds: ROUNDS }),
  });
  const round1 = (sent.body?.messages || []).filter((m) => m.kind === "turn" && m.round === 1);
  console.log(`send http=${sent.status} ronde1_placeholder=${round1.length} (harus 2, bukan semua ronde sekaligus)`);
  if (sent.status !== 200 || round1.length !== 2) throw new Error("ronde 1 tidak dibuat dengan benar");

  const deadline = Date.now() + 900_000;
  let last = null;
  let polls = 0;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    const poll = await req(`/api/group-chat?roomId=${encodeURIComponent(roomId)}`);
    last = poll.body;
    polls += 1;
    if (!last?.pending) break;
  }
  if (last?.pending) throw new Error("diskusi masih pending setelah 900s");

  const msgs = last.messages || [];
  const turns = msgs.filter((m) => m.kind === "turn");
  const notices = msgs.filter((m) => m.kind === "notice");
  const summary = msgs.find((m) => m.kind === "summary");
  const rounds = [...new Set(turns.map((m) => m.round))].sort();

  console.log(`\npolls=${polls} total_turn=${turns.length} ronde_terpakai=${rounds.join(",")}`);
  for (const t of turns) {
    console.log(`  R${t.round} ${t.name}: status=${t.status} error=${Boolean(t.error)} len=${t.content.length}`);
    console.log(`      ${JSON.stringify(t.content.slice(0, 110))}`);
    if (/STATUS:/i.test(t.content)) throw new Error(`baris STATUS bocor ke transkrip (${t.name} R${t.round})`);
  }
  console.log(`\nalasan_berhenti="${notices.at(-1)?.content || "(tidak ada)"}"`);
  console.log(`ringkasan_ada=${Boolean(summary)} len=${summary?.content?.length || 0}`);
  if (summary) console.log(`ringkasan:\n${summary.content.slice(0, 700)}`);

  if (!turns.length) throw new Error("tidak ada turn");
  if (!notices.length) throw new Error("tidak ada notice alasan berhenti");
  if (!summary || !summary.content.trim()) throw new Error("ringkasan akhir tidak dibuat");
  if (rounds.some((r) => r > ROUNDS)) throw new Error(`ronde melebihi batas ${ROUNDS}`);
  if (turns.some((t) => t.pending)) throw new Error("masih ada turn pending");
  console.log("\nALL_OK");
} finally {
  cleanup();
}
