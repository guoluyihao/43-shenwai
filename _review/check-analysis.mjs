import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve('value-added-evaluation-system-v3.1/prototype');
const OUT = path.resolve('_review/analysis-shots');
const PORT = 8127, CDP_PORT = 9337;
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
const profile = path.join(process.env.TEMP || '.', 've-an-' + Date.now());
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', '--disable-gpu', '--force-device-scale-factor=1', '--window-size=1440,1000', 'about:blank'], { stdio: 'ignore' });
async function waitCdp() { for (let i = 0; i < 80; i++) { try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); if (r.ok) return; } catch (e) {} await sleep(150); } throw new Error('no cdp'); }
await waitCdp();
const tab = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(`http://127.0.0.1:${PORT}/index.html`)}`, { method: 'PUT' })).json();
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl); const pending = new Map(); let id = 0; const events = [];
    ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const { resolve: r, reject: j } = pending.get(m.id); pending.delete(m.id); m.error ? j(new Error(JSON.stringify(m.error))) : r(m.result); } else if (m.method) events.push(m); });
    ws.addEventListener('error', reject);
    ws.addEventListener('open', () => resolve({ send(method, params = {}) { return new Promise((res, rej) => { const mid = ++id; pending.set(mid, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: mid, method, params })); }); }, events, close() { ws.close(); } }));
  });
}
const cdp = await connect(tab.webSocketDebuggerUrl);
await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
async function ev(expression) { const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description)); return r.result.value; }
async function go(url) { await cdp.send('Page.navigate', { url }); await sleep(1200); }
async function shot(name, full = false) {
  let params = { format: 'png' };
  if (full) {
    const m = await cdp.send('Page.getLayoutMetrics');
    const w = Math.ceil(m.cssContentSize.width), h = Math.ceil(m.cssContentSize.height);
    params = { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: Math.min(w, 1440), height: Math.min(h, 20000), scale: 1 } };
  }
  const r = await cdp.send('Page.captureScreenshot', params);
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.data, 'base64'));
  console.log('shot', name);
}
await go(`http://127.0.0.1:${PORT}/index.html`);
await ev(`localStorage.setItem('ve_account','ops');localStorage.setItem('ve_role','admin');localStorage.setItem('ve_user','运营管理员');localStorage.setItem('ve_school','S01');true`);
await go(`http://127.0.0.1:${PORT}/app.html#/evaluations`);
await shot('01-task-list');
await go(`http://127.0.0.1:${PORT}/app.html#/evaluations/T1/analysis`);
await shot('02-hub');
await go(`http://127.0.0.1:${PORT}/app.html#/evaluations/T1/analysis/principal`);
await shot('03-principal-top');
await shot('04-principal-full', true);
const info = await ev(`(() => {
  const q = s => document.querySelector(s);
  const badScroll = [];
  document.querySelectorAll('.an-page *').forEach(el => {
    const s = getComputedStyle(el);
    const vy = s.overflowY, vx = s.overflowX;
    if ((vy === 'auto' || vy === 'scroll') && el.scrollHeight > el.clientHeight + 2) badScroll.push(el.className + ':' + el.scrollHeight + '/' + el.clientHeight);
    if ((vx === 'auto' || vx === 'scroll') && el.scrollWidth > el.clientWidth + 2) badScroll.push('x:' + el.className);
  });
  return {
    chapters: document.querySelectorAll('.an-chapter').length,
    kpis: document.querySelectorAll('.an-kpi').length,
    tables: document.querySelectorAll('.table').length,
    rows: document.querySelectorAll('.table tbody tr').length,
    studentRows: document.querySelectorAll('#an-appendix .table tbody tr').length,
    height: document.body.scrollHeight,
    hasToc: !!q('.an-toc'),
    scrollX: document.documentElement.scrollWidth > innerWidth,
    badScroll: badScroll.slice(0, 5),
    badScrollCount: badScroll.length,
    title: q('.an-cover h1') ? q('.an-cover h1').innerText : ''
  };
})()`);
console.log('INFO', JSON.stringify(info));
const peek = await ev(`(() => {
  const rows = (sel, n) => Array.from(document.querySelectorAll(sel)).slice(0, n).map(x => x.innerText.replace(/\\s+/g, ' ').trim());
  return {
    d1head: rows('#an-d1 table thead tr', 1),
    d1rows: rows('#an-d1 table tbody tr', 3),
    d3head: rows('#an-d3 .an-scroll table thead tr', 1),
    d3rows: rows('#an-d3 .an-scroll table tbody tr', 5),
    a2rows: rows('#an-appendix table tbody tr', 3)
  };
})()`);
console.log('PEEK', JSON.stringify(peek, null, 1));
const csv = await ev(`(() => { const s = window.__ANALYSIS_STUDENT_CSV__ || ''; return { lines: s.split('\\n').length, head: s.split('\\n')[0], first: s.split('\\n')[1] }; })()`);
console.log('CSV', JSON.stringify(csv));
const fText = await ev(`(() => { const el = document.querySelector('#an-f'); return el ? el.innerText.slice(0, 2200) : ''; })()`);
console.log('F_TEXT', fText);
const eText = await ev(`(() => { const el = document.querySelector('#an-e'); return el ? el.innerText.slice(0, 2600) : ''; })()`);
console.log('E_TEXT', eText);
const d2Total = await ev(`(() => { const rows = [...document.querySelectorAll('#an-d2 .table tbody tr')]; return rows.slice(-2).map(r => r.innerText).join(' | '); })()`);
console.log('D2_TOTAL', d2Total);
const bText = await ev(`(() => { const el = document.querySelector('#an-b'); return el ? el.innerText.slice(0, 1800) : ''; })()`);
console.log('B_TEXT', bText);
await ev(`window.scrollTo(0, 3000); true`);
await sleep(350);
const sticky = await ev(`(() => { const bar = document.querySelector('.an-rolebar'); const toc = document.querySelector('.an-toc'); const top = document.querySelector('.an-backtop'); return { y: window.scrollY, barTop: bar ? Math.round(bar.getBoundingClientRect().top) : null, barH: bar ? Math.round(bar.getBoundingClientRect().height) : null, tocTop: toc ? Math.round(toc.getBoundingClientRect().top) : null, back: top ? top.classList.contains('show') : false }; })()`);
console.log('STICKY', JSON.stringify(sticky));
await ev(`(() => { const b = document.querySelector('.an-backtop'); if (b) b.click(); return true; })()`);
await sleep(800);
console.log('BACKTOP', await ev(`Math.round(window.scrollY)`));
const d3Text = await ev(`(() => { const el = document.querySelector('#an-d3'); return el ? el.innerText.slice(0, 3000) : ''; })()`);
console.log('D3_TEXT', d3Text);
const d3Stats = await ev(`(() => { const t = document.querySelector('#an-d3 .an-teacher-table'); return { rows: t ? t.querySelectorAll('tbody tr').length : 0, summaries: t ? t.querySelectorAll('.an-teacher-summary').length : 0, classes: t ? t.querySelectorAll('.an-teacher-class').length : 0, merges: t ? t.querySelectorAll('.an-teacher-merge').length : 0 }; })()`);
console.log('D3_STATS', JSON.stringify(d3Stats));
const d4Text = await ev(`(() => { const el = document.querySelector('#an-d4'); return el ? el.innerText.slice(0, 5000) : ''; })()`);
console.log('D4_TEXT', d4Text);
const d4Box = await ev(`(() => { const el = document.querySelector('#an-d4'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: 0, y: Math.max(0, r.top + scrollY), w: innerWidth, h: r.height }; })()`);
if (d4Box) {
  const img = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: d4Box.x, y: d4Box.y, width: d4Box.w, height: Math.min(d4Box.h, 5000), scale: 1 } });
  fs.writeFileSync(path.join(OUT, '09-d4-positive.png'), Buffer.from(img.data, 'base64'));
  console.log('D4_SHOT', JSON.stringify(d4Box));
}
const d3First = await ev(`(() => { const r = document.querySelector('#an-d3 .an-teacher-summary'); if (!r) return null; const c = r.children[0]; const s = getComputedStyle(c); const b = c.getBoundingClientRect(); return { text: c.innerText, color: s.color, bg: s.backgroundColor, width: b.width, height: b.height, overflow: s.overflow, position: s.position, zIndex: s.zIndex, font: s.fontSize }; })()`);
console.log('D3_FIRST', JSON.stringify(d3First));
const d3Box = await ev(`(() => { const el = document.querySelector('#an-d3 .an-teacher-table'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: 0, y: Math.max(0, r.top + scrollY), w: innerWidth, h: r.height }; })()`);
if (d3Box) {
  const img = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: d3Box.x, y: d3Box.y, width: d3Box.w, height: Math.min(d3Box.h, 7000), scale: 1 } });
  fs.writeFileSync(path.join(OUT, '08-teacher-merged.png'), Buffer.from(img.data, 'base64'));
  console.log('D3_SHOT', JSON.stringify(d3Box));
}
for (const role of ['grade', 'subject', 'homeroom', 'teacher', 'student', 'region']) {
  await go(`http://127.0.0.1:${PORT}/app.html?role=${role}#/evaluations/T1/analysis/${role}`);
  await sleep(900);
  const info = await ev(`(() => { const c = document.querySelector('.an-cover h1'); return { title: c ? c.innerText : '', chapters: document.querySelectorAll('.an-chapter').length, tables: document.querySelectorAll('.table').length, select: !!document.querySelector('.an-toolbar select') }; })()`);
  console.log('ROLE', role, JSON.stringify(info));
  await shot(`role-${role}`);
  if (role === 'teacher' || role === 'student') {
    const pk = await ev(`(() => { const box = document.querySelector('.an-picker'); if (!box) return null; box.querySelector('.an-picker-trigger').click(); return { open: box.classList.contains('open'), options: box.querySelectorAll('.an-picker-option').length, count: (box.querySelector('.an-picker-count') || {}).innerText || '' }; })()`);
    console.log('PICKER_OPEN', role, JSON.stringify(pk));
    const pf = await ev(`(() => { const box = document.querySelector('.an-picker'); if (!box) return null; const input = box.querySelector('.an-picker-input'); input.value = '${role === 'teacher' ? '政治' : '高三1班'}'; input.dispatchEvent(new Event('input', { bubbles: true })); return { visible: [...box.querySelectorAll('.an-picker-option')].filter(o => !o.hidden).length, count: (box.querySelector('.an-picker-count') || {}).innerText || '' }; })()`);
    console.log('PICKER_FILTER', role, JSON.stringify(pf));
    await ev(`App.closeAnalysisPickers(); true`);
  }
  if (info.select) {
    const changed = await ev(`(() => { const s = document.querySelector('.an-toolbar select'); if (!s) return null; const o = s.options[s.options.length - 1]; s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); return o.textContent; })()`);
    await sleep(900);
    const after = await ev(`(document.querySelector('.an-cover h1') || {}).innerText || ''`);
    console.log('ROLE_CHANGE', role, JSON.stringify({ changed, title: after }));
  }
}
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
for (const role of ['grade', 'subject', 'homeroom', 'teacher', 'student', 'region']) {
  await go(`http://127.0.0.1:${PORT}/app.html?role=1280-${role}#/evaluations/T1/analysis/${role}`);
  await sleep(700);
  const narrow = await ev(`(() => { const bad = [...document.querySelectorAll('.an-page .table')].filter(t => t.scrollWidth > t.clientWidth + 2).length; return { page: document.documentElement.scrollWidth > innerWidth, tables: bad, title: (document.querySelector('.an-cover h1')||{}).innerText || '' }; })()`);
  console.log('ROLE_NARROW', role, JSON.stringify(narrow));
}
await go(`http://127.0.0.1:${PORT}/app.html?sticky=1280#/evaluations/T1/analysis/subject`);
await ev(`window.scrollTo(0, 2600); true`);
await sleep(400);
const stickyNarrow = await ev(`(() => { const bar = document.querySelector('.an-rolebar'); const toc = document.querySelector('.an-toc'); const top = document.querySelector('.an-backtop'); return { y: scrollY, barTop: bar ? Math.round(bar.getBoundingClientRect().top) : null, barH: bar ? Math.round(bar.getBoundingClientRect().height) : null, tocTop: toc ? Math.round(toc.getBoundingClientRect().top) : null, back: top ? top.classList.contains('show') : false }; })()`);
console.log('STICKY_1280', JSON.stringify(stickyNarrow));
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await go(`http://127.0.0.1:${PORT}/app.html#/evaluations/T1/reports/principal`);await shot('05-old-principal');
const oldInfo = await ev(`({ title: (document.querySelector('.report-cover h1')||{}).innerText || '', chapters: document.querySelectorAll('.rblock').length })`);
console.log('OLD', JSON.stringify(oldInfo));
await ev(`localStorage.setItem('ve_account','boya');localStorage.setItem('ve_role','school');localStorage.setItem('ve_user','博雅高中管理员');localStorage.setItem('ve_school','S01');true`);
await go(`http://127.0.0.1:${PORT}/app.html?sa=1#/evaluations/T1/analysis/principal`);
await shot('06-school-admin');
const sa = await ev(`({ title: (document.querySelector('.an-cover h1')||{}).innerText || '', select: !!document.querySelector('.an-toolbar select'), fixed: (document.querySelector('.an-fixed')||{}).innerText || '' })`);
console.log('SCHOOL_ADMIN', JSON.stringify(sa));
await go(`http://127.0.0.1:${PORT}/app.html?sa=1#/evaluations/T1/analysis/region`);
const saRegion = await ev(`({ title: (document.querySelector('.an-cover h1')||{}).innerText || '', empty: (document.querySelector('.empty')||{}).innerText || '' })`);
console.log('SA_REGION', JSON.stringify(saRegion));
await go(`http://127.0.0.1:${PORT}/app.html?default=1`);
await sleep(700);
const saDefault = await ev(`({ hash: location.hash, title: (document.querySelector('.page-title')||{}).innerText || '' })`);
console.log('SA_DEFAULT', JSON.stringify(saDefault));
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
await go(`http://127.0.0.1:${PORT}/app.html?sa=1#/evaluations/T1/analysis/principal`);
await shot('07-1280');
const narrow = await ev(`({ overflow: document.documentElement.scrollWidth > innerWidth, scrollW: document.documentElement.scrollWidth, inner: innerWidth })`);
console.log('NARROW', JSON.stringify(narrow));
await go(`http://127.0.0.1:${PORT}/app.html?sa=1#/evaluations`);
await shot('09-task-1280');
await ev(`localStorage.setItem('ve_account','ops');localStorage.setItem('ve_role','admin');localStorage.setItem('ve_user','运营管理员');localStorage.setItem('ve_school','S01');true`);
await go(`http://127.0.0.1:${PORT}/app.html?p=1#/evaluations/T1/analysis/principal`);
await cdp.send('Emulation.setEmulatedMedia', { media: 'print' });
await shot('08-print-top');
if (!process.env.SKIP_PDF) {
  const pdf = await cdp.send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
  fs.writeFileSync(path.join(OUT, 'principal-print.pdf'), Buffer.from(pdf.data, 'base64'));
  console.log('PDF_BYTES', Buffer.from(pdf.data, 'base64').length);
}
await cdp.send('Emulation.setEmulatedMedia', { media: '' });
for (const id of ['S02', 'S03', 'S04']) {
  await ev(`App.setAnalysisSchool('${id}')`);
  await sleep(900);
  const t = await ev(`({ title: (document.querySelector('.an-cover h1')||{}).innerText || '', chapters: document.querySelectorAll('.an-chapter').length, classes: document.querySelectorAll('#an-d2 .table tbody tr').length })`);
  console.log('SCHOOL_SWITCH', id, JSON.stringify(t));
}
await shot('10-switch-S04');
const errors = cdp.events.filter((e) => e.method === 'Runtime.exceptionThrown' || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'));
console.log('CONSOLE_ERRORS', errors.length);
errors.slice(0, 5).forEach((e) => console.log(JSON.stringify(e.params).slice(0, 500)));
cdp.close(); await fetch(`http://127.0.0.1:${CDP_PORT}/json/close/${tab.id}`).catch(() => {}); chrome.kill(); server.close();
