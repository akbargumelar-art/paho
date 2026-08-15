/**
 * Verifies in a REAL browser that the nav rule holds:
 * a page that appears as a section tab must not also appear in the sidebar or
 * the mobile bottom bar.
 */
import WebSocket from "ws";

const BASE = process.argv[2] || "http://127.0.0.1:3000";
const CDP = "http://127.0.0.1:9222";

const PROBE = `(() => {
  const hrefs = (sel) => Array.from(document.querySelectorAll(sel))
    .map(a => a.getAttribute('href')).filter(Boolean);
  // Only the real tab strip counts — page content links (e.g. dashboard quick
  // links) are not navigation and may legitimately point anywhere.
  return {
    sidebar: hrefs('aside nav a'),
    tabStrip: hrefs('[data-section-tabs] a'),
    mobileBar: hrefs('.dashboard-mobile-tabbar a'),
    activeTab: document.querySelector('[data-section-tabs] a[aria-current="page"]')?.getAttribute('href') || null,
  };
})()`;

function connect(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url, { perMessageDeflate: false });
    ws.on("open", () => res(ws));
    ws.on("error", rej);
  });
}
function sender(ws) {
  let id = 0; const pending = new Map();
  ws.on("message", (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  });
  return (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id; pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
    setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error(method + " timeout")); } }, 30000);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const target = await (await fetch(`${CDP}/json/new?about:blank`, { method: "PUT" })).json();
const ws = await connect(target.webSocketDebuggerUrl);
const send = sender(ws);
await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
await send("Network.setCookie", { name: "better-auth.session_token", value: "ux-probe", domain: new URL(BASE).hostname, path: "/" });
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

const checks = ["/dashboard/chat", "/dashboard/group-chat", "/dashboard/tasks", "/dashboard/hermes-manager", "/dashboard/console", "/dashboard", "/dashboard/brief"];
let failures = 0;

for (const p of checks) {
  await send("Page.navigate", { url: BASE + p });
  await sleep(2400);
  const { result } = await send("Runtime.evaluate", { expression: PROBE, returnByValue: true });
  const v = result.value;
  const tabs = v.tabStrip || [];
  const dupSidebar = tabs.filter((h) => v.sidebar.includes(h) && h !== tabs[0]);
  const dupMobile = tabs.filter((h) => v.mobileBar.includes(h) && h !== tabs[0]);
  const ok = dupSidebar.length === 0 && dupMobile.length === 0;
  if (!ok) failures += 1;
  console.log(`${p.padEnd(28)} sidebar=${v.sidebar.length} tab=${tabs.length} bottom=${v.mobileBar.length} activeTab=${v.activeTab || "-"} dup(sidebar/bottom)=${dupSidebar.length}/${dupMobile.length} ${ok ? "OK" : "GAGAL"}`);
}

console.log(`\nHASIL: ${failures ? failures + " halaman punya menu ganda" : "BERSIH — tidak ada halaman tab yang juga muncul di sidebar/bottom bar"}`);
ws.close();
await fetch(`${CDP}/json/close/${target.id}`);
process.exit(failures ? 1 : 0);
