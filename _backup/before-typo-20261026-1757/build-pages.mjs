import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve('value-added-evaluation-system-v3.1/prototype');
const OUT = path.resolve('_deliverables/20261026-A4版/网页版');
const SRC = path.resolve('_deliverables/_pages_src');
const PORT = 8165, CDP_PORT = 9379;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SRC, { recursive: true });

const CSS_FILES = ['tokens.css', 'app.css', 'components.css', 'analysis.css'];
const pageCss = fs.readFileSync(path.resolve('_deliverables/a4-pages.css'), 'utf8');

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
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const profile = path.join(process.env.TEMP || '.', 've-pages-' + Date.now());
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', '--disable-gpu', '--window-size=1440,1000', 'about:blank'], { stdio: 'ignore' });
async function waitCdp() { for (let i = 0; i < 100; i++) { try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); if (r.ok) return; } catch (e) {} await sleep(150); } throw new Error('no cdp'); }
await waitCdp();

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl); const pending = new Map(); let id = 0;
    ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const { resolve: r, reject: j } = pending.get(m.id); pending.delete(m.id); m.error ? j(new Error(JSON.stringify(m.error))) : r(m.result); } });
    ws.addEventListener('error', reject);
    ws.addEventListener('open', () => resolve({ send(method, params = {}) { return new Promise((res, rej) => { const mid = ++id; pending.set(mid, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: mid, method, params })); }); }, close() { ws.close(); } }));
  });
}

const jobs = [
  { slug: '01', role: 'region', school: null, title: '区域 / 联考增值分析报告', file: '01-联考报告-四校.html' },
  { slug: '02', role: 'principal', school: 'S01', title: '博雅高中增值分析报告', file: '02-博雅高中增值分析报告.html' },
  { slug: '03', role: 'principal', school: 'S02', title: '弘知高中增值分析报告', file: '03-弘知高中增值分析报告.html' },
  { slug: '04', role: 'principal', school: 'S03', title: '理工高中增值分析报告', file: '04-理工高中增值分析报告.html' },
  { slug: '05', role: 'principal', school: 'S04', title: '致远高中增值分析报告', file: '05-致远高中增值分析报告.html' }
];
const only = process.argv[2] ? process.argv[2].split(',') : null;

const tab = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(`http://127.0.0.1:${PORT}/index.html`)}`, { method: 'PUT' })).json();
const cdp = await connect(tab.webSocketDebuggerUrl);
await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
async function ev(expression) { const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description)); return r.result.value; }
async function go(url, wait = 1500) { await cdp.send('Page.navigate', { url }); await sleep(wait); }
async function till(expr, timeout = 90000) { const t0 = Date.now(); while (Date.now() - t0 < timeout) { try { if (await ev(expr)) return true; } catch (e) {} await sleep(250); } throw new Error('timeout: ' + expr); }

await go(`http://127.0.0.1:${PORT}/index.html`, 800);
await ev(`localStorage.setItem('ve_account','ops');localStorage.setItem('ve_role','admin');localStorage.setItem('ve_user','运营管理员');localStorage.setItem('ve_school','S01');true`);
await go(`http://127.0.0.1:${PORT}/app.html#/evaluations/T1/analysis/region`, 1800);
await till(`!!document.querySelector('.an-cover h1') && document.fonts.status === 'loaded'`);

const baseCss = CSS_FILES.map((f) => fs.readFileSync(path.join(ROOT, 'assets/css', f), 'utf8')).join('\n')
  .replace(/@page\s*\{[^}]*\}/g, '');

for (const job of jobs) {
  if (only && !only.includes(job.slug)) continue;
  // 每个任务都回到系统页面（上一轮结束时停在 file:// 的分页结果上）
  await go(`http://127.0.0.1:${PORT}/app.html#/evaluations/T1/analysis/${job.role}`, 1800);
  await till(`!!document.querySelector('.an-cover h1') && document.fonts.status === 'loaded'`);
  if (job.school) {
    await ev(`App.setAnalysisSchool('${job.school}'); true`);
    await till(`(document.querySelector('.an-cover h1')||{}).innerText === ${JSON.stringify(job.title)}`);
  }
  await sleep(700);

  const reportHtml = await ev(`(() => {
    const page = document.querySelector('.an-page').cloneNode(true);
    page.querySelectorAll('.an-rolebar, .an-toolbar, .an-toc, .an-backtop, .an-cover-actions, .breadcrumb, .an-hub-grid, .an-hub-note, .an-hub-meta, .an-card-head-row .btn, .an-print-hide').forEach(n => n.remove());
    return page.outerHTML;
  })()`);

  const srcHtml = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${job.title} · A4</title>
<style id="base-css">${baseCss}</style>
<style id="page-css">${pageCss}</style>
</head><body>
${reportHtml}
<script src="${pathToFileURL(path.resolve('_deliverables/paginate.js')).href}"></script>
</body></html>`;

  const srcFile = path.join(SRC, job.slug + '.html');
  fs.writeFileSync(srcFile, srcHtml);

  await go(pathToFileURL(srcFile).href, 1200);
  await till(`typeof window.__PAGES__ === 'number' && window.__PAGES__ > 0`, 120000);
  await sleep(300);

  const n = await ev('window.__PAGES__');
  await ev(`(() => { document.querySelectorAll('script').forEach(function (s) { s.remove(); }); return true; })()`);
  const totalLen = await ev(`(() => { window.__HTML__ = '<!DOCTYPE html>' + document.documentElement.outerHTML; return window.__HTML__.length; })()`);
  let html = '';
  for (let i = 0; i < totalLen; i += 120000) {
    html += await ev(`window.__HTML__.slice(${i}, ${i + 120000})`);
  }
  const dest = path.join(OUT, job.file);
  fs.writeFileSync(dest, html);
  log('pages', job.file, n + ' pages', (html.length / 1024).toFixed(0) + 'KB');
}
cdp.close(); chrome.kill(); server.close();
process.exit(0);


