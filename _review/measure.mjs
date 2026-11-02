import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve('value-added-evaluation-system-v3.1/prototype');
const PORT = 8126, CDP_PORT = 9336;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = path.join(process.env.TEMP || '.', 've-m-' + Date.now());
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', '--disable-gpu', '--force-device-scale-factor=1', '--window-size=1440,1000', 'about:blank'], { stdio: 'ignore' });
async function waitCdp() { for (let i = 0; i < 80; i++) { try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); if (r.ok) return; } catch (e) {} await sleep(150); } throw new Error('no cdp'); }
await waitCdp();
const tab = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(`http://127.0.0.1:${PORT}/index.html`)}`, { method: 'PUT' })).json();
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl); const pending = new Map(); let id = 0;
    ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const { resolve: r, reject: j } = pending.get(m.id); pending.delete(m.id); m.error ? j(new Error(JSON.stringify(m.error))) : r(m.result); } });
    ws.addEventListener('error', reject);
    ws.addEventListener('open', () => resolve({ send(method, params = {}) { return new Promise((res, rej) => { const mid = ++id; pending.set(mid, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: mid, method, params })); }); }, close() { ws.close(); } }));
  });
}
const cdp = await connect(tab.webSocketDebuggerUrl);
await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
async function ev(expression) { const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
async function go(url) { await cdp.send('Page.navigate', { url }); await sleep(1100); }
await go(`http://127.0.0.1:${PORT}/index.html`);
await ev(`localStorage.setItem('ve_account','ops');localStorage.setItem('ve_role','admin');localStorage.setItem('ve_user','运营管理员');localStorage.setItem('ve_school','S01');true`);
for (const role of ['region', 'principal', 'grade', 'subject', 'homeroom', 'teacher', 'student']) {
  await go(`http://127.0.0.1:${PORT}/app.html#/evaluations/T1/reports/${role}`);
  const m = await ev(`(() => {
    const q = (s) => document.querySelector(s);
    const top = (el) => el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null;
    const h = (el) => el ? Math.round(el.getBoundingClientRect().height) : null;
    return { role: '${role}', coverH: h(q('.report-cover')), basisTop: top(q('.report-basics')), basisH: h(q('.report-basics')), summaryTop: top(q('#sec-summary')), docH: Math.round(document.body.scrollHeight), viewport: innerHeight };
  })()`);
  console.log(JSON.stringify(m));
}
cdp.close(); await fetch(`http://127.0.0.1:${CDP_PORT}/json/close/${tab.id}`).catch(() => {}); chrome.kill(); server.close();
