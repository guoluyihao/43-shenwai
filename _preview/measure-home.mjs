/* 首屏高度测量：确认各常见视口下 hero + 数据条是否超出一屏 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve('value-added-evaluation-system-v3.1/prototype');
const PORT = 8125;
const CDP_PORT = 9335;
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
const profile = path.join(process.env.TEMP || '.', 've-measure-' + Date.now());
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });

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

const sizes = [[1440, 1000], [1440, 900], [1366, 768], [1280, 900], [1280, 800], [1152, 864], [390, 844]];
for (const [width, height] of sizes) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?anim=off` });
  await sleep(700);
  const r = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(function(){
      var hero=document.querySelector('.login-section');
      var strip=document.querySelector('.hero-strip');
      var inner=document.querySelector('.story-inner');
      var card=document.querySelector('.login-card');
      var hr=hero.getBoundingClientRect();
      return {
        vh: window.innerHeight,
        heroBottom: Math.round(hr.bottom),
        stripBottom: Math.round(strip.getBoundingClientRect().bottom),
        stripTop: Math.round(strip.getBoundingClientRect().top),
        storyH: Math.round(inner.getBoundingClientRect().height),
        cardH: Math.round(card.getBoundingClientRect().height),
        overflow: Math.round(strip.getBoundingClientRect().bottom - window.innerHeight)
      };
    })()`
  });
  const v = r.result.value;
  console.log(`${width}x${height}`, JSON.stringify(v));
}
ws.close();
chrome.kill();
server.close();
