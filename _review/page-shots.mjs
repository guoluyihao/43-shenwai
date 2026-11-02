/* 截取分页 HTML 的指定页（A4 元素截图），用法：node _review/page-shots.mjs <html> <outdir> 3,7,9 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const src = path.resolve(process.argv[2]);
const outDir = path.resolve(process.argv[3] || '_review/page-shots');
const idx = (process.argv[4] || '').split(',').filter(Boolean).map(Number);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9351;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(outDir, { recursive: true });
const profile = path.join(process.env.TEMP || '.', 've-pg-' + Date.now());
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
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
};

const total = await ev(`document.querySelectorAll('.pg').length`);
console.log('pages', total);
for (const n of idx) {
  if (!(n >= 1 && n <= total)) { console.log('skip', n); continue; }
  const rect = await ev(`(() => { const el = document.querySelectorAll('.pg')[${n - 1}]; const r = el.getBoundingClientRect(); return { x: r.x + window.scrollX, y: r.y + window.scrollY, w: r.width, h: r.height }; })()`);
  await sleep(200);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 1 } });
  const file = path.join(outDir, `p${String(n).padStart(2, '0')}.png`);
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log('shot', file);
}
ws.close();
chrome.kill();
process.exit(0);
