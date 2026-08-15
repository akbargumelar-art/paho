/** Render check for Group Chat layout: composer must live below the transcript,
 * not inside the top settings panel. Uses a temporary Better Auth account. */
import WebSocket from "ws";
import { execFileSync } from "child_process";

const ORIGIN = "https://paho.aarasa.click";
const BASE = ORIGIN;
const CDP = "http://127.0.0.1:9222";
const EMAIL = `paho-layout-${Date.now()}@local.test`;
const USERNAME = `paholayout${Date.now().toString(36)}`;
const PASSWORD = `Ly-${Math.random().toString(36).slice(2)}-Aa1!`;
let cookies = [];

async function api(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { 'content-type': 'application/json', origin: ORIGIN, ...(init.headers||{}) }});
  cookies.push(...(res.headers.getSetCookie?.() || []).map(c => c.split(';')[0]));
  let body; try { body = await res.json() } catch { body = await res.text() }
  return { status: res.status, body };
}

const cleanup = () => execFileSync('python3', ['-c', `
import sqlite3
c=sqlite3.connect('/root/paho/data/aspri.db')
row=c.execute('select id from user where email=?', ('${EMAIL}',)).fetchone()
if row:
    uid=row[0]
    c.execute('delete from session where user_id=?',(uid,)); c.execute('delete from account where user_id=?',(uid,)); c.execute('delete from user where id=?',(uid,)); c.commit()
print('cleanup: layout user dibersihkan')
`], { stdio: 'inherit' });

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url); let id = 0; const pending = new Map();
    ws.on('message', raw => { const msg = JSON.parse(raw); if (msg.id && pending.has(msg.id)) { const {resolve, reject} = pending.get(msg.id); pending.delete(msg.id); msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result); }});
    ws.on('open', () => resolve({ call(method, params={}) { return new Promise((resolve, reject) => { pending.set(++id, {resolve, reject}); ws.send(JSON.stringify({id, method, params})); }); }, close(){ ws.close(); } }));
    ws.on('error', reject);
  });
}

try {
  const signup = await api('/api/auth/sign-up/email', { method:'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD, name:'Layout Probe', username: USERNAME })});
  if (signup.status >= 400) throw new Error('signup gagal '+JSON.stringify(signup.body));

  await fetch(`${CDP}/json/new?${BASE}/dashboard/group-chat`, { method: 'PUT' }).catch(async () => fetch(`${CDP}/json/new?${BASE}/dashboard/group-chat`));
  const tabs = await (await fetch(`${CDP}/json`)).json();
  const tab = tabs.find(t => (t.url||'').includes('/dashboard/group-chat')) || tabs[0];
  const c = await connect(tab.webSocketDebuggerUrl);
  await c.call('Page.enable'); await c.call('Runtime.enable'); await c.call('Network.enable');
  for (const pair of cookies) {
    const eq = pair.indexOf('=');
    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    if (!name || !value) continue;
    await c.call('Network.setCookie', { name, value, url: BASE });
  }
  await c.call('Page.navigate', { url: `${BASE}/dashboard/group-chat` });
  await new Promise(r => setTimeout(r, 3500));
  const result = await c.call('Runtime.evaluate', { returnByValue: true, expression: `(() => {
    const areas = [...document.querySelectorAll('textarea')].map(el => ({
      placeholder: el.getAttribute('placeholder'),
      top: Math.round(el.getBoundingClientRect().top),
      bottom: Math.round(el.getBoundingClientRect().bottom),
      sticky: !!el.closest('.sticky'),
      inPanel: !![...document.querySelectorAll('*')].find(x => x.textContent === 'Panel Group')?.closest('.rounded-xl, .card')?.contains(el)
    }));
    const percTitle = [...document.querySelectorAll('*')].find(el => el.textContent === 'Percakapan');
    const panelTitle = [...document.querySelectorAll('*')].find(el => el.textContent === 'Panel Group');
    return {title: document.title, textareaCount: areas.length, areas, percTop: percTitle ? Math.round(percTitle.getBoundingClientRect().top) : null, panelTop: panelTitle ? Math.round(panelTitle.getBoundingClientRect().top) : null, bodyText: document.body.innerText.slice(0,500)};
  })()`});
  c.close();
  console.log(JSON.stringify(result.result.value, null, 2));
  const v = result.result.value;
  if (v.textareaCount !== 1) throw new Error(`textareaCount ${v.textareaCount}`);
  if (!v.areas[0].sticky) throw new Error('composer tidak sticky/bawah');
  if (v.areas[0].inPanel) throw new Error('composer masih berada di Panel Group');
  console.log('ALL_OK');
} finally { cleanup(); }
