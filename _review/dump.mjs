/* 渲染七个角色报告页，导出正文纯文本，供逐页审读 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve('value-added-evaluation-system-v3.1/prototype');
const OUT = path.resolve('_review/text');
const PORT = 8125;
const CDP_PORT = 9335;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };

fs.mkdirSync(OUT, { recursive: true });
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
const profile = path.join(process.env.TEMP || '.', 've-dump-' + Date.now());
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--disable-gpu',
  '--force-device-scale-factor=1', '--window-size=1440,1000', 'about:blank'
], { stdio: 'ignore' });

async function waitCdp() {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); if (r.ok) return; } catch (e) {}
    await sleep(150);
  }
  throw new Error('CDP not ready');
}
await waitCdp();
const tab = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(`http://127.0.0.1:${PORT}/index.html`)}`, { method: 'PUT' })).json();

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let id = 0;
    const events = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve: res, reject: rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      } else if (msg.method) events.push(msg);
    });
    ws.addEventListener('error', reject);
    ws.addEventListener('open', () => resolve({
      send(method, params = {}) {
        return new Promise((res, rej) => { const mid = ++id; pending.set(mid, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: mid, method, params })); });
      },
      events,
      close() { ws.close(); }
    }));
  });
}
const cdp = await connect(tab.webSocketDebuggerUrl);
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
async function evalJs(expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description));
  return r.result ? r.result.value : undefined;
}
async function goto(url, wait = 900) {
  await cdp.send('Page.navigate', { url });
  await sleep(wait);
}

await goto(`http://127.0.0.1:${PORT}/index.html`);
await evalJs(`localStorage.setItem('ve_account','ops');localStorage.setItem('ve_role','admin');localStorage.setItem('ve_user','运营管理员');localStorage.setItem('ve_school','S01');true`);

const roles = ['region', 'principal', 'grade', 'subject', 'homeroom', 'teacher', 'student'];
for (const role of roles) {
  await goto(`http://127.0.0.1:${PORT}/app.html#/evaluations/T1/reports/${role}`, 1400);
  const data = await evalJs(`(() => {
    const main = document.querySelector('.report-doc-main') || document.querySelector('#app');
    const head = document.querySelector('.report-cover') || document.querySelector('.report-hero');
    return { text: main ? main.innerText : '', head: head ? head.innerText : '', len: main ? main.innerText.length : 0 };
  })()`);
  fs.writeFileSync(path.join(OUT, role + '.txt'), data.text, 'utf8');
  console.log(role, 'chars=', data.len);
}
cdp.close();
await fetch(`http://127.0.0.1:${CDP_PORT}/json/close/${tab.id}`).catch(() => {});
chrome.kill();
server.close();
