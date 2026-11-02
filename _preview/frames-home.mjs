/* 动效帧序列：确认块内错峰与块间扫线是否按节奏播放 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve('value-added-evaluation-system-v3.1/prototype');
const OUT = path.resolve(process.env.OUT_DIR || '_preview/home-v2/frames');
const PORT = 8126;
const CDP_PORT = 9336;
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
const profile = path.join(process.env.TEMP || '.', 've-frames-' + Date.now());
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--disable-gpu', '--window-size=1440,1000', 'about:blank'], { stdio: 'ignore' });
for (let i = 0; i < 80; i++) {
  try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); if (r.ok) break; } catch (e) {}
  await sleep(150);
}

const tab = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(`http://127.0.0.1:${PORT}/index.html`)}`, { method: 'PUT' })).json();
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
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

fs.mkdirSync(OUT, { recursive: true });
const shoot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.data, 'base64'));
  console.log('frame', name);
};

// 首屏入场
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
await sleep(150); await shoot('hero-150ms');
await sleep(220); await shoot('hero-370ms');
await sleep(500); await shoot('hero-870ms');
await sleep(900); await shoot('hero-1770ms');

// 触发第 3 个区块（how）的入场，记录 4 帧
await send('Runtime.evaluate', { expression: `document.getElementById('method').scrollIntoView({block:'start'});true` });
await sleep(90); await shoot('method-090ms');
await sleep(120); await shoot('method-210ms');
await sleep(160); await shoot('method-370ms');
await sleep(400); await shoot('method-770ms');

// 再触发四层区块，验证卡片错峰
await send('Runtime.evaluate', { expression: `document.getElementById('levels').scrollIntoView({block:'start'});true` });
await sleep(120); await shoot('levels-120ms');
await sleep(160); await shoot('levels-280ms');
await sleep(400); await shoot('levels-680ms');

ws.close();
chrome.kill();
server.close();
