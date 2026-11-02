/* 本地静态服务 + Headless Chrome 截图（CDP，无第三方依赖） */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve('value-added-evaluation-system-v3.1/prototype');
const OUT = path.resolve(process.env.OUT_DIR || '_preview/tech');
const PORT = 8123;
const CDP_PORT = 9333;
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
const profile = path.join(process.env.TEMP || '.', 've-shot-profile-' + Date.now());
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

async function newTab(url) {
  const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  return r.json();
}

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

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const tab = await newTab(`http://127.0.0.1:${PORT}/index.html`);
  const cdp = await connect(tab.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: Number(process.env.WIDTH || 1440), height: Number(process.env.HEIGHT || 1000), deviceScaleFactor: 1, mobile: false });

  async function goto(url) {
    await cdp.send('Page.navigate', { url });
    await sleep(900);
  }
  async function evalJs(expression) {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    return r.result ? r.result.value : undefined;
  }
  async function shot(name, fullPage = false) {
    let params = { format: 'png' };
    if (fullPage) {
      const m = await cdp.send('Page.getLayoutMetrics');
      const w = Math.ceil(m.cssContentSize.width), h = Math.ceil(m.cssContentSize.height);
      params = { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: Math.min(w, 1600), height: Math.min(h, 12000), scale: 1 } };
    }
    const r = await cdp.send('Page.captureScreenshot', params);
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.data, 'base64'));
    console.log('shot', name);
  }

  const only = process.argv[2] || 'all';

  // 登录页
  await goto(`http://127.0.0.1:${PORT}/index.html`);
  await shot('01-login');
  if ((process.env.FULL || '').includes('01-login')) await shot('01-login-full', true);
  if (process.env.LOGIN_TEST) {
    await evalJs(`document.getElementById('homeUsername').value='ops';document.getElementById('homePassword').value='Ops@2026';document.getElementById('homeLoginBtn').click();true`);
    await sleep(1200);
    console.log('after login:', await evalJs('location.pathname + location.hash + " | " + (localStorage.getItem("ve_account")||"")'));
  }

  // 注入登录态
  await evalJs(`localStorage.setItem('ve_account','ops');localStorage.setItem('ve_role','admin');localStorage.setItem('ve_user','运营管理员');localStorage.setItem('ve_school','S01');true`);
  const pages = [
    ['02-schools', '#/schools'],
    ['03-basic', '#/basic'],
    ['05-exams', '#/exams'],
    ['06-exam-detail', '#/exams/E2'],
    ['08-evaluations', '#/evaluations'],
    ['09-eval-config', '#/evaluations/new/config'],
    ['10-results', '#/evaluations/T1/results'],
    ['11-results-classes', '#/evaluations/T1/results/classes'],
    ['13-process', '#/evaluations/T1/process'],
    ['14-reports', '#/evaluations/T1/reports'],
    ['15-report-region', '#/evaluations/T1/reports/region'],
    ['15b-report-principal', '#/evaluations/T1/reports/principal'],
    ['15c-report-grade', '#/evaluations/T1/reports/grade'],
    ['15d-report-homeroom', '#/evaluations/T1/reports/homeroom'],
    ['15e-report-teacher', '#/evaluations/T1/reports/teacher'],
    ['15h-report-subject', '#/evaluations/T1/reports/subject'],
    ['15f-report-student', '#/evaluations/T1/reports/student'],
    ['16-settings', '#/settings'],
    ['18-algorithm', '#/algorithm']
  ];
  for (const [name, hash] of pages) {
    if (only !== 'all' && !name.includes(only)) continue;
    await goto(`http://127.0.0.1:${PORT}/app.html${hash}`);
    await sleep(700);
    await shot(name);
    if ((process.env.FULL || '').includes(name)) await shot(name + '-full', true);
    if ((process.env.FOLD || '').includes(name)) {
      await evalJs(`document.querySelector('.report-fold-head').click(); true`);
      await sleep(400);
      await evalJs(`document.querySelector('.report-fold').scrollIntoView({block:'start'}); true`);
      await sleep(500);
      await shot(name + '-fold');
    }
    if (process.env.SCROLL) {
      await evalJs(`document.getElementById('${process.env.SCROLL}').scrollIntoView({block:'start'}); true`);
      await sleep(600);
      await shot(name + '-scroll');
    }
    if (process.env.CLICK) {
      await evalJs(`(() => { const el = document.querySelector(${JSON.stringify(process.env.CLICK)}); if (el) el.click(); return !!el; })()`);
      await sleep(800);
      await shot(name + '-click');
      if (process.env.POST_SCROLL) {
        await evalJs(`document.getElementById('${process.env.POST_SCROLL}').scrollIntoView({block:'start'}); true`);
        await sleep(600);
        await shot(name + '-class-scroll');
      }
    }
    if ((process.env.PRINT || '').includes(name)) {
      await cdp.send('Emulation.setEmulatedMedia', { media: 'print' });
      await shot(name + '-print', true);
      const pdf = await cdp.send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
      fs.writeFileSync(path.join(OUT, name + '.pdf'), Buffer.from(pdf.data, 'base64'));
      console.log('pdf', name);
      await cdp.send('Emulation.setEmulatedMedia', { media: '' });
    }
  }
  if (only === 'all' || only.includes('full')) {
    await goto(`http://127.0.0.1:${PORT}/app.html#/evaluations/T1/results`);
    await sleep(500);
    await evalJs(`window.App.actions.setResultsTab({dataset:{value:'classes'}}); true`);
    await sleep(600);
    await shot('11-results-classes');
    await evalJs(`window.App.actions.setResultsTab({dataset:{value:'schools'}}); true`);
    await sleep(600);
    await shot('12-results-schools');
    await goto(`http://127.0.0.1:${PORT}/app.html#/evaluations/T1/process`);
    await sleep(600);
    await shot('20-process-full', true);
  }
  if (only === 'all' || only.includes('public')) {
    await goto(`http://127.0.0.1:${PORT}/algorithm.html`);
    await shot('19-algorithm-public');
    if ((process.env.FULL || '').includes('19-algorithm-public')) await shot('19-algorithm-public-full', true);
  }
  const errors = cdp.events.filter((e) => e.method === 'Runtime.exceptionThrown' || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'));
  fs.writeFileSync(path.join(OUT, 'console.json'), JSON.stringify({ errors: errors.map((e) => e.params), count: errors.length }, null, 2));

  cdp.close();
  await fetch(`http://127.0.0.1:${CDP_PORT}/json/close/${tab.id}`).catch(() => {});
  chrome.kill();
  server.close();
}

try { await main(); } catch (e) { console.error(e); chrome.kill(); server.close(); process.exit(1); }
