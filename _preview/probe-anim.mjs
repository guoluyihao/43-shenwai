/* 动效节奏探针：把动画放慢 10 倍，读取各元素的实际 opacity，验证错峰顺序 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve('value-added-evaluation-system-v3.1/prototype');
const PORT = 8127;
const CDP_PORT = 9337;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

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
const profile = path.join(process.env.TEMP || '.', 've-probe-' + Date.now());
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--disable-gpu', '--window-size=1440,1000', 'about:blank'], { stdio: 'ignore' });
for (let i = 0; i < 80; i++) {
  try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); if (r.ok) break; } catch (e) {}
  await sleep(150);
}
const tab = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
const pending = new Map();
let id = 0;
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.rej(new Error(JSON.stringify(msg.error))) : p.res(msg.result); }
});
const send = (method, params = {}) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method, params })); });

await send('Page.enable');
await send('Runtime.enable');
await send('Animation.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

const probe = `(function(){
  var q=function(s){var el=document.querySelector(s);return el?+getComputedStyle(el).opacity:null;};
  return {t:Math.round(performance.now()), kicker:q('.story-kicker'), h1:q('.story-inner h1'), lead:q('.story-lead'), points:q('.story-points'), ruler:q('.ruler'), card:q('.login-card'), strip:q('.hero-strip')};
})()`;

await send('Animation.setPlaybackRate', { playbackRate: 0.1 });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });

for (let i = 0; i < 7; i++) {
  const r = await send('Runtime.evaluate', { expression: probe, returnByValue: true });
  console.log(JSON.stringify(r.result.value));
  await sleep(700);
}

ws.close();
chrome.kill();
server.close();
