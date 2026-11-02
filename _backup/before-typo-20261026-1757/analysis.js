/* 分析报告 v1：中立结构 + 完整数据 + 双向解读（旁路模块，不影响旧报告） */
(function () {
  'use strict';

  const App = window.App;
  const UI = window.UI;
  const AM = window.AnalysisMetrics;

  const esc = App.esc;
  const f1 = (v) => (v == null || isNaN(v)) ? '—' : Number(v).toFixed(1);
  const f2 = (v) => (v == null || isNaN(v)) ? '—' : Number(v).toFixed(2);
  const pct = (v) => (v == null || isNaN(v)) ? '—' : Math.round(v * 100) + '%';
  const pct1 = (v) => (v == null || isNaN(v)) ? '—' : (Number(v) * 100).toFixed(1) + '%';
  const sgn = (v) => (v == null || isNaN(v)) ? '—' : (v > 0 ? '+' + v : String(v));
  const pp = (v) => (v == null || isNaN(v)) ? '—' : (v > 0 ? '+' : '') + (Number(v) * 100).toFixed(1) + 'pp';

  const ROLES = [
    { key: 'region', label: '区域/联考', ready: true },
    { key: 'principal', label: '校长', ready: true },
    { key: 'grade', label: '年级主任', ready: true },
    { key: 'subject', label: '学科组长', ready: true },
    { key: 'homeroom', label: '班主任', ready: true },
    { key: 'teacher', label: '科任教师', ready: true },
    { key: 'student', label: '学生', ready: true }
  ];

  const SUBJECT_ORDER = ['语文', '数学', '英语', '物理', '历史', '化学', '生物', '政治', '地理', '日语', '俄语'];
  function subjectRank(s) { const i = SUBJECT_ORDER.indexOf(s); return i < 0 ? 99 : i; }

  function scopeSchoolId(r) {
    if (!App.canEdit()) return App.state.schoolId;
    const ids = (r.schoolEval['总分'] || []).map((x) => x.schoolId);
    const saved = App.state.analysisSchoolId;
    if (saved && ids.includes(saved)) return saved;
    return ids.includes('S01') ? 'S01' : (ids[0] || App.state.schoolId);
  }

  function canViewRegion() {
    return App.canEdit() || App.isSchool() || App.state.role === 'principal';
  }

  function schoolRows(r) {
    return (r.schoolEval['总分'] || []).map((s) => {
      const rows = (r.totals || []).filter((x) => x.schoolId === s.schoolId);
      const d = AM.describe(rows.map((x) => x.zDiff));
      return Object.assign({}, s, { mean: d.mean, sd: d.sd, expected: AM.expectedBelow(d.mean, d.sd) });
    }).sort((a, b) => a.strengthRank - b.strengthRank);
  }

  function scopeStats(rows, weights) {
    const list = rows || [];
    const n = list.length;
    const d = AM.describe(list.map((x) => Number(x.zDiff) || 0));
    const c = AM.counts(list);
    let keep = 0, progress = 0, decline = 0;
    const w = weights && weights.length ? weights : [90, 80, 70, 60, 50, 40, 30, 20, 10];
    list.forEach((x) => {
      if (x.status === '保持') keep += Math.max(0, (w[x.entryGrade - 1] || 0) - 10);
      else if (x.status === '进步') {
        let s = 0;
        for (let g = x.entryGrade - 1; g >= Math.max(1, x.entryGrade - x.level); g--) s += w[g - 1] || 0;
        progress += s;
      } else {
        let s = 0;
        for (let g = x.entryGrade + 1; g <= Math.min(9, x.entryGrade + Math.abs(x.level)); g++) s += 100 - (w[g - 1] || 0);
        decline += s;
      }
    });
    const rate = n ? Math.round(((keep / n + (progress / n) * 2) / ((decline / n + 1) * 1.5)) * 100) / 100 : null;
    return { n, mean: d.mean, sd: d.sd, progress: c.progress, keep: c.keep, decline: c.decline, progressRatio: c.progressRatio, keepRatio: c.keepRatio, declineRatio: c.declineRatio, rate };
  }

  function gradeBarsFor(rows) {
    const entry = new Array(9).fill(0), exit = new Array(9).fill(0);
    (rows || []).forEach((x) => { if (x.entryGrade >= 1 && x.entryGrade <= 9) entry[x.entryGrade - 1]++; if (x.currentGrade >= 1 && x.currentGrade <= 9) exit[x.currentGrade - 1]++; });
    return gradeDistBars({ grade: entry.map((v, i) => ({ grade: i + 1, entry: v, exit: exit[i], delta: exit[i] - v })) });
  }

  function roleCover(task, d, roleKey, title, scope, meta) {
    const role = ROLES.find((x) => x.key === roleKey) || { label: roleKey };
    return `<header class="an-cover">
      <div class="an-cover-top">
        <div class="breadcrumb"><span>管理</span><span class="sep">/</span><a href="#/evaluations/${task.id}/analysis">分析报告</a><span class="sep">/</span><span>${esc(role.label)}</span></div>
        <div class="an-cover-actions">
          <a class="btn btn-sm" href="#/evaluations/${task.id}/analysis">报告中心</a>
          <button class="btn btn-sm" data-action="printAnalysis">导出 PDF</button>
        </div>
      </div>
      <div class="an-cover-body">
        <div class="an-cover-copy"><div class="an-kicker">VALUE-ADDED ANALYSIS · ${esc(role.label)}</div><h1>${esc(title)}</h1><p>${scope}</p></div>
        <div class="an-cover-stamp"><b>${esc(role.label)}</b><span>${esc(meta || '全量数据 · 双向解读')}</span></div>
      </div>
      <div class="an-cover-meta"><span>任务 <b>${esc(task.name)}</b></span><span>结果版本 <b>${esc(task.resultVersion || '—')}</b></span><span>更新 <b>${esc(task.updatedAt || '—')}</b></span></div>
    </header>`;
  }

  function roleToolbar(scopeLabel, selectHtml, noteText) {
    return `<div class="an-toolbar an-toolbar-filter"><div class="an-toolbar-left"><span class="an-scope-label">${esc(scopeLabel)}</span>${selectHtml || '<span class="an-fixed">全部</span>'}</div><div class="an-toolbar-right"><span>${esc(noteText || '退步面基线 31.7% · n<8 不判定')}</span></div></div>`;
  }

  function analysisPicker(kind, current, options, placeholder, unit) {
    return `<div class="an-picker" data-picker="${kind}" data-unit="${esc(unit || '项')}">
      <button type="button" class="an-picker-trigger" title="${esc(current)}" onclick="App.openAnalysisPicker('${kind}')" aria-haspopup="listbox" aria-expanded="false">
        ${UI.icon('search', 'an-picker-icon')}<span class="an-picker-current">${esc(current)}</span><span class="an-picker-caret">▾</span>
      </button>
      <div class="an-picker-pop">
        <div class="an-picker-search">${UI.icon('search', 'an-picker-icon')}<input class="input an-picker-input" placeholder="${esc(placeholder)}" autocomplete="off" oninput="App.filterAnalysisPicker('${kind}', this.value)" onkeydown="App.analysisPickerKey(event, '${kind}')"></div>
        <div class="an-picker-list" role="listbox">${options.map((o) => `<button type="button" class="an-picker-option ${o.label === current ? 'selected' : ''}" data-value="${esc(o.label)}" data-search="${esc(o.search || o.label)}" onclick="App.pickAnalysisOption('${kind}', this.dataset.value)">${esc(o.label)}</button>`).join('')}</div>
        <div class="an-picker-empty" hidden>没有匹配项</div>
        <div class="an-picker-foot"><span class="an-picker-count">共 ${options.length} ${esc(unit || '项')}</span><span>点击或回车选择</span></div>
      </div>
    </div>`;
  }

  function roleToc(items) {
    return `<aside class="an-toc"><div class="an-toc-title">目录</div>${items.map(([id, label], i) => `<button class="an-toc-link ${i === 0 ? 'active' : ''}" data-action="scrollAnalysis" data-target="${id}">${label}</button>`).join('')}<button class="btn btn-sm an-toc-print" data-action="printAnalysis">导出 PDF</button><div class="an-toc-note">A4 纵向 · 全量数据</div></aside>`;
  }

  function roleShell(task, d, roleKey, title, scope, toolbar, tocItems, body, meta) {
    return `<div class="page an-page an-report">${roleCover(task, d, roleKey, title, scope, meta)}${roleBar(task, roleKey)}${toolbar}<div class="an-layout"><main class="an-main">${body}</main>${roleToc(tocItems)}</div><button class="an-backtop" type="button" data-action="scrollTopAnalysis" aria-label="回到顶部" title="回到顶部">↑</button></div>`;
  }

  function groupStats(rows, keyFn, labelFn) {
    const map = {};
    (rows || []).forEach((x) => {
      const k = keyFn(x);
      if (k == null) return;
      const g = map[k] || (map[k] = { key: k, label: labelFn ? labelFn(x) : k, rows: [] });
      g.rows.push(x);
    });
    return Object.values(map).map((g) => Object.assign({ label: g.label }, scopeStats(g.rows))).sort((a, b) => (a.mean == null ? 99 : a.mean) - (b.mean == null ? 99 : b.mean));
  }

  const NEG_TAGS = [
    { key: '总分掉2档以上', short: '总分↓2', title: '总分入口档 − 评价档 ≥ 2' },
    { key: '入口靠前但退步', short: '入口前退', title: '入口 G1–G3 且下降 ≥ 1 档' },
    { key: '单科掉2档以上', short: '单科↓2', title: '任一科等级下降 ≥ 2 档' },
    { key: '单科掉4档以上', short: '单科↓4', title: '任一科等级下降 ≥ 4 档' }
  ];
  const POS_TAGS = [
    { key: '总分升2档以上', short: '总分↑2', title: '评价档 − 入口档 ≥ 2' },
    { key: '入口前段进步', short: '入口前升', title: '入口 G1–G3 且进步' },
    { key: '入口后段进步', short: '入口后升', title: '入口 G7–G9 且进步' },
    { key: '单科升2档以上', short: '单科↑2', title: '任一科等级上升 ≥ 2 档' },
    { key: '单科升4档以上', short: '单科↑4', title: '任一科等级上升 ≥ 4 档' }
  ];

  function tagMatrixTable(rows, opts) {
    const o = opts || {};
    const zKey = o.zKey || 'zDiff';
    const zLabel = o.zLabel || 'ΔZ';
    const pathFn = o.pathFn || ((x) => `G${x.entryGrade} → G${x.currentGrade}`);
    const tagsOf = (x) => new Set([].concat(x.tags || [], positiveTags(x)));
    const hit = (x, tag) => tagsOf(x).has(tag);
    const head1 = `<tr>${o.includeNo ? '<th rowspan="2">学号</th>' : ''}<th rowspan="2">班级</th><th rowspan="2">姓名</th><th rowspan="2">入口→评价</th><th rowspan="2">${esc(zLabel)}</th>${o.includeStatus ? '<th rowspan="2">判定</th>' : ''}<th colspan="${NEG_TAGS.length}" class="an-tag-group neg">负向标签</th><th colspan="${POS_TAGS.length}" class="an-tag-group pos">正向标签</th></tr>`;
    const head2 = `<tr>${NEG_TAGS.map((t) => `<th class="an-tag-col neg" title="${esc(t.title)}">${esc(t.short)}</th>`).join('')}${POS_TAGS.map((t) => `<th class="an-tag-col pos" title="${esc(t.title)}">${esc(t.short)}</th>`).join('')}</tr>`;
    const body = rows.map((x) => `<tr${o.rowClass ? ` class="${o.rowClass(x)}"` : ''}>${o.includeNo ? `<td class="an-tag-id">${esc(x.studentNo)}</td>` : ''}<td class="an-tag-identity an-tag-class">${esc(x.className)}</td><td class="an-tag-identity an-tag-name">${esc(x.studentName)}</td><td class="an-tag-path">${pathFn(x)}</td><td class="an-tag-z ${toneClass(x[zKey])}">${sgn(f2(x[zKey]))}</td>${o.includeStatus ? `<td>${UI.badge(x.status, x.status === '进步' ? 'green' : x.status === '退步' ? 'red' : 'gray')}</td>` : ''}${NEG_TAGS.map((t) => `<td class="an-tag-cell ${hit(x, t.key) ? 'hit neg' : ''}" title="${esc(t.title)}">${hit(x, t.key) ? '●' : ''}</td>`).join('')}${POS_TAGS.map((t) => `<td class="an-tag-cell ${hit(x, t.key) ? 'hit pos' : ''}" title="${esc(t.title)}">${hit(x, t.key) ? '●' : ''}</td>`).join('')}</tr>`).join('');
    return `<div class="table-wrap an-tag-wrap"><table class="table an-tag-table"><thead>${head1}${head2}</thead><tbody>${body}</tbody></table></div><div class="an-tag-legend"><span><b>●</b> 命中</span><span>空白=未命中</span><span>↓=掉档，↑=升档；短标签全称悬停可见</span></div>`;
  }

  function roleStudentTable(rows, opts) {
    return tagMatrixTable(rows, opts);
  }

  function bandOverviewTable(rows) {
    const bands = [
      { label: '入口前约23%', from: 1, to: 3 },
      { label: '入口中间约55%', from: 4, to: 6 },
      { label: '入口后约23%', from: 7, to: 9 }
    ];
    const data = bands.map((b) => {
      const rs = (rows || []).filter((x) => x.entryGrade >= b.from && x.entryGrade <= b.to);
      const st = scopeStats(rs);
      return { label: b.label, ...st };
    });
    return UI.table({
      columns: [
        { key: 'label', label: '入口段', render: (x) => `<b>${esc(x.label)}</b>` },
        { key: 'n', label: '人数', align: 'num' },
        { key: 'progress', label: '进步', align: 'num' },
        { key: 'keep', label: '保持', align: 'num' },
        { key: 'decline', label: '退步', align: 'num' },
        { key: 'mean', label: '平均 ΔZ', align: 'num', render: (x) => sgn(f2(x.mean)) },
        { key: 'progressRatio', label: '进步面', align: 'num', render: (x) => pct1(x.progressRatio) },
        { key: 'declineRatio', label: '退步面', align: 'num', render: (x) => pct1(x.declineRatio) }
      ], rows: data
    });
  }

  function tagSummary(students) {
    const neg = students.filter((x) => x.risk).length;
    const pos = students.filter((x) => positiveTags(x).length).length;
    const both = students.filter((x) => x.risk && positiveTags(x).length).length;
    const none = students.length - students.filter((x) => x.risk || positiveTags(x).length).length;
    return kpiGrid([
      { label: '负向标签', value: neg + ' 人', sub: '优先跟进并集', tone: 'neg' },
      { label: '正向标签', value: pos + ' 人', sub: '有任一正向变化', tone: 'pos' },
      { label: '正负同时', value: both + ' 人', sub: '两类标签共存' },
      { label: '无标签', value: none + ' 人', sub: '未命中规则' }
    ]);
  }

  function histCard(rows, title) {
    const values = (rows || []).map((x) => Number(x.zDiff) || 0);
    return `<div class="an-card"><h4>${esc(title || 'ΔZ 分布')}</h4>${histChart(AM.histogram(values, 0.25))}${note('横轴为 ΔZ 分箱，纵轴为人数；0 附近为持平。')}</div>`;
  }

  function verdict(mean, n) {
    if (n == null || n < 8 || !isFinite(mean)) return { label: '样本不足', tone: 'gray' };
    if (mean >= 0.3) return { label: '明显高于', tone: 'green' };
    if (mean >= 0.1) return { label: '略高于', tone: 'green' };
    if (mean > -0.1) return { label: '基本持平', tone: 'gray' };
    if (mean > -0.3) return { label: '略低于', tone: 'amber' };
    return { label: '明显低于', tone: 'red' };
  }
  function toneClass(v) { return v >= 0.1 ? 'an-pos' : v <= -0.1 ? 'an-neg' : 'an-mid'; }
  function verdictBadge(mean, n) {
    const v = verdict(mean, n);
    return `<span class="an-badge ${v.tone}">${v.label}</span>`;
  }

  /* ---------- 路由 ---------- */
  function analysisPages(parts) {
    const task = App.task(parts[1]);
    if (!task) return `<div class="page">${UI.empty('评价任务不存在')}</div>`;
    if (task.status !== '已完成') return `<div class="page">${UI.empty('任务完成后才能查看分析报告')}</div>`;
    const role = parts[3];
    if (!role) return hub(task);
    if (role === 'principal') return principalPage(task);
    if (role === 'region') return canViewRegion() ? regionPage(task) : `<div class="page an-page">${UI.empty('当前账号无权查看区域/联考报告')}</div>`;
    if (role === 'grade') return gradePage(task);
    if (role === 'subject') return subjectPage(task);
    if (role === 'homeroom') return homeroomPage(task);
    if (role === 'teacher') return teacherPage(task);
    if (role === 'student') return studentPage(task);
    if (role === 'region') return regionPage(task);
    return placeholder(task, role);
  }
  App.analysisPages = analysisPages;
  App.setAnalysisSchool = function (v) {
    App.state.analysisSchoolId = v;
    App.render();
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  function setRoleScope(key) {
    return function (v) {
      App.state[key] = v;
      App.render();
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
  }
  App.setAnalysisSubject = setRoleScope('analysisSubject');
  App.setAnalysisClass = setRoleScope('analysisClassId');
  App.setAnalysisTeacher = setRoleScope('analysisTeacherName');
  App.setAnalysisStudent = setRoleScope('analysisStudentId');
  App.closeAnalysisPickers = function () {
    document.querySelectorAll('.an-picker.open').forEach((box) => {
      box.classList.remove('open');
      const trigger = box.querySelector('.an-picker-trigger');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
  };
  App.openAnalysisPicker = function (kind) {
    const box = document.querySelector(`.an-picker[data-picker="${kind}"]`);
    if (!box) return;
    const wasOpen = box.classList.contains('open');
    App.closeAnalysisPickers();
    if (wasOpen) return;
    box.classList.add('open');
    const trigger = box.querySelector('.an-picker-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    const input = box.querySelector('.an-picker-input');
    if (input) {
      input.value = '';
      App.filterAnalysisPicker(kind, '');
      setTimeout(() => input.focus(), 0);
    }
    if (!window.__AN_PICKER_OUTSIDE__) {
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.an-picker')) App.closeAnalysisPickers();
      });
      window.__AN_PICKER_OUTSIDE__ = true;
    }
  };
  App.filterAnalysisPicker = function (kind, query) {
    const box = document.querySelector(`.an-picker[data-picker="${kind}"]`);
    if (!box) return;
    const q = String(query || '').trim().toLowerCase();
    const opts = Array.from(box.querySelectorAll('.an-picker-option'));
    let shown = 0;
    opts.forEach((opt) => {
      const hit = !q || String(opt.dataset.search || '').toLowerCase().indexOf(q) !== -1;
      opt.hidden = !hit;
      if (hit) shown++;
    });
    const empty = box.querySelector('.an-picker-empty');
    if (empty) empty.hidden = shown > 0;
    const count = box.querySelector('.an-picker-count');
    if (count) {
      const unit = box.dataset.unit || '项';
      count.textContent = q ? `找到 ${shown} ${unit}` : `共 ${opts.length} ${unit}`;
    }
  };
  App.analysisPickerKey = function (e, kind) {
    if (e.key === 'Escape') { e.preventDefault(); App.closeAnalysisPickers(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return;
    const box = document.querySelector(`.an-picker[data-picker="${kind}"]`);
    if (!box) return;
    const opts = Array.from(box.querySelectorAll('.an-picker-option')).filter((o) => !o.hidden);
    if (!opts.length) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      opts[0].click();
      return;
    }
    e.preventDefault();
    const active = document.activeElement;
    let idx = opts.indexOf(active);
    if (idx < 0) idx = e.key === 'ArrowDown' ? -1 : opts.length;
    idx += e.key === 'ArrowDown' ? 1 : -1;
    idx = (idx + opts.length) % opts.length;
    opts[idx].focus();
  };
  App.pickAnalysisOption = function (kind, label) {
    if (kind === 'teacher') App.pickAnalysisTeacher(label);
    else if (kind === 'student') App.pickAnalysisStudent(label);
  };
  App.pickAnalysisTeacher = function (label) {
    const hit = (App.__AN_TEACHERS || []).find((x) => x.label === label);
    if (!hit) { UI.toast('未找到该教师', 'warn'); App.render(); return; }
    App.state.analysisTeacherName = hit.name;
    App.render();
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  App.pickAnalysisStudent = function (label) {
    const hit = (App.__AN_STUDENTS || []).find((x) => x.label === label);
    if (!hit) { UI.toast('未找到该学生', 'warn'); App.render(); return; }
    App.state.analysisStudentId = hit.id;
    App.render();
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  App.actions.printAnalysis = function () { window.print(); };
  App.actions.scrollTopAnalysis = function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(function () {
      if (window.scrollY > 0 && window.scrollY < 200) window.scrollTo({ top: 0, behavior: 'auto' });
    }, 650);
  };

  function syncAnalysisChrome() {
    const bar = document.querySelector('.an-report .an-rolebar');
    const toolbar = document.querySelector('.an-report .an-toolbar');
    const root = document.documentElement;
    if (bar) root.style.setProperty('--rolebar-h', Math.ceil(bar.getBoundingClientRect().height) + 'px');
    else root.style.removeProperty('--rolebar-h');
    if (toolbar) root.style.setProperty('--toolbar-h', Math.ceil(toolbar.getBoundingClientRect().height) + 'px');
    else root.style.removeProperty('--toolbar-h');
    const top = document.querySelector('.an-backtop');
    if (top) top.classList.toggle('show', window.scrollY > 600);
  }
  if (!window.__ANALYSIS_CHROME__) {
    window.__ANALYSIS_CHROME__ = true;
    window.addEventListener('resize', function () { requestAnimationFrame(syncAnalysisChrome); });
    window.addEventListener('scroll', function () {
      const top = document.querySelector('.an-backtop');
      if (top) top.classList.toggle('show', window.scrollY > 600);
    }, { passive: true });
  }
  App.afterRender = function () { requestAnimationFrame(syncAnalysisChrome); };
  App.actions.exportAnalysisStudents = function () {
    const csv = window.__ANALYSIS_STUDENT_CSV__;
    if (!csv) { UI.toast('当前没有可导出的学生明细', 'error'); return; }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '增值分析_学生全表.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 800);
  };
  App.actions.scrollAnalysis = function (el) {
    const t = document.getElementById(el.dataset.target || '');
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.querySelectorAll('.an-toc-link').forEach(function (n) { n.classList.toggle('active', n === el); });
  };

  /* ---------- 报告中心 ---------- */
  function hub(task) {
    const r = App.result(task.id);
    const c = AM.counts(r.totals.filter((x) => App.canEdit() || x.schoolId === App.state.schoolId));
    const cards = ROLES.map((role) => {
      const available = role.ready && (role.key !== 'region' || canViewRegion());
      const status = available ? '<span class="an-hub-status ready">已开放</span>' : '<span class="an-hub-status">当前账号不可用</span>';
      const inner = `<div class="an-hub-top"><div class="an-hub-icon">${role.label.slice(0, 1)}</div><div><div class="an-hub-title">${esc(role.label)}</div><div class="an-hub-sub">${available ? '中立结构 · 全量数据 · 双向解读' : '按权限范围开放'}</div></div>${status}</div>
        <div class="an-hub-chapters">A 说明 · B 总体 · C 结构 · D 分项 · E 差异 · F 追问</div>`;
      return available
        ? `<a class="an-hub-card ready" href="#/evaluations/${task.id}/analysis/${role.key}">${inner}<div class="an-hub-go">查看报告 →</div></a>`
        : `<div class="an-hub-card">${inner}</div>`;
    }).join('');
    return `<div class="page an-page">
      <div class="page-head">
        <div><div class="breadcrumb"><span>管理</span><span class="sep">/</span><span>评价任务</span><span class="sep">/</span><span>分析报告</span></div>
          <div class="an-kicker">ANALYSIS CENTER</div>
          <h1 class="page-title">分析报告中心</h1>
          <div class="page-desc">先看全貌，再看分项；每章完整数据、双向解读，再追问为什么高、为什么低。</div>
        </div>
        <div class="page-actions"></div>
      </div>
      <div class="an-hub-meta">
        <div><span>任务</span><b>${esc(task.name)}</b></div>
        <div><span>范围</span><b>${App.canEdit() ? '四校' : App.schoolName(App.state.schoolId)}</b></div>
        <div><span>参评</span><b>${c.n} 人</b></div>
        <div><span>退步面</span><b>${pct1(c.declineRatio)}</b></div>
        <div><span>结果版本</span><b>${esc(task.resultVersion || '—')}</b></div>
      </div>
      <div class="an-hub-grid">${cards}</div>
      <div class="an-hub-note">分析报告入口；旧报告入口已关闭。区域/联考对区域管理员与校长开放，其余角色按学校范围开放。</div>
    </div>`;
  }

  function placeholder(task, role) {
    const roleDef = ROLES.find((x) => x.key === role) || { label: role };
    return `<div class="page an-page"><div class="page-head"><div><div class="breadcrumb"><span>管理</span><span class="sep">/</span><a href="#/evaluations/${task.id}/analysis">分析报告</a><span class="sep">/</span><span>${esc(roleDef.label)}</span></div><h1 class="page-title">${esc(roleDef.label)}分析报告</h1></div><div class="page-actions"><a class="btn" href="#/evaluations/${task.id}/analysis">返回中心</a></div></div>
      <div class="an-placeholder"><b>下一阶段</b><p>${esc(roleDef.label)}将复用同一套 A–F 骨架，按角色范围与模块开关生成，不另写结构。</p><a class="btn" href="#/evaluations/${task.id}/analysis/principal">先看校长报告</a></div></div>`;
  }

  /* ---------- 年级主任 ---------- */
  function gradePage(task) {
    const r = App.result(task.id);
    const schoolId = scopeSchoolId(r);
    const d = AM.build(r, schoolId);
    if (!d.school) return `<div class="page">${UI.empty('当前任务没有该校结果')}</div>`;
    window.__ANALYSIS_STUDENT_CSV__ = buildStudentCsv(d);
    const body = [
      chapterA(task, r, d),
      chapterB(task, r, d),
      chapterC(task, r, d),
      chapterD1(task, r, d),
      chapterD2(task, r, d),
      chapterD3(task, r, d),
      chapterD4(task, r, d),
      chapterE(task, r, d),
      chapterF(task, r, d),
      appendix(task, r, d)
    ].join('');
    const toolbar = roleToolbar('年级', '<span class="an-fixed">高三年级</span>', '年级视角 · 班级/学科/教师/学生全量');
    return roleShell(task, d, 'grade', `${esc(d.school.schoolName)}高三年级增值分析报告`, `读者：年级主任 · 范围：${esc(d.school.schoolName)} 高三年级 ${d.school.n} 人 · 口径：${task.algorithm === 'grade' ? '等级差法' : '标准分法'} / ${r.gradeCount || 9} 档`, toolbar, FULL_TOC, body, '年级视角');
  }

  /* ---------- 学科组长 ---------- */
  function subjectTeacherDetail(rows) {
    const map = {};
    (rows || []).forEach((x) => {
      const k = x.teacherId || x.teacherName;
      const g = map[k] || (map[k] = { teacher: x.teacherName || '—', classes: {} });
      const c = g.classes[x.classId] || (g.classes[x.classId] = { className: x.className, rows: [] });
      c.rows.push(x);
    });
    const groups = Object.values(map).map((g) => ({ teacher: g.teacher, classes: Object.values(g.classes).map((c) => ({ className: c.className, rows: c.rows })) }));
    groups.forEach((g) => g.classes.sort((a, b) => AM.classNum(a.className) - AM.classNum(b.className)));
    groups.sort((a, b) => scopeStats(a.classes.flatMap((c) => c.rows)).mean - scopeStats(b.classes.flatMap((c) => c.rows)).mean);
    const head = `<tr><th>教师</th><th>班级 / 口径</th><th>本科人数</th><th>平均 ΔZ</th><th>进步面</th><th>退步面</th><th>相对进步率</th><th>判定</th></tr>`;
    const body = groups.map((g) => {
      const all = g.classes.flatMap((c) => c.rows);
      const st = scopeStats(all);
      const multi = g.classes.length > 1;
      const span = multi ? g.classes.length + 1 : 1;
      const label = multi ? `<b>教师汇总</b><span class="small">（${g.classes.length} 个班）</span>` : `${esc(g.classes[0].className)}<span class="small">（仅1个班）</span>`;
      const summary = `<tr class="an-teacher-group an-teacher-summary"><td rowspan="${span}" class="an-teacher-merge"><b>${esc(g.teacher)}</b></td><td>${label}</td><td class="num">${st.n}</td><td class="num"><b class="${toneClass(st.mean)}">${sgn(f2(st.mean))}</b></td><td class="num">${pct1(st.progressRatio)}</td><td class="num">${pct1(st.declineRatio)}</td><td class="num">${st.n < 8 ? '—' : f2(st.rate)}</td><td>${verdictBadge(st.mean, st.n)}</td></tr>`;
      const classRows = multi ? g.classes.map((c) => {
        const s = scopeStats(c.rows);
        return `<tr class="an-teacher-class"><td class="an-teacher-classname">${esc(c.className)}</td><td class="num">${s.n}</td><td class="num"><b class="${toneClass(s.mean)}">${sgn(f2(s.mean))}</b></td><td class="num">${pct1(s.progressRatio)}</td><td class="num">${pct1(s.declineRatio)}</td><td class="num">${s.n < 8 ? '—' : f2(s.rate)}</td><td>${verdictBadge(s.mean, s.n)}</td></tr>`;
      }).join('') : '';
      return summary + classRows;
    }).join('');
    return `<div class="table-wrap an-teacher-table-wrap"><table class="table an-teacher-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
  }

  function subjectPage(task) {
    const r = App.result(task.id);
    const schoolId = scopeSchoolId(r);
    const d = AM.build(r, schoolId);
    if (!d.school) return `<div class="page">${UI.empty('当前任务没有该校结果')}</div>`;
    const subjects = d.subjectRows.map((x) => x.subject);
    const saved = App.state.analysisSubject;
    const sub = subjects.includes(saved) ? saved : (d.subjectRows.slice().sort((a, b) => a.mean - b.mean)[0] || {}).subject;
    const rows = r.rows.filter((x) => x.schoolId === schoolId && x.subject === sub);
    const st = scopeStats(rows, r.weights);
    const classes = groupStats(rows, (x) => x.classId, (x) => x.className);
    const teachers = groupStats(rows, (x) => x.teacherId || x.teacherName, (x) => x.teacherName || '—');
    const ids = new Set(rows.map((x) => x.studentId));
    const students = d.risk.list.filter((x) => ids.has(x.studentId)).map((x) => {
      const sr = (x.subs || []).find((s) => s.subject === sub);
      return Object.assign({}, x, { subjectZ: sr ? sr.zDiff : null, subjectEntry: sr ? sr.entryGrade : null, subjectCurrent: sr ? sr.currentGrade : null });
    }).filter((x) => x.subjectZ != null).sort((a, b) => a.subjectZ - b.subjectZ);
    const bottom = students.slice(0, 10), top = students.slice().sort((a, b) => b.subjectZ - a.subjectZ).slice(0, 10);
    const classTable = UI.table({
      columns: [
        { key: 'label', label: '班级', render: (x) => `<b>${esc(x.label)}</b>` },
        { key: 'n', label: '人数', align: 'num' },
        { key: 'mean', label: '平均 ΔZ', align: 'num', render: (x) => `<b class="${toneClass(x.mean)}">${sgn(f2(x.mean))}</b>` },
        { key: 'progressRatio', label: '进步面', align: 'num', render: (x) => pct1(x.progressRatio) },
        { key: 'declineRatio', label: '退步面', align: 'num', render: (x) => pct1(x.declineRatio) },
        { key: 'rate', label: '相对进步率', align: 'num', render: (x) => f2(x.rate) }
      ], rows: classes
    });
    const teacherTable = UI.table({
      columns: [
        { key: 'label', label: '教师', render: (x) => `<b>${esc(x.label)}</b>` },
        { key: 'n', label: '本科人数', align: 'num' },
        { key: 'mean', label: '平均 ΔZ', align: 'num', render: (x) => `<b class="${toneClass(x.mean)}">${sgn(f2(x.mean))}</b>` },
        { key: 'progressRatio', label: '进步面', align: 'num', render: (x) => pct1(x.progressRatio) },
        { key: 'declineRatio', label: '退步面', align: 'num', render: (x) => pct1(x.declineRatio) },
        { key: 'rate', label: '相对进步率', align: 'num', render: (x) => x.n < 8 ? '—' : f2(x.rate) }
      ], rows: teachers
    });
    const classesSorted = classes.filter((x) => x.n >= 8).sort((a, b) => b.mean - a.mean);
    const classPoints = classes.filter((x) => x.n >= 8).map((c) => {
      const base = d.classes.find((x) => x.name === c.label);
      return base ? { label: c.label, x: base.strength, y: c.mean, n: c.n } : null;
    }).filter(Boolean);
    const good = classesSorted.slice(0, 2).map((x) => `<b>${esc(x.label)}</b> 平均 ΔZ ${sgn(f2(x.mean))}、进步面 ${pct1(x.progressRatio)}。`);
    const bad = classesSorted.slice(-2).map((x) => `<b>${esc(x.label)}</b> 平均 ΔZ ${sgn(f2(x.mean))}、退步面 ${pct1(x.declineRatio)}。`);
    const body = [
      chapter('A', 'an-a', '报告说明', '学科组长看什么、数据范围是什么？', `<div class="an-card"><h4>${esc(sub)} · ${esc(d.school.schoolName)}</h4><ul class="an-list"><li>范围：${st.n} 名学生的 ${esc(sub)} 学科成绩；入口/评价两次考试同一口径。</li><li>主镜头：平均 ΔZ、进步面、退步面、相对进步率；班级/教师差异同时看。</li><li>边界：学科试卷不同，不跨科比分数；教师差异不直接等于教学水平。</li></ul></div>`, '学科视角'),
      chapter('B', 'an-b', '总体', `${esc(sub)} 整体处在什么位置？`, kpiGrid([
        { label: '参评人数', value: st.n + ' 人', sub: '本科有效成绩' },
        { label: '平均 ΔZ', value: sgn(f2(st.mean)), sub: '0 为持平', tone: st.mean >= 0 ? 'pos' : 'neg' },
        { label: '进步面', value: pct1(st.progressRatio), sub: '进步人数 / 本科人数' },
        { label: '退步面', value: pct1(st.declineRatio), sub: '退步人数 / 本科人数' }
      ]) + `<div class="an-card mt-16"><h4>${esc(sub)} 等级分布</h4>${gradeBarsFor(rows)}${note('灰色=入口，彩色尾巴=评价多/少；红/绿只表示人数方向。')}</div>`, '全量'),
      chapter('C', 'an-c', '结构', '入口到评价，等级结构怎么变？', `<div class="an-card"><h4>等级迁移矩阵（${st.n} 人）</h4>${migrationTable(rows)}${note('行=入口、列=出口；G1 最好、G9 最低；出口数字变大是降档。')}</div><div class="mt-16">${histCard(rows, '本科 ΔZ 分布')}</div>`, '结构'),
      chapter('D1', 'an-d1', '分项 · 班级', '每个班的该科表现如何？', `<div class="an-card"><h4>班级实力 × 本科 ΔZ</h4>${scatterChart(classPoints, { aria: '班级实力与本科 ΔZ 散点图' })}${note('横轴=班级学业实力，纵轴=本科平均 ΔZ；气泡=本科人数。')}</div><div class="an-card mt-16"><h4>班级 × ${esc(sub)}</h4>${classTable}${note('按平均 ΔZ 从低到高；n<8 不判定，完整班级表见 A3。')}</div><div class="an-card mt-16"><h4>班级 × 本科：单科掉2 / 升2档人数</h4>${changeCountTable(rows, (x) => x.classId, (x) => x.className, '班级')}${note('同一学生本科多科会重复计；净升=升2档以上−掉2档以上。')}</div>${interp(good, bad, [])}`, '全部班级'),
      chapter('D2', 'an-d2', '分项 · 教师', '不同教师的该科表现如何？', `<div class="an-card"><h4>教师 × 本科：汇总 + 班级拆分</h4>${subjectTeacherDetail(rows)}${note('每位教师先列教师汇总，再列所教班；单班教师只留一行；教师不排名，班间差异不直接归因。')}</div><div class="an-card mt-16"><h4>教师 × 本科：单科掉2 / 升2档人数</h4>${changeCountTable(rows, (x) => x.teacherId || x.teacherName, (x) => x.teacherName || '—', '教师')}${note('同一教师多科/多班按人次计；净升=升2档以上−掉2档以上。')}</div>`, '不排名'),
      chapter('D3', 'an-d3', '分项 · 学生', '哪些学生变化最大？', `<div class="an-card"><h4>入口段 × 本科表现</h4>${bandOverviewTable(rows)}</div><div class="an-card mt-16"><h4>标签概况（${students.length} 人）</h4>${tagSummary(students)}</div><div class="an-card mt-16"><h4>本科学生总表：总分 + 本科 ΔZ</h4>${studentMasterTable(students, d, [sub])}${note('只展示总分与本科；行=学生，列=总分/本科 ΔZ；悬停可看等级路径。')}</div><div class="an-card mt-16"><h4>负向样本（前10）</h4>${roleStudentTable(bottom, { zKey: 'subjectZ', zLabel: '本科 ΔZ', pathFn: (x) => `G${x.subjectEntry} → G${x.subjectCurrent}` })}</div><div class="an-card mt-16"><h4>正向样本（前10）</h4>${roleStudentTable(top, { zKey: 'subjectZ', zLabel: '本科 ΔZ', pathFn: (x) => `G${x.subjectEntry} → G${x.subjectCurrent}` })}</div>${note('正负样本按本科 ΔZ 排序，各取前10；标签列仍为总分标签。完整 748 人清单见 A5。')}`, '样本'),
      chapter('E', 'an-e', '差异与关联', '班级、教师差异在哪里？', `<div class="an-card"><h4>班级差异摘要</h4><ul class="an-list"><li>班级平均 ΔZ 最高：${classesSorted[0] ? `${esc(classesSorted[0].label)} ${sgn(f2(classesSorted[0].mean))}` : '—'}；最低：${classesSorted[classesSorted.length - 1] ? `${esc(classesSorted[classesSorted.length - 1].label)} ${sgn(f2(classesSorted[classesSorted.length - 1].mean))}` : '—'}。</li><li>教师区间：${teachers.length} 位教师，平均 ΔZ 从 ${teachers.length ? sgn(f2(teachers[0].mean)) : '—'} 到 ${teachers.length ? sgn(f2(teachers[teachers.length - 1].mean)) : '—'}。</li><li>差异可能来自入口、班额、选科与命题；本页只描述，不证明因果。</li></ul></div>`, '描述'),
      chapter('F', 'an-f', '追问与行动', '下一步先核对什么？', `${whyBlock('候选解释（待验证）', [
        `班级差异：先看 ${classesSorted.slice(-2).map((x) => esc(x.label)).join('、') || '低值班'} 的入口结构与作业完成。`,
        `教师差异：同科教师跨班对比需要两个班与课堂/作业数据；仅凭增值不能归因。`,
        `命题/生源：整科偏低时先核对备课组、命题与生源结构，再判断是否个别教师。`
      ])}${boundary('学科报告只读该科成绩；跨科不可直接比分数；n<8 不判定。')}`, '待验证')
    ].join('');
    window.__ANALYSIS_STUDENT_CSV__ = '';
    const sel = `<select class="select select-sm" onchange="App.setAnalysisSubject(this.value)">${subjects.map((s) => `<option value="${esc(s)}" ${s === sub ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>`;
    return roleShell(task, d, 'subject', `${esc(d.school.schoolName)} · ${esc(sub)}学科增值分析报告`, `读者：学科组长 · 范围：${esc(d.school.schoolName)} ${esc(sub)} ${st.n} 人 · 口径：${task.algorithm === 'grade' ? '等级差法' : '标准分法'} / ${r.gradeCount || 9} 档`, roleToolbar('学科', sel, '学科视角 · 班级/教师/学生'), [['an-a', 'A 说明'], ['an-b', 'B 总体'], ['an-c', 'C 结构'], ['an-d1', 'D1 班级'], ['an-d2', 'D2 教师'], ['an-d3', 'D3 学生'], ['an-e', 'E 差异'], ['an-f', 'F 行动']], body, '学科视角');
  }

  /* ---------- 班主任 ---------- */
  function homeroomPage(task) {
    const r = App.result(task.id);
    const schoolId = scopeSchoolId(r);
    const d = AM.build(r, schoolId);
    if (!d.school) return `<div class="page">${UI.empty('当前任务没有该校结果')}</div>`;
    const classes = d.classes.filter((x) => x.n >= 8);
    const saved = App.state.analysisClassId;
    const cls = classes.find((x) => x.id === saved) || classes.slice().sort((a, b) => a.mean - b.mean)[0] || d.classes[0];
    if (!cls) return `<div class="page">${UI.empty('当前没有可展示的班级')}</div>`;
    const totals = d.totals.filter((x) => x.classId === cls.id);
    const st = scopeStats(totals, r.weights);
    const students = d.risk.list.filter((x) => x.classId === cls.id);
    const subjectRows = r.rows.filter((x) => x.schoolId === schoolId && x.classId === cls.id && x.subject !== '总分');
    const subj = groupStats(subjectRows, (x) => x.subject, (x) => x.subject).sort((a, b) => subjectRank(a.label) - subjectRank(b.label));
    const schoolSub = {};
    d.subjectRows.forEach((x) => { schoolSub[x.subject] = x.mean; });
    const subjRows = subj.map((x) => ({ ...x, schoolMean: schoolSub[x.label], diff: x.schoolMean == null ? null : x.mean - x.schoolMean }));
    const subjTable = UI.table({
      columns: [
        { key: 'label', label: '学科', render: (x) => `<b>${esc(x.label)}</b>` },
        { key: 'n', label: '人数', align: 'num' },
        { key: 'mean', label: '班级 ΔZ', align: 'num', render: (x) => `<b class="${toneClass(x.mean)}">${sgn(f2(x.mean))}</b>` },
        { key: 'schoolMean', label: '学校均值', align: 'num', render: (x) => sgn(f2(x.schoolMean)) },
        { key: 'diff', label: '差值', align: 'num', render: (x) => x.diff == null ? '—' : sgn(f2(x.diff)) },
        { key: 'progressRatio', label: '进步面', align: 'num', render: (x) => pct1(x.progressRatio) },
        { key: 'declineRatio', label: '退步面', align: 'num', render: (x) => pct1(x.declineRatio) }
      ], rows: subjRows
    });
    const above = subjRows.filter((x) => x.diff != null && x.diff >= 0.1).sort((a, b) => b.diff - a.diff);
    const below = subjRows.filter((x) => x.diff != null && x.diff <= -0.1).sort((a, b) => a.diff - b.diff);
    const teacherMap = {};
    subjectRows.forEach((x) => {
      const k = `${x.teacherId || x.teacherName}||${x.subject}`;
      const g = teacherMap[k] || (teacherMap[k] = { teacher: x.teacherName || '—', subject: x.subject, rows: [] });
      g.rows.push(x);
    });
    const teacherRows = Object.values(teacherMap).map((g) => Object.assign({ subject: g.subject, teacher: g.teacher }, scopeStats(g.rows))).sort((a, b) => a.mean - b.mean);
    const teacherTable = UI.table({
      columns: [
        { key: 'subject', label: '学科' }, { key: 'teacher', label: '教师', render: (x) => `<b>${esc(x.teacher)}</b>` },
        { key: 'n', label: '本科人数', align: 'num' },
        { key: 'mean', label: '本班 ΔZ', align: 'num', render: (x) => `<b class="${toneClass(x.mean)}">${sgn(f2(x.mean))}</b>` },
        { key: 'progressRatio', label: '进步面', align: 'num', render: (x) => pct1(x.progressRatio) },
        { key: 'declineRatio', label: '退步面', align: 'num', render: (x) => pct1(x.declineRatio) },
        { key: 'rate', label: '相对进步率', align: 'num', render: (x) => x.n < 8 ? '—' : f2(x.rate) },
        { key: 'verdict', label: '判定', render: (x) => verdictBadge(x.mean, x.n) }
      ], rows: teacherRows
    });
    const classTarget = cls.rate < 0.4 ? 0.4 : cls.rate < 0.6 ? 0.6 : 0.8;
    const classSim = AM.simulateToTarget(totals, classTarget, r.weights);
    const body = [
      chapter('A', 'an-a', '报告说明', '班主任看什么、范围是什么？', `<div class="an-card"><h4>${esc(cls.name)} · ${esc(d.school.schoolName)}</h4><ul class="an-list"><li>范围：本班 ${st.n} 人；入口/评价同一口径。</li><li>先看班级总体，再看学科与学生；不把班级差异直接归因班主任。</li><li>完整名单与标签见 A5。</li></ul></div>`, '班级视角'),
      chapter('B', 'an-b', '总体', '这个班整体处在什么位置？', kpiGrid([
        { label: '班级人数', value: st.n + ' 人', sub: '本班参评' },
        { label: '平均 ΔZ', value: sgn(f2(st.mean)), sub: '0 为持平', tone: st.mean >= 0 ? 'pos' : 'neg' },
        { label: '进步面', value: pct1(st.progressRatio), sub: `${st.progress} 人进步` },
        { label: '退步面', value: pct1(st.declineRatio), sub: `${st.decline} 人退步` }
      ]) + `<div class="mt-16">${histCard(totals, '本班 ΔZ 分布')}</div>`, '全量'),
      chapter('C', 'an-c', '结构', '入口到评价，等级结构怎么变？', `<div class="an-card"><h4>本班等级分布</h4>${gradeBarsFor(totals)}</div><div class="an-card mt-16"><h4>等级迁移（${st.n} 人）</h4>${migrationTable(totals)}${note('行=入口、列=出口；G1 最好、G9 最低。')}</div>`, '结构'),
      chapter('D1', 'an-d1', '分项 · 学科', '本班各科相对学校如何？', `<div class="an-card"><h4>本班学科 ΔZ</h4>${bars(subjRows.map((x) => ({ label: x.label, value: x.mean })), { max: 0.5 })}${note('条形=本班该科平均 ΔZ；0 为持平。')}</div><div class="an-card mt-16"><h4>学科 × 本班</h4>${subjTable}${note('班级 ΔZ 与学校均值比；正=高于学校，负=低于学校。')}</div><div class="an-card mt-16"><h4>学科 × 单科掉2 / 升2档人数</h4>${changeCountTable(subjectRows, (x) => x.subject, (x) => x.subject, '学科')}${note('按人次计；净升=升2档以上−掉2档以上。')}</div>${interp(
        above.map((x) => `<b>${esc(x.label)}</b> 高于学校 ${sgn(f2(x.diff))}。`),
        below.map((x) => `<b>${esc(x.label)}</b> 低于学校 ${sgn(f2(x.diff))}。`), []
      )}`, '全部学科'),
      chapter('D2', 'an-d2', '分项 · 学生', '本班学生变化如何？', `<div class="an-card"><h4>入口段 × 本班</h4>${bandOverviewTable(totals)}</div><div class="an-card mt-16"><h4>标签概况</h4>${tagSummary(students)}</div><div class="an-card mt-16"><h4>本班学生总表：总分 + 各科 ΔZ</h4>${studentMasterTable(students, d)}${note('行=学生，列=总分与各科 ΔZ；悬停单元格可看等级路径；最后一行为整体汇总。')}</div><div class="an-card mt-16"><h4>本班学生（${students.length} 人，含正负标签）</h4>${roleStudentTable(students)}${note('按学号排序；负向/正向标签可同时命中。')}</div>`, '全部学生'),
      chapter('D3', 'an-d3', '分项 · 教师', '本班各科任教师表现如何？', `<div class="an-card"><h4>本班任课教师 × 本科</h4>${teacherTable}${note('教师表不排名；同科教师所教班入口、班额不同，差异不能直接归因。')}</div>`, '不排名'),
      chapter('E', 'an-e', '差异与关联', '班级内差异在哪里？', whyBlock('候选解释（待验证）', [
        `学科差异：${below.length ? below.slice(0, 3).map((x) => esc(x.label)).join('、') + ' 低于学校均值' : '没有明显低于学校的学科'}；先核对入口、作业与缺课。`,
        `教师差异：本班 ${teacherRows.length} 位任课教师；同科跨班对比需要课堂/作业数据。`,
        '学生差异：同一班内正负标签并存，不能用一个班均值代替个体。',
        '班级层面不能直接归因班主任；分班、选科、缺课、教师组合都可能是候选。'
      ]), '待验证'),
      chapter('F', 'an-f', '追问与行动', '下一步先核对什么？', `<div class="an-card"><h4>目标反推：本班 rate → 目标</h4>${UI.table({
        columns: [
          { key: 'target', label: '目标 rate', align: 'num', render: (x) => f2(x.target) },
          { key: 'need', label: '需要回保持', align: 'num', render: (x) => x.need == null ? '不可达' : `${x.need} 人` },
          { key: 'level1', label: '现有掉1档', align: 'num' },
          { key: 'current', label: '当前 rate', align: 'num', render: (x) => f2(x.current) }
        ], rows: classSim ? [{ target: classSim.target, need: classSim.need, level1: classSim.level1, current: classSim.current }] : []
      })}${note('换算：把当前退步中最浅的学生改为保持；不是承诺，只用于定人数。')}</div>${actionBlock([
        { title: '先看低于学校的学科', text: `${below.slice(0, 3).map((x) => esc(x.label)).join('、') || '先看本班学科表'}；核对入口与作业。` },
        { title: '再看学生名单', text: `${students.filter((x) => x.risk).length} 名负向标签学生、${students.filter((x) => positiveTags(x).length).length} 名正向标签学生；正负同时看。` },
        { title: '复查', text: '两周后看本班平均 ΔZ、进步面/退步面与学科差值。' }
      ])}${boundary('班级报告只描述本班；分班与班级号变化会影响解释，不证明因果。')}`, '行动')
    ].join('');
    const sel = `<select class="select select-sm" onchange="App.setAnalysisClass(this.value)">${classes.map((c) => `<option value="${esc(c.id)}" ${c.id === cls.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`;
    return roleShell(task, d, 'homeroom', `${esc(cls.name)}班级增值分析报告`, `读者：班主任 · 范围：${esc(d.school.schoolName)} ${esc(cls.name)} ${st.n} 人 · 口径：${task.algorithm === 'grade' ? '等级差法' : '标准分法'}`, roleToolbar('班级', sel, '班级视角 · 学科/教师/学生'), [['an-a', 'A 说明'], ['an-b', 'B 总体'], ['an-c', 'C 结构'], ['an-d1', 'D1 学科'], ['an-d2', 'D2 学生'], ['an-d3', 'D3 教师'], ['an-e', 'E 差异'], ['an-f', 'F 行动']], body, '班级视角');
  }

  /* ---------- 科任教师 ---------- */
  function teacherPage(task) {
    const r = App.result(task.id);
    const schoolId = scopeSchoolId(r);
    const d = AM.build(r, schoolId);
    if (!d.school) return `<div class="page">${UI.empty('当前任务没有该校结果')}</div>`;
    const teachers = [];
    d.teachers.forEach((g) => g.teachers.forEach((t) => teachers.push(Object.assign({}, t, { subject: g.subject }))));
    const saved = App.state.analysisTeacherName;
    const validTeachers = teachers.filter((x) => x.n >= 8);
    const teacher = teachers.find((x) => x.name === saved) || validTeachers.slice().sort((a, b) => a.mean - b.mean)[0] || teachers.slice().sort((a, b) => a.mean - b.mean)[0];
    if (!teacher) return `<div class="page">${UI.empty('当前没有可展示的教师')}</div>`;
    const rows = r.rows.filter((x) => x.schoolId === schoolId && x.teacherName === teacher.name && x.subject !== '总分');
    const st = scopeStats(rows, r.weights);
    const ids = new Set(rows.map((x) => x.studentId));
    const students = d.risk.list.filter((x) => ids.has(x.studentId)).map((x) => {
      const sr = rows.find((r) => r.studentId === x.studentId);
      return Object.assign({}, x, { teacherZ: sr ? sr.zDiff : null, teacherEntry: sr ? sr.entryGrade : null, teacherCurrent: sr ? sr.currentGrade : null });
    }).filter((x) => x.teacherZ != null).sort((a, b) => a.teacherZ - b.teacherZ);
    const classes = groupStats(rows, (x) => x.classId, (x) => x.className);
    const classTable = UI.table({
      columns: [
        { key: 'label', label: '所教班', render: (x) => `<b>${esc(x.label)}</b>` },
        { key: 'n', label: '本科人数', align: 'num' },
        { key: 'mean', label: '平均 ΔZ', align: 'num', render: (x) => `<b class="${toneClass(x.mean)}">${sgn(f2(x.mean))}</b>` },
        { key: 'progressRatio', label: '进步面', align: 'num', render: (x) => pct1(x.progressRatio) },
        { key: 'declineRatio', label: '退步面', align: 'num', render: (x) => pct1(x.declineRatio) },
        { key: 'rate', label: '相对进步率', align: 'num', render: (x) => x.n < 8 ? '—' : f2(x.rate) }
      ], rows: classes
    });
    const body = [
      chapter('A', 'an-a', '报告说明', '科任教师看什么、范围是什么？', `<div class="an-card"><h4>${esc(teacher.name)} · ${esc(teacher.subject)} · ${esc(d.school.schoolName)}</h4><ul class="an-list"><li>范围：本人所教 ${st.n} 名学生、${classes.length} 个班；同一学科口径。</li><li>先看所教班，再看学生；教师表不排名。</li><li>班级入口、班额、选科不同，班间差异不直接等于教学水平。</li></ul></div>`, '教师视角'),
      chapter('B', 'an-b', '总体', '我的整体表现如何？', kpiGrid([
        { label: '所教学生', value: st.n + ' 人', sub: `${classes.length} 个班` },
        { label: '平均 ΔZ', value: sgn(f2(st.mean)), sub: `${esc(teacher.subject)} · 0 为持平`, tone: st.mean >= 0 ? 'pos' : 'neg' },
        { label: '进步面', value: pct1(st.progressRatio), sub: `${st.progress} 人进步` },
        { label: '退步面', value: pct1(st.declineRatio), sub: `${st.decline} 人退步` }
      ]) + `<div class="mt-16">${histCard(rows, '本科 ΔZ 分布')}</div>`, '全量'),
      chapter('C', 'an-c', '结构', '入口到评价，结构怎么变？', `<div class="an-card"><h4>等级分布</h4>${gradeBarsFor(rows)}</div><div class="an-card mt-16"><h4>迁移矩阵</h4>${migrationTable(rows)}</div>`, '结构'),
      chapter('D1', 'an-d1', '分项 · 班级', '不同班的差异在哪里？', `<div class="an-card"><h4>所教班 × 本科 ΔZ</h4>${bars(classes.map((x) => ({ label: x.label, value: x.mean })), { max: 0.5 })}${note('条形=该班本科平均 ΔZ；0 为持平。')}</div><div class="an-card mt-16"><h4>所教班 × 本科</h4>${classTable}${note('按平均 ΔZ 从低到高；n<8 不判定。')}</div><div class="an-card mt-16"><h4>所教班 × 单科掉2 / 升2档人数</h4>${changeCountTable(rows, (x) => x.classId, (x) => x.className, '所教班')}${note('按人次计；净升=升2档以上−掉2档以上。')}</div>`, '全部班级'),
      chapter('D2', 'an-d2', '分项 · 学生', '我的学生变化如何？', `<div class="an-card"><h4>入口段 × 本科</h4>${bandOverviewTable(rows)}</div><div class="an-card mt-16"><h4>标签概况</h4>${tagSummary(students)}</div><div class="an-card mt-16"><h4>学生总表：总分 + 本科 ΔZ</h4>${studentMasterTable(students, d, [teacher.subject])}${note('只展示总分与本人所教学科；行=学生，列=总分/本科 ΔZ；最后一行为整体汇总。')}</div><div class="an-card mt-16"><h4>学生名单（${students.length} 人，含正负标签）</h4>${roleStudentTable(students, { zKey: 'teacherZ', zLabel: '本科 ΔZ', pathFn: (x) => `G${x.teacherEntry} → G${x.teacherCurrent}` })}${note('按本科 ΔZ 从低到高；标签列仍为总分标签；完整清单见 A5。')}</div>`, '全部学生'),
      chapter('E', 'an-e', '差异与关联', '班间差异怎么解释？', whyBlock('候选解释（待验证）', [
        `所教班平均 ΔZ 从 ${classes.length ? sgn(f2(classes[0].mean)) : '—'} 到 ${classes.length ? sgn(f2(classes[classes.length - 1].mean)) : '—'}；先看入口与班额。`,
        '同一教师在不同班也可能差异很大；不能把班间差异直接归因教师。',
        '需要课堂、作业、错题与缺课数据，才能解释“为什么”。'
      ]), '待验证'),
      chapter('F', 'an-f', '追问与行动', '下一步先核对什么？', `${actionBlock([
        { title: '先看低于基准的班', text: `${classes.length ? esc(classes[0].label) : '先看班级表'}；核对入口、作业与缺课。` },
        { title: '再看学生', text: `${students.filter((x) => x.risk).length} 名负向标签、${students.filter((x) => positiveTags(x).length).length} 名正向标签；正负同时看。` },
        { title: '复查', text: '两周后看本科平均 ΔZ、进步面/退步面与班间差。' }
      ])}${boundary('教师报告不排名；同科教师所教班入口、班额、选科不同，差异不能直接当教学水平。')}`, '行动')
    ].join('');
    window.__ANALYSIS_STUDENT_CSV__ = '';
    const teacherLabel = (x) => `${x.name}｜${x.subject}｜${x.classes || ''}`;
    App.__AN_TEACHERS = teachers.map((x) => ({ name: x.name, label: teacherLabel(x) }));
    const sel = analysisPicker('teacher', teacherLabel(teacher), teachers.map((x) => ({ label: teacherLabel(x), search: `${x.name} ${x.subject} ${x.classes || ''}` })), '输入姓名 / 学科 / 班级', '位教师');
    return roleShell(task, d, 'teacher', `${esc(teacher.name)}老师增值分析报告`, `读者：科任教师 · 范围：${esc(d.school.schoolName)} ${esc(teacher.subject)} · ${st.n} 人 · 不排名`, roleToolbar('教师', sel, '教师视角 · 班级/学生'), [['an-a', 'A 说明'], ['an-b', 'B 总体'], ['an-c', 'C 结构'], ['an-d1', 'D1 班级'], ['an-d2', 'D2 学生'], ['an-e', 'E 差异'], ['an-f', 'F 行动']], body, '教师视角');
  }

  /* ---------- 学生 ---------- */
  function studentPage(task) {
    const r = App.result(task.id);
    const schoolId = scopeSchoolId(r);
    const d = AM.build(r, schoolId);
    if (!d.school) return `<div class="page">${UI.empty('当前任务没有该校结果')}</div>`;
    const list = d.risk.list.slice().sort((a, b) => AM.classNum(a.className) - AM.classNum(b.className) || String(a.studentNo).localeCompare(String(b.studentNo)));
    const saved = App.state.analysisStudentId;
    const stu = list.find((x) => x.studentId === saved) || list[0];
    if (!stu) return `<div class="page">${UI.empty('当前没有可展示的学生')}</div>`;
    const subs = (stu.subs || []).slice().sort((a, b) => subjectRank(a.subject) - subjectRank(b.subject));
    const chg = (x) => x.entryGrade - x.currentGrade;
    const chgText = (n) => n > 0 ? `↑${n} 档` : n < 0 ? `↓${Math.abs(n)} 档` : '持平';
    const totalChg = chg(stu);
    const totalDir = totalChg > 0 ? `上升 ${totalChg} 档` : totalChg < 0 ? `下降 ${Math.abs(totalChg)} 档` : '持平';
    const up = subs.filter((x) => chg(x) > 0).sort((a, b) => chg(b) - chg(a));
    const down = subs.filter((x) => chg(x) < 0).sort((a, b) => chg(a) - chg(b));
    const flat = subs.filter((x) => chg(x) === 0);
    const focus = down[0] || subs.slice().sort((a, b) => b.currentGrade - a.currentGrade)[0] || null;
    const focusChg = focus ? chg(focus) : 0;
    const targetGrade = focus ? Math.max(1, focus.currentGrade - 1) : null;
    const targetText = focus ? (focusChg < 0 ? `下次目标回到 G${targetGrade}` : `下次目标保持 G${focus.currentGrade}`) : '暂无目标';
    const upText = up.length ? `${up.map((x) => x.subject).join('、')}进步` : '没有科目上升';
    const downText = down.length ? `${down[0].subject}下降最多` : '没有科目下降';
    const summary = `${stu.studentName}，本次总分 G${stu.entryGrade} → G${stu.currentGrade}，${totalDir}；${upText}，${downText}。${focus ? `先补 ${focus.subject}，${targetText}。` : ''}`;
    const classRows = d.totals.filter((x) => x.classId === stu.classId);
    const beatPct = (rows) => {
      if (!rows.length) return null;
      return Math.round(rows.filter((x) => x.zDiff < stu.zDiff).length / rows.length * 100);
    };
    const classBeat = beatPct(classRows);
    const schoolBeat = beatPct(d.totals);
    const beatText = (v) => v == null ? '—' : v <= 0 ? '暂未超过同学' : v >= 100 ? '超过全部同学' : `超过 ${v}% 同学`;
    const classSub = {};
    r.rows.filter((x) => x.schoolId === schoolId && x.classId === stu.classId && x.subject !== '总分').forEach((x) => {
      const o = classSub[x.subject] || (classSub[x.subject] = { z: 0, n: 0 });
      o.z += Number(x.zDiff) || 0; o.n++;
    });
    const classMean = scopeStats(classRows, r.weights).mean;
    const schoolMean = d.schoolD.mean;
    const subjectRows = subs.map((x) => {
      const cm = classSub[x.subject] && classSub[x.subject].n ? classSub[x.subject].z / classSub[x.subject].n : null;
      const rel = cm == null ? '—' : x.zDiff - cm > 0.05 ? '高于班均' : x.zDiff - cm < -0.05 ? '低于班均' : '接近班均';
      return Object.assign({}, x, {
        change: chg(x), changeText: chgText(chg(x)), rel,
        verdict: chg(x) > 0 ? '进步' : chg(x) < 0 ? '下降' : '持平'
      });
    });
    const subTable = UI.table({
      columns: [
        { key: 'subject', label: '学科', render: (x) => `<b>${esc(x.subject)}</b>` },
        { key: 'entryGrade', label: '入口', align: 'num', render: (x) => 'G' + x.entryGrade },
        { key: 'currentGrade', label: '本次', align: 'num', render: (x) => 'G' + x.currentGrade },
        { key: 'changeText', label: '变化', align: 'num', render: (x) => `<b class="${x.change > 0 ? 'an-pos' : x.change < 0 ? 'an-neg' : ''}">${x.changeText}</b>` },
        { key: 'rel', label: '相对班均' },
        { key: 'verdict', label: '怎么看', render: (x) => UI.badge(x.verdict, x.verdict === '进步' ? 'green' : x.verdict === '下降' ? 'red' : 'gray') }
      ], rows: subjectRows
    });
    const actionTips = {
      '语文': '每天 20 分钟阅读；每周 1 篇限时作文，重点回看错题。',
      '数学': '每天 20 分钟基础题；每周整理 1 次错题，先补 2 个高频题型。',
      '英语': '每天 20 分钟阅读/听力；每周 1 篇限时写作，回看错题。',
      '物理': '每天 20 分钟基础题；每周 1 次模型题复盘，先补最常错的两类。',
      '化学': '每天 20 分钟方程式与基础题；每周 1 次错题回看。',
      '生物': '每天 15 分钟概念背诵；每周 1 次图表题复盘。',
      '历史': '每天 15 分钟时间线/史料；每周 1 道材料题。',
      '政治': '每天 15 分钟概念与热点；每周 1 道材料题。',
      '地理': '每天 15 分钟图表/区域；每周 1 道综合题。',
      '日语': '每天 20 分钟词汇/阅读；每周 1 篇限时练习。',
      '俄语': '每天 20 分钟词汇/阅读；每周 1 篇限时练习。'
    };
    const focusTip = focus ? (actionTips[focus.subject] || '每天固定 20 分钟基础练习；每周回看 1 次错题。') : '保持当前节奏，先稳住优势科目。';
    const body = [
      chapter('1', 'an-a', '本次结论', '这次考得怎么样？下一步先做什么？', `<div class="an-card"><div class="an-summary-line">${esc(summary)}</div>${kpiGrid([
        { label: '总分变化', value: `G${stu.entryGrade} → G${stu.currentGrade}`, sub: totalDir, tone: totalChg > 0 ? 'pos' : totalChg < 0 ? 'neg' : '' },
        { label: '进步科目', value: `${up.length} 科`, sub: up.length ? up.map((x) => x.subject).join('、') : '暂无' },
        { label: '优先科目', value: focus ? focus.subject : '—', sub: focus ? `${chgText(focusChg)}，${targetText}` : '暂无' },
        { label: '班级位置', value: classBeat == null ? '—' : `${classBeat}%`, sub: '超过同学比例 · 仅本人可见' }
      ])}</div>`, '个人'),
      chapter('2', 'an-b', '六科变化', '哪几科上升，哪几科下降？', `<div class="an-card"><h4>六科档位变化</h4>${bars(subjectRows.map((x) => ({ label: x.subject, value: x.change })), { max: 5 })}${note('条形=入口到本次的档位变化，向上=进步，向下=下降；0 为持平。')}</div><div class="an-card mt-16"><h4>六科明细</h4>${subTable}${note('G1 最好、G9 最低；档位是学科内相对位置，不是卷面分数。')}</div>`, '六科'),
      chapter('3', 'an-c', '我的位置', '我在班里、年级里大概在什么位置？', `<div class="an-grid-2"><div class="an-card"><h4>班级位置</h4><div class="an-big-number">${beatText(classBeat)}</div><div class="an-note">按本次相对位置估算，仅本人可见。</div></div><div class="an-card"><h4>年级位置</h4><div class="an-big-number">${beatText(schoolBeat)}</div><div class="an-note">不显示其他同学姓名，也不做公开排名。</div></div></div><div class="an-note mt-16">班级均值和年级均值只用来估算位置；一次考试的波动、缺考、转科都会影响结果。</div>`, '位置'),
      chapter('4', 'an-d', '下次目标', '下次考试先抓什么？', `<div class="an-card"><h4>${focus ? `先补 ${esc(focus.subject)}` : '保持当前节奏'}</h4><div class="an-target-line">${focus ? `${esc(focus.subject)} 当前 G${focus.currentGrade}，${targetText}。` : '先稳住当前优势科目，再补最弱一科。'}</div><div class="an-note mt-8">${esc(focusTip)}</div></div>${actionBlock([
        { title: '先补优先科目', text: focus ? `${focus.subject}：${focusTip}` : '先补最弱一科，每天固定 20 分钟。' },
        { title: '保留进步做法', text: up.length ? `${up.slice(0, 2).map((x) => x.subject).join('、')}继续保持；把有效做法写下来。` : '找到一科最稳的做法，固定下来。' },
        { title: '两周后检查', text: `用一次小测或作业检查${focus ? ' ' + focus.subject : '优先科目'}，看是否继续同向。` }
      ])}`, '目标'),
      chapter('5', 'an-e', '说明', '看这份报告要注意什么？', `<div class="an-card"><ul class="an-list"><li>这份报告只描述本次入口到评价的变化，不评价个人能力或努力程度。</li><li>缺考、转科、题目难度和复习安排都会影响结果，一次考试不能说明趋势。</li><li>下次考试看同一科是否继续同向，再决定是否调整学习方法。</li></ul></div>`, '说明')
    ].join('');
    const studentLabel = (x) => `${x.studentName}｜${x.className}｜${x.studentNo}`;
    App.__AN_STUDENTS = list.map((x) => ({ id: x.studentId, label: studentLabel(x) }));
    const sel = analysisPicker('student', studentLabel(stu), list.map((x) => ({ label: studentLabel(x), search: `${x.studentName} ${x.className} ${x.studentNo}` })), '输入姓名 / 班级 / 学号', '名学生');
    return roleShell(task, d, 'student', `${esc(stu.studentName)}同学学习变化报告`, `读者：学生 · 范围：${esc(d.school.schoolName)} ${esc(stu.className)} · 仅本人可见`, roleToolbar('学生', sel, '个人视角 · 仅本人可见'), [['an-a', '1 结论'], ['an-b', '2 六科'], ['an-c', '3 位置'], ['an-d', '4 目标'], ['an-e', '5 说明']], body, '个人视角');
  }
  /* ---------- 区域/联考 ---------- */
  function regionPage(task) {
    const r = App.result(task.id);
    const totals = r.totals || [];
    const totalN = totals.length;
    const schools = schoolRows(r);
    const schoolTable = UI.table({
      columns: [
        { key: 'schoolName', label: '学校', render: (x) => `<b>${esc(x.schoolName)}</b>` },
        { key: 'n', label: '参评', align: 'num' },
        { key: 'strength', label: '学业实力', align: 'num', render: (x) => f1(x.strength) },
        { key: 'mean', label: '平均 ΔZ', align: 'num', render: (x) => `<b class="${toneClass(x.mean)}">${sgn(f2(x.mean))}</b>` },
        { key: 'progressRatio', label: '进步面', align: 'num', render: (x) => pct1(x.progressRatio) },
        { key: 'declineRatio', label: '退步面', align: 'num', render: (x) => pct1(x.declineRatio) },
        { key: 'rate', label: '相对进步率', align: 'num', render: (x) => f2(x.rate) }
      ], rows: schools
    });
    const subjects = SUBJECT_ORDER.filter((sub) => (r.schoolEval[sub] || []).length);
    const matrixRows = schools.map((s) => {
      const row = { school: s.schoolName, cells: {} };
      subjects.forEach((sub) => {
        const list = (r.rows || []).filter((x) => x.schoolId === s.schoolId && x.subject === sub);
        row.cells[sub] = list.length ? list.reduce((a, x) => a + (Number(x.zDiff) || 0), 0) / list.length : null;
      });
      return row;
    });
    const heatHead = `<tr><th>学校</th>${subjects.map((s) => `<th>${esc(s)}</th>`).join('')}</tr>`;
    const heatBody = matrixRows.map((row) => `<tr><th>${esc(row.school)}</th>${subjects.map((s) => `<td class="${toneClass(row.cells[s])}">${row.cells[s] == null ? '' : sgn(f2(row.cells[s]))}</td>`).join('')}</tr>`).join('');
    const schoolTop = matrixRows.map((row) => {
      const vals = subjects.map((sub) => ({ subject: sub, mean: row.cells[sub] })).filter((x) => x.mean != null).sort((a, b) => b.mean - a.mean);
      return { school: row.school, high: vals[0] || null, low: vals[vals.length - 1] || null };
    });
    const countMatrix = (pred) => schools.map((s) => {
      const row = { school: s.schoolName, cells: {}, total: 0 };
      subjects.forEach((sub) => {
        const ids = new Set((r.rows || []).filter((x) => x.schoolId === s.schoolId && x.subject === sub && pred(x.level)).map((x) => x.studentId));
        row.cells[sub] = ids.size;
        row.total += ids.size;
      });
      return row;
    });
    const countTable = (data) => {
      const head = `<tr><th>学校</th>${subjects.map((s) => `<th>${esc(s)}</th>`).join('')}<th>合计</th></tr>`;
      const rowsHtml = data.map((row) => `<tr><th>${esc(row.school)}</th>${subjects.map((s) => `<td class="an-heat ${heatClass(row.cells[s] || 0)}">${row.cells[s] || ''}</td>`).join('')}<td class="num"><b>${row.total}</b></td></tr>`).join('');
      const totals = subjects.map((s) => data.reduce((a, row) => a + row.cells[s], 0));
      const grand = totals.reduce((a, b) => a + b, 0);
      return `<div class="table-wrap an-matrix"><table class="table"><thead>${head}</thead><tbody>${rowsHtml}<tr class="an-total-row"><th>整体汇总（人次）</th>${totals.map((v) => `<td class="num">${v || ''}</td>`).join('')}<td class="num"><b>${grand}</b></td></tr></tbody></table></div>`;
    };
    const body = [
      chapter('A', 'an-a', '报告说明', '区域/联考报告看什么？', `<div class="an-card"><h4>四校联考 · ${totalN} 人</h4><ul class="an-list"><li>范围：四校全部参评学生；入口/评价同一口径。</li><li>不把四校合成一个“区域总体”：先逐校看，再做校际对比。</li><li>学校间生源、命题、赋分不同，跨校比较只作方向参考。</li></ul></div>`, '区域视角'),
      chapter('B', 'an-b', '总体', '四校各自处在什么位置？', kpiGrid(schools.map((s) => ({
        label: s.schoolName, value: sgn(f2(s.mean)), sub: `${s.n} 人 · 进步面 ${pct1(s.progressRatio)} · 退步面 ${pct1(s.declineRatio)}`, tone: s.mean >= 0 ? 'pos' : 'neg'
      }))) + `<div class="an-card mt-16"><h4>四校总表</h4>${schoolTable}${note('不排名学校；每校分别给平均 ΔZ、进步面、退步面、相对进步率。')}</div><div class="an-card mt-16"><h4>四校实力 × 平均 ΔZ</h4>${scatterChart(schools.map((s) => ({ label: s.schoolName, x: s.strength, y: s.mean, n: s.n })), { aria: '四校实力与平均 ΔZ 散点图' })}${note('横轴=学业实力，纵轴=平均 ΔZ；气泡=参评人数。')}</div>`, '逐校'),
      chapter('C', 'an-c', '结构', '四校分别怎么变？', `<div class="an-grid-2">${schools.map((s) => `<div class="an-card"><h4>${esc(s.schoolName)}</h4>${gradeBarsFor(totals.filter((x) => x.schoolId === s.schoolId))}</div>`).join('')}</div><div class="an-card mt-16"><h4>四校结构净变化（pp）</h4>${UI.table({
        columns: [
          { key: 'school', label: '学校' }, { key: 'front', label: 'G1–G3', align: 'num', render: (x) => pp(x.front) },
          { key: 'mid', label: 'G4–G6', align: 'num', render: (x) => pp(x.mid) },
          { key: 'back', label: 'G7–G9', align: 'num', render: (x) => pp(x.back) }
        ], rows: schools.map((s) => {
          const rs = totals.filter((x) => x.schoolId === s.schoolId);
          const share = (arr, a, b) => arr.filter((x) => x >= a && x <= b).length / (arr.length || 1);
          const entry = rs.map((x) => x.entryGrade), exit = rs.map((x) => x.currentGrade);
          return { school: s.schoolName, front: share(exit, 1, 3) - share(entry, 1, 3), mid: share(exit, 4, 6) - share(entry, 4, 6), back: share(exit, 7, 9) - share(entry, 7, 9) };
        })
      })}${note('正=该档占比增加；G1–G3 增加是高端变厚，G7–G9 增加是低档变宽。')}</div>`, '逐校'),
      chapter('D', 'an-d', '分项 · 学科', '各校学科差异在哪里？', `<div class="an-card"><h4>学校 × 学科（平均 ΔZ）</h4><div class="table-wrap an-matrix"><table class="table"><thead>${heatHead}</thead><tbody>${heatBody}</tbody></table></div>${note('行=学校、列=学科；颜色只表示正负，跨科不直接比高低。')}</div><div class="an-card mt-16"><h4>学校 × 学科：单科掉2档以上人数</h4>${countTable(countMatrix((v) => v <= -2))}${note('数字为人次，同一学生多科会计多次；最后一行为各科列合计。')}</div><div class="an-card mt-16"><h4>学校 × 学科：单科升2档以上人数</h4>${countTable(countMatrix((v) => v >= 2))}${note('与上方掉档表同口径；数字为人次，同一学生多科会计多次。')}</div><div class="an-card mt-16"><h4>各校最高 / 最低学科</h4>${UI.table({
        columns: [
          { key: 'school', label: '学校' },
          { key: 'high', label: '最高学科', render: (x) => x.high ? `${esc(x.high.subject)} ${sgn(f2(x.high.mean))}` : '—' },
          { key: 'low', label: '最低学科', render: (x) => x.low ? `${esc(x.low.subject)} ${sgn(f2(x.low.mean))}` : '—' }
        ], rows: schoolTop
      })}${note('最高/最低是校内学科相对位置；不是跨校排名。')}</div><div class="an-card mt-16"><h4>校际差最大的学科</h4>${UI.table({
        columns: [
          { key: 'subject', label: '学科' }, { key: 'range', label: '极差', align: 'num', render: (x) => f2(x.range) },
          { key: 'high', label: '最高校', render: (x) => `${esc(x.high.schoolName)} ${sgn(f2(x.high.mean))}` },
          { key: 'low', label: '最低校', render: (x) => `${esc(x.low.schoolName)} ${sgn(f2(x.low.mean))}` }
        ],
        rows: subjects.map((sub) => {
          const vals = schools.map((s) => {
            const list = (r.rows || []).filter((x) => x.schoolId === s.schoolId && x.subject === sub);
            return { schoolName: s.schoolName, mean: list.length ? list.reduce((a, x) => a + (Number(x.zDiff) || 0), 0) / list.length : null };
          }).filter((x) => x.mean != null).sort((a, b) => b.mean - a.mean);
          return { subject: sub, range: vals.length ? vals[0].mean - vals[vals.length - 1].mean : null, high: vals[0] || { schoolName: '—', mean: null }, low: vals[vals.length - 1] || { schoolName: '—', mean: null } };
        }).sort((a, b) => (b.range || 0) - (a.range || 0)).slice(0, 5)
      })}${note('极差=最高校−最低校；只列前5科。')}</div>`, '全部学科'),
      chapter('E', 'an-e', '差异与关联', '学校差异落在哪个指标？', `<div class="an-card"><h4>四校指标差</h4>${UI.table({
        columns: [
          { key: 'schoolName', label: '学校' }, { key: 'mean', label: '平均 ΔZ', align: 'num', render: (x) => sgn(f2(x.mean)) },
          { key: 'progressRatio', label: '进步面', align: 'num', render: (x) => pct1(x.progressRatio) },
          { key: 'declineRatio', label: '退步面', align: 'num', render: (x) => pct1(x.declineRatio) },
          { key: 'rate', label: '相对进步率', align: 'num', render: (x) => f2(x.rate) }
        ], rows: schools
      })}${note('学校差异是生源、结构、命题、教学共同作用；不做单因果归因。')}</div>`, '描述'),
      chapter('F', 'an-f', '追问与行动', '区域下一步先做什么？', `${actionBlock([
        { title: '先看校际差异最大的学科', text: '对照 D 表，找 2–3 个校际差最大的学科，核对命题与生源结构。' },
        { title: '再看学校内部结构', text: '进入单校报告，看班级/学科/学生是否集中。' },
        { title: '复查', text: '下一次联考看同样的校际差是否收敛；不因一次联考下结论。' }
      ])}${boundary('区域报告只描述四校差异；学校不是同质群体，跨校比较不能直接当办学质量。')}`, '行动')
    ].join('');
    window.__ANALYSIS_STUDENT_CSV__ = '';
    return roleShell(task, null, 'region', '区域 / 联考增值分析报告', `读者：区域/联考管理者 · 范围：四校 ${totalN} 人 · 口径：${task.algorithm === 'grade' ? '等级差法' : '标准分法'}`, roleToolbar('范围', '<span class="an-fixed">四校联考</span>', `区域视角 · 四校 ${totalN} 人`), [['an-a', 'A 说明'], ['an-b', 'B 总体'], ['an-c', 'C 结构'], ['an-d', 'D 学科'], ['an-e', 'E 差异'], ['an-f', 'F 行动']], body, '区域视角');
  }

  /* ---------- 校长报告 ---------- */
  function principalPage(task) {
    const r = App.result(task.id);
    const schoolId = scopeSchoolId(r);
    const d = AM.build(r, schoolId);
    if (!d.school) return `<div class="page">${UI.empty('当前任务没有该校结果')}</div>`;
    window.__ANALYSIS_STUDENT_CSV__ = buildStudentCsv(d);
    const body = [
      chapterA(task, r, d),
      chapterB(task, r, d),
      chapterC(task, r, d),
      chapterD1(task, r, d),
      chapterD2(task, r, d),
      chapterD3(task, r, d),
      chapterD4(task, r, d),
      chapterE(task, r, d),
      chapterF(task, r, d),
      appendix(task, r, d)
    ].join('');
    return `<div class="page an-page an-report">
      ${cover(task, r, d)}
      ${roleBar(task, 'principal')}
      ${toolbar(task, d)}
      <div class="an-layout"><main class="an-main">${body}</main>${toc()}</div>
      <button class="an-backtop" type="button" data-action="scrollTopAnalysis" aria-label="回到顶部" title="回到顶部">↑</button>
    </div>`;
  }

  function cover(task, r, d) {
    const entry = (window.MOCK.exams || []).find((e) => e.id === task.entryExamId);
    const exit = (window.MOCK.exams || []).find((e) => e.id === task.exitExamId);
    return `<header class="an-cover">
      <div class="an-cover-top">
        <div class="breadcrumb"><span>管理</span><span class="sep">/</span><a href="#/evaluations/${task.id}/analysis">分析报告</a><span class="sep">/</span><span>校长</span></div>
        <div class="an-cover-actions">
          <a class="btn btn-sm" href="#/evaluations/${task.id}/analysis">报告中心</a>
          <button class="btn btn-sm" data-action="printAnalysis">导出 PDF</button>
        </div>
      </div>
      <div class="an-cover-body">
        <div class="an-cover-copy">
          <div class="an-kicker">VALUE-ADDED ANALYSIS</div>
          <h1>${esc(d.school.schoolName)}增值分析报告</h1>
          <p>读者：校长 · 范围：${esc(d.school.schoolName)} ${d.school.n} 人 · 口径：${task.algorithm === 'grade' ? '等级差法' : '标准分法'} / ${r.gradeCount || 9} 档 · 版本 ${esc(task.resultVersion || '—')}</p>
        </div>
        <div class="an-cover-stamp"><b>校长</b><span>全量数据 · 双向解读</span></div>
      </div>
      <div class="an-cover-meta">
        <span>任务 <b>${esc(task.name)}</b></span>
        <span>考试 <b>${esc(entry ? entry.name : task.entryExamId)} → ${esc(exit ? exit.name : task.exitExamId)}</b></span>
        <span>参评 <b>${d.school.n} 人</b></span>
        <span>更新 <b>${esc(task.updatedAt || '—')}</b></span>
      </div>
    </header>`;
  }

  function roleBar(task, active) {
    return `<div class="an-rolebar"><span class="an-rolebar-label">角色视角</span>${ROLES.map((r) => {
      if (r.key === active) return `<span class="an-role-chip active">${esc(r.label)}</span>`;
      if (r.ready && (r.key !== 'region' || canViewRegion())) return `<a class="an-role-chip" href="#/evaluations/${task.id}/analysis/${r.key}">${esc(r.label)}</a>`;
      return `<span class="an-role-chip disabled" title="${r.ready ? '当前账号不可用' : '下一阶段'}">${esc(r.label)}<em>${r.ready ? '不可用' : '建设中'}</em></span>`;
    }).join('')}</div>`;
  }

  function toolbar(task, d) {
    const list = (App.result(task.id).schoolEval['总分'] || []).slice().sort((a, b) => a.schoolId.localeCompare(b.schoolId));
    const sel = App.canEdit()
      ? `<select class="select select-sm" onchange="App.setAnalysisSchool(this.value)">${list.map((s) => `<option value="${s.schoolId}" ${s.schoolId === d.schoolId ? 'selected' : ''}>${esc(s.schoolName)}</option>`).join('')}</select>`
      : `<span class="an-fixed">${esc(d.school.schoolName)}</span>`;
    return `<div class="an-toolbar an-toolbar-filter">
      <div class="an-toolbar-left"><span class="an-scope-label">学校</span>${sel}<span class="an-badge gray">全量数据</span></div>
      <div class="an-toolbar-right"><span>结果版本 ${esc(task.resultVersion || '—')} · 退步面基线 31.7% · n&lt;8 不判定</span></div>
    </div>`;
  }

  const FULL_TOC = [
    ['an-a', 'A 报告说明'], ['an-b', 'B 总体'], ['an-c', 'C 结构'],
    ['an-d1', 'D1 学科'], ['an-d2', 'D2 班级'], ['an-d3', 'D3 教师'], ['an-d4', 'D4 学生'],
    ['an-e', 'E 差异与关联'], ['an-f', 'F 追问与行动'], ['an-appendix', '附录']
  ];

  function toc() {
    return `<aside class="an-toc"><div class="an-toc-title">目录</div>${FULL_TOC.map(([id, label], i) => `<button class="an-toc-link ${i === 0 ? 'active' : ''}" data-action="scrollAnalysis" data-target="${id}">${label}</button>`).join('')}<button class="btn btn-sm an-toc-print" data-action="printAnalysis">导出 PDF</button><div class="an-toc-note">A4 纵向 · 附录随正文导出</div></aside>`;
  }

  /* ---------- 通用块 ---------- */
  function chapter(letter, id, title, question, body, tag) {
    return `<section class="an-chapter" id="${id}">
      <header class="an-chapter-head">
        <div class="an-chapter-letter">${letter}</div>
        <div class="an-chapter-copy"><div class="an-chapter-kicker">CHAPTER ${letter}</div><h2>${esc(title)}</h2><p>${esc(question)}</p></div>
        <span class="an-chapter-tag">${esc(tag || '数据完整')}</span>
      </header>
      <div class="an-chapter-body">${body}</div>
    </section>`;
  }

  function kpiGrid(items) {
    return `<div class="an-kpis">${items.map((k) => `<div class="an-kpi ${k.tone || ''}"><span>${esc(k.label)}</span><b>${k.value}</b><em>${k.sub || ''}</em></div>`).join('')}</div>`;
  }

  function interp(good, bad, neutral) {
    const col = (tone, title, items) => `<div class="an-interp-col ${tone}"><h4>${title}</h4>${items && items.length ? `<ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>` : '<p class="weak">暂无</p>'}</div>`;
    return `<div class="an-interp">${col('good', '好于基准', good)}${col('bad', '低于基准', bad)}${col('neutral', '基本持平 / 需观察', neutral)}</div>`;
  }

  function whyBlock(title, items) {
    return `<div class="an-block"><h4>${esc(title)}</h4><ul class="an-list">${items.map((x) => `<li>${x}</li>`).join('')}</ul></div>`;
  }
  function boundary(text) {
    return `<div class="an-boundary"><b>边界</b><span>${text}</span></div>`;
  }
  function actionBlock(items) {
    return `<div class="an-actions"><h4>下一步</h4>${items.map((x, i) => `<div class="an-action"><span>${i + 1}</span><div><b>${x.title}</b><p>${x.text}</p></div></div>`).join('')}<div class="an-note">目标换算、名单规模与 D0/D+14 复查见 F 追问与行动。</div></div>`;
  }
  function note(text) { return `<div class="an-note">${text}</div>`; }

  function bars(rows, opts) {
    const o = opts || {};
    const max = o.max || Math.max.apply(null, rows.map((r) => Math.abs(Number(r.value) || 0)).concat([0.1]));
    return `<div class="an-bars">${rows.map((r) => {
      const v = Number(r.value) || 0;
      const w = Math.min(100, Math.abs(v) / max * 100);
      const tone = v >= 0 ? (o.invert ? 'bad' : 'good') : (o.invert ? 'good' : 'bad');
      const style = v >= 0 ? `left:50%;width:${w / 2}%` : `right:50%;width:${w / 2}%`;
      const text = o.pp ? `${v > 0 ? '+' : ''}${v.toFixed(1)}pp` : sgn(f2(v));
      return `<div class="an-bar-row"><span class="an-bar-label">${esc(r.label)}</span><span class="an-bar-track"><span class="an-bar-zero"></span><span class="an-bar-fill ${tone}" style="${style}"></span></span><span class="an-bar-val ${tone}">${text}</span></div>`;
    }).join('')}</div>`;
  }

  function gradeDistBars(d) {
    const max = Math.max.apply(null, d.grade.map((x) => Math.max(x.entry, x.exit)).concat([1]));
    const rows = d.grade.map((x) => {
      const common = Math.min(x.entry, x.exit);
      const diff = x.exit - x.entry;
      const tone = diff < 0 ? 'red' : diff > 0 ? 'green' : 'none';
      const tail = diff === 0 ? '' : `<span class="an-ov-tail ${tone}" style="width:${(Math.abs(diff) / max * 100).toFixed(2)}%"></span>`;
      return `<div class="an-ov-row"><span class="an-ov-label">G${x.grade}</span><span class="an-ov-track"><span class="an-ov-common" style="width:${(common / max * 100).toFixed(2)}%"></span>${tail}</span><span class="an-ov-nums">${x.entry} → ${x.exit}</span><span class="an-ov-delta ${tone}">${diff > 0 ? '+' : ''}${diff}</span></div>`;
    }).join('');
    return `<div class="an-ov">${rows}</div><div class="an-ov-legend"><span><i class="common"></i>重叠：入口/评价共同部分</span><span><i class="red"></i>评价少于入口</span><span><i class="green"></i>评价多于入口</span><span>尾巴长度=人数差</span></div><div class="an-note">红/绿只表示“少/多”，不表示评价；尾巴太小时以右侧数字为准。</div>`;
  }

  function stackedSubjectBars(d) {
    const rows = d.subjectRows.map((x) => {
      const n = x.n || 1;
      const p = x.progressCount / n * 100, k = x.keepCount / n * 100, de = x.declineCount / n * 100;
      return `<div class="an-stack-row"><span class="an-stack-label">${esc(x.subject)}</span><span class="an-stack-bar" title="${esc(x.subject)}：进步 ${x.progressCount} / 保持 ${x.keepCount} / 退步 ${x.declineCount}"><span class="an-stack-seg progress" style="width:${p.toFixed(2)}%"></span><span class="an-stack-seg keep" style="width:${k.toFixed(2)}%"></span><span class="an-stack-seg decline" style="width:${de.toFixed(2)}%"></span></span><span class="an-stack-val">${f2(x.rate)}</span></div>`;
    }).join('');
    return `<div class="an-stack">${rows}</div><div class="an-stack-legend"><span><i class="progress"></i>进步</span><span><i class="keep"></i>保持</span><span><i class="decline"></i>退步</span><span>右侧为相对进步率</span></div>`;
  }

  function scatterChart(rows, opts) {
    const o = opts || {};
    const W = 760, H = 460, pad = { l: 54, r: 18, t: 34, b: 42 };
    const xs = rows.map((r) => r.x), ys = rows.map((r) => r.y);
    let x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    let y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    const xPad = Math.max(2, (x1 - x0) * 0.08), yPad = Math.max(0.08, (y1 - y0) * 0.12);
    x0 -= xPad; x1 += xPad; y0 -= yPad; y1 += yPad;
    if (y0 > 0) y0 = -0.1;
    if (y1 < 0) y1 = 0.1;
    const px = (v) => pad.l + (v - x0) / (x1 - x0) * (W - pad.l - pad.r);
    const py = (v) => H - pad.b - (v - y0) / (y1 - y0) * (H - pad.t - pad.b);
    const xMean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const grid = [];
    for (let i = 0; i <= 4; i++) {
      const gx = pad.l + (W - pad.l - pad.r) * i / 4;
      const gy = pad.t + (H - pad.t - pad.b) * i / 4;
      grid.push(`<line class="grid" x1="${gx.toFixed(1)}" y1="${pad.t}" x2="${gx.toFixed(1)}" y2="${H - pad.b}"/>`);
      grid.push(`<line class="grid" x1="${pad.l}" y1="${gy.toFixed(1)}" x2="${W - pad.r}" y2="${gy.toFixed(1)}"/>`);
    }
    const quad = `<text class="quad" x="${pad.l + 6}" y="${pad.t + 14}">低进高出</text><text class="quad" x="${W - pad.r - 6}" y="${pad.t + 14}" text-anchor="end">双高</text><text class="quad" x="${pad.l + 6}" y="${H - pad.b - 8}">相对靠后</text><text class="quad" x="${W - pad.r - 6}" y="${H - pad.b - 8}" text-anchor="end">高位承压</text>`;
    const pts = rows.map((r) => {
      const cx = px(r.x), cy = py(r.y);
      return { r, cx, cy, rad: Math.min(11, 4 + Math.sqrt(r.n || 10) / 2.2) };
    });
    const labelH = 12;
    const textW = (s) => s.length * 9.6 + 2;
    const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const dotBoxes = pts.map((p) => ({ x: p.cx - p.rad, y: p.cy - p.rad, w: p.rad * 2, h: p.rad * 2 }));
    const occupied = [
      { x: pad.l + 4, y: pad.t + 3, w: 44, h: 14 },
      { x: W - pad.r - 48, y: pad.t + 3, w: 44, h: 14 },
      { x: pad.l + 4, y: H - pad.b - 17, w: 44, h: 14 },
      { x: W - pad.r - 48, y: H - pad.b - 17, w: 44, h: 14 }
    ];
    const dense = pts.map((p) => ({
      p,
      neighbors: pts.filter((q) => q !== p && Math.hypot(q.cx - p.cx, q.cy - p.cy) < 38).length
    })).sort((a, b) => b.neighbors - a.neighbors || a.p.cx - b.p.cx);
    const placed = new Map();
    dense.forEach(({ p }) => {
      let best = null;
      const base = p.rad + 5;
      const dists = [base, base + 8, base + 16, base + 24, base + 32];
      const angles = [0, -35, 35, -70, 70, -110, 110, 180, -145, 145];
      for (const dist of dists) {
        for (const angle of angles) {
          const a = angle * Math.PI / 180;
          const dx = Math.cos(a) * dist, dy = Math.sin(a) * dist;
          const anchor = Math.abs(dx) < 4 ? 'middle' : dx > 0 ? 'start' : 'end';
          const w = textW(p.r.label) + 4;
          const x = anchor === 'end' ? p.cx + dx - w : anchor === 'middle' ? p.cx + dx - w / 2 : p.cx + dx;
          const y = p.cy + dy - labelH / 2;
          const box = { x, y, w, h: labelH };
          let score = dist * 0.05;
          if (x < pad.l + 2 || x + w > W - pad.r - 2 || y < pad.t + 2 || y + labelH > H - pad.b - 2) score += 1000;
          dotBoxes.forEach((b) => { score += overlap(box, b) * 8; });
          occupied.forEach((b) => { score += overlap(box, b) * 20; });
          if (!best || score < best.score) best = { box, x: x + (anchor === 'middle' ? w / 2 : anchor === 'end' ? w : 0), y: p.cy + dy, anchor, score };
        }
      }
      occupied.push(best.box);
      placed.set(p, best);
    });
    const dots = pts.map((p) => {
      const pos = placed.get(p);
      return `<g><title>${esc(p.r.label)}：学业实力 ${f1(p.r.x)}，平均 ΔZ ${sgn(f2(p.r.y))}，n=${p.r.n}</title><circle class="dot" cx="${p.cx.toFixed(1)}" cy="${p.cy.toFixed(1)}" r="${p.rad.toFixed(1)}"/><text class="dot-label ${p.r.hot ? 'hot' : ''}" x="${pos.x.toFixed(1)}" y="${pos.y.toFixed(1)}" text-anchor="${pos.anchor}" dominant-baseline="middle">${esc(p.r.label)}</text></g>`;
    }).join('');
    const leaders = pts.map((p) => {
      const pos = placed.get(p);
      const b = pos.box;
      const nx = Math.max(b.x, Math.min(p.cx, b.x + b.w));
      const ny = Math.max(b.y, Math.min(p.cy, b.y + b.h));
      const dist = Math.hypot(nx - p.cx, ny - p.cy);
      if (dist <= 16) return '';
      const dx = nx - p.cx, dy = ny - p.cy, len = Math.hypot(dx, dy) || 1;
      const x1 = p.cx + dx / len * (p.rad + 1), y1 = p.cy + dy / len * (p.rad + 1);
      return `<line class="leader" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}"/>`;
    }).join('');
    const yTicks = [y0, (y0 + y1) / 2, y1].map((v) => `<text class="tick" x="${pad.l - 6}" y="${(py(v) + 3).toFixed(1)}" text-anchor="end">${sgn(f2(v))}</text>`).join('');
    const xTicks = [x0, (x0 + x1) / 2, x1].map((v) => `<text class="tick" x="${px(v).toFixed(1)}" y="${H - pad.b + 14}" text-anchor="middle">${f1(v)}</text>`).join('');
    return `<svg class="an-scatter" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || '散点图')}">${grid.join('')}<line class="ref" x1="${px(xMean).toFixed(1)}" y1="${pad.t}" x2="${px(xMean).toFixed(1)}" y2="${H - pad.b}"/><line class="ref" x1="${pad.l}" y1="${py(0).toFixed(1)}" x2="${W - pad.r}" y2="${py(0).toFixed(1)}"/><line class="axis" x1="${pad.l}" y1="${H - pad.b}" x2="${W - pad.r}" y2="${H - pad.b}"/><line class="axis" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H - pad.b}"/>${yTicks}${xTicks}${quad}${leaders}${dots}<text class="axis-label" x="${pad.l}" y="14">平均 ΔZ（0=持平）</text><text class="axis-label" x="${(W - pad.r).toFixed(1)}" y="${H - 8}" text-anchor="end">学业实力（入口位置）</text></svg>`;
  }

  function flowTop(totals) {
    const m = [];
    for (let i = 0; i < 9; i++) m.push(new Array(9).fill(0));
    totals.forEach((t) => { m[t.entryGrade - 1][t.currentGrade - 1]++; });
    const flows = [];
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) if (i !== j && m[i][j]) flows.push({ from: i + 1, to: j + 1, n: m[i][j], dir: j > i ? 'down' : 'up' });
    flows.sort((a, b) => b.n - a.n);
    const top = flows.slice(0, 3);
    const down = top.filter((x) => x.dir === 'down').reduce((a, x) => a + x.n, 0);
    const up = top.filter((x) => x.dir === 'up').reduce((a, x) => a + x.n, 0);
    const allUp = totals.filter((x) => x.currentGrade < x.entryGrade).length;
    const allDown = totals.filter((x) => x.currentGrade > x.entryGrade).length;
    const allKeep = totals.length - allUp - allDown;
    return `<div class="an-flows">${top.map((x) => `<div class="an-flow-card ${x.dir}"><span>${x.dir === 'down' ? '降档' : '升档'}</span><b>G${x.from} → G${x.to}</b><em>${x.n} 人</em></div>`).join('')}</div><div class="an-note">全量：升档 ${allUp} 人、保持 ${allKeep} 人、降档 ${allDown} 人；前三条只含非对角线：降档 ${down} 人、升档 ${up} 人。</div>`;
  }

  function histChart(bins) {
    const max = Math.max.apply(null, bins.map((b) => b.count).concat([1]));
    return `<div class="an-hist">${bins.map((b, i) => `<div class="an-hist-col" title="${f2(b.from)} ~ ${f2(b.to)}：${b.count} 人"><span style="height:${(b.count / max * 100).toFixed(1)}%"></span>${i % 4 === 0 ? `<em>${f1(b.from)}</em>` : ''}</div>`).join('')}</div>`;
  }

  function heatClass(n) { return n >= 6 ? 'h3' : n >= 3 ? 'h2' : n >= 1 ? 'h1' : ''; }

  function csvCell(v) {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function positiveTags(x) {
    const tags = [];
    const subs = x.subs || [];
    if (x.level >= 2) tags.push('总分升2档以上');
    if (x.entryGrade <= 3 && x.status === '进步') tags.push('入口前段进步');
    if (x.entryGrade >= 7 && x.status === '进步') tags.push('入口后段进步');
    if (subs.some((s) => s.level >= 2)) tags.push('单科升2档以上');
    if (subs.some((s) => s.level >= 4)) tags.push('单科升4档以上');
    return tags;
  }

  function buildStudentCsv(d) {
    const head = ['学号', '姓名', '班级', '入口档', '评价档', 'ΔZ', '判定', '负向标签', '正向标签'];
    const lines = [head.join(',')];
    d.risk.list.slice().sort((a, b) => AM.classNum(a.className) - AM.classNum(b.className) || String(a.studentNo).localeCompare(String(b.studentNo))).forEach((x) => {
      lines.push([x.studentNo, x.studentName, x.className, x.entryGrade, x.currentGrade, f2(x.zDiff), x.status, (x.tags || []).join('；'), positiveTags(x).join('；')].map(csvCell).join(','));
    });
    return '\ufeff' + lines.join('\n');
  }

  /* ---------- 表格 ---------- */
  function schoolTable(r, d) {
    return UI.table({
      columns: [
        { key: 'schoolName', label: '学校', render: (x) => `<b>${esc(x.schoolName)}</b>${x.schoolId === d.schoolId ? '<span class="an-current">本校</span>' : ''}` },
        { key: 'n', label: '参评', align: 'num' },
        { key: 'strength', label: '学业实力', align: 'num', render: (x) => f1(x.strength) },
        { key: 'mean', label: '平均 ΔZ', align: 'num', render: (x) => `<b class="${toneClass(x.mean)}">${sgn(f2(x.mean))}</b>` },
        { key: 'progressRatio', label: '进步面', align: 'num', render: (x) => pct1(x.progressRatio) },
        { key: 'declineRatio', label: '退步面', align: 'num', render: (x) => pct1(x.declineRatio) },
        { key: 'expected', label: '期望', align: 'num', render: (x) => pct1(x.expected) },
        { key: 'rate', label: '相对进步率', align: 'num', render: (x) => f2(x.rate) },
        { key: 'ranks', label: '排名 实力/增值', render: (x) => `${x.strengthRank} / ${x.rateRank}` }
      ],
      rows: schoolRows(r),
      rowClass: (x) => x.schoolId === d.schoolId ? 'an-row-current' : ''
    });
  }

  function subjectTable(d) {
    return UI.table({
      columns: [
        { key: 'subject', label: '学科', render: (x) => `<b>${esc(x.subject)}</b>` },
        { key: 'n', label: '参评', align: 'num' },
        { key: 'mean', label: '平均 ΔZ', align: 'num', render: (x) => `<b class="${toneClass(x.mean)}">${sgn(f2(x.mean))}</b>` },
        { key: 'progressRatio', label: '进步面', align: 'num', render: (x) => pct1(x.progressRatio) },
        { key: 'declineRatio', label: '退步面', align: 'num', render: (x) => pct1(x.declineRatio) },
        { key: 'expected', label: '期望', align: 'num', render: (x) => pct1(x.expected) },
        { key: 'rate', label: '相对进步率', align: 'num', render: (x) => f2(x.rate) },
        { key: 'vs', label: '距校均值', align: 'num', render: (x) => x.rate == null || d.subjectMeanRate == null ? '—' : `<span class="${toneClass(x.rate - d.subjectMeanRate)}">${sgn(f2(x.rate - d.subjectMeanRate))}</span>` },
        { key: 'verdict', label: '判定', render: (x) => verdictBadge(x.mean, x.n) }
      ],
      rows: d.subjectRows
    });
  }

  function classTable(d, full) {
    const cols = [
      { key: 'name', label: '班级', render: (x) => `<b>${esc(x.name)}</b>` },
      { key: 'n', label: '人数', align: 'num' }
    ];
    if (full) cols.push({ key: 'strength', label: '学业实力', align: 'num', render: (x) => f1(x.strength) });
    cols.push(
      { key: 'mean', label: '平均 ΔZ', align: 'num', render: (x) => `<b class="${toneClass(x.mean)}">${sgn(f2(x.mean))}</b>` },
      { key: 'verdict', label: '判定', render: (x) => verdictBadge(x.mean, x.n) },
      { key: 'progressRatio', label: '进步面', align: 'num', render: (x) => x.n < 8 ? '—' : pct1(x.progressRatio) },
      { key: 'declineRatio', label: '退步面', align: 'num', render: (x) => x.n < 8 ? '—' : pct1(x.declineRatio) },
      { key: 'expected', label: '同段期望', align: 'num', render: (x) => x.n < 8 ? '—' : pct1(x.expected) },
      { key: 'excess', label: '差值', align: 'num', render: (x) => x.n < 8 ? '—' : pp(x.excess) },
      { key: 'rate', label: '相对进步率', align: 'num', render: (x) => x.n < 8 ? '—' : f2(x.rate) },
      { key: 'recomp', label: '班级号变化', align: 'num', render: (x) => x.recomp && x.recomp.matched ? pct1(x.recomp.ratio) : '—' }
    );
    const expectedTotal = AM.expectedBelow(d.schoolD.mean, d.schoolD.sd);
    const total = {
      name: '整体汇总', n: d.school.n, strength: d.school.strength,
      mean: d.schoolD.mean, progressRatio: d.risk.counts.progress / d.school.n,
      declineRatio: d.school.declineRatio,
      expected: expectedTotal, excess: d.school.declineRatio - expectedTotal,
      rate: d.school.rate,
      recomp: { matched: true, ratio: AM.classRecomposition(d.totals).ratio },
      isTotal: true
    };
    return UI.table({ columns: cols, rows: d.classes.concat([total]), rowClass: (x) => x.isTotal ? 'an-total-row' : '' });
  }

  function teacherClassRows(r, d) {
    const map = {};
    (r.rows || []).forEach((x) => {
      if (x.schoolId !== d.schoolId || x.subject === '总分' || !x.teacherId || !x.classId) return;
      const k = `${x.teacherId}||${x.subject}||${x.classId}`;
      const g = map[k] || (map[k] = { teacherId: x.teacherId, teacher: x.teacherName, subject: x.subject, classId: x.classId, className: x.className, rows: [] });
      g.rows.push(x);
    });
    const weights = r.weights && r.weights.length ? r.weights : [90, 80, 70, 60, 50, 40, 30, 20, 10];
    const keepW = (g) => Math.max(0, (weights[g - 1] || 0) - 10);
    const progW = (g, levels) => {
      let s = 0;
      for (let x = g - 1; x >= Math.max(1, g - levels); x--) s += weights[x - 1] || 0;
      return s;
    };
    const declW = (g, levels) => {
      let s = 0;
      for (let x = g + 1; x <= Math.min(9, g + levels); x++) s += 100 - (weights[x - 1] || 0);
      return s;
    };
    const rows = Object.values(map).map((g) => {
      let keepSum = 0, progSum = 0, declSum = 0, keep = 0, progress = 0, decline = 0, zSum = 0;
      g.rows.forEach((x) => {
        zSum += Number(x.zDiff) || 0;
        if (x.status === '保持') { keep++; keepSum += keepW(x.entryGrade); }
        else if (x.status === '进步') { progress++; progSum += progW(x.entryGrade, x.level); }
        else { decline++; declSum += declW(x.entryGrade, Math.abs(x.level)); }
      });
      const n = g.rows.length;
      const mean = n ? zSum / n : null;
      const rate = n ? Math.round(((keepSum / n + (progSum / n) * 2) / ((declSum / n + 1) * 1.5)) * 100) / 100 : null;
      return { teacherId: g.teacherId, teacher: g.teacher, subject: g.subject, className: g.className, n, mean, rate, progress, progressRatio: n ? progress / n : 0, declineRatio: n ? decline / n : 0 };
    });
    rows.sort((a, b) => subjectRank(a.subject) - subjectRank(b.subject) || String(a.teacher).localeCompare(String(b.teacher), 'zh') || AM.classNum(a.className) - AM.classNum(b.className));
    return rows;
  }

  function teacherDetailTable(d, r) {
    const summaries = [];
    d.teachers.forEach((g) => g.teachers.forEach((t) => summaries.push(Object.assign({}, t, { subject: g.subject }))));
    const pairs = teacherClassRows(r, d);
    const map = {};
    summaries.forEach((t) => { map[`${t.subject}||${t.name}`] = { summary: t, classes: [] }; });
    pairs.forEach((p) => {
      const k = `${p.subject}||${p.teacher}`;
      if (!map[k]) map[k] = { summary: null, classes: [] };
      map[k].classes.push(p);
    });
    const groups = Object.values(map).filter((g) => g.summary || g.classes.length);
    groups.forEach((g) => g.classes.sort((a, b) => AM.classNum(a.className) - AM.classNum(b.className)));
    groups.sort((a, b) => {
      const sa = a.summary ? a.summary.subject : a.classes[0].subject;
      const sb = b.summary ? b.summary.subject : b.classes[0].subject;
      const ta = a.summary ? a.summary.name : a.classes[0].teacher;
      const tb = b.summary ? b.summary.name : b.classes[0].teacher;
      return subjectRank(sa) - subjectRank(sb) || String(ta).localeCompare(String(tb), 'zh');
    });
    const head = `<tr><th>学科</th><th>教师</th><th>班级 / 口径</th><th>本科人数</th><th>平均 ΔZ</th><th>进步面</th><th>退步面</th><th>相对进步率</th><th>判定</th></tr>`;
    const body = groups.map((g) => {
      const s = g.summary;
      const subject = s ? s.subject : g.classes[0].subject;
      const teacher = s ? s.name : g.classes[0].teacher;
      const multi = g.classes.length > 1;
      const span = multi ? g.classes.length + 1 : 1;
      const base = s || g.classes[0];
      const summaryLabel = multi ? `<b>教师汇总</b><span class="small">（${g.classes.length} 个班）</span>` : (g.classes.length === 1 ? `${esc(g.classes[0].className)}<span class="small">（仅1个班）</span>` : '<b>教师汇总</b>');
      const summaryRow = `<tr class="an-teacher-group an-teacher-summary"><td rowspan="${span}" class="an-teacher-merge">${esc(subject)}</td><td rowspan="${span}" class="an-teacher-merge"><b>${esc(teacher)}</b></td><td>${summaryLabel}</td><td class="num">${base.n}</td><td class="num"><b class="${toneClass(base.mean)}">${sgn(f2(base.mean))}</b></td><td class="num">${pct1(base.progressRatio)}</td><td class="num">${pct1(base.declineRatio)}</td><td class="num">${base.n < 8 ? '—' : f2(base.rate)}</td><td>${verdictBadge(base.mean, base.n)}</td></tr>`;
      const classRows = multi ? g.classes.map((c) => `<tr class="an-teacher-class"><td class="an-teacher-classname">${esc(c.className)}</td><td class="num">${c.n}</td><td class="num"><b class="${toneClass(c.mean)}">${sgn(f2(c.mean))}</b></td><td class="num">${pct1(c.progressRatio)}</td><td class="num">${pct1(c.declineRatio)}</td><td class="num">${c.n < 8 ? '—' : f2(c.rate)}</td><td>${verdictBadge(c.mean, c.n)}</td></tr>`).join('') : '';
      return summaryRow + classRows;
    }).join('');
    return `<div class="table-wrap an-teacher-table-wrap"><table class="table an-teacher-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
  }

  function teacherTable(d) {
    const rows = [];
    d.teachers.forEach((g) => g.teachers.forEach((t) => rows.push(t)));
    rows.sort((a, b) => subjectRank(a.subject) - subjectRank(b.subject) || (a.mean == null ? 99 : a.mean) - (b.mean == null ? 99 : b.mean));
    return UI.table({
      columns: [
        { key: 'subject', label: '学科' },
        { key: 'name', label: '教师', render: (x) => `<b>${esc(x.name)}</b>` },
        { key: 'classes', label: '所教班', render: (x) => `<span class="small">${esc(x.classes || '—')}</span>` },
        { key: 'n', label: '本科人数', align: 'num' },
        { key: 'mean', label: '平均 ΔZ', align: 'num', render: (x) => `<b class="${toneClass(x.mean)}">${sgn(f2(x.mean))}</b>` },
        { key: 'declineRatio', label: '退步面', align: 'num', render: (x) => pct1(x.declineRatio) },
        { key: 'rate', label: '相对进步率', align: 'num', render: (x) => x.n < 8 ? '—' : f2(x.rate) },
        { key: 'verdict', label: '判定', render: (x) => verdictBadge(x.mean, x.n) }
      ],
      rows: rows
    });
  }

  function studentTable(d) {
    const rows = d.risk.list.slice().sort((a, b) => AM.classNum(a.className) - AM.classNum(b.className) || String(a.studentNo).localeCompare(String(b.studentNo)));
    return tagMatrixTable(rows, { includeNo: true, includeStatus: true, zLabel: '总分 ΔZ', rowClass: (x) => x.risk ? 'an-row-risk' : '' });
  }

  function matrixTable(d, rows) {
    const data = rows || d.matrix;
    const head = `<tr><th>班级</th>${d.subjects.map((s) => `<th>${esc(s)}</th>`).join('')}<th>合计</th></tr>`;
    const body = data.map((row) => `<tr><th>${esc(row.name)}</th>${d.subjects.map((s) => `<td class="an-heat ${heatClass(row.cells[s] || 0)}">${row.cells[s] || ''}</td>`).join('')}<td class="num"><b>${row.total}</b></td></tr>`).join('');
    const totals = d.subjects.map((s) => data.reduce((a, row) => a + (row.cells[s] || 0), 0));
    const grand = totals.reduce((a, b) => a + b, 0);
    const totalRow = `<tr class="an-total-row"><th>整体汇总（人次）</th>${totals.map((v) => `<td class="num">${v || ''}</td>`).join('')}<td class="num"><b>${grand}</b></td></tr>`;
    return `<div class="table-wrap an-matrix"><table class="table"><thead>${head}</thead><tbody>${body}${totalRow}</tbody></table></div>`;
  }

  function migrationTable(totals) {
    const m = [];
    for (let i = 0; i < 9; i++) m.push(new Array(9).fill(0));
    totals.forEach((t) => { m[t.entryGrade - 1][t.currentGrade - 1]++; });
    const head = `<tr><th>入口 \\ 出口</th>${Array.from({ length: 9 }, (_, i) => `<th>G${i + 1}</th>`).join('')}</tr>`;
    const body = m.map((row, i) => `<tr><th>G${i + 1}</th>${row.map((v, j) => `<td class="an-mig ${i === j ? 'diag' : j > i ? 'down' : 'up'}">${v || ''}</td>`).join('')}</tr>`).join('');
    const legend = `<div class="an-mig-legend"><span><i class="up"></i>升档：出口数字变小（如 G3→G2）</span><span><i class="diag"></i>保持：入口=出口</span><span><i class="down"></i>降档：出口数字变大（如 G1→G2）</span></div>`;
    return `${legend}<div class="table-wrap an-migration"><table class="table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
  }

  function bandTable(d) {
    const rows = [];
    d.bands.forEach((b) => {
      rows.push({ label: b.label, n: b.n, kind: '进步', count: b.progress, rate: b.progressRate, base: b.progressBase, diff: b.progressExcess, first: true });
      rows.push({ label: b.label, n: b.n, kind: '退步', count: b.decline, rate: b.rate, base: b.base, diff: b.excess, first: false });
    });
    return UI.table({
      columns: [
        { key: 'label', label: '入口段', render: (x) => x.first ? `<b>${esc(x.label)}</b><span class="small">（n=${x.n}）</span>` : '' },
        { key: 'kind', label: '类型', render: (x) => `<span class="an-badge ${x.kind === '进步' ? 'blue' : 'gray'}">${x.kind}</span>` },
        { key: 'count', label: '人数', align: 'num' },
        { key: 'rate', label: '段内占比', align: 'num', render: (x) => pct1(x.rate) },
        { key: 'base', label: '同段基准', align: 'num', render: (x) => pct1(x.base) },
        { key: 'diff', label: '相差', align: 'num', render: (x) => pp(x.diff) }
      ],
      rows
    });
  }

  function directionTable(d) {
    return UI.table({
      columns: [
        { key: 'sel', label: '方向', render: (x) => `<b>${esc(x.sel)}</b>` },
        { key: 'n', label: '人数', align: 'num' },
        { key: 'progress', label: '进步', align: 'num' },
        { key: 'keep', label: '保持', align: 'num' },
        { key: 'decline', label: '退步', align: 'num' },
        { key: 'declineRatio', label: '退步面', align: 'num', render: (x) => pct1(x.declineRatio) }
      ],
      rows: d.direction
    });
  }

  /* ---------- A 报告说明 ---------- */
  function chapterA(task, r, d) {
    const entry = (window.MOCK.exams || []).find((e) => e.id === task.entryExamId);
    const exit = (window.MOCK.exams || []).find((e) => e.id === task.exitExamId);
    const recomp = AM.classRecomposition(d.totals);
    const metricRows = [
      ['平均 ΔZ', '学生 ΔZ 的均值；>0 表示整体相对位次上移', '0', '受极端值影响，配合中位数/分布看'],
      ['学业实力', '评价档按 90→10 加权平均；表示出口位置', '联考均值', '不是增值，不能单独当加工能力'],
      ['退步面', '退步人数 ÷ 参评人数', '基线约 31.7%', '阈值敏感；必须和期望值一起看'],
      ['相对进步率', '（保持 + 进步×2）÷（（退步+1）×1.5）', '1.0', '无上界；小分母会放大'],
      ['等级迁移', '入口 G→评价 G 的人数结构', '入口结构', '看低档是否变宽、高端是否变薄'],
      ['风险标签', '总分掉2档 / 入口靠前退步 / 单科掉2档 / 单科掉4档', '规则阈值', '标签重叠，不能相加']
    ];
    const body = `<div class="an-grid-2">
      <div class="an-card"><h4>基本情况</h4><dl class="an-dl">
        <dt>任务</dt><dd>${esc(task.name)}</dd>
        <dt>考试</dt><dd>${esc(entry ? entry.name : task.entryExamId)} → ${esc(exit ? exit.name : task.exitExamId)}</dd>
        <dt>范围</dt><dd>${esc(d.school.schoolName)} · ${d.school.n} 人 · ${d.classes.length} 个班</dd>
        <dt>参评 / 剔除</dt><dd>${d.school.n} 人（本校）/ ${r.quality.sample} 人（联考） · 剔除 ${r.quality.excluded} 人</dd>
        <dt>部分缺考</dt><dd>${r.quality.partialAbsentExcluded} 人（联考）</dd>
        <dt>结果版本</dt><dd>${esc(task.resultVersion || '—')} · ${esc(task.updatedAt || '—')}</dd>
      </dl></div>
      <div class="an-card"><h4>数据来源与口径</h4><ul class="an-list">
        <li>成绩来自入口/评价两场考试的原始分与赋分；物理/历史按原始分，化学/生物/政治/地理按赋分。</li>
        <li>学生按学号匹配；仅入口、仅评价、单科缺考、艺体考生按规则剔除。</li>
        <li>班级归属按评价考试当前班级；入口班级仅用于识别。本校 ${d.school.n} 人中，${recomp.changed}/${recomp.matched} 人（${pct1(recomp.ratio)}）班级号发生变化（含高二→高三统一改名/重组）。</li>
        <li>报告只读结果版本 ${esc(task.resultVersion || '—')}，不重新计算；对比、差值、百分比为报告层派生。</li>
      </ul></div>
      <div class="an-card"><h4>算法逻辑</h4><ol class="an-steps">
        <li><b>算标准分</b>：z =（原始分 − 联考均分）÷ 标准差；入口、评价各算一次，不同科目放到同一把尺子上。</li>
        <li><b>划九档</b>：按标准正态 Z 区间划 G1–G9；G1 最高、G9 最低；入口档和评价档分开判定。进步/保持/退步另按 ΔZ 阈值判定：|ΔZ|≤0.25 保持，>0.25 进步，<−0.25 退步；级数按 0.25/0.5 折算。</li>
        <li><b>算跨档贡献</b>：等级权重 G1=90 … G9=10；保持/进步/退步按跨过的档位累计；退步取 100 − 目标档权重。</li>
        <li><b>合成相对进步率</b>：（保持值 + 进步值×2）÷（（退步值+1）×1.5）；1.0 为平衡，不是百分比。</li>
      </ol></div>
      <div class="an-card"><h4>怎么读</h4><ul class="an-list">
        <li><b>先看基线</b>：当前 ±0.25 口径下，稳定队列的退步面约 31.7%；40.6% 要先和 31.7%、按本校分布推算的期望 39.6% 比。</li>
        <li><b>再看效应量</b>：平均 ΔZ ≥ +0.10 记为略高、≥ +0.30 记为明显高；≤ −0.10 略低、≤ −0.30 明显低；中间为基本持平。</li>
        <li><b>双向解读</b>：每章都列“高于基准 / 低于基准 / 基本持平”，不只看低于基准的部分。</li>
        <li><b>归因边界</b>：报告只写到直接数据原因与机制候选；教学/管理原因标“待验证”。</li>
        <li><b>样本规则</b>：n&lt;8 只展示、不判定；小样本与极端值在表内标出。</li>
      </ul></div>
    </div>
    <div class="an-card mt-16"><h4>关键指标</h4>${UI.table({
      columns: [{ key: 'k', label: '指标' }, { key: 'd', label: '定义' }, { key: 'b', label: '基准' }, { key: 'r', label: '注意' }],
      rows: metricRows.map((x) => ({ k: x[0], d: x[1], b: x[2], r: x[3] }))
    })}</div>`;
    return chapter('A', 'an-a', '报告说明', '这份报告用什么数据、怎么算、怎么读？', body, '先读这一章');
  }

  /* ---------- B 总体 ---------- */
  function chapterB(task, r, d) {
    const s = d.school;
    const c = AM.counts(d.totals);
    const schools = schoolRows(r);
    const peers = schools.filter((x) => x.schoolId !== d.schoolId);
    const topPeer = peers.slice().sort((a, b) => b.strength - a.strength)[0];
    const good = [];
    const bad = [];
    const neutral = [];
    const validClasses = d.classes.filter((x) => x.n >= 8);
    const topClass = validClasses.slice().sort((a, b) => b.mean - a.mean)[0];
    const lowClass = validClasses.slice().sort((a, b) => a.mean - b.mean)[0];
    const topSubs = d.subjectRows.slice().sort((a, b) => b.mean - a.mean);
    const lowSubs = d.subjectRows.slice().sort((a, b) => a.mean - b.mean);
    const expectedSelf = AM.expectedBelow(d.schoolD.mean, d.schoolD.sd);
    const expectedGap = expectedSelf == null ? null : (c.declineRatio - expectedSelf) * 100;
    if (topSubs[0]) good.push(`<b>${esc(topSubs[0].subject)}</b> 平均 ΔZ ${sgn(f2(topSubs[0].mean))}、相对进步率 ${f2(topSubs[0].rate)}，是学科中相对最高。`);
    if (topClass) good.push(`<b>${esc(topClass.name)}</b> 平均 ΔZ ${sgn(f2(topClass.mean))}、退步面 ${pct1(topClass.declineRatio)}，班级层面有正向样本。`);
    good.push(`进步 <b>${c.progress} 人</b>（${pct1(c.progressRatio)}）、保持 ${c.keep} 人（${pct1(c.keepRatio)}）。`);
    bad.push(`平均 ΔZ <b>${sgn(f2(d.schoolD.mean))}</b>（约 ${f2(Math.abs(d.schoolD.mean) / d.global.sd)} SD），退步 <b>${c.decline} 人</b>（${pct1(c.declineRatio)}）。`);
    if (lowSubs.length) bad.push(`低于基准的学科：${lowSubs.slice(0, 3).map((x) => `${esc(x.subject)} ${sgn(f2(x.mean))}`).join('、')}。`);
    if (lowClass) bad.push(`<b>${esc(lowClass.name)}</b> 平均 ΔZ ${sgn(f2(lowClass.mean))}、退步面 ${pct1(lowClass.declineRatio)}，是班级中的低于基准。`);
    neutral.push(`相对进步率 <b>${f2(s.rate)}</b>，与 1.0 的差距不大；退步面 ${pct1(c.declineRatio)} vs 按本校分布期望 ${pct1(expectedSelf)}，差 ${expectedGap == null ? '—' : sgn(f2(expectedGap)) + 'pp'}。`);
    const flatSubs = d.subjectRows.filter((x) => Math.abs(x.mean) < 0.1).slice(0, 3);
    if (flatSubs.length) neutral.push(`${flatSubs.map((x) => esc(x.subject)).join('、')} 平均 ΔZ 接近 0，属于基本持平。`);

    const body = `${kpiGrid([
      { label: '参评人数', value: d.school.n + ' 人', sub: '四校合计 ' + r.quality.sample + ' 人' },
      { label: '平均 ΔZ', value: sgn(f2(d.schoolD.mean)), sub: `约 ${f2(Math.abs(d.schoolD.mean) / d.global.sd)} SD · 基准 0`, tone: d.schoolD.mean < -0.1 ? 'neg' : d.schoolD.mean > 0.1 ? 'pos' : '' },
      { label: '退步面', value: pct1(c.declineRatio), sub: `基线 31.7% · 期望 ${pct1(expectedSelf)}`, tone: c.declineRatio > 0.35 ? 'neg' : '' },
      { label: '相对进步率', value: f2(s.rate), sub: '1.0 为平衡', tone: s.rate < 1 ? 'neg' : 'pos' }
    ])}
    <div class="an-card mt-16"><h4>ΔZ 分布（全体 ${d.school.n} 人）</h4>${histChart(d.histogram)}${note('横轴为 ΔZ，纵轴为人数；±0.25 为保持带。分布中心略偏左，说明整体是小幅下移，不是双峰断裂。')}</div>
    <div class="an-card mt-16"><h4>四校总表（全部学校）</h4>${schoolTable(r, d)}${note('平均水平看 ΔZ；退步面同时给“期望”，避免把基线误读为变化。')}</div>
    ${interp(good, bad, neutral)}
    ${whyBlock('追问：为什么会出现这种总体格局？', [
      `入口结构：本校学业实力 ${f1(s.strength)}${topPeer ? `，其他三校最高为 ${esc(topPeer.schoolName)} ${f1(topPeer.strength)}` : ''}；入口差异会放大退步面，但不解释全部差异。`,
      `位移幅度：平均 ΔZ ${sgn(f2(d.schoolD.mean))}，约 ${f2(Math.abs(d.schoolD.mean) / d.global.sd)} SD；这是小幅位移，不是全面崩塌。`,
      `集中度：低于基准的集中在 ${lowSubs.slice(0, 3).map((x) => esc(x.subject)).join('、')}${lowClass ? ` 与 ${esc(lowClass.name)}` : ''}，不是全校同向。`,
      `指标效应：退步面受 ±0.25 阈值影响，${pct1(c.declineRatio)} 与期望 ${pct1(expectedSelf)} 差 ${expectedGap == null ? '—' : sgn(f2(expectedGap)) + 'pp'}；真正要解释的是均值为什么偏。`
    ])}
    ${boundary(`退步面是阈值指标，基线约 31.7%；学生班级号变化 ${pct1(AM.classRecomposition(d.totals).ratio)}（含统一改名/重组），班级层面不能直接归因班主任或任课教师；本节只描述总体，不证明因果。`)}
    ${actionBlock([
      { title: '先看低于基准的集中点', text: `${lowClass ? lowClass.name : '低于基准的班'} + ${lowSubs.slice(0, 3).map((x) => esc(x.subject)).join('/')}；由年级主任牵头，两周内完成学科拆解。` },
      { title: '同时复制正向样本', text: `${topSubs[0] ? esc(topSubs[0].subject) : '优势学科'}备课组、${topClass ? esc(topClass.name) : '正向班'}各出一页做法，跨班分享。` },
      { title: '复查口径', text: '两周后看平均 ΔZ、退步面（对期望）、低于基准的班/科是否收窄；不只看总退步人数。' }
    ])}`;
    return chapter('B', 'an-b', '总体', '本校整体处在什么位置？变化有多大？', body, '含四校对比');
  }

  /* ---------- C 结构 ---------- */
  function chapterC(task, r, d) {
    const down = d.grade.filter((x) => x.delta < 0).sort((a, b) => a.delta - b.delta);
    const up = d.grade.filter((x) => x.delta > 0).sort((a, b) => b.delta - a.delta);
    const lowSubs = d.subjectRows.slice().sort((a, b) => a.mean - b.mean).slice(0, 3);
    const flatSubs = d.subjectRows.filter((x) => Math.abs(x.mean) < 0.1).slice(0, 3);
    const good = [`G1 仍有 ${d.grade[0].exit} 人${d.grade[1].delta >= 0 ? `、G2 +${d.grade[1].delta} 人` : ''}，高端没有整体消失。`];
    const bad = [`${down[0] ? `G${down[0].grade} ${down[0].delta} 人` : '无明显下降档'}${down[1] ? `、G${down[1].grade} ${down[1].delta} 人` : ''}；中段变薄。`, `G7/G8/G9 合计净增 ${d.grade.slice(6).reduce((a, x) => a + x.delta, 0)} 人，低档变宽。`];
    const neutral = [`G5 ${d.grade[4].delta} 人，基本稳定。`];
    const body = `${kpiGrid([
      { label: 'G1 人数', value: `${d.grade[0].entry} → ${d.grade[0].exit}`, sub: `Δ ${d.grade[0].delta > 0 ? '+' : ''}${d.grade[0].delta}` },
      { label: down[0] ? `G${down[0].grade} 人数` : '最大下降档', value: down[0] ? `${down[0].entry} → ${down[0].exit}` : '—', sub: down[0] ? `Δ ${down[0].delta}` : '—', tone: 'neg' },
      { label: up[0] ? `G${up[0].grade} 人数` : '最大上升档', value: up[0] ? `${up[0].entry} → ${up[0].exit}` : '—', sub: up[0] ? `Δ +${up[0].delta}` : '—' },
      { label: '低档净增（G7–G9）', value: `${d.grade.slice(6).reduce((a, x) => a + x.delta, 0) > 0 ? '+' : ''}${d.grade.slice(6).reduce((a, x) => a + x.delta, 0)} 人`, sub: '低档变宽', tone: 'neg' }
    ])}
    <div class="an-card mt-16"><h4>入口 → 评价 等级分布</h4>${gradeDistBars(d)}${note('G1 最好、G9 最低；入口与评价分别统计，Δ 为评价人数减入口人数。')}</div>
    <div class="an-card mt-16"><h4>等级迁移矩阵（全部 ${d.school.n} 人）</h4>${migrationTable(d.totals)}${note('行=入口、列=出口；对角线=保持。G1 最好、G9 最低：出口数字变大是降档，数字变小是升档。')}${flowTop(d.totals)}</div>
    ${interp(good, bad, neutral)}
    ${whyBlock('追问：结构为什么下移？', [
      `相对位次：九档是相对位置，不是绝对分数；整体均值 ${sgn(f2(d.schoolD.mean))} 时，中段人数会向低档移动。`,
      `天花板/回归：入口越强的班，下降空间越大；本校班级“学业实力 × 平均 ΔZ”相关系数为 ${d.classCorr == null ? '—' : f2(d.classCorr)}（负值表示入口越强、平均 ΔZ 越低），说明部分结构变化是统计效应。`,
      `学科结构：${lowSubs.map((x) => esc(x.subject)).join('、')} 偏低，会把中段学生整体往下推；${flatSubs.map((x) => esc(x.subject)).join('、') || '部分学科'} 接近持平，缓冲了结构下移。`
    ])}
    ${boundary('等级是相对位置，不是绝对水平；分档比例由口径决定，不能把“某个档减少”直接读成“学生退步了多少个名次”。')}
    ${actionBlock([
      { title: '看中段', text: '先看 G3–G6 的迁移，而不是只看 G1/G9；中段是结构变化的主要承载。' },
      { title: '分学科验证', text: `把中段减少的学生按学科拆开，确认是否集中在 ${lowSubs.map((x) => esc(x.subject)).join('/')}。` },
      { title: '复查', text: '两周后看中段是否回补，低档净增是否收窄。' }
    ])}`;
    return chapter('C', 'an-c', '结构', '入口到评价，等级结构发生了什么变化？', body, '含 9×9 迁移');
  }

  /* ---------- D1 学科 ---------- */
  function chapterD1(task, r, d) {
    const good = d.subjectRows.filter((x) => x.mean >= 0.1).sort((a, b) => b.mean - a.mean);
    const bad = d.subjectRows.filter((x) => x.mean <= -0.1).sort((a, b) => a.mean - b.mean);
    const neutral = d.subjectRows.filter((x) => x.mean > -0.1 && x.mean < 0.1).sort((a, b) => b.mean - a.mean);
    const line = (x) => `<b>${esc(x.subject)}</b> 平均 ΔZ ${sgn(f2(x.mean))}、退步面 ${pct1(x.declineRatio)}、相对进步率 ${f2(x.rate)}`;
    const gLines = good.map(line);
    const bLines = bad.map(line);
    const nLines = neutral.map(line);
    const topSub = good[0];
    const low3 = bad.slice(0, 3);
    const teacherRange = (sub) => {
      const g = d.teachers.find((x) => x.subject === sub);
      return g ? `教师区间 ${sgn(f2(g.min))} ~ ${sgn(f2(g.max))}，中位 ${sgn(f2(g.med))}` : '';
    };
    const body = `${kpiGrid([
      { label: '学科数', value: d.subjectRows.length + ' 科', sub: '全部纳入，不筛选' },
      { label: '高于基准', value: good.length + ' 科', sub: good.map((x) => x.subject).join('、') || '—', tone: 'pos' },
      { label: '低于基准', value: bad.length + ' 科', sub: bad.map((x) => x.subject).join('、') || '—', tone: 'neg' },
      { label: '校均值', value: f2(d.subjectMeanRate), sub: '相对进步率均值' }
    ])}
    <div class="an-card mt-16"><h4>全部学科（${d.subjectRows.length} 科）</h4>${subjectTable(d)}${note('平均 ΔZ 是主镜头；退步面/相对进步率是辅助镜头。不同学科的比较群体不同，不能直接比分数。')}</div>
    <div class="an-card mt-16"><h4>平均 ΔZ（全部学科）</h4>${bars(d.subjectRows.map((x) => ({ label: x.subject, value: x.mean })), { max: 0.4 })}</div>
    <div class="an-card mt-16"><h4>学科构成（进步 / 保持 / 退步）</h4>${stackedSubjectBars(d)}${note('条内为人数构成，右侧为相对进步率；构成不是好坏，需结合平均 ΔZ 与样本看。')}</div>
    ${interp(gLines, bLines, nLines)}
    ${whyBlock('追问：为什么高、为什么低？', [
      ...low3.map((x) => `${esc(x.subject)}：${teacherRange(x.subject) || '教师区间样本不足'}；整科偏低时，先核对备课组、命题与生源结构。`),
      topSub ? `${esc(topSub.subject)}：${teacherRange(topSub.subject) || '教师区间样本不足'}；可复制做法值得先看。` : '',
      (() => { const en = d.subjectRows.find((x) => x.subject === '英语'); if (!en) return ''; const diverge = (en.rate >= 1) !== (en.mean >= 0); return `英语相对进步率 ${f2(en.rate)}、平均 ΔZ ${sgn(f2(en.mean))}：两个镜头${diverge ? '方向不一致' : '方向一致'}，说明“保持/进步权重”与“平均位移”不是一回事。`; })()
    ].filter(Boolean))}
    ${boundary('学科之间比较的是相对进步率与平均 ΔZ，不是平均分；不同学科试卷难度、选科群体不同，不能直接评价某科教学优劣。')}
    ${actionBlock([
      { title: low3[0] ? `${esc(low3[0].subject)}备课组` : '低于基准的备课组', text: '做一次同题分析，两周后看低于基准的部分是否收窄。' },
      { title: low3[1] ? `${esc(low3[1].subject)}对照` : '教师对照', text: '先看同科教师区间与所教班入口，再决定是备课组还是班级因素。' },
      { title: topSub ? `${esc(topSub.subject)}复制` : '正向复制', text: '整理一页可复制做法，跨科分享。' }
    ])}`;
    return chapter('D1', 'an-d1', '分项 · 学科', '每一科各自处在什么位置？哪些高于基准、哪些低于基准？', body, '全部学科');
  }

  /* ---------- D2 班级 ---------- */
  function chapterD2(task, r, d) {
    const good = d.classes.filter((x) => x.n >= 8 && x.mean >= 0.1).sort((a, b) => b.mean - a.mean);
    const bad = d.classes.filter((x) => x.n >= 8 && x.mean <= -0.1).sort((a, b) => a.mean - b.mean);
    const neutral = d.classes.filter((x) => x.n >= 8 && x.mean > -0.1 && x.mean < 0.1).sort((a, b) => b.mean - a.mean);
    const line = (x) => `<b>${esc(x.name)}</b> 平均 ΔZ ${sgn(f2(x.mean))}、退步面 ${pct1(x.declineRatio)}、相对进步率 ${f2(x.rate)}`;
    const validClasses = d.classes.filter((x) => x.n >= 8);
    const focus = validClasses.slice().sort((a, b) => a.mean - b.mean)[0];
    const positive = validClasses.slice().sort((a, b) => b.mean - a.mean)[0];
    const lowSubs = d.subjectRows.slice().sort((a, b) => a.mean - b.mean).slice(0, 3);
    const body = `${kpiGrid([
      { label: '班级数', value: d.classes.length + ' 个', sub: '全部纳入，不筛选' },
      { label: '高于基准', value: good.length + ' 个', sub: good.map((x) => x.name).join('、') || '—', tone: 'pos' },
      { label: '低于基准', value: bad.length + ' 个', sub: bad.slice(0, 6).map((x) => x.name).join('、') + (bad.length > 6 ? ' 等' : ''), tone: 'neg' },
      { label: '学生班级号变化', value: pct1(AM.classRecomposition(d.totals).ratio), sub: '入口→评价 · 含统一改名/重组' }
    ])}
    <div class="an-card mt-16"><h4>班级实力 × 增值矩阵（平均 ΔZ）</h4>${scatterChart(d.classes.filter((x) => x.n >= 8).map((x) => ({ label: x.name.replace('高三', ''), x: x.strength, y: x.mean, n: x.n })), { aria: '班级学业实力与平均 ΔZ 散点图' })}${note('横轴=班级学业实力（入口位置），纵轴=平均 ΔZ（0 为持平；旧版纵轴为相对进步率 1.0 平衡，口径不同，不直接比高低）；气泡大小=班级人数；只纳入 n≥8 的班；全部班级名称直接标注在点旁，极密集处就近避让，必要时用短线连接。')}</div>
    <div class="an-card mt-16"><h4>全校班级总表：总分 + 各科平均 ΔZ</h4>${classMasterTable(d, r)}${note('行=班级，列=总分与各科平均 ΔZ；颜色只表示正负；人数少的班级仍展示，但不做判定。')}</div>
    <div class="an-card mt-16"><h4>全部班级（${d.classes.length} 个）</h4>${classTable(d)}${note('“同段期望”是按其他学校入口相近学生推算的退步面；“班级号变化”是入口班级号发生变化的学生比例；最后一行为整体汇总。完整学业实力/明细见附录 A3。')}</div>
    ${interp(good.map(line), bad.slice(0, 6).map(line).concat(bad.length > 6 ? [`另有 ${bad.length - 6} 个班低于基准，见上表。`] : []), neutral.map(line))}
    ${whyBlock('追问：为什么高、为什么低？', [
      `班级“学业实力 × 平均 ΔZ”相关系数 ${d.classCorr == null ? '—' : f2(d.classCorr)}：入口越强，平均 ΔZ 越低；天花板/回归不能忽略。`,
      focus ? `低于基准的班：${esc(focus.name)} 平均 ΔZ ${sgn(f2(focus.mean))}、退步面 ${pct1(focus.declineRatio)}；先看 D1 与班×科矩阵，确认是否学科集中。` : '当前没有达标班级可作低于基准的参照。',
      '同教师跨班对比需要至少两个所教班与课堂/作业数据；仅凭增值不能归因教师。',
      positive ? `正向班：${esc(positive.name)} 平均 ΔZ ${sgn(f2(positive.mean))}、退步面 ${pct1(positive.declineRatio)}；与低于基准的班形成对照。` : '当前没有达标班级可作正向参照。'
    ])}
    ${boundary(`学生班级号变化 ${pct1(AM.classRecomposition(d.totals).ratio)}（含统一改名/重组）${focus ? `；${focus.name} ${focus.n} 人中 ${focus.recomp.changed} 人班级号变化` : ''}，班级层面不能直接归因班主任。`)}
    ${actionBlock([
      { title: `先看 ${focus ? focus.name : '低于基准的班'}`, text: `${lowSubs.map((x) => esc(x.subject)).join('/')} 拆解，核对名单；两周后看这几科掉档人数。` },
      { title: `对照 ${positive ? positive.name : '正向班'}`, text: '整理正向班在课堂、作业、错题上的做法，形成一页对照。' },
      { title: '分组复查', text: '两周后看低于基准的班的平均 ΔZ 是否回升、退步面是否接近期望。' }
    ])}`;
    return chapter('D2', 'an-d2', '分项 · 班级', '每个班各自处在什么位置？哪些高于基准、哪些低于基准？', body, '全部班级');
  }

  /* ---------- D3 教师 ---------- */
  function chapterD3(task, r, d) {
    const groups = d.teachers;
    const roster = (window.MOCK.teachers || []).filter((t) => t.schoolId === d.schoolId).length;
    const evaluated = groups.reduce((a, g) => a + g.teachers.length, 0);
    const pairs = teacherClassRows(r, d);
    const pairByTeacher = {};
    pairs.forEach((x) => { (pairByTeacher[x.teacherId] || (pairByTeacher[x.teacherId] = new Set())).add(x.className); });
    const multiTeachers = Object.values(pairByTeacher).filter((s) => s.size > 1).length;
    const rows = groups.map((g) => ({
      subject: g.subject, valid: g.valid, min: g.min, med: g.med, max: g.max,
      span: g.min == null || g.max == null ? null : g.max - g.min
    }));
    const summary = UI.table({
      columns: [
        { key: 'subject', label: '学科', render: (x) => `<b>${esc(x.subject)}</b>` },
        { key: 'valid', label: '教师数（n≥8）', align: 'num' },
        { key: 'min', label: '最低', align: 'num', render: (x) => sgn(f2(x.min)) },
        { key: 'med', label: '中位', align: 'num', render: (x) => sgn(f2(x.med)) },
        { key: 'max', label: '最高', align: 'num', render: (x) => sgn(f2(x.max)) },
        { key: 'span', label: '极差', align: 'num', render: (x) => f2(x.span) }
      ],
      rows
    });
    const bySpan = groups.filter((g) => g.min != null && g.max != null).sort((a, b) => (b.max - b.min) - (a.max - a.min));
    const widest = bySpan[0];
    const byMed = groups.filter((g) => g.med != null).sort((a, b) => a.med - b.med);
    const lowest = byMed[0];
    const highest = byMed[byMed.length - 1];
    const good = [];
    const bad = [];
    const neutral = [];
    if (highest) good.push(`${esc(highest.subject)} ${highest.valid} 位教师中位 ${sgn(f2(highest.med))}、区间 ${sgn(f2(highest.min))} ~ ${sgn(f2(highest.max))}；${highest.min >= 0 ? '全部为正' : '相对最高'}。`);
    good.push(`教师区间差异存在正向样本：${highest ? esc(highest.subject) : '—'}${widest ? `；${esc(widest.subject)} 极差 ${f2(widest.max - widest.min)}` : ''}。`);
    if (lowest) bad.push(`${esc(lowest.subject)} 中位 ${sgn(f2(lowest.med))}、最低 ${sgn(f2(lowest.min))}：${lowest.max <= 0 ? '整科偏低，不是个别教师' : '相对偏低'}。`);
    if (widest) bad.push(`${esc(widest.subject)} 教师间极差 ${f2(widest.max - widest.min)}（${sgn(f2(widest.min))} ~ ${sgn(f2(widest.max))}），差异较大。`);
    byMed.filter((g) => Math.abs(g.med) < 0.1).slice(0, 2).forEach((g) => neutral.push(`${esc(g.subject)} 中位 ${sgn(f2(g.med))}，整体接近持平。`));
    neutral.push('教师间差异要结合所教班入口、班额、选科看；本表不排名，只给区间。');
    const body = `${kpiGrid([
      { label: '参与评价教师', value: evaluated + ' 人', sub: `${pairs.length} 个班级组合 · 本校 ${roster} 人 · ${roster - evaluated} 人未标学科` },
      { label: '最低学科中位', value: sgn(f2(lowest ? lowest.med : null)), sub: lowest ? `${esc(lowest.subject)} · 最低 ${sgn(f2(lowest.min))}` : '—', tone: 'neg' },
      { label: '最大教师极差', value: widest ? f2(widest.max - widest.min) : '—', sub: widest ? `${esc(widest.subject)} · ${sgn(f2(widest.min))} ~ ${sgn(f2(widest.max))}` : '—' },
      { label: '最高学科中位', value: sgn(f2(highest ? highest.med : null)), sub: highest ? `${esc(highest.subject)} · ${highest.min >= 0 ? '全部为正' : '相对最高'}` : '—', tone: 'pos' }
    ])}
    <div class="an-card mt-16"><h4>分学科教师区间（n≥8）</h4>${summary}${note('极差 = 最高 − 最低；不代表教学水平差异，需结合所教班入口。')}</div>
    <div class="an-card mt-16"><h4>教师明细（${evaluated} 人 · ${pairs.length} 个班级组合；${multiTeachers} 位教师跨多个班）</h4>${teacherDetailTable(d, r)}${note('每位教师先列“教师汇总”，再列所教班级；单班教师只留一行，标注“仅1个班”。教师表不排名；班级人数少时以“样本不足”为准，不把班间差异直接归因教师。本校教师 ' + roster + ' 人，' + (roster - evaluated) + ' 人未标注学科，未进入本科统计。')}</div>
    ${interp(good, bad, neutral)}
    ${whyBlock('追问：教师差异怎么解释？', [
      `${lowest ? `${esc(lowest.subject)}：${lowest.valid} 位教师中位 ${sgn(f2(lowest.med))}、最低 ${sgn(f2(lowest.min))}` : '—'}；整科偏低时，先核对备课组、命题与生源结构，而不是单个教师。`,
      `${widest ? `${esc(widest.subject)}：区间 ${sgn(f2(widest.min))} ~ ${sgn(f2(widest.max))}` : '—'}；差异大，但同一位老师在不同班也可能差异很大，不能直接归因。`,
      `${highest ? `${esc(highest.subject)}：${highest.valid} 位教师中位 ${sgn(f2(highest.med))}，${highest.min >= 0 ? '全部为正' : '相对最高'}` : '—'}；先看可复制做法，而不是只盯低于基准的部分。`
    ])}
    ${boundary('教师表不排名；同科教师所教班入口、班额、选科不同，教师差异与班级结构混在一起，不能直接当教学水平。')}
    ${actionBlock([
      { title: lowest ? `${esc(lowest.subject)}备课组` : '低于基准的备课组', text: '同题分析 + 作业分层；两周后看该科平均 ΔZ 与退步面。' },
      { title: widest ? `${esc(widest.subject)}对照` : '教师对照', text: '选同一教师所教的两个班，听课 + 作业检查，再判断是班级还是教学。' },
      { title: highest ? `${esc(highest.subject)}复制` : '正向复制', text: '整理正向备课组做法，作为可复制样本。' }
    ])}`;
    return chapter('D3', 'an-d3', '分项 · 教师', '同一学科不同教师，差异在哪？', body, '不排名');
  }

  /* ---------- D4 学生 ---------- */
  function changeCountTable(rows, keyFn, labelFn, label) {
    const map = {};
    (rows || []).forEach((x) => {
      const k = keyFn(x);
      if (k == null) return;
      const g = map[k] || (map[k] = { label: labelFn ? labelFn(x) : k, n: 0, down2: 0, up2: 0 });
      g.n++;
      if (x.level <= -2) g.down2++;
      if (x.level >= 2) g.up2++;
    });
    const data = Object.values(map).map((x) => Object.assign({}, x, { net: x.up2 - x.down2 })).sort((a, b) => b.down2 - a.down2 || b.net - a.net);
    return UI.table({
      columns: [
        { key: 'label', label: label || '分组', render: (x) => `<b>${esc(x.label)}</b>` },
        { key: 'n', label: '人次', align: 'num' },
        { key: 'down2', label: '掉2档以上', align: 'num' },
        { key: 'up2', label: '升2档以上', align: 'num' },
        { key: 'net', label: '净升', align: 'num', render: (x) => x.net > 0 ? '+' + x.net : String(x.net) }
      ], rows: data
    });
  }

  function classMasterTable(d, r, classList) {
    const classes = classList && classList.length ? classList : d.classes;
    const ids = new Set(classes.map((c) => c.id));
    const by = {};
    (r.rows || []).filter((x) => x.schoolId === d.schoolId && x.subject !== '总分' && ids.has(x.classId)).forEach((x) => {
      const k = x.classId + '||' + x.subject;
      const g = by[k] || (by[k] = { z: 0, n: 0 });
      g.z += Number(x.zDiff) || 0; g.n++;
    });
    const totalRows = d.totals.filter((x) => ids.has(x.classId));
    const overallMean = AM.describe(totalRows.map((x) => x.zDiff)).mean;
    const subjOverall = {};
    d.subjects.forEach((sub) => {
      const rs = (r.rows || []).filter((x) => x.schoolId === d.schoolId && x.subject === sub && ids.has(x.classId));
      subjOverall[sub] = rs.length ? rs.reduce((a, x) => a + (Number(x.zDiff) || 0), 0) / rs.length : null;
    });
    const cell = (v) => v == null ? '<td class="an-master-cell">—</td>' : `<td class="an-master-cell ${toneClass(v)}" title="${sgn(f2(v))}">${sgn(f2(v))}</td>`;
    const head = `<tr><th>班级</th><th>人数</th><th class="an-master-total">总分 ΔZ</th>${d.subjects.map((s) => `<th>${esc(s)}</th>`).join('')}</tr>`;
    const body = classes.map((c) => `<tr><th>${esc(c.name)}</th><td class="num">${c.n}</td>${cell(c.mean)}${d.subjects.map((s) => {
      const g = by[c.id + '||' + s];
      return cell(g && g.n ? g.z / g.n : null);
    }).join('')}</tr>`).join('');
    const total = `<tr class="an-total-row"><th>整体汇总</th><td class="num">${totalRows.length}</td>${cell(overallMean)}${d.subjects.map((s) => cell(subjOverall[s])).join('')}</tr>`;
    return `<div class="table-wrap an-master-wrap"><table class="table an-master-table"><thead>${head}</thead><tbody>${body}${total}</tbody></table></div>`;
  }

  function studentMasterTable(rows, d, subjectList) {
    const list = rows || [];
    const subjects = subjectList && subjectList.length ? subjectList : d.subjects;
    const subjMean = {};
    subjects.forEach((sub) => {
      const vals = list.map((x) => (x.subs || []).find((s) => s.subject === sub)).filter(Boolean).map((s) => Number(s.zDiff) || 0);
      subjMean[sub] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });
    const overallMean = list.length ? list.reduce((a, x) => a + (Number(x.zDiff) || 0), 0) / list.length : null;
    const cell = (v, title) => v == null ? '<td class="an-master-cell">—</td>' : `<td class="an-master-cell ${toneClass(v)}"${title ? ` title="${esc(title)}"` : ''}>${sgn(f2(v))}</td>`;
    const head = `<tr><th>班级</th><th>姓名</th><th class="an-master-total">总分 ΔZ</th>${subjects.map((s) => `<th>${esc(s)}</th>`).join('')}</tr>`;
    const body = list.map((x) => `<tr><th>${esc(x.className)}</th><td>${esc(x.studentName)}</td>${cell(x.zDiff, `G${x.entryGrade}→G${x.currentGrade}`)}${subjects.map((s) => {
      const sr = (x.subs || []).find((y) => y.subject === s);
      return cell(sr ? sr.zDiff : null, sr ? `G${sr.entryGrade}→G${sr.currentGrade}` : '');
    }).join('')}</tr>`).join('');
    const total = `<tr class="an-total-row"><th>整体汇总</th><td>${list.length} 人</td>${cell(overallMean)}${subjects.map((s) => cell(subjMean[s])).join('')}</tr>`;
    return `<div class="table-wrap an-master-wrap"><table class="table an-master-table"><thead>${head}</thead><tbody>${body}${total}</tbody></table></div>`;
  }

  function topStudentStats(r, d) {
    const top = d.totals.filter((x) => x.entryGrade <= 2);
    const topIds = new Set(top.map((x) => x.studentId));
    const out = top.filter((x) => x.currentGrade > 2);
    const inRows = d.totals.filter((x) => x.entryGrade > 2 && x.currentGrade <= 2);
    const retain = top.filter((x) => x.currentGrade <= 2);
    const status = { progress: 0, keep: 0, decline: 0 };
    top.forEach((x) => { if (x.status === '进步') status.progress++; else if (x.status === '保持') status.keep++; else status.decline++; });
    const dest = {};
    out.forEach((x) => { dest[x.currentGrade] = (dest[x.currentGrade] || 0) + 1; });
    const classMap = {};
    top.forEach((x) => {
      const o = classMap[x.className] || (classMap[x.className] = { className: x.className, n: 0, out: 0, in: 0, z: 0 });
      o.n++; if (x.currentGrade > 2) o.out++; o.z += Number(x.zDiff) || 0;
    });
    inRows.forEach((x) => {
      const o = classMap[x.className] || (classMap[x.className] = { className: x.className, n: 0, out: 0, in: 0, z: 0 });
      o.in++;
    });
    const classRows = Object.values(classMap).map((x) => Object.assign({}, x, { mean: x.n ? x.z / x.n : null })).sort((a, b) => (b.n + b.in) - (a.n + a.in) || b.n - a.n);
    const subMap = {};
    (r.rows || []).filter((x) => x.schoolId === d.schoolId && x.subject !== '总分' && topIds.has(x.studentId)).forEach((x) => {
      const o = subMap[x.subject] || (subMap[x.subject] = { subject: x.subject, n: 0, low: 0, z: 0 });
      o.n++; if (x.currentGrade >= 4) o.low++; o.z += Number(x.zDiff) || 0;
    });
    const subRows = Object.values(subMap).map((x) => Object.assign({}, x, { mean: x.z / x.n })).sort((a, b) => a.mean - b.mean);
    const lowIds = new Set((r.rows || []).filter((x) => x.schoolId === d.schoolId && x.subject !== '总分' && x.currentGrade >= 4 && topIds.has(x.studentId)).map((x) => x.studentId));
    const warn = top.filter((x) => x.zDiff < -0.25 || lowIds.has(x.studentId)).length;
    return {
      n: top.length, current: d.totals.filter((x) => x.currentGrade <= 2).length,
      retain: retain.length, out: out.length, in: inRows.length, warn,
      mean: top.length ? top.reduce((a, x) => a + (Number(x.zDiff) || 0), 0) / top.length : null,
      status, dest, classRows, subRows
    };
  }

  function chapterD4(task, r, d) {
    const c = d.risk.counts;
    const subRows = (r.rows || []).filter((x) => x.schoolId === d.schoolId && x.subject !== '总分');
    const byStudent = {};
    subRows.forEach((x) => { (byStudent[x.studentId] || (byStudent[x.studentId] = [])).push(x); });
    const anySub = (pred) => Object.values(byStudent).filter((arr) => arr.some(pred)).length;
    const down2 = d.totals.filter((x) => x.level <= -2).length;
    const high = d.totals.filter((x) => x.entryGrade <= 3 && x.level <= -1).length;
    const subDown2 = anySub((x) => x.level <= -2);
    const subDown4 = anySub((x) => x.level <= -4);
    const up2 = d.totals.filter((x) => x.level >= 2).length;
    const frontUp = d.totals.filter((x) => x.entryGrade <= 3 && x.status === '进步').length;
    const backUp = d.totals.filter((x) => x.entryGrade >= 7 && x.status === '进步').length;
    const subUp2 = anySub((x) => x.level >= 2);
    const subUp4 = anySub((x) => x.level >= 4);
    const tagRows = [
      { dir: '负向', tag: '总分掉2档以上', n: down2, def: '总分入口档 − 评价档 ≥ 2' },
      { dir: '负向', tag: '入口靠前但退步', n: high, def: '入口 G1–G3 且下降 ≥ 1 档' },
      { dir: '负向', tag: '单科掉2档以上', n: subDown2, def: '任一科等级下降 ≥ 2 档' },
      { dir: '负向', tag: '单科掉4档以上', n: subDown4, def: '任一科等级下降 ≥ 4 档' },
      { dir: '正向', tag: '总分升2档以上', n: up2, def: '评价档 − 入口档 ≥ 2' },
      { dir: '正向', tag: '入口前段进步', n: frontUp, def: '入口 G1–G3 且进步' },
      { dir: '正向', tag: '入口后段进步', n: backUp, def: '入口 G7–G9 且进步' },
      { dir: '正向', tag: '单科升2档以上', n: subUp2, def: '任一科等级上升 ≥ 2 档' },
      { dir: '正向', tag: '单科升4档以上', n: subUp4, def: '任一科等级上升 ≥ 4 档' }
    ];
    const up2List = d.totals.filter((x) => x.level >= 2).sort((a, b) => b.zDiff - a.zDiff);
    const negList = d.risk.risk.slice().sort((a, b) => a.zDiff - b.zDiff);
    const top = topStudentStats(r, d);
    const topFlowRows = [
      { label: '保持：G1–G2 → G1–G2', n: top.retain, kind: '保持' },
      ...Object.keys(top.dest).sort((a, b) => Number(a) - Number(b)).map((g) => ({ label: `掉出：G1–G2 → G${g}`, n: top.dest[g], kind: '掉出' })),
      { label: '新进：G3+ → G1–G2', n: top.in, kind: '新进' }
    ];
    const good = [`进步 ${c.progress} 人（${pct1(c.progress / d.school.n)}）、保持 ${c.keep} 人（${pct1(c.keep / d.school.n)}）；正向标签中总分升2档 ${up2} 人、单科升4档 ${subUp4} 人。`];
    const bad = [`退步 ${c.decline} 人（${pct1(c.decline / d.school.n)}）；优先跟进 ${c.risk} 人（${pct1(c.risk / d.school.n)}）。`, `其中入口靠前但退步 ${high} 人、单科掉4档以上 ${subDown4} 人。`];
    const neutral = [`标签按全员统计，同一学生可命中多个；${c.risk} 人是负向标签并集，不等于表内相加。`];
    const body = `${kpiGrid([
      { label: '优先跟进', value: c.risk + ' 人', sub: pct1(c.risk / d.school.n) + ' · 负向标签并集', tone: 'neg' },
      { label: '总分掉2档', value: down2 + ' 人', sub: '入口→评价 ≥2 档' },
      { label: '总分升2档', value: up2 + ' 人', sub: '评价→入口 ≥2 档', tone: 'pos' },
      { label: '单科升4档', value: subUp4 + ' 人', sub: '任一科 ≥4 档', tone: 'pos' }
    ])}
    <div class="an-card mt-16"><h4>变化标签（全员口径）</h4>${UI.table({
      columns: [
        { key: 'dir', label: '方向', render: (x) => `<span class="an-badge ${x.dir === '正向' ? 'blue' : 'gray'}">${x.dir}</span>` },
        { key: 'tag', label: '标签' }, { key: 'n', label: '人数', align: 'num' }, { key: 'def', label: '定义' }
      ],
      rows: tagRows
    })}${note('负向/正向标签均按全员统计，分母 748；同一学生可同时命中正负标签；KPI 的“优先跟进 181”是负向标签并集，不是表内相加。完整学生清单见附录 A5。')}</div>
    <div class="an-card mt-16"><h4>负向样本：优先跟进（${negList.length} 人）</h4>${tagMatrixTable(negList, { zKey: 'zDiff', zLabel: '总分 ΔZ' })}${note('本表是负向子集，按 ΔZ 从低到高排；标签矩阵同时保留正负标签，同一学生可同时命中。完整 748 人清单见附录 A5。')}</div>
    <div class="an-card mt-16"><h4>正向样本：总分升2档以上（${up2} 人）</h4>${tagMatrixTable(up2List, { zKey: 'zDiff', zLabel: '总分 ΔZ' })}${note('本表是正向子集，列总分升2档以上的全部学生；标签矩阵同时保留正负标签。完整学生清单见附录 A5。')}</div>
    <div class="an-card mt-16"><h4>尖子生池监控（入口 G1–G2）</h4>${kpiGrid([
      { label: '入口尖子', value: top.n + ' 人', sub: '入口 G1–G2 · 固定 cohort' },
      { label: '当前尖子', value: top.current + ' 人', sub: `净变化 ${sgn(top.current - top.n)} 人` },
      { label: '留存率', value: pct1(top.retain / top.n), sub: `${top.retain} / ${top.n}` },
      { label: '掉出 / 新进', value: `${top.out} / ${top.in}`, sub: '掉出 G3+ / 新进 G1–G2' }
    ])}
    <div class="an-grid-2 mt-12">
      <div><h4>入口 → 当前流向</h4>${UI.table({ columns: [{ key: 'label', label: '流向' }, { key: 'n', label: '人数', align: 'num' }], rows: topFlowRows })}</div>
      <div><h4>班级集中</h4>${UI.table({ columns: [
        { key: 'className', label: '班级' }, { key: 'n', label: '入口尖子', align: 'num' },
        { key: 'out', label: '掉出', align: 'num' }, { key: 'in', label: '新增', align: 'num' },
        { key: 'mean', label: '平均 ΔZ', align: 'num', render: (x) => x.mean == null ? '—' : sgn(f2(x.mean)) }
      ], rows: top.classRows.concat([{ className: '整体汇总', n: top.n, out: top.out, in: top.in, mean: top.mean, isTotal: true }]), rowClass: (x) => x.isTotal ? 'an-total-row' : '' })}<div class="an-note">入口尖子/掉出按入口班；新增按当前班；平均 ΔZ 为入口尖子 cohort，n=0 时记“—”。</div></div>
    </div>
    <div class="an-grid-2 mt-12">
      <div><h4>学科短板（按平均 ΔZ）</h4>${UI.table({ columns: [
        { key: 'subject', label: '学科' }, { key: 'n', label: '尖子人数', align: 'num' },
        { key: 'mean', label: '平均 ΔZ', align: 'num', render: (x) => sgn(f2(x.mean)) },
        { key: 'low', label: '当前≤G4', align: 'num' }
      ], rows: top.subRows.slice(0, 3) })}</div>
      <div class="an-note">尖子生平均 ΔZ ${sgn(f2(top.mean))}；退步 ${top.status.decline}、保持 ${top.status.keep}、进步 ${top.status.progress}。本次触发预警 ${top.warn} 人（任一科当前≤G4 或 ΔZ<−0.25）；本次为单次快照，“连续两次”规则从下一次考试开始累计；不公开排名。</div>
    </div>
    </div>
    <div class="an-card mt-16"><h4>入口段 × 进步 / 退步</h4>${bandTable(d)}${note('同一段两行：进步与退步；“相差”=段内占比−同段基准；前段人数少，需结合绝对人数看，不能只看比例。')}</div>
    ${interp(good, bad, neutral)}
    ${whyBlock('追问：为什么有这么多“优先跟进”？', [
      `基线效应：退步面本身有约 31.7% 的基线；${pct1(c.decline / d.school.n)} 的退步里，一部分是阈值口径，不是新增的下降。`,
      `集中度：${c.risk} 人中，${high} 人属于入口靠前但退步；这批人更值得优先谈。`,
      `学科集中：单科掉2档以上 ${subDown2} 人（全员），与 D1 的低于基准的学科一致。`
    ])}
    ${boundary('学生标签是规则判定，不是诊断；缺考、转科、班级重组都可能影响标签。完整名单见附录 A5。')}
    ${actionBlock([
      { title: '先谈入口靠前退步', text: `${high} 人优先；按班级拆分，每次谈话只定 1 个目标。` },
      { title: '再看尖子掉出', text: `${top.out} 人掉出 G1–G2，先看数学/政治/历史短板；不把一次掉档当结论。` },
      { title: '复查', text: '两周后只复查优先跟进标签人数与名单，不追求“全部清零”。' }
    ])}`;
    return chapter('D4', 'an-d4', '分项 · 学生', '哪些学生需要跟进？哪些在进步？尖子生是否保持？', body, '明细见附录');
  }

  /* ---------- E 差异与关联 ---------- */
  function chapterE(task, r, d) {
    const top = d.bands[0], mid = d.bands[1], low = d.bands[2];
    const validClasses = d.classes.filter((x) => x.n >= 8);
    const lowClass = validClasses.slice().sort((a, b) => a.mean - b.mean)[0];
    const posClasses = validClasses.slice().sort((a, b) => b.mean - a.mean).slice(0, 2);
    const dirHigh = d.direction.slice().sort((a, b) => b.declineRatio - a.declineRatio)[0];
    const dirLow = d.direction.slice().sort((a, b) => a.declineRatio - b.declineRatio)[0];
    const lowSubs = d.subjectRows.slice().sort((a, b) => a.mean - b.mean).slice(0, 3);
    const good = [
      `${posClasses.map((x) => esc(x.name)).join('、') || '正向班'}等正向样本说明班级层面有可复制空间。`,
      `入口后段进步率 ${pct1(low.progressRate)}，与同段基准 ${pct1(low.progressBase)} 接近。`
    ];
    const bad = [`入口前段退步率 ${pct1(top.rate)}，比同段基准 ${pct1(top.base)} 高 ${f2(top.excess * 100)}pp；同段进步率 ${pct1(top.progressRate)}，比基准低 ${f2(Math.abs(top.progressExcess) * 100)}pp。`];
    if (dirHigh && dirLow && dirHigh.sel !== dirLow.sel) bad.push(`${esc(dirHigh.sel)}退步面 ${pct1(dirHigh.declineRatio)}，高于${esc(dirLow.sel)} ${pct1(dirLow.declineRatio)}。`);
    const neutral = [`入口后段 ${pct1(low.rate)} vs ${pct1(low.base)}，差距 ${f2(low.excess * 100)}pp，相对小。`];
    const body = `${kpiGrid([
      { label: '入口前段', value: pct1(top.rate), sub: `同段基准 ${pct1(top.base)} · 高 ${f2(top.excess * 100)}pp`, tone: 'neg' },
      { label: '入口中段', value: pct1(mid.rate), sub: `同段基准 ${pct1(mid.base)} · 高 ${f2(mid.excess * 100)}pp` },
      { label: '入口后段', value: pct1(low.rate), sub: `同段基准 ${pct1(low.base)} · 高 ${f2(low.excess * 100)}pp` },
      { label: '班级相关', value: d.classCorr == null ? '—' : f2(d.classCorr), sub: '学业实力 × 平均 ΔZ' }
    ])}
    <div class="an-grid-2 mt-16">
      <div class="an-card"><h4>入口段 × 进步差</h4>${bars(d.bands.map((b) => ({ label: b.key === 'G1-G3' ? '前段' : b.key === 'G4-G6' ? '中段' : '后段', value: b.progressExcess * 100 })), { pp: true })}${note('正值=进步率高于同段基准（绿），负值=低于基准（红）；同段基准来自其他三校入口相近学生。')}</div>
      <div class="an-card"><h4>入口段 × 退步差</h4>${bars(d.bands.map((b) => ({ label: b.key === 'G1-G3' ? '前段' : b.key === 'G4-G6' ? '中段' : '后段', value: b.excess * 100 })), { pp: true, invert: true })}${note('正值=退步率高于同段基准（红），负值=低于基准（绿）；两张图共用前/中/后段划分。')}</div>
    </div>
    <div class="an-card mt-16"><h4>入口段 × 进步 / 退步</h4>${bandTable(d)}${note('同一段两行：进步与退步；“相差”=段内占比−同段基准；前段人数少，需结合人数看。')}</div>
    <div class="an-card mt-16"><h4>物理 / 历史方向</h4>${directionTable(d)}</div>
    <div class="an-card mt-16"><h4>班级 × 学科：单科掉2档以上人数（全部学生）</h4>${matrixTable(d)}${note('行是班级、列是学科；数字是人次，同一学生多科会计多次；空白为 0；最后一行为各科列合计（人次）。')}</div>
    <div class="an-card mt-16"><h4>班级 × 学科：单科升2档以上人数（全部学生）</h4>${matrixTable(d, d.progressMatrix)}${note('与上方掉档表同口径；数字为人次，同一学生多科会计多次；最后一行为各科列合计（人次）。')}</div>
    ${interp(good, bad, neutral)}
    ${whyBlock('追问：差异是结构还是教学？', [
      `入口结构：前段退步率高、进步率低，但前段人数少；同段基准已经扣除了“入口不同”，剩余 ${f2(top.excess * 100)}pp 才是退步超额。`,
      `${dirHigh ? `${esc(dirHigh.sel)} ${pct1(dirHigh.declineRatio)} vs ${dirLow ? esc(dirLow.sel) + ' ' + pct1(dirLow.declineRatio) : '—'}` : '方向差异'}；选科结构会放大某几科的差异。`,
      `班级集中：${lowClass ? esc(lowClass.name) : '低于基准的班'}与 ${lowSubs.map((x) => esc(x.subject)).join('、')} 高度重合；这更像“班×科”集中，而不是全校普遍现象。`,
      `相关不等于因果：班级实力与平均 ΔZ 相关 ${d.classCorr == null ? '—' : f2(d.classCorr)}，只能说明“强班更容易出现低 ΔZ”，不能说明原因。`
    ])}
    ${boundary('同段基准来自其他学校入口相近学生；样本、命题、赋分不同，跨校比较只能作方向参考；多重比较下，个别班/科的极端值可能是噪声。')}
    ${actionBlock([
      { title: '按“班×科”定位', text: `优先${lowClass ? esc(lowClass.name) : '低于基准的班'}×${lowSubs.map((x) => esc(x.subject)).join('/')}；再看其他班/科。` },
      { title: '按入口段分流', text: '前段重谈，后段重基础；不要把前段的高退步率简单归因于教学。' },
      { title: '复查', text: `两周后看前段退步率、低于基准的班${lowSubs.length ? lowSubs[0].subject : ''}掉档人数${dirHigh ? '、' + esc(dirHigh.sel) + '退步面' : ''}。` }
    ])}`;
    return chapter('E', 'an-e', '差异与关联', '差异在均值、入口段，还是班×科？什么与好坏同向？', body, '同段基准');
  }

  /* ---------- F 追问与行动 ---------- */
  function chapterF(task, r, d) {
    const validClasses = d.classes.filter((x) => x.n >= 8);
    const topClass = validClasses.slice().sort((a, b) => b.mean - a.mean)[0];
    const lowClass = validClasses.slice().sort((a, b) => a.mean - b.mean)[0];
    const topSubs = d.subjectRows.slice().sort((a, b) => b.mean - a.mean);
    const lowSubs = d.subjectRows.slice().sort((a, b) => a.mean - b.mean);
    const topSub = topSubs[0];
    const c8 = d.classes.find((x) => x.name === '高三8班');
    const good = [];
    if (topSub) good.push(`<b>${esc(topSub.subject)}</b>：平均 ΔZ ${sgn(f2(topSub.mean))}、相对进步率 ${f2(topSub.rate)}。`);
    if (topClass) good.push(`<b>${esc(topClass.name)}</b>：平均 ΔZ ${sgn(f2(topClass.mean))}、退步面 ${pct1(topClass.declineRatio)}。`);
    good.push(`<b>进步 ${d.risk.counts.progress} 人</b>（${pct1(d.risk.counts.progress / d.school.n)}），说明不是全校性下滑。`);
    const bad = [
      `<b>${esc(d.school.schoolName)}整体</b>：平均 ΔZ ${sgn(f2(d.schoolD.mean))}，退步面 ${pct1(d.risk.counts.decline / d.school.n)}；幅度不大，但方向为负。`
    ];
    if (lowClass) bad.push(`<b>${esc(lowClass.name)}</b>：平均 ΔZ ${sgn(f2(lowClass.mean))}，退步面 ${pct1(lowClass.declineRatio)}。`);
    if (lowSubs.length) bad.push(`<b>${lowSubs.slice(0, 3).map((x) => esc(x.subject)).join(' / ')}</b>：${lowSubs.slice(0, 3).map((x) => sgn(f2(x.mean))).join(' / ')}，低于学科基准。`);
    const neutral = [];
    const en = d.subjectRows.find((x) => x.subject === '英语');
    if (en) neutral.push(`<b>英语</b>：平均 ΔZ ${sgn(f2(en.mean))}，相对进步率 ${f2(en.rate)}；两个镜头${(en.rate >= 1) !== (en.mean >= 0) ? '方向不一致' : '方向一致'}。`);
    if (c8) neutral.push(`<b>${esc(c8.name)}</b>：相对进步率 ${f2(c8.rate)}，平均 ΔZ ${sgn(f2(c8.mean))}；不是简单的高低。`);
    else neutral.push('<b>指标分歧</b>：相对进步率与平均 ΔZ 方向不一致的班/科，需要同时看。');
    const schoolTarget = d.school.rate < 0.95 ? 0.95 : 1.0;
    const schoolSim = AM.simulateToTarget(d.totals, schoolTarget, r.weights);
    const classTarget = lowClass ? (lowClass.rate < 0.4 ? 0.4 : lowClass.rate < 0.6 ? 0.6 : 0.8) : null;
    const classSim = lowClass ? AM.simulateToTarget(d.totals.filter((x) => x.classId === lowClass.id), classTarget, r.weights) : null;
    const subSims = lowClass ? lowSubs.slice(0, 3).map((s) => {
      const g = (r.classEval[s.subject] || []).find((c) => c.schoolId === d.schoolId && c.id === lowClass.id);
      const current = g ? g.rate : null;
      const target = current == null ? null : current < 0.4 ? 0.4 : current < 0.6 ? 0.6 : current < 0.8 ? 0.8 : 0.9;
      const rows = r.rows.filter((x) => x.schoolId === d.schoolId && x.classId === lowClass.id && x.subject === s.subject);
      return { subject: s.subject, current, target, sim: AM.simulateToTarget(rows, target, r.weights) };
    }) : [];
    const sims = [];
    if (schoolSim) sims.push({ label: '全校总分', sim: schoolSim });
    if (lowClass && classSim) sims.push({ label: `${lowClass.name}总分`, sim: classSim });
    subSims.forEach((s) => { if (s.sim) sims.push({ label: `${lowClass ? lowClass.name : ''}${s.subject}`, sim: s.sim }); });
    const simTable = `<div class="an-card mt-16"><h4>目标反推：从当前 rate 到目标，需要多少人回保持</h4>${UI.table({
      columns: [
        { key: 'label', label: '对象', render: (x) => `<b>${esc(x.label)}</b>` },
        { key: 'current', label: '当前 rate', align: 'num', render: (x) => f2(x.sim.current) },
        { key: 'target', label: '目标', align: 'num', render: (x) => f2(x.sim.target) },
        { key: 'need', label: '需要回保持', align: 'num', render: (x) => x.sim.need == null ? '不可达' : x.sim.need === 0 ? '已达标' : `${x.sim.need} 人` },
        { key: 'level1', label: '现有掉1档', align: 'num', render: (x) => `${x.sim.level1} 人` },
        { key: 'why', label: '说明', render: (x) => x.sim.need == null ? '目标过高' : x.sim.need <= x.sim.level1 ? '从掉1档中选' : '先抓掉1档，再从掉2档补' }
      ],
      rows: sims
    })}${note('换算逻辑：把当前“退步”中最浅的学生逐个改为“保持”，其他条件不变；这是定目标的换算，不是承诺或预测。')}</div>`;
    const focusName = lowClass ? lowClass.name : '低于基准的班';
    const classNeed = classSim ? classSim.need : null;
    const subNeedText = subSims.map((s) => `${esc(s.subject)} ${s.sim && s.sim.need != null ? s.sim.need : '—'}`).join('、');
    const protocol = `<div class="an-card mt-16"><h4>两周执行协议（D0=今天）</h4>${UI.table({
      columns: [
        { key: 't', label: '时间' }, { key: 'a', label: '动作' }, { key: 'o', label: '负责人' }, { key: 'out', label: '产出/验收' }
      ],
      rows: [
        { t: 'D0–D2', a: `按目标反推表锁定名单：${focusName}总分 ${classNeed == null ? '—' : classNeed} 人；${subNeedText}；同一学生多科只算一次谈话。`, o: '班主任 + 科任', out: '名单 + 缺课/转科标记' },
        { t: 'D+3', a: '10 题小测：每科 5 基础 + 3 审题 + 2 时间；错因分四类（基础/审题/时间/缺课），备课组统一评分。', o: '备课组长', out: '10 题小测 + 错因表' },
        { t: 'D+4–D+10', a: '每科 2 次分层课/作业；班主任每 3 天 5 分钟谈话；缺课学生转年级处理。', o: '科任 + 班主任', out: '2 次课/作业记录 + 谈话记录' },
        { t: 'D+14', a: `同结构小测/月考；看回保持人数、平均 ΔZ、rate；${focusName} 目标 rate ${lowClass ? f2(lowClass.rate) : '—'} → ${classTarget == null ? '—' : f2(classTarget)}。`, o: '年级主任', out: '复查表 + 是否调整' }
      ]
    })}${note('验收：回保持人数 ≥ 目标人数的 50% 为“有效”，<50% 换方法；缺课优先处理；不以一次考试定论。工具：名单、10 题小测、错因表、缺勤表。')}</div>`;
    const body = `<div class="an-grid-2">
      <div class="an-card"><h4>好的：可复制什么</h4><ul class="an-list">${good.map((x) => `<li>${x}</li>`).join('')}</ul></div>
      <div class="an-card"><h4>低于基准的：先核对什么</h4><ul class="an-list">${bad.map((x) => `<li>${x}</li>`).join('')}</ul></div>
    </div>
    <div class="an-card mt-16"><h4>需要继续观察的</h4><ul class="an-list">${neutral.map((x) => `<li>${x}</li>`).join('')}</ul></div>
    ${whyBlock('追问：为什么高、为什么低？（候选，待验证）', [
      `<b>为什么 ${topSub ? esc(topSub.subject) : '正向学科'}/${topClass ? esc(topClass.name) : '正向班'} 好</b>：可能是备课组统一、作业分层、班级管理稳定；需要看课堂、作业、错题，才能确认可复制。`,
      `<b>为什么 ${lowClass ? esc(lowClass.name) : '低于基准的班'}/${lowSubs.slice(0, 3).map((x) => esc(x.subject)).join('、')} 偏低</b>：入口结构（强班天花板）、班级重组、学科适配、任课组合都可能是候选；同一位老师在其他班更好，不能直接归因教师。`,
      `<b>为什么整体只是小幅下移</b>：平均 ΔZ ${sgn(f2(d.schoolD.mean))}，约 ${f2(Math.abs(d.schoolD.mean) / d.global.sd)} SD；不是全面崩塌，更像“少数班×科 + 指标基线”的叠加。`
    ])}
    ${simTable}
    ${protocol}
    ${boundary('以上“为什么”都是候选：分数数据不能证明课堂行为、作业质量、家庭因素；要确认，需要题目级得分、听课、作业、访谈、缺课与分班规则。目标反推也不等于因果承诺。')}
    ${note('下一步要补的数据：题目级得分/失分类型、作业与周测、缺课/请假、教师任课历史、分班规则、课堂观察。没有这些，报告最多到 L2。')}`;
    return chapter('F', 'an-f', '追问与行动', '高在哪里、低在哪里，各自为什么？先做什么？', body, '双向解读');
  }

  /* ---------- 附录 ---------- */
  function appendix(task, r, d) {
    const quality = [
      ['参评人数', d.school.n],
      ['联考样本', r.quality.sample],
      ['剔除', r.quality.excluded],
      ['部分缺考', r.quality.partialAbsentExcluded || 0],
      ['回退科目', (r.quality.fallbackSubjects || []).join('、') || '无'],
      ['班级重组', pct1(AM.classRecomposition(d.totals).ratio)],
      ['结果版本', task.resultVersion || '—']
    ];
    const metricRows = [
      ['平均 ΔZ', '学生 ΔZ 的均值', '0', '受极端值影响'],
      ['学业实力', '评价档按 90→10 加权平均', '联考均值', '不是增值'],
      ['退步面', '退步人数 ÷ 参评人数', '31.7%', '阈值敏感'],
      ['相对进步率', '（保持+进步×2）÷（（退步+1）×1.5）', '1.0', '无上界'],
      ['等级迁移', '入口 G→评价 G 人数', '入口结构', '相对位置'],
      ['风险标签', '四类规则标签', '规则阈值', '重叠、不可相加']
    ];
    return `<section class="an-chapter an-appendix" id="an-appendix">
      <header class="an-chapter-head"><div class="an-chapter-letter">附</div><div class="an-chapter-copy"><div class="an-chapter-kicker">APPENDIX</div><h2>附录 · 全量数据与口径</h2><p>正文已展开的表不重复；这里放完整单位表、学生明细、质量与字典。</p></div><span class="an-chapter-tag">全量</span></header>
      <div class="an-chapter-body">
        <div class="an-card"><h4>A1 四校总表</h4>${schoolTable(r, d)}</div>
        <div class="an-card mt-16"><h4>A2 学科全表</h4>${subjectTable(d)}</div>
        <div class="an-card mt-16"><h4>A3 班级全表（含学业实力与班级号变化）</h4>${classTable(d, true)}</div>
        <div class="an-card mt-16"><h4>A4 教师全表（参与评价 ${d.teachers.reduce((a, g) => a + g.teachers.length, 0)} 人）</h4><div class="an-scroll an-scroll-lg">${teacherTable(d)}</div>${note('本校教师 ' + (window.MOCK.teachers || []).filter((t) => t.schoolId === d.schoolId).length + ' 人；未标注学科的教师不进入本科统计。')}</div>
        <div class="an-card mt-16"><h4>A5 学生全表（${d.school.n} 人，含正向 / 负向标签）</h4><div class="an-card-head-row"><span class="weak small">按班级、学号排序；负向/正向标签可同时命中，不代表诊断。</span><button class="btn btn-xs" data-action="exportAnalysisStudents">导出 CSV</button></div><div class="an-print-hide"><div class="an-scroll an-scroll-xl">${studentTable(d)}</div></div><div class="an-print-note">打印版不含 ${d.school.n} 行学生明细；请用“导出 CSV”获取全量。</div></div>
        <div class="an-card mt-16"><h4>A6 数据质量</h4>${UI.table({ columns: [{ key: 'k', label: '项目' }, { key: 'v', label: '数值' }], rows: quality.map((x) => ({ k: x[0], v: x[1] })) })}</div>
        <div class="an-card mt-16"><h4>A7 指标字典</h4>${UI.table({ columns: [{ key: 'k', label: '指标' }, { key: 'd', label: '定义' }, { key: 'b', label: '基准' }, { key: 'r', label: '注意' }], rows: metricRows.map((x) => ({ k: x[0], d: x[1], b: x[2], r: x[3] })) })}</div>
      </div>
    </section>`;
  }

  /* ---------- 占位：其余角色 ---------- */
  function placeholderPage(task, role) { return placeholder(task, role); }
})();




