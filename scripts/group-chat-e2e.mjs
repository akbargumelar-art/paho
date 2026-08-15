/**
 * End-to-end Group Chat test through the real HTTP API with a real session.
 *
 * Better Auth cookies are SIGNED (`token.signature`), so a raw session token
 * copied out of SQLite cannot be replayed — hence a temporary account is
 * created, used, and deleted at the end.
 */
import { execFileSync } from "child_process";

const BASE = "http://127.0.0.1:3000";
// Better Auth validates Origin against BETTER_AUTH_URL, so the probe must
// present the public origin even while talking to the loopback port.
const ORIGIN = process.env.PAHO_E2E_ORIGIN || "https://paho.aarasa.click";
const EMAIL = `paho-e2e-${Date.now()}@local.test`;
const USERNAME = `pahoe2e${Date.now().toString(36)}`;
const PASSWORD = `E2e-${Math.random().toString(36).slice(2)}-Aa1!`;
let cookie = "";

const req = async (path, init = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    // Better Auth enforces CSRF via Origin. Without it every auth call returns
    // 403 MISSING_OR_NULL_ORIGIN, which looks like a credentials problem.
    headers: {
      "Content-Type": "application/json",
      origin: ORIGIN,
      ...(cookie ? { cookie } : {}),
      ...(init.headers || {}),
    },
  });
  const setCookie = res.headers.getSetCookie?.() || [];
  const jar = setCookie.map((c) => c.split(";")[0]).filter(Boolean);
  if (jar.length) cookie = jar.join("; ");
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
};

const cleanup = () => {
  execFileSync("python3", ["-c", `
import sqlite3
c = sqlite3.connect('/root/paho/data/aspri.db')
row = c.execute("select id from user where email = ?", ("${EMAIL}",)).fetchone()
if row:
    uid = row[0]
    c.execute("delete from session where user_id = ?", (uid,))
    c.execute("delete from account where user_id = ?", (uid,))
    c.execute("delete from user where id = ?", (uid,))
    c.commit()
    print("cleanup: test user dihapus")
else:
    print("cleanup: tidak ada user tes")
`], { stdio: "inherit" });
};

try {
  const signup = await req("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: "E2E Probe", username: USERNAME }),
  });
  console.log(`signup http=${signup.status}`);
  if (signup.status >= 400) throw new Error(`signup gagal: ${JSON.stringify(signup.body).slice(0, 200)}`);
  if (!cookie) throw new Error("tidak dapat cookie sesi");

  const list = await req("/api/group-chat");
  console.log(`GET /api/group-chat http=${list.status} rooms=${list.body?.rooms?.length} agents=${list.body?.agents?.map((a) => a.id).join(",")}`);
  if (list.status !== 200) throw new Error("list gagal");

  const created = await req("/api/group-chat", {
    method: "POST",
    body: JSON.stringify({ action: "create-room", title: "E2E Room", participants: ["corla", "oca"], model: "hermes" }),
  });
  console.log(`create-room http=${created.status} roomId=${created.body?.room?.id} participants=${created.body?.room?.participants?.join(",")}`);
  if (created.status !== 200 || !created.body?.room?.id) throw new Error("create-room gagal");
  const roomId = created.body.room.id;

  const sent = await req("/api/group-chat", {
    method: "POST",
    body: JSON.stringify({ roomId, message: "Balas dengan satu kata: OK", participants: ["corla", "oca"], model: "hermes" }),
  });
  const placeholders = (sent.body?.messages || []).filter((m) => m.role === "assistant");
  console.log(`send http=${sent.status} pending=${sent.body?.pending} placeholder_assistant=${placeholders.length}`);
  if (sent.status !== 200 || placeholders.length !== 2) throw new Error("send tidak membuat 2 placeholder");

  const deadline = Date.now() + 240_000;
  let last = null;
  let sawPartial = 0;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await req(`/api/group-chat?roomId=${encodeURIComponent(roomId)}`);
    last = poll.body;
    const assistants = (last?.messages || []).filter((m) => m.role === "assistant");
    if (assistants.some((m) => m.pending && m.content)) sawPartial += 1;
    if (!last?.pending) break;
  }
  const assistants = (last?.messages || []).filter((m) => m.role === "assistant");
  console.log(`pending_akhir=${last?.pending} partial_terlihat=${sawPartial}`);
  for (const m of assistants) {
    console.log(`  ${m.name}: error=${Boolean(m.error)} len=${m.content.length} text=${JSON.stringify(m.content.slice(0, 90))}`);
  }
  const failed = assistants.filter((m) => m.error || !m.content.trim());
  if (last?.pending) throw new Error("masih pending setelah 240s");
  if (failed.length) throw new Error(`${failed.length} agent gagal menjawab`);
  console.log("ALL_OK");
} finally {
  cleanup();
}
