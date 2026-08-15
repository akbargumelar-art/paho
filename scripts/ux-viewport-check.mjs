/**
 * Real-browser responsive check for Paho.
 *
 * Drives a headless Chrome over CDP (no puppeteer dependency) and measures, per
 * viewport, whether the document scrolls horizontally and which elements stick
 * out past the viewport. Elements inside an intentional horizontal scroller
 * (overflow-x: auto/scroll, e.g. wide tables and the tab strip) are ignored.
 *
 * Auth note: the dashboard shell only gates rendering on the PRESENCE of a
 * session cookie client-side, so a dummy cookie is enough to render the layout
 * for measurement. API calls still 401 — this measures layout, not data.
 *
 * Usage: node scripts/ux-viewport-check.mjs [baseUrl]
 */
import WebSocket from "ws";

const BASE = process.argv[2] || "https://paho.aarasa.click";
const CDP = "http://127.0.0.1:9222";

const PAGES = [
  "/dashboard",
  "/dashboard/chat",
  "/dashboard/group-chat",
  "/dashboard/project-contexts",
  "/dashboard/kanban",
  "/dashboard/tasks",
  "/dashboard/reminders",
  "/dashboard/jobs",
  "/dashboard/logs",
  "/dashboard/insights",
  "/dashboard/models",
  "/dashboard/files",
  "/dashboard/console",
  "/dashboard/brief",
  "/dashboard/agents",
  "/dashboard/hermes",
  "/dashboard/hermes-manager",
  "/dashboard/openclaw",
  "/dashboard/approvals",
  "/dashboard/policy",
  "/dashboard/pilot",
  "/dashboard/projects",
];

const VIEWPORTS = [
  { w: 360, h: 740, label: "360 HP kecil" },
  { w: 390, h: 844, label: "390 HP" },
  { w: 768, h: 1024, label: "768 tablet" },
  { w: 1280, h: 800, label: "1280 laptop" },
  { w: 1920, h: 1080, label: "1920 desktop" },
];

const PROBE = `(() => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const bad = [];
  const inScroller = (el) => {
    let p = el.parentElement;
    while (p) {
      const cs = getComputedStyle(p);
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowX === 'clip' || cs.overflowX === 'hidden') return true;
      p = p.parentElement;
    }
    return false;
  };
  for (const el of document.querySelectorAll('main *, header *, nav *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right <= vw + 1 && r.left >= -1) continue;
    if (inScroller(el)) continue;
    bad.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 60), left: Math.round(r.left), right: Math.round(r.right) });
  }
  const tabbar = document.querySelector('.dashboard-mobile-tabbar');
  const main = document.querySelector('main');
  const mainRect = main ? main.getBoundingClientRect() : null;
  return {
    scrollW: de.scrollWidth,
    clientW: de.clientWidth,
    horizScroll: de.scrollWidth > de.clientWidth + 1,
    overflowCount: bad.length,
    sample: bad.slice(0, 4),
    tabbarVisible: tabbar ? getComputedStyle(tabbar).display !== 'none' : false,
    mainBottomGap: mainRect && tabbar ? Math.round(window.innerHeight - (tabbar.getBoundingClientRect().top)) : null,
    tabStrip: Boolean(document.querySelector('main a[aria-current="page"]')),
    rendered: Boolean(main && main.innerText.trim().length > 20),
  };
})()`;

async function rpc(url, body) {
  const res = await fetch(url, { method: "PUT" });
  return res.json();
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 64 * 1024 * 1024 });
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function makeSender(ws) {
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      events.push(msg.method);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
      setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error(`${method} timeout`)); } }, 45000);
    });
  return { send, events };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const target = await rpc(`${CDP}/json/new?about:blank`);
const ws = await connect(target.webSocketDebuggerUrl);
const { send } = makeSender(ws);

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");
const host = new URL(BASE).hostname;
await send("Network.setCookie", { name: "better-auth.session_token", value: "ux-probe", domain: host, path: "/", secure: true });

let failures = 0;
const rows = [];

for (const pathname of PAGES) {
  for (const vp of VIEWPORTS) {
    await send("Emulation.setDeviceMetricsOverride", { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.w < 768 });
    await send("Page.navigate", { url: `${BASE}${pathname}` });
    await sleep(vp.w < 768 ? 2600 : 2200);
    const { result } = await send("Runtime.evaluate", { expression: PROBE, returnByValue: true, awaitPromise: false });
    const v = result.value;
    const ok = v.rendered && !v.horizScroll && v.overflowCount === 0;
    if (!ok) failures += 1;
    rows.push({ pathname, vp: vp.w, ...v, ok });
    if (!ok) {
      console.log(`FAIL ${pathname} @${vp.w}  rendered=${v.rendered} horizScroll=${v.horizScroll} scrollW=${v.scrollW}/${v.clientW} overflow=${v.overflowCount}`);
      if (v.sample.length) console.log("      ", JSON.stringify(v.sample).slice(0, 300));
    }
  }
}

console.log("\n== ringkasan per viewport ==");
for (const vp of VIEWPORTS) {
  const subset = rows.filter((r) => r.vp === vp.w);
  const bad = subset.filter((r) => !r.ok);
  console.log(`  ${vp.label.padEnd(14)} ${subset.length - bad.length}/${subset.length} halaman bersih${bad.length ? `  -> ${bad.map((b) => b.pathname).join(", ")}` : ""}`);
}

const mobileRows = rows.filter((r) => r.vp === 360);
console.log(`\ntabbar tampil di 360px: ${mobileRows.filter((r) => r.tabbarVisible).length}/${mobileRows.length}`);
console.log(`tab strip terdeteksi   : ${rows.filter((r) => r.tabStrip).length}/${rows.length} render`);
console.log(`\nHASIL: ${failures === 0 ? "BERSIH — tidak ada halaman yang terpotong" : `${failures} kombinasi halaman/viewport bermasalah`}`);

ws.close();
await fetch(`${CDP}/json/close/${target.id}`);
process.exit(failures ? 1 : 0);
