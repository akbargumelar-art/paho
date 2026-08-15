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
  const bar = document.querySelector('.dashboard-mobile-tabbar');
  const entries = bar ? Array.from(bar.children).map(el => {
    const span = el.querySelector('span:last-child');
    return {
      href: el.getAttribute('href'),
      text: (el.innerText || '').trim(),
      center: el.classList.contains('dashboard-mobile-tab-center'),
      // A label whose text overflows its box is rendered with an ellipsis —
      // that counts as "terpotong" and must fail.
      clipped: span ? span.scrollWidth > span.clientWidth + 1 : false,
    };
  }) : [];
  // Only the real tab strip counts — page content links (e.g. dashboard quick
  // links) are not navigation and may legitimately point anywhere.
  return {
    sidebar: hrefs('aside nav a'),
    tabStrip: hrefs('[data-section-tabs] a'),
    mobileBar: hrefs('.dashboard-mobile-tabbar a'),
    barDisplay: bar ? getComputedStyle(bar).display : 'missing',
    barOrder: entries.map(e => e.text.replace(/\\s+/g, ' ')),
    clippedLabels: entries.filter(e => e.clipped).map(e => e.text),
    centerIndex: entries.findIndex(e => e.center),
    centerHref: entries.find(e => e.center)?.href || null,
    entryCount: entries.length,
    bell: Boolean(document.querySelector('header button[aria-label^="Notifikasi"]')),
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
const EXPECTED_ORDER = ["Dashboard", "Briefing", "Chat", "Kanban", "Lainnya"];
let failures = 0;

// --- Pass 1: mobile viewport (bar must be visible, ordered, centered Chat) ---
// 360px is the tightest real phone width — labels must still fit there.
for (const width of [360, 390]) {
await send("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 1, mobile: true });
console.log(`== MOBILE ${width}px ==`);
for (const p of checks) {
  await send("Page.navigate", { url: BASE + p });
  await sleep(2400);
  const { result } = await send("Runtime.evaluate", { expression: PROBE, returnByValue: true });
  const v = result.value;
  const tabs = v.tabStrip || [];
  const dupSidebar = tabs.filter((h) => v.sidebar.includes(h) && h !== tabs[0]);
  const dupMobile = tabs.filter((h) => v.mobileBar.includes(h) && h !== tabs[0]);
  const orderOk = JSON.stringify(v.barOrder) === JSON.stringify(EXPECTED_ORDER);
  const centerOk = v.centerIndex === 2 && v.centerHref === "/dashboard/chat";
  const visibleOk = v.barDisplay === "flex";
  const labelsOk = (v.clippedLabels || []).length === 0;
  const ok = dupSidebar.length === 0 && dupMobile.length === 0 && orderOk && centerOk && visibleOk && labelsOk && v.bell;
  if (!ok) failures += 1;
  console.log(`${p.padEnd(26)} bar=${v.barDisplay} urutan=${orderOk ? "OK" : JSON.stringify(v.barOrder)} tengah=${centerOk ? "Chat@2" : `idx${v.centerIndex}/${v.centerHref}`} label=${labelsOk ? "utuh" : "TERPOTONG " + JSON.stringify(v.clippedLabels)} bell=${v.bell} dup=${dupSidebar.length}/${dupMobile.length} ${ok ? "OK" : "GAGAL"}`);
}
console.log("");
}

// --- Pass 2: desktop viewport (bar must be hidden entirely) ---
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
console.log("\n== DESKTOP 1440px ==");
for (const p of ["/dashboard", "/dashboard/chat", "/dashboard/kanban"]) {
  await send("Page.navigate", { url: BASE + p });
  await sleep(2200);
  const { result } = await send("Runtime.evaluate", { expression: PROBE, returnByValue: true });
  const v = result.value;
  const hidden = v.barDisplay === "none" || v.barDisplay === "missing";
  const sidebarOk = v.sidebar.length > 0;
  const ok = hidden && sidebarOk && v.bell;
  if (!ok) failures += 1;
  console.log(`${p.padEnd(26)} bottomBar=${v.barDisplay} (harus none) sidebar=${v.sidebar.length} bell=${v.bell} ${ok ? "OK" : "GAGAL"}`);
}

console.log(`\nHASIL: ${failures ? failures + " pemeriksaan gagal" : "BERSIH — bottom bar mobile-only, urutan benar, Chat di tengah, bell aktif"}`);
ws.close();
await fetch(`${CDP}/json/close/${target.id}`);
process.exit(failures ? 1 : 0);
