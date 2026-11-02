/* 首页截图：视口 / 整页 / 分段滚动；用于核对清新科技风与动效节奏 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve('value-added-evaluation-system-v3.1/prototype');
const OUT = path.resolve(process.env.OUT_DIR || '_preview/home-v2');
const PORT = 8124;
const CDP_PORT = 9334;
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
const profile = path.join(process.env.TEMP || '.', 've-home-profile-' + Date.now());
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

  async function viewport(width, height) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  }
  async function goto(url, wait = 1700) {
    await cdp.send('Page.navigate', { url });
    await sleep(wait);
  }
  async function evalJs(expression) {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    return r.result ? r.result.value : undefined;
  }
  async function shot(name, full = false, scale = 1) {
    let params = { format: 'png' };
    if (full) {
      const m = await cdp.send('Page.getLayoutMetrics');
      const w = Math.ceil(m.cssContentSize.width), h = Math.ceil(m.cssContentSize.height);
      params = { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: Math.min(w, 1600), height: Math.min(h, 14000), scale } };
    }
    const r = await cdp.send('Page.captureScreenshot', params);
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.data, 'base64'));
    console.log('shot', name);
  }

  // 1440：首屏（动效结束态）
  await viewport(1440, 1000);
  await goto(`http://127.0.0.1:${PORT}/index.html`);
  await shot('01-hero-1440');

  // 1440：整页（关闭动效，核对排版）
  await goto(`http://127.0.0.1:${PORT}/index.html?anim=off`, 1200);
  await shot('02-full-1440', true);
  await shot('02b-full-1440-small', true, 0.3);

  // 1440：分段滚动（动效开，核对错峰入场后的状态）
  await goto(`http://127.0.0.1:${PORT}/index.html`);
  const stops = [
    ['03-value', 'value'],
    ['04-capabilities', 'capabilities'],
    ['05-method', 'method'],
    ['06-levels', 'levels'],
    ['07-trust', 'trust'],
    ['07b-metrics', 'metrics'],
    ['07c-workflow', 'workflow'],
    ['08-roles', 'roles'],
    ['08b-scenarios', 'scenarios'],
    ['09-faq', 'faq']
  ];
  for (const [name, id] of stops) {
    await evalJs(`document.getElementById('${id}').scrollIntoView({block:'start'});true`);
    await sleep(1400);
    await shot(name);
  }
  await evalJs(`window.scrollTo(0, document.body.scrollHeight);true`);
  await sleep(1200);
  await shot('10-footer');

  // 1280 / 1366 / 390
  await viewport(1280, 900);
  await goto(`http://127.0.0.1:${PORT}/index.html`);
  await shot('11-hero-1280');
  await viewport(1366, 768);
  await goto(`http://127.0.0.1:${PORT}/index.html`);
  await shot('11b-hero-1366x768');
  await viewport(768, 1024);
  await goto(`http://127.0.0.1:${PORT}/index.html`);
  await shot('11c-hero-768');
  await viewport(390, 844);
  await goto(`http://127.0.0.1:${PORT}/index.html`);
  await shot('12-hero-390');
  await evalJs(`document.getElementById('method').scrollIntoView({block:'start'});true`);
  await sleep(1200);
  await shot('13-method-390');

  // 登录回归
  await viewport(1440, 1000);
  await goto(`http://127.0.0.1:${PORT}/index.html`);
  await evalJs(`document.getElementById('homeUsername').value='ops';document.getElementById('homePassword').value='Ops@2026';document.getElementById('homeLoginBtn').click();true`);
  await sleep(1500);
  console.log('after login:', await evalJs('location.pathname + location.hash'));

  // reduced-motion 复核
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await goto(`http://127.0.0.1:${PORT}/index.html`, 900);
  console.log('reduced-motion html class:', await evalJs('document.documentElement.className'));
  console.log('reveal count hidden:', await evalJs(`(function(){var n=0;document.querySelectorAll('[data-reveal]').forEach(function(el){if(getComputedStyle(el).opacity==='0')n++;});return n;})()`));
  await shot('14-hero-reduced');
  await cdp.send('Emulation.setEmulatedMedia', { features: [] });

  const errors = cdp.events.filter((e) => e.method === 'Runtime.exceptionThrown' || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'));
  fs.writeFileSync(path.join(OUT, 'console.json'), JSON.stringify({ errors: errors.map((e) => e.params), count: errors.length }, null, 2));
  console.log('console errors:', errors.length);

  cdp.close();
  await fetch(`http://127.0.0.1:${CDP_PORT}/json/close/${tab.id}`).catch(() => {});
  chrome.kill();
  server.close();
}

try { await main(); } catch (e) { console.error(e); chrome.kill(); server.close(); process.exit(1); }
