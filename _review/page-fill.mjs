/* 量测分页 HTML 每页内容填充率，找出“近乎空白页”
   用法：node _review/page-fill.mjs <html> [minFill=0.35] */
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const src = path.resolve(process.argv[2]);
const MIN = Number(process.argv[3] || 0.35);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9361;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = path.join(process.env.TEMP || '.', 've-fill-' + Date.now());
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--hide-scrollbars', '--disable-gpu', '--force-device-scale-factor=1',
  '--window-size=1200,1400', 'about:blank'], { stdio: 'ignore' });
for (let i = 0; i < 100; i++) { try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); if (r.ok) break; } catch (e) {} await sleep(150); }
const tab = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
const pending = new Map(); let id = 0;
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } });
await new Promise((r) => ws.addEventListener('open', r));
const send = (method, params = {}) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params })); });
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 1400, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: pathToFileURL(src).href });
await sleep(1500);
const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
const rows = await ev(`Array.from(document.querySelectorAll('.pg')).map((pg, i) => {
  const body = pg.querySelector('.pg-body');
  if (!body) return { i: i + 1, fill: 1, text: '' };
  const kids = Array.from(body.children).filter(n => n.getBoundingClientRect().height > 0);
  if (!kids.length) return { i: i + 1, fill: 0, text: '' };
  const br = body.getBoundingClientRect();
  const last = kids[kids.length - 1].getBoundingClientRect();
  const used = Math.max(0, Math.min(br.height, last.bottom - br.top));
  return { i: i + 1, fill: br.height ? used / br.height : 0, text: (body.innerText || '').replace(/\\s+/g, ' ').slice(0, 60), kind: pg.className };
})`);
for (const r of rows) {
  if (r.fill < MIN) console.log(`P${String(r.i).padStart(2, '0')} fill=${(r.fill * 100).toFixed(0)}% ${r.kind} :: ${r.text}`);
}
console.log('pages', rows.length, 'low-fill', rows.filter(r => r.fill < MIN).length);
ws.close(); chrome.kill(); process.exit(0);
