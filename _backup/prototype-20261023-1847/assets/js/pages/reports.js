/* 增值评价报告页 v3.2 · 角色化报告 */
(function () {
  'use strict';
  const App = window.App;
  const UI = window.UI;

  const ROLES = [
    {
      key: 'region', label: '区域/联考', icon: 'chart', title: '区域增值总报告',
      reader: '教育局 · 联考组织方', question: '四校格局如何、共性问题在哪',
      points: ['四校实力 × 增值矩阵', '九科增值热力', '学校分述与区域建议']
    },
    {
      key: 'principal', label: '校长', icon: 'school', title: '学校增值报告',
      reader: '校长 · 学校管理员', question: '本校位置与增值是否匹配、哪块拖后腿',
      points: ['本校在联考中的位置', '班级四象限', '学科短板与风险班级']
    },
    {
      key: 'grade', label: '年级主任', icon: 'layers', title: '年级增值报告',
      reader: '年级主任 · 教务处', question: '哪些班分化、哪些科要介入',
      points: ['班级增值分布', '班级全表', '学科结构']
    },
    {
      key: 'homeroom', label: '班主任', icon: 'users', title: '班级增值报告',
      reader: '班主任', question: '我班谁进步谁退步、哪科弱',
      points: ['班级指标卡', '学生级数分布', '进退步名单']
    },
    {
      key: 'teacher', label: '科任教师', icon: 'book', title: '教师教学增值报告',
      reader: '科任教师 · 教研组长', question: '我教的班本科目加工得怎样',
      points: ['任教班与人数', '同科位置', '学生名单']
    },
    {
      key: 'student', label: '学生', icon: 'target', title: '学生个人增值报告',
      reader: '学生 · 家长', question: '我升了还是降了、哪科拖累',
      points: ['总分等级变化', '六科 Δz', '单科建议']
    }
  ];

  /* ---------- 基础工具 ---------- */
  const esc = App.esc;
  const f1 = (v) => (v == null || isNaN(v)) ? '—' : Number(v).toFixed(1);
  const f2 = (v) => (v == null || isNaN(v)) ? '—' : Number(v).toFixed(2);
  const pct = (v) => (v == null || isNaN(v)) ? '—' : Math.round(v * 100) + '%';
  const pct1 = (v) => (v == null || isNaN(v)) ? '—' : (Number(v) * 100).toFixed(1) + '%';
  const sgn = (v) => (v == null || isNaN(v)) ? '—' : (v > 0 ? '+' + v : String(v));
  const mean = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  function subjectsOf(r) {
    return Object.keys(r.schoolEval || {}).filter((s) => s !== '总分' && (r.schoolEval[s] || []).length);
  }
  function schoolRow(r, id) {
    return (r.schoolEval['总分'] || []).find((g) => g.schoolId === id) || null;
  }
  function classList(r, schoolId) {
    return (r.classEval['总分'] || []).filter((g) => g.schoolId === schoolId);
  }
  function classRow(r, schoolId, classId) {
    return classList(r, schoolId).find((g) => g.id === classId) || null;
  }
  function classSubject(r, schoolId, classId, subject) {
    return (r.classEval[subject] || []).find((g) => g.schoolId === schoolId && g.id === classId) || null;
  }
  function teacherList(r, schoolId, subject) {
    return (r.teacherEval[subject] || []).filter((g) => g.schoolId === schoolId);
  }
  function studentTotals(r, schoolId, classId) {
    return r.totals.filter((x) => x.schoolId === schoolId && (!classId || x.classId === classId));
  }
  function subjectRowsOf(r, studentId) {
    return r.rows.filter((x) => x.studentId === studentId && x.subject !== '总分');
  }
  function counts(rows) {
    const c = { n: rows.length, progress: 0, keep: 0, decline: 0 };
    rows.forEach((x) => {
      if (x.status === '进步') c.progress++;
      else if (x.status === '保持') c.keep++;
      else c.decline++;
    });
    c.progressRatio = c.n ? c.progress / c.n : 0;
    c.keepRatio = c.n ? c.keep / c.n : 0;
    c.declineRatio = c.n ? c.decline / c.n : 0;
    return c;
  }
  function rankedClasses(r, schoolId) {
    return classList(r, schoolId).filter((g) => g.n >= r.smallSample).slice().sort((a, b) => b.rate - a.rate);
  }
  function rankedSubjects(r, schoolId) {
    const all = subjectsOf(r).map((sub) => {
      const g = (r.schoolEval[sub] || []).find((x) => x.schoolId === schoolId);
      return g ? Object.assign({}, g, { subject: sub }) : null;
    }).filter(Boolean);
    const valid = all.filter((g) => g.n >= 8);
    return (valid.length ? valid : all).slice().sort((a, b) => b.rate - a.rate);
  }
  function judgeOf(g) {
    const s = g.strengthRank, rk = g.rateRank;
    if (s <= 2 && rk <= 2) return { label: '双高', tone: 'green', text: '实力与增值都处于前列' };
    if (s <= 2 && rk > 2) return { label: '高位承压', tone: 'amber', text: '入口实力靠前，但增值没有同步' };
    if (s > 2 && rk <= 2) return { label: '低进高出', tone: 'blue', text: '入口实力靠后，但增值靠前' };
    if (s === 3 && rk === 4) return { label: '中位承压', tone: 'amber', text: '实力处于中游，但增值靠后' };
    return { label: '相对靠后', tone: 'red', text: '相对四校，实力与增值都靠后' };
  }

  /* ---------- 默认对象 ---------- */
  function defaultSchool(r) {
    if (!App.canEdit()) return App.state.schoolId;
    const ids = (r.schoolEval['总分'] || []).map((g) => g.schoolId);
    const saved = App.state.reportSchoolId;
    if (saved && ids.includes(saved)) return saved;
    return ids.includes('S01') ? 'S01' : (ids[0] || App.state.schoolId);
  }
  function defaultClass(r, schoolId) {
    const list = classList(r, schoolId);
    const saved = App.state.reportClassId;
    if (saved && list.some((c) => c.id === saved)) return saved;
    const valid = list.filter((c) => c.n >= r.smallSample).sort((a, b) => a.rate - b.rate);
    return (valid[0] || list[0] || {}).id || '';
  }
  function defaultSubject(r, schoolId) {
    const saved = App.state.reportSubject;
    if (saved && teacherList(r, schoolId, saved).length) return saved;
    const subs = subjectsOf(r).filter((s) => teacherList(r, schoolId, s).length);
    return subs.includes('数学') ? '数学' : (subs[0] || '语文');
  }
  function defaultTeacher(r, schoolId, subject) {
    const list = teacherList(r, schoolId, subject);
    const saved = App.state.reportTeacherId;
    if (saved && list.some((t) => t.id === saved)) return saved;
    const sorted = list.slice().sort((a, b) => b.n - a.n);
    return (sorted[0] || {}).id || '';
  }
  function defaultStudent(r, schoolId, classId) {
    const list = studentTotals(r, schoolId, classId);
    const saved = App.state.reportStudentId;
    if (saved && list.some((x) => x.studentId === saved)) return saved;
    const statusMap = {};
    r.rows.forEach((x) => {
      if (x.subject !== '总分') (statusMap[x.studentId] || (statusMap[x.studentId] = [])).push(x.status);
    });
    let best = list[0], bestScore = -Infinity;
    list.forEach((t) => {
      const st = statusMap[t.studentId] || [];
      const mixed = st.filter((s) => s !== t.status).length;
      let score = mixed * 2;
      if (t.status === '保持') score += 3;
      score -= Math.abs(t.zDiff || 0);
      if (score > bestScore) { bestScore = score; best = t; }
    });
    return best ? best.studentId : '';
  }

  /* ---------- 图表 ---------- */
  function ticks(a, b, n) {
    const out = [];
    const step = (b - a) / n;
    for (let i = 0; i <= n; i++) out.push(a + step * i);
    return out;
  }
  function scatter(points, opts) {
    opts = opts || {};
    if (!points.length) return `<div class="empty">暂无数据</div>`;
    const W = 760, H = 340, L = 56, R = 30, T = 22, B = 48;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    let x0 = Math.min(...xs), x1 = Math.max(...xs);
    const xPad = Math.max(1.5, (x1 - x0) * 0.16);
    x0 -= xPad; x1 += xPad;
    let y0 = Math.min(...ys, 1), y1 = Math.max(...ys, 1);
    const yPad = Math.max(0.25, (y1 - y0) * 0.2);
    y0 = Math.max(0, y0 - yPad); y1 += yPad;
    const X = (v) => L + ((v - x0) / (x1 - x0)) * (W - L - R);
    const Y = (v) => H - B - ((v - y0) / (y1 - y0)) * (H - T - B);
    const xt = ticks(x0, x1, 5);
    const yt = ticks(y0, y1, 4);
    const grid = xt.map((v) => `<line class="grid" x1="${X(v).toFixed(1)}" y1="${T}" x2="${X(v).toFixed(1)}" y2="${H - B}"/><text class="axis-label" x="${X(v).toFixed(1)}" y="${H - B + 17}" text-anchor="middle">${v.toFixed(v >= 10 ? 0 : 1)}</text>`).join('')
      + yt.map((v) => `<line class="grid" x1="${L}" y1="${Y(v).toFixed(1)}" x2="${W - R}" y2="${Y(v).toFixed(1)}"/><text class="axis-label" x="${L - 9}" y="${Y(v).toFixed(1) + 3}" text-anchor="end">${v.toFixed(1)}</text>`).join('');
    const refs = (opts.refX != null ? `<line class="ref" x1="${X(opts.refX).toFixed(1)}" y1="${T}" x2="${X(opts.refX).toFixed(1)}" y2="${H - B}"/>` : '')
      + (opts.refY != null ? `<line class="ref" x1="${L}" y1="${Y(opts.refY).toFixed(1)}" x2="${W - R}" y2="${Y(opts.refY).toFixed(1)}"/>` : '');
    const pts = points.map((p) => {
      const cx = X(p.x), cy = Y(p.y);
      const rad = Math.max(6, Math.min(13, 5 + Math.sqrt(p.size || 100) / 6));
      const color = p.color || (p.y >= 1 ? '#0a66ff' : '#ef4444');
      const anchor = cx > W - R - 110 ? 'end' : 'start';
      const tx = anchor === 'end' ? cx - rad - 7 : cx + rad + 7;
      const ty = Math.max(T + 12, Math.min(H - B - 12, cy - 4));
      return `<g class="pt">
        <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rad.toFixed(1)}" fill="${color}" fill-opacity=".88" stroke="#fff" stroke-width="2"><title>${esc(p.title || (p.label + '：' + f2(p.y)))}</title></circle>
        ${p.label ? `<text class="pt-label" x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anchor}">${esc(p.label)}</text>` : ''}
        ${p.sub ? `<text class="pt-sub" x="${tx.toFixed(1)}" y="${(ty + 14).toFixed(1)}" text-anchor="${anchor}">${esc(p.sub)}</text>` : ''}
      </g>`;
    }).join('');
    return `<svg class="r-chart" viewBox="0 0 ${W} ${H}" role="img">
      ${grid}${refs}${pts}
      <text class="axis-title" x="${(L + W - R) / 2}" y="${H - 8}" text-anchor="middle">${esc(opts.xLabel || '学业实力')}</text>
      <text class="axis-title" x="14" y="${(T + H - B) / 2}" text-anchor="middle" transform="rotate(-90 14 ${(T + H - B) / 2})">${esc(opts.yLabel || '相对进步率')}</text>
    </svg>`;
  }

  function bars(rows, opts) {
    opts = opts || {};
    if (!rows.length) return `<div class="empty">暂无数据</div>`;
    const ref = opts.ref == null ? 1 : opts.ref;
    const max = Math.max(ref * 1.2, ...rows.map((r) => r.value)) * 1.05;
    return `<div class="r-bars">${rows.map((r) => {
      const tone = r.tone || (r.value >= ref ? 'good' : 'bad');
      const width = Math.max(1.5, Math.min(100, (r.value / max) * 100));
      return `<div class="r-bar-row ${r.active ? 'active' : ''}" title="${esc(r.title || (r.label + '：' + f2(r.value)))}">
        <div class="r-bar-label">${esc(r.label)}${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</div>
        <div class="r-bar-track"><span class="r-ref" style="left:${((ref / max) * 100).toFixed(1)}%"></span><span class="r-bar-fill ${tone}" style="width:${width.toFixed(1)}%"></span></div>
        <div class="r-bar-value ${tone === 'good' ? 'r-good' : tone === 'bad' ? 'r-bad' : ''}">${r.display || f2(r.value)}</div>
      </div>`;
    }).join('')}</div>`;
  }

  function levelDist(rows) {
    const bins = [
      { label: '≤-3', test: (v) => v <= -3, tone: 'bad' },
      { label: '-2', test: (v) => v === -2, tone: 'bad' },
      { label: '-1', test: (v) => v === -1, tone: 'warn' },
      { label: '0', test: (v) => v === 0, tone: 'keep' },
      { label: '+1', test: (v) => v === 1, tone: 'good' },
      { label: '+2', test: (v) => v === 2, tone: 'good' },
      { label: '≥+3', test: (v) => v >= 3, tone: 'good' }
    ];
    const data = bins.map((b) => Object.assign({}, b, { count: rows.filter((r) => b.test(r.level || 0)).length }));
    const max = Math.max(1, ...data.map((x) => x.count));
    return `<div class="r-dist">${data.map((b) => `<div class="r-dist-col"><div class="r-dist-count">${b.count || ''}</div><div class="r-dist-bar ${b.tone}" style="height:${b.count ? Math.max(2, (b.count / max) * 100).toFixed(1) : 0}%;${b.count ? '' : 'min-height:0;'}"></div><div class="r-dist-label">${b.label}</div></div>`).join('')}</div>`;
  }

  function deltaBars(rows) {
    const max = Math.max(0.5, ...rows.map((r) => Math.abs(r.zDiff || 0)));
    return `<div class="r-delta">${rows.map((r) => {
      const v = r.zDiff || 0;
      const w = Math.min(50, (Math.abs(v) / max) * 50);
      return `<div class="r-delta-row">
        <div class="r-delta-label">${esc(r.subject)}</div>
        <div class="r-delta-track"><span class="r-delta-fill ${v >= 0 ? 'pos' : 'neg'}" style="width:${w.toFixed(1)}%"></span></div>
        <div class="r-delta-val ${v >= 0 ? 'pos' : 'neg'}">${v > 0 ? '+' : ''}${f2(v)}</div>
      </div>`;
    }).join('')}</div>`;
  }

  function heatTable(r, schools) {
    const subs = subjectsOf(r);
    const head = `<tr><th>科目</th>${schools.map((s) => `<th>${esc(s.schoolName)}</th>`).join('')}</tr>`;
    const body = subs.map((sub) => {
      const cells = schools.map((s) => {
        const g = (r.schoolEval[sub] || []).find((x) => x.schoolId === s.schoolId);
        if (!g) return `<td class="h-na">—</td>`;
        const cls = g.rate >= 1.5 ? 'h-good' : g.rate >= 1 ? 'h-mid' : g.rate >= 0.8 ? 'h-warn' : 'h-bad';
        return `<td class="${cls}" title="${esc(sub + ' · ' + s.schoolName)}：增值率 ${f2(g.rate)}，学业实力 ${f1(g.strength)}，n=${g.n}">${f2(g.rate)}</td>`;
      }).join('');
      return `<tr><th>${esc(sub)}</th>${cells}</tr>`;
    }).join('');
    return `<div class="table-wrap"><table class="r-heat"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
  }

  /* ---------- 页面组件 ---------- */
  function kpi(label, value, sub, tone) {
    return `<div class="stat ${tone || ''}"><div class="stat-label">${esc(label)}</div><div class="stat-value">${value}</div>${sub ? `<div class="stat-sub">${sub}</div>` : ''}</div>`;
  }
  function conclusions(items) {
    return `<div class="report-conclusions">${items.map((t, i) => `<div class="report-conclusion"><div class="report-c-no">0${i + 1}</div><div>${t}</div></div>`).join('')}</div>`;
  }
  function section(no, title, sub, body) {
    return `<section class="report-section"><div class="report-sec-head"><span class="report-sec-no">${no}</span><div><div class="report-sec-title">${esc(title)}</div>${sub ? `<div class="report-sec-sub">${esc(sub)}</div>` : ''}</div></div>${body}</section>`;
  }
  function caption(text) { return `<div class="report-caption">${text}</div>`; }
  function scopeBar(inner) { return `<div class="report-scope">${inner}</div>`; }
  function statusBar(c) {
    return `<div class="r-statusbar"><span class="s-progress" style="width:${(c.progressRatio * 100).toFixed(1)}%"></span><span class="s-keep" style="width:${(c.keepRatio * 100).toFixed(1)}%"></span><span class="s-decline" style="width:${(c.declineRatio * 100).toFixed(1)}%"></span></div>
      <div class="r-status-legend"><span><i class="s-progress"></i>进步 ${c.progress} 人（${pct(c.progressRatio)}）</span><span><i class="s-keep"></i>保持 ${c.keep} 人（${pct(c.keepRatio)}）</span><span><i class="s-decline"></i>退步 ${c.decline} 人（${pct(c.declineRatio)}）</span></div>`;
  }

  function roleBar(taskId, active) {
    return `<div class="report-rolebar">${ROLES.map((role) => `<a class="report-role-pill ${role.key === active ? 'active' : ''}" href="#/evaluations/${taskId}/reports/${role.key}">${UI.icon(role.icon)}${esc(role.label)}</a>`).join('')}</div>`;
  }
  function metaBar(task) {
    const r = App.result(task.id);
    const fallback = r.quality.fallbackSubjects || [];
    return `<div class="report-meta">
      ${UI.badge(task.algorithm === 'grade' ? '等级差法' : '标准分法', 'blue')}
      ${UI.badge(`${r.gradeCount || 9} 档`, 'purple')}      ${UI.badge(`联考样本 ${r.quality.sample} 人`, 'gray')}
      ${UI.badge(`联考剔除 ${r.quality.excluded} 人`, 'gray')}
      ${UI.badge(`结果版本 ${task.resultVersion || '—'}`, 'gray')}
      ${UI.badge(`小样本 <${r.smallSample} 人不排名`, 'gray')}
      ${fallback.length ? UI.badge(`回退原始分：${fallback.join('、')}`, 'amber') : ''}
    </div>`;
  }
  function shell(task, roleKey, title, desc, scope, body) {
    const role = ROLES.find((x) => x.key === roleKey) || ROLES[0];
    return `<div class="page report-page">
      <div class="page-head">
        <div>
          <div class="breadcrumb"><span>管理</span><span class="sep">/</span><span>评价任务</span><span class="sep">/</span><a href="#/evaluations/${task.id}/reports">报告</a><span class="sep">/</span><span>${esc(role.label)}</span></div>
          <h1 class="page-title">${esc(title)}</h1>
          <div class="page-desc">${esc(desc)}</div>
        </div>
        <div class="page-actions">
          <a class="btn" href="#/evaluations/${task.id}/results">查看结果</a>
          <a class="btn" href="#/evaluations/${task.id}/reports">切换报告</a>
          <button class="btn" data-action="printReport">打印</button>
        </div>
      </div>
      ${roleBar(task.id, roleKey)}
      ${metaBar(task)}
      ${scope || ''}
      ${body}
    </div>`;
  }

  function schoolSelect(r, current) {
    if (!App.canEdit()) return `<span class="report-fixed">${esc(App.schoolName(current))}</span><span class="tiny weak">学校管理员仅本校</span>`;
    const list = (r.schoolEval['总分'] || []).slice().sort((a, b) => a.schoolId.localeCompare(b.schoolId));
    return `<select class="select select-sm" style="width:150px" onchange="App.setReportSchool(this.value)">${list.map((g) => `<option value="${g.schoolId}" ${g.schoolId === current ? 'selected' : ''}>${esc(g.schoolName)}</option>`).join('')}</select>`;
  }
  function classSelect(r, schoolId, current) {
    const list = classList(r, schoolId).slice().sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    return `<select class="select select-sm" style="width:160px" onchange="App.setReportClass(this.value)">${list.map((c) => `<option value="${c.id}" ${c.id === current ? 'selected' : ''}>${esc(c.name)}（${c.n}人）</option>`).join('')}</select>`;
  }
  function teacherSelect(r, schoolId, subject, current) {
    const list = teacherList(r, schoolId, subject).slice().sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    if (!list.length) return `<span class="weak">暂无教师数据</span>`;
    return `<select class="select select-sm" style="width:180px" onchange="App.setReportTeacher(this.value)">${list.map((t) => `<option value="${t.id}" ${t.id === current ? 'selected' : ''}>${esc(t.name)}（${t.n}人）</option>`).join('')}</select>`;
  }
  function studentSelect(r, schoolId, classId, current) {
    const list = studentTotals(r, schoolId, classId).slice().sort((a, b) => a.studentNo.localeCompare(b.studentNo));
    if (!list.length) return `<span class="weak">暂无学生</span>`;
    return `<select class="select select-sm" style="width:220px" onchange="App.setReportStudent(this.value)">${list.map((s) => `<option value="${s.studentId}" ${s.studentId === current ? 'selected' : ''}>${esc(s.studentName)}（${esc(s.studentNo)}）</option>`).join('')}</select>`;
  }
  function subjectChips(r, schoolId, current) {
    const subs = subjectsOf(r).filter((s) => teacherList(r, schoolId, s).length);
    return `<div class="chips">${subs.map((s) => UI.chip(s, s === current, 'setReportSubject', s)).join('')}</div>`;
  }

  /* ---------- 报告入口 ---------- */
  function reportIndex(task) {
    const r = App.result(task.id);
    const isAdmin = App.canEdit();
    const scoped = isAdmin ? r.totals : r.totals.filter((x) => x.schoolId === App.state.schoolId);
    const c = counts(scoped);
    const schoolCount = (r.schoolEval['总分'] || []).length;
    const ownClasses = isAdmin ? schoolCount : classList(r, App.state.schoolId).length;
    const cards = ROLES.map((role) => `<a class="report-role-card" href="#/evaluations/${task.id}/reports/${role.key}">
      <div class="report-role-top"><div class="report-role-icon">${UI.icon(role.icon)}</div><div><div class="report-role-title">${esc(role.label)}</div><div class="report-role-reader">${esc(role.reader)}</div></div></div>
      <div class="report-role-q">${esc(role.question)}</div>
      <ul class="report-role-list">${role.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      <div class="report-role-go">查看报告 →</div>
    </a>`).join('');
    return `<div class="page report-page">
      <div class="page-head">
        <div>
          <div class="breadcrumb"><span>管理</span><span class="sep">/</span><span>评价任务</span><span class="sep">/</span><span>报告</span></div>
          <h1 class="page-title">选择报告视角</h1>
          <div class="page-desc">同一套四层结果，按角色切成六份报告；每份只回答这个角色最关心的问题。</div>
        </div>
        <div class="page-actions"><a class="btn" href="#/evaluations/${task.id}/results">查看结果</a></div>
      </div>
      ${metaBar(task)}
      <div class="report-overview">
        <div><b>${c.n}</b><span>${isAdmin ? '参评学生' : '本校参评'}</span></div>
        <div><b>${ownClasses}</b><span>${isAdmin ? '学校' : '班级'}</span></div>
        <div><b>${pct1(c.progressRatio)}</b><span>进步面</span></div>
        <div><b>${pct1(c.declineRatio)}</b><span>退步面</span></div>
        <div><b>${task.resultVersion || '—'}</b><span>结果版本</span></div>
      </div>
      <div class="report-roles">${cards}</div>
      <div class="card mt-16"><div class="card-head"><div><div class="card-title"><span class="dot"></span>报告说明</div><div class="card-sub">报告是结果的只读快照，不重新计算</div></div></div><div class="card-body report-note">
        报告中的学校、班级、教师、学生指标均来自本次评价任务的结果版本 ${esc(task.resultVersion || '—')}；对比、差值、百分比为报告层派生，口径见各页脚注。班级/教师排名为校内排名，学校排名为联考排名；人数少于 ${r.smallSample} 人的班级/教师只展示指标、不参与排名。报告不改变结果，发现数据问题请回到结果与计算过程核对。
      </div></div>
    </div>`;
  }

  /* ---------- 01 区域 ---------- */
  function regionPage(task, r) {
    const schools = (r.schoolEval['总分'] || []).slice().sort((a, b) => a.strengthRank - b.strengthRank);
    const byRate = schools.slice().sort((a, b) => b.rate - a.rate);
    const all = counts(r.totals);
    const top = schools.find((g) => g.strengthRank === 1 && g.rateRank === 1) || byRate[0];
    const lowRate = byRate[byRate.length - 1];
    const lowStrength = schools[schools.length - 1];
    const kpis = `<div class="report-kpis">
      ${kpi('参评学生', `${all.n}<small>人</small>`, `四校 · 剔除 ${r.quality.excluded} 人`)}
      ${kpi('整体进步面', pct1(all.progressRatio), `${all.progress} 人判定进步`, 'green')}
      ${kpi('整体保持面', pct1(all.keepRatio), `${all.keep} 人保持`)}
      ${kpi('整体退步面', pct1(all.declineRatio), `${all.decline} 人退步`, 'red')}
    </div>`;
    const cc = conclusions([
      `<b>${esc(top.schoolName)}</b> 双高：学业实力 <b>${f1(top.strength)}</b>（第 ${top.strengthRank}/4），相对进步率 <b>${f2(top.rate)}</b>（第 ${top.rateRank}/4），是本轮唯一两项都居首的学校。`,
      `<b>${esc(lowRate.schoolName)}</b> 学业实力 ${f1(lowRate.strength)}（第 ${lowRate.strengthRank}/4），但相对进步率 <b>${f2(lowRate.rate)}</b>（第 ${lowRate.rateRank}/4）、退步值 <b>${f1(lowRate.decline)}</b> 为四校最高，退步占比 ${pct(lowRate.declineRatio)}；问题在“没稳住”，不在入口。`,
      lowStrength.schoolId === lowRate.schoolId
        ? `<b>${esc(lowStrength.schoolName)}</b> 参评 ${lowStrength.n} 人，是四校中样本最小的，指标波动需谨慎。`
        : `<b>${esc(lowStrength.schoolName)}</b> 学业实力 ${f1(lowStrength.strength)}（第 ${lowStrength.strengthRank}/4），相对进步率 <b>${f2(lowStrength.rate)}</b>（第 ${lowStrength.rateRank}/4），属于“低进高出”；参评 ${lowStrength.n} 人，是四校中样本最小的，结论需带样本提示。`
    ]);
    const points = schools.map((g) => ({
      x: g.strength, y: g.rate, size: g.n, label: g.schoolName, sub: f2(g.rate),
      color: g.rate >= 1.5 ? '#0f9f6e' : g.rate >= 1 ? '#0a66ff' : '#ef4444'
    }));
    const chart = scatter(points, { refX: mean(schools.map((g) => g.strength)), refY: 1 });
    const table = UI.table({
      columns: [
        { key: 'schoolName', label: '学校', render: (g) => `<b>${esc(g.schoolName)}</b>` },
        { key: 'n', label: '人数', align: 'num' },
        { key: 'strength', label: '学业实力', align: 'num', render: (g) => f1(g.strength) },
        { key: 'keep', label: '保持值', align: 'num', render: (g) => f1(g.keep) },
        { key: 'progress', label: '进步值', align: 'num', render: (g) => f1(g.progress) },
        { key: 'decline', label: '退步值', align: 'num', render: (g) => f1(g.decline) },
        { key: 'rate', label: '相对进步率', align: 'num', render: (g) => `<b class="${g.rate >= 1 ? 'r-good' : 'r-bad'}">${f2(g.rate)}</b>` },
        { key: 'avgLevel', label: '平均级数', align: 'num', render: (g) => sgn(g.avgLevel) },
        { key: 'mix', label: '进步/保持/退步', render: (g) => `${pct(g.progressRatio)} / ${pct(g.keepRatio)} / ${pct(g.declineRatio)}` },
        { key: 'rank', label: '实力/增值排名', render: (g) => `${g.strengthRank} / ${g.rateRank}` }
      ],
      rows: schools
    });
    const cards = schools.map((g) => {
      const subs = rankedSubjects(r, g.schoolId);
      const best = subs[0], worst = subs[subs.length - 1];
      const judge = judgeOf(g);
      return `<div class="card report-school-card"><div class="card-body">
        <div class="flex items-center justify-between gap-8 wrap"><div><b>${esc(g.schoolName)}</b><div class="tiny weak">${g.n} 人 · 实力第 ${g.strengthRank} · 增值第 ${g.rateRank}</div></div>${UI.badge(judge.label, judge.tone)}</div>
        <div class="report-mini"><span>相对强项</span><b>${esc(best.subject)} ${f2(best.rate)}</b></div>
        <div class="report-mini"><span>相对短板</span><b>${esc(worst.subject)} ${f2(worst.rate)}</b></div>
        <div class="report-mini"><span>退步占比</span><b>${pct(g.declineRatio)}</b></div>
      </div></div>`;
    }).join('');
    const weak = subjectsOf(r).map((sub) => {
      const list = (r.schoolEval[sub] || []).map((g) => ({ school: g.schoolName, rate: g.rate, n: g.n })).sort((a, b) => a.rate - b.rate);
      return { sub, min: list[0] };
    }).sort((a, b) => a.min.rate - b.min.rate)[0];
    const recs = `<div class="report-recs">
      <div><b>学科教研</b><span>${esc(weak.sub)} 最低（${esc(weak.min.school)} ${f2(weak.min.rate)}），建议作为区域联合教研第一议题，先做试卷与错题归因。</span></div>
      <div><b>样本口径</b><span>${esc(lowStrength.schoolName)} 参评 ${lowStrength.n} 人，是四校中样本最小的；跨校比较时需同时标注人数，避免把小样本波动当成趋势。</span></div>
      <div><b>下轮监测</b><span>下一次评价沿用同一批学校、同一算法与参数；${esc(lowRate.schoolName)} 的退步面是否收窄，应作为重点观察项。</span></div>
    </div>`;
    const body = kpis
      + section('01', '一页结论', '先看结论，再看依据', cc)
      + section('02', '四校总览', '实力 × 增值，气泡大小 = 参评人数', chart + caption('横轴：学业实力；纵轴：相对进步率；虚线为四校实力均值与 1.0 平衡线。') + `<div class="mt-16">${table}</div>`)
      + section('03', '学科结构', '九科增值率热力，颜色越绿越高', heatTable(r, schools) + `<div class="r-legend"><span class="h-good">≥1.50</span><span class="h-mid">1.00–1.49</span><span class="h-warn">0.80–0.99</span><span class="h-bad">&lt;0.80</span></div>`)
      + section('04', '学校分述', '每校一段：相对强项、相对短板、退步面', `<div class="grid grid-2">${cards}</div>`)
      + section('05', '区域建议', '从数据到动作', recs);
    return shell(task, 'region', '区域增值总报告', `读者：教育局/联考组织方 · 四校全体 · 联考统一标准化 · ${all.n} 人`, '', body);
  }

  /* ---------- 02 校长 ---------- */
  function principalPage(task, r) {
    const schoolId = defaultSchool(r);
    const g = schoolRow(r, schoolId);
    if (!g) return shell(task, 'principal', '学校增值报告', '当前任务没有该校结果', '', `<div class="card"><div class="card-body">${UI.empty('暂无结果')}</div></div>`);
    const classes = classList(r, schoolId);
    const valid = classes.filter((c) => c.n >= r.smallSample);
    const byRate = valid.slice().sort((a, b) => b.rate - a.rate);
    const bestClass = byRate[0] || classes[0];
    const worstClass = byRate[byRate.length - 1] || classes[0];
    const subjects = rankedSubjects(r, schoolId);
    const bestSub = subjects[0], worstSub = subjects[subjects.length - 1];
    const c = counts(studentTotals(r, schoolId));
    const judge = judgeOf(g);
    const scope = scopeBar(`<span class="report-scope-label">学校</span>${schoolSelect(r, schoolId)}`);
    const kpis = `<div class="report-kpis">
      ${kpi('学业实力', f1(g.strength), `四校第 ${g.strengthRank}/4`, 'purple')}
      ${kpi('相对进步率', f2(g.rate), `四校第 ${g.rateRank}/4`, g.rate >= 1 ? 'green' : 'red')}
      ${kpi('退步值', f1(g.decline), `退步占比 ${pct(g.declineRatio)}`, 'red')}
      ${kpi('进步占比', pct(g.progressRatio), `${c.progress} 人进步`, 'green')}
    </div>`;
    const cc = conclusions([
      `<b>${esc(g.schoolName)}</b> 学业实力 <b>${f1(g.strength)}</b>（四校第 ${g.strengthRank}），相对进步率 <b>${f2(g.rate)}</b>（四校第 ${g.rateRank}），${judge.text}。`,
      `学科：${esc(bestSub.subject)} ${f2(bestSub.rate)} 相对最强，${esc(worstSub.subject)} ${f2(worstSub.rate)} 相对最弱；${esc(worstSub.subject)} 退步值 ${f1(worstSub.decline)}，是本学科最需要解释的。`,
      `班级：${esc(bestClass.name)} 增值 ${f2(bestClass.rate)}（校内第 ${bestClass.rateRank}），${esc(worstClass.name)} 增值 ${f2(worstClass.rate)}（校内第 ${worstClass.rateRank}）、退步值 ${f1(worstClass.decline)}。`
    ]);
    const compareTable = UI.table({
      columns: [
        { key: 'schoolName', label: '学校', render: (x) => x.schoolId === schoolId ? `<b>${esc(x.schoolName)}</b>` : esc(x.schoolName) },
        { key: 'n', label: '人数', align: 'num' },
        { key: 'strength', label: '学业实力', align: 'num', render: (x) => f1(x.strength) },
        { key: 'rate', label: '相对进步率', align: 'num', render: (x) => `<b class="${x.rate >= 1 ? 'r-good' : 'r-bad'}">${f2(x.rate)}</b>` },
        { key: 'decline', label: '退步值', align: 'num', render: (x) => f1(x.decline) },
        { key: 'rank', label: '实力/增值排名', render: (x) => `${x.strengthRank} / ${x.rateRank}` }
      ],
      rows: (r.schoolEval['总分'] || []).slice().sort((a, b) => a.strengthRank - b.strengthRank),
      rowClass: (x) => x.schoolId === schoolId ? 'report-row-active' : ''
    });
    const labelIds = {};
    [byRate[0], byRate[byRate.length - 1]].filter(Boolean).forEach((x) => { labelIds[x.id] = 1; });
    const points = valid.map((x) => ({
      x: x.strength, y: x.rate, size: x.n,
      label: labelIds[x.id] ? x.name : '', sub: '',
      color: x.rate >= 1 ? '#0a66ff' : '#ef4444'
    }));
    const chart = scatter(points, { refX: mean(valid.map((x) => x.strength)), refY: 1 });
    const pick = [];
    const seen = {};
    byRate.slice(0, 5).concat(byRate.slice(-5)).forEach((x) => { if (!seen[x.id]) { seen[x.id] = 1; pick.push(x); } });
    pick.sort((a, b) => b.rate - a.rate);
    const classTable = UI.table({
      columns: [
        { key: 'name', label: '班级' },
        { key: 'n', label: '人数', align: 'num', render: (x) => x.n < r.smallSample ? `${x.n} <span class="badge badge-amber">样本不足</span>` : x.n },
        { key: 'strength', label: '学业实力', align: 'num', render: (x) => f1(x.strength) },
        { key: 'rate', label: '相对进步率', align: 'num', render: (x) => `<b class="${x.rate >= 1 ? 'r-good' : 'r-bad'}">${f2(x.rate)}</b>` },
        { key: 'keep', label: '保持值', align: 'num', render: (x) => f1(x.keep) },
        { key: 'progress', label: '进步值', align: 'num', render: (x) => f1(x.progress) },
        { key: 'decline', label: '退步值', align: 'num', render: (x) => f1(x.decline) },
        { key: 'rank', label: '校内排名（实力/增值）', render: (x) => `${x.strengthRank || '—'} / ${x.rateRank || '—'}` }
      ],
      rows: pick,
      rowClass: (x) => x.id === worstClass.id ? 'report-row-warn' : ''
    });
    const subBars = bars(subjects.map((s) => ({ label: s.subject, value: s.rate, sub: `n=${s.n}` })), { ref: 1 });
    const recs = `<div class="report-recs">
      <div><b>先保位</b><span>${esc(worstClass.name)} 退步值 ${f1(worstClass.decline)}、增值 ${f2(worstClass.rate)}，建议优先做课堂观察、作业完成度与个别谈话，而不是先谈拔高。</span></div>
      <div><b>再补科</b><span>${esc(worstSub.subject)} 增值 ${f2(worstSub.rate)}，在九科中相对最弱；建议教研组先做试卷结构与学生错题归因。</span></div>
      <div><b>可复制</b><span>${esc(bestClass.name)} 增值 ${f2(bestClass.rate)}，与 ${esc(bestSub.subject)} 的 ${f2(bestSub.rate)} 一起，作为校内经验分享的样本。</span></div>
    </div>`;
    const body = kpis
      + section('01', '一页结论', '本校位置、学科、班级三段判断', cc)
      + section('02', '本校在四校中的位置', '学校层指标与排名', compareTable)
      + section('03', '班级结构', '展示增值率前 5 / 后 5；图中只标注最高与最低班', chart + caption('横轴：班级学业实力；纵轴：班级相对进步率；虚线为校内班级实力均值与 1.0 平衡线。仅展示人数≥' + r.smallSample + ' 的班级。') + `<div class="mt-16">${classTable}</div>`)
      + section('04', '学科诊断', '九科增值率，低于 1.0 为红色', subBars + `<div class="report-inline-note">强项：${esc(bestSub.subject)} ${f2(bestSub.rate)}；短板：${esc(worstSub.subject)} ${f2(worstSub.rate)}（退步值 ${f1(worstSub.decline)}）。</div>`)
      + section('05', '学生结构', '进步 / 保持 / 退步', statusBar(c))
      + section('06', '建议', '三条可执行动作', recs);
    return shell(task, 'principal', `${g.schoolName}增值报告`, `读者：校长/学校管理员 · ${g.schoolName} · 本校在联考中的位置与校内结构`, scope, body);
  }

  /* ---------- 03 年级 ---------- */
  function gradePage(task, r) {
    const schoolId = defaultSchool(r);
    const g = schoolRow(r, schoolId);
    if (!g) return shell(task, 'grade', '年级增值报告', '当前任务没有该校结果', '', `<div class="card"><div class="card-body">${UI.empty('暂无结果')}</div></div>`);
    const classes = classList(r, schoolId);
    const valid = classes.filter((x) => x.n >= r.smallSample).slice().sort((a, b) => b.rate - a.rate);
    const top = valid[0], bottom = valid[valid.length - 1];
    const spread = top.rate - bottom.rate;
    const c = counts(studentTotals(r, schoolId));
    const subjects = rankedSubjects(r, schoolId);
    const bestSub = subjects[0], worstSub = subjects[subjects.length - 1];
    const small = classes.filter((x) => x.n < r.smallSample);
    const scope = scopeBar(`<span class="report-scope-label">学校</span>${schoolSelect(r, schoolId)}`);
    const kpis = `<div class="report-kpis">
      ${kpi('班级数', `${classes.length}<small>个</small>`, `可排名 ${valid.length} 个`)}
      ${kpi('参评学生', `${c.n}<small>人</small>`, `进步 ${c.progress} / 保持 ${c.keep} / 退步 ${c.decline}`)}
      ${kpi('增值率极差', f2(spread), `${top.name} ${f2(top.rate)} ↔ ${bottom.name} ${f2(bottom.rate)}`, spread >= 2 ? 'red' : 'amber')}
      ${kpi('小样本班', `${small.length}<small>个</small>`, small.length ? small.map((x) => x.name).join('、') : '无', small.length ? 'amber' : 'green')}
    </div>`;
    const cc = conclusions([
      `全校 ${classes.length} 个班，增值率最高 <b>${esc(top.name)} ${f2(top.rate)}</b>，最低 <b>${esc(bottom.name)} ${f2(bottom.rate)}</b>，极差 <b>${f2(spread)}</b>，班级分化${spread >= 2 ? '明显' : '总体可控'}。`,
      `增值率后 3 位：${valid.slice(-3).reverse().map((x) => `${esc(x.name)} ${f2(x.rate)}`).join('、')}；前 3 位：${valid.slice(0, 3).map((x) => `${esc(x.name)} ${f2(x.rate)}`).join('、')}。`,
      `学科：${esc(bestSub.subject)} ${f2(bestSub.rate)} 相对最强，${esc(worstSub.subject)} ${f2(worstSub.rate)} 相对最弱；${esc(worstSub.subject)} 退步值 ${f1(worstSub.decline)}，是年级学科结构里的主要短板。`
    ]);
    const classBars = bars(valid.map((x) => ({ label: x.name, value: x.rate, sub: `${x.n}人` })), { ref: 1 });
    const classTable = UI.table({
      columns: [
        { key: 'name', label: '班级' },
        { key: 'n', label: '人数', align: 'num', render: (x) => x.n < r.smallSample ? `${x.n} <span class="badge badge-amber">不排名</span>` : x.n },
        { key: 'strength', label: '学业实力', align: 'num', render: (x) => f1(x.strength) },
        { key: 'rate', label: '相对进步率', align: 'num', render: (x) => x.n < r.smallSample ? '<span class="weak">—</span>' : `<b class="${x.rate >= 1 ? 'r-good' : 'r-bad'}">${f2(x.rate)}</b>` },
        { key: 'keep', label: '保持值', align: 'num', render: (x) => f1(x.keep) },
        { key: 'progress', label: '进步值', align: 'num', render: (x) => f1(x.progress) },
        { key: 'decline', label: '退步值', align: 'num', render: (x) => f1(x.decline) },
        { key: 'mix', label: '进步/退步占比', render: (x) => `${pct(x.progressRatio)} / ${pct(x.declineRatio)}` },
        { key: 'rank', label: '校内排名（实力/增值）', render: (x) => `${x.strengthRank || '—'} / ${x.rateRank || '—'}` }
      ],
      rows: classes.slice().sort((a, b) => (a.rateRank || 99) - (b.rateRank || 99)),
      rowClass: (x) => x.n < r.smallSample ? 'report-row-muted' : ((x.rateRank && x.rateRank > valid.length - 3) ? 'report-row-warn' : '')
    });
    const subBars = bars(subjects.map((s) => ({ label: s.subject, value: s.rate, sub: `n=${s.n}` })), { ref: 1 });
    const recs = `<div class="report-recs">
      <div><b>年级分析会</b><span>先看增值率后 3 个班：${valid.slice(-3).reverse().map((x) => esc(x.name)).join('、')}；逐班核对退步学生名单与学科短板，再定介入方式。</span></div>
      <div><b>学科联动</b><span>${esc(worstSub.subject)} 是年级最弱学科，建议备课组统一做一次试卷结构与错题类型分析，避免各班各自归因。</span></div>
      <div><b>样本提示</b><span>${small.length ? `${small.map((x) => esc(x.name)).join('、')} 人数不足 ${r.smallSample} 人，只展示指标、不参与排名；` : '本期没有小样本班；'}班级排名仅在校内有效，不能与联考排名混用。</span></div>
    </div>`;
    const body = kpis
      + section('01', '一页结论', '分化、头尾、学科三条线', cc)
      + section('02', '班级增值分布', '按相对进步率排序，1.0 为平衡线', classBars)
      + section('03', '班级全表', '含人数、指标、排名与样本标记', classTable)
      + section('04', '学科结构', '学校层九科增值率', subBars)
      + section('05', '建议', '年级层面的三个动作', recs);
    return shell(task, 'grade', `${g.schoolName}年级增值报告`, `读者：年级主任/教务处 · ${g.schoolName} · 班级分化与学科结构`, scope, body);
  }

  /* ---------- 04 班主任 ---------- */
  function homeroomPage(task, r) {
    const schoolId = defaultSchool(r);
    const classId = defaultClass(r, schoolId);
    const g = classRow(r, schoolId, classId);
    if (!g) return shell(task, 'homeroom', '班级增值报告', '当前任务没有该班结果', '', `<div class="card"><div class="card-body">${UI.empty('暂无结果')}</div></div>`);
    const students = studentTotals(r, schoolId, classId);
    const c = counts(students);
    const classes = classList(r, schoolId);
    const ranked = classes.filter((x) => x.n >= r.smallSample);
    const totalRanked = ranked.length;
    const allSubjects = subjectsOf(r).map((sub) => classSubject(r, schoolId, classId, sub)).filter(Boolean).slice().sort((a, b) => b.rate - a.rate);
    const subjects = allSubjects.filter((s) => s.n >= r.smallSample);
    const smallSubjects = allSubjects.filter((s) => s.n < r.smallSample);
    const bestSub = subjects[0] || allSubjects[0];
    const worstSub = subjects[subjects.length - 1] || allSubjects[allSubjects.length - 1];
    const progress = students.filter((x) => x.status === '进步').slice().sort((a, b) => b.level - a.level).slice(0, 8);
    const decline = students.filter((x) => x.status === '退步').slice().sort((a, b) => a.level - b.level).slice(0, 8);
    const deep = students.filter((x) => (x.level || 0) <= -2).length;
    const scope = scopeBar(`<span class="report-scope-label">学校</span>${schoolSelect(r, schoolId)}<span class="report-scope-label">班级</span>${classSelect(r, schoolId, classId)}`);
    const rankText = (v) => v ? `校内第 ${v}/${totalRanked}` : '样本不足，不排名';
    const kpis = `<div class="report-kpis">
      ${kpi('班级人数', `${g.n}<small>人</small>`, `${pct(g.keepRatio)} 保持 / ${pct(g.progressRatio)} 进步`)}
      ${kpi('学业实力', f1(g.strength), rankText(g.strengthRank), 'purple')}
      ${kpi('相对进步率', f2(g.rate), rankText(g.rateRank), g.rate >= 1 ? 'green' : 'red')}
      ${kpi('退步值', f1(g.decline), `退步 ${c.decline} 人（${pct(c.declineRatio)}）`, 'red')}
    </div>`;
    const cc = conclusions([
      `<b>${esc(g.name)}</b> ${g.n} 人，学业实力 <b>${f1(g.strength)}</b>（${rankText(g.strengthRank)}），相对进步率 <b>${f2(g.rate)}</b>（${rankText(g.rateRank)}）。`,
      `进步 <b>${c.progress}</b> 人（${pct(c.progressRatio)}）、保持 <b>${c.keep}</b> 人、退步 <b>${c.decline}</b> 人（${pct(c.declineRatio)}）；级数 ≤ -2 的 <b>${deep}</b> 人，是谈话优先级最高的一批。`,
      `学科：${esc(bestSub.subject)} ${f2(bestSub.rate)} 相对最强，${esc(worstSub.subject)} ${f2(worstSub.rate)} 相对最弱；${esc(worstSub.subject)} 退步值 ${f1(worstSub.decline)}。`
    ]);
    const studentCols = [
      { key: 'studentNo', label: '学号', render: (x) => `<span class="code">${esc(x.studentNo)}</span>` },
      { key: 'studentName', label: '姓名' },
      { key: 'grade', label: '等级变化', render: (x) => `G${x.entryGrade} → G${x.currentGrade}` },
      { key: 'status', label: '判定', render: (x) => UI.badge(x.status, x.status === '进步' ? 'green' : x.status === '退步' ? 'red' : 'gray') },
      { key: 'level', label: '级数', align: 'num', render: (x) => x.level > 0 ? `+${x.level}` : x.level },
      { key: 'zDiff', label: 'Δz', align: 'num', render: (x) => f2(x.zDiff) }
    ];
    const subBars = bars(subjects.map((s) => ({ label: s.subject, value: s.rate, sub: `n=${s.n}` })), { ref: 1 })
      + (smallSubjects.length ? `<div class="report-inline-note">人数少于 ${r.smallSample} 的科目未列入强弱判断：${smallSubjects.map((s) => `${esc(s.subject)}（${s.n}人）`).join('、')}。</div>` : '');
    const recs = `<div class="report-recs">
      <div><b>先谈人</b><span>级数 ≤ -2 的 ${deep} 人优先个别谈话；退步名单里同时出现同一学科短板的，交给对应科任一起看。</span></div>
      <div><b>再补科</b><span>${esc(worstSub.subject)} 是班级最弱学科（${f2(worstSub.rate)}），建议与科任对齐下一次课的目标与作业分层。</span></div>
      <div><b>可表扬</b><span>进步名单前 ${Math.min(8, progress.length)} 人可在班会上做经验分享，重点讲“怎么稳住”的方法，而不是只讲结果。</span></div>
    </div>`;
    const body = kpis
      + section('01', '一页结论', '班级位置、进退步结构、学科短板', cc)
      + section('02', '学生级数分布', '0 为保持，负数为退步，正数为进步', levelDist(students) + `<div class="mt-16">${statusBar(c)}</div>`)
      + section('03', '学科短板', '本班九科增值率，人数不足的科目不参与强弱判断', subBars)
      + section('04', '进退步名单', '进步前 8 与退步前 8', `<div class="grid grid-2"><div><div class="report-subhead">进步名单</div>${UI.table({ columns: studentCols, rows: progress, empty: '暂无进步学生' })}</div><div><div class="report-subhead">退步名单</div>${UI.table({ columns: studentCols, rows: decline, empty: '暂无退步学生' })}</div></div>`)
      + section('05', '建议', '班会与个别谈话的三个动作', recs);
    return shell(task, 'homeroom', `${g.name}班级增值报告`, `读者：班主任 · ${g.schoolName} ${g.name} · ${g.n} 人 · 班级排名为校内排名`, scope, body);
  }

  /* ---------- 05 科任教师 ---------- */
  function teacherPage(task, r) {
    const schoolId = defaultSchool(r);
    const subject = defaultSubject(r, schoolId);
    const teacherId = defaultTeacher(r, schoolId, subject);
    const g = (r.teacherEval[subject] || []).find((x) => x.id === teacherId && x.schoolId === schoolId);
    if (!g) return shell(task, 'teacher', '教师教学增值报告', '当前对象没有教师结果', '', `<div class="card"><div class="card-body">${UI.empty('暂无结果')}</div></div>`);
    const peers = teacherList(r, schoolId, subject).filter((x) => x.n >= r.smallSample);
    const peerRates = peers.map((x) => x.rate);
    const avg = mean(peerRates);
    const sortedPeers = peers.slice().sort((a, b) => b.rate - a.rate);
    const rank = sortedPeers.findIndex((x) => x.id === teacherId) + 1;
    const peerDisplay = peers.slice().sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    let peerNo = 0;
    const peerRows = peerDisplay.map((x) => {
      const me = x.id === teacherId;
      if (!me) peerNo++;
      return {
        label: me ? '本人' : `同科教师 ${peerNo}`,
        value: x.rate,
        sub: me ? '当前' : '',
        active: me,
        tone: me ? 'active' : (x.rate >= 1 ? 'good' : 'bad')
      };
    });
    const rows = r.rows.filter((x) => x.teacherId === teacherId && x.subject === subject);
    const c = counts(rows);
    const byClass = {};
    rows.forEach((x) => { (byClass[x.classId] || (byClass[x.classId] = [])).push(x); });
    const taught = Object.keys(byClass).map((id) => {
      const rs = byClass[id];
      const cc2 = counts(rs);
      const cg = classSubject(r, schoolId, id, subject);
      return { id, name: rs[0].className, n: rs.length, rate: cg ? cg.rate : null, strength: cg ? cg.strength : null, progress: cc2.progress, keep: cc2.keep, decline: cc2.decline };
    }).sort((a, b) => (b.rate == null ? -1 : b.rate) - (a.rate == null ? -1 : a.rate));
    const bestClass = taught[0], worstClass = taught[taught.length - 1];
    const studentRows = rows.slice().sort((a, b) => b.level - a.level);
    const progress = studentRows.filter((x) => x.status === '进步').slice(0, 8);
    const decline = studentRows.filter((x) => x.status === '退步').slice(-8).reverse();
    const scope = scopeBar(`<span class="report-scope-label">学校</span>${schoolSelect(r, schoolId)}<span class="report-scope-label">科目</span>${subjectChips(r, schoolId, subject)}<span class="report-scope-label">教师</span>${teacherSelect(r, schoolId, subject, teacherId)}`);
    const kpis = `<div class="report-kpis">
      ${kpi('任教班级', `${taught.length}<small>个</small>`, `${g.n} 人 · ${esc(g.classes || '')}`)}
      ${kpi('学业实力', f1(g.strength), `本科目校内均值 ${f2(mean(peers.map((x) => x.strength)))}`, 'purple')}
      ${kpi('相对进步率', f2(g.rate), `同科均值 ${f2(avg)}`, g.rate >= avg ? 'green' : (g.rate >= 1 ? 'amber' : 'red'))}
      ${kpi('平均级数', sgn(g.avgLevel), `进步 ${c.progress} / 保持 ${c.keep} / 退步 ${c.decline}`)}
    </div>`;
    const compare = g.rate >= avg ? `高于同科均值 ${f2(g.rate - avg)}` : `低于同科均值 ${f2(avg - g.rate)}`;
    const cc = conclusions([
      `<b>${esc(g.name)}</b> 本科目（${esc(subject)}）任教 ${taught.length} 个班、${g.n} 人，学业实力 <b>${f1(g.strength)}</b>、相对进步率 <b>${f2(g.rate)}</b>、平均级数 ${sgn(g.avgLevel)}。`,
      `校内同科 ${peers.length} 名教师，本科目均值 ${f2(avg)}，本人 ${f2(g.rate)}，${compare}${rank ? `，位于第 ${rank}/${peers.length}（仅本人可见）` : ''}。`,
      `所教班差异：${esc(bestClass.name)} ${f2(bestClass.rate)}，${esc(worstClass.name)} ${f2(worstClass.rate)}；本科目退步学生 <b>${c.decline}</b> 人。`
    ]);
    const strip = `<div class="report-peer-bars">${bars(peerRows, { ref: 1 })}</div><div class="report-inline-note">同科教师按姓名排序匿名展示，蓝条为本人；仅用于定位，不公开姓名与排名。</div>`;
    const classTable = UI.table({
      columns: [
        { key: 'name', label: '班级' },
        { key: 'n', label: '本科目人数', align: 'num' },
        { key: 'rate', label: '班级本科目增值率', align: 'num', render: (x) => x.rate == null ? '—' : `<b class="${x.rate >= 1 ? 'r-good' : 'r-bad'}">${f2(x.rate)}</b>` },
        { key: 'strength', label: '班级本科目实力', align: 'num', render: (x) => x.strength == null ? '—' : f1(x.strength) },
        { key: 'mix', label: '进步/保持/退步', render: (x) => `${x.progress} / ${x.keep} / ${x.decline}` }
      ],
      rows: taught
    });
    const studentCols = [
      { key: 'studentNo', label: '学号', render: (x) => `<span class="code">${esc(x.studentNo)}</span>` },
      { key: 'studentName', label: '姓名' },
      { key: 'className', label: '班级' },
      { key: 'grade', label: '等级变化', render: (x) => `G${x.entryGrade} → G${x.currentGrade}` },
      { key: 'level', label: '级数', align: 'num', render: (x) => x.level > 0 ? `+${x.level}` : x.level },
      { key: 'zDiff', label: 'Δz', align: 'num', render: (x) => f2(x.zDiff) }
    ];
    const recs = `<div class="report-recs">
      <div><b>班级差异</b><span>${esc(worstClass.name)} 的本科目增值 ${f2(worstClass.rate)}，与 ${esc(bestClass.name)} 的 ${f2(bestClass.rate)} 差距明显；先比较两班的作业完成、课堂参与和错题订正，而不是直接归因于学生基础。</span></div>
      <div><b>学生名单</b><span>本科目退步 ${c.decline} 人，优先关注级数 ≤ -2 的学生；名单已按班级拆开，可直接用于讲评与个别辅导。</span></div>
      <div><b>教研分享</b><span>若本科目高于同科均值，建议在备课组内复盘可复制的做法；若低于均值，先对齐教学进度与作业难度，再做一次同题异构。</span></div>
    </div>`;
    const body = kpis
      + section('01', '一页结论', '本科目位置、同科对比、班级差异', cc)
      + section('02', '同科位置', '同科教师相对进步率分布（匿名）', strip)      + section('03', '所教班级', '班级本科目指标', classTable)
      + section('04', '学生名单', '本科目进步前 8 / 退步前 8', `<div class="grid grid-2"><div><div class="report-subhead">进步名单</div>${UI.table({ columns: studentCols, rows: progress, empty: '暂无进步学生' })}</div><div><div class="report-subhead">退步名单</div>${UI.table({ columns: studentCols, rows: decline, empty: '暂无退步学生' })}</div></div>`)
      + section('05', '建议', '教学调整的三个动作', recs);
    return shell(task, 'teacher', `${g.name} · ${subject}教学增值报告`, `读者：科任教师/教研组长 · ${g.schoolName} · 教师排名不公开，仅本人可见`, scope, body);
  }

  /* ---------- 06 学生 ---------- */
  function studentPage(task, r) {
    const schoolId = defaultSchool(r);
    const classId = defaultClass(r, schoolId);
    const studentId = defaultStudent(r, schoolId, classId);
    const total = (r.totals || []).find((x) => x.studentId === studentId);
    if (!total) return shell(task, 'student', '学生个人增值报告', '当前对象没有学生结果', '', `<div class="card"><div class="card-body">${UI.empty('暂无结果')}</div></div>`);
    const subs = subjectRowsOf(r, studentId);
    const progressSubs = subs.filter((x) => x.status === '进步');
    const keepSubs = subs.filter((x) => x.status === '保持');
    const declineSubs = subs.filter((x) => x.status === '退步');
    const byDelta = subs.slice().sort((a, b) => (b.zDiff || 0) - (a.zDiff || 0));
    const bestSub = byDelta[0], worstSub = byDelta[byDelta.length - 1];
    const scope = scopeBar(`<span class="report-scope-label">学校</span>${schoolSelect(r, schoolId)}<span class="report-scope-label">班级</span>${classSelect(r, schoolId, classId)}<span class="report-scope-label">学生</span>${studentSelect(r, schoolId, classId, studentId)}`);
    const levelText = total.level ? `（${sgn(total.level)} 级）` : '（0 级）';
    const kpis = `<div class="report-kpis">
      ${kpi('入口总分', f1(total.entryValue), `${total.selection || '同组'}组内排名 ${total.entryRank}`)}
      ${kpi('评价总分', f1(total.currentValue), `${total.selection || '同组'}组内排名 ${total.currentRank}`)}
      ${kpi('等级变化', `G${total.entryGrade} → G${total.currentGrade}`, `判定：${total.status}${levelText}`, total.status === '进步' ? 'green' : total.status === '退步' ? 'red' : '')}
      ${kpi('总分 Δz', f2(total.zDiff), `联考同首选组内比较`)}
    </div>`;
    const advice = total.status === '进步'
      ? `保持当前节奏，优先补 ${esc(worstSub.subject)} 的短板，避免优势科被稀释。`
      : total.status === '退步'
        ? `先稳住 ${esc(worstSub.subject)} 的基础，再谈优势科；建议与${esc(worstSub.subject)}老师对齐下一次目标。`
        : `位置基本稳定，优先补 ${esc(worstSub.subject)}，把“保持”变成“进步”。`;
    const cc = conclusions([
      `总分 <b>${f1(total.entryValue)} → ${f1(total.currentValue)}</b>，等级 <b>G${total.entryGrade} → G${total.currentGrade}</b>，判定 <b>${total.status}</b>${levelText}；同首选组排名 ${total.entryRank} → ${total.currentRank}。`,
      `六科中 <b>${progressSubs.length}</b> 科进步、<b>${keepSubs.length}</b> 科保持、<b>${declineSubs.length}</b> 科退步；相对位置上升最多的是 ${esc(bestSub.subject)}（Δz ${sgn(bestSub.zDiff)}），下降最多的是 ${esc(worstSub.subject)}（Δz ${sgn(worstSub.zDiff)}）。`,
      `建议：${advice}`
    ]);
    const detail = UI.table({
      columns: [
        { key: 'subject', label: '科目' },
        { key: 'entryValue', label: '入口', align: 'num', render: (x) => f1(x.entryValue) },
        { key: 'currentValue', label: '评价', align: 'num', render: (x) => f1(x.currentValue) },
        { key: 'entryGrade', label: '入口等级', align: 'num', render: (x) => `G${x.entryGrade}` },
        { key: 'currentGrade', label: '评价等级', align: 'num', render: (x) => `G${x.currentGrade}` },
        { key: 'zDiff', label: 'Δz', align: 'num', render: (x) => `<b class="${x.zDiff >= 0 ? 'r-good' : 'r-bad'}">${sgn(x.zDiff)}</b>` },
        { key: 'status', label: '判定', render: (x) => UI.badge(x.status, x.status === '进步' ? 'green' : x.status === '退步' ? 'red' : 'gray') },
        { key: 'level', label: '级数', align: 'num', render: (x) => x.level > 0 ? `+${x.level}` : x.level }
      ],
      rows: subs
    });
    const recs = `<div class="report-recs">
      <div><b>先看位置</b><span>总分判定 ${esc(total.status)}${levelText}，这是相对位次的变化，不是“分数涨没涨”；不同科目、不同选科组的比较群体不同。</span></div>
      <div><b>再看单科</b><span>${esc(worstSub.subject)} 是本次相对下滑最多的一科（Δz ${sgn(worstSub.zDiff)}），优先和老师确认失分类型：基础、审题还是时间分配。</span></div>
      <div><b>隐私说明</b><span>本页只呈现本人数据；排名为本人在联考同科目/同首选组内的位置，不展示其他学生信息。</span></div>
    </div>`;
    const body = kpis
      + section('01', '一页结论', '总分、单科、下一步', cc)
      + section('02', '六科 Δz', '相对联考位置的变化，0 为保持', deltaBars(subs))
      + section('03', '六科明细', '入口/评价、等级、判定、级数', detail)
      + section('04', '建议与说明', '给学生和家长的三个提示', recs);
    return shell(task, 'student', `${total.studentName}个人增值报告`, `读者：学生/家长 · ${total.schoolName} ${total.className} · 仅本人数据`, scope, body);
  }

  /* ---------- 路由 ---------- */
  function reportRole(task, roleKey) {
    const r = App.result(task.id);
    if (roleKey === 'region') return regionPage(task, r);
    if (roleKey === 'principal') return principalPage(task, r);
    if (roleKey === 'grade') return gradePage(task, r);
    if (roleKey === 'homeroom') return homeroomPage(task, r);
    if (roleKey === 'teacher') return teacherPage(task, r);
    if (roleKey === 'student') return studentPage(task, r);
    return reportIndex(task);
  }

  App.reportPages = function (parts) {
    const task = App.task(parts[1]);
    if (!task) return `<div class="page">${UI.empty('评价任务不存在')}</div>`;
    if (task.status !== '已完成') return `<div class="page">${UI.empty('任务完成后才能查看报告')}</div>`;
    const role = parts[3];
    if (!role) return reportIndex(task);
    if (!ROLES.some((x) => x.key === role)) return reportIndex(task);
    return reportRole(task, role);
  };

  /* ---------- 交互 ---------- */
  App.setReportSchool = function (v) {
    App.state.reportSchoolId = v;
    App.state.reportClassId = '';
    App.state.reportTeacherId = '';
    App.state.reportStudentId = '';
    App.render();
  };
  App.setReportClass = function (v) {
    App.state.reportClassId = v;
    App.state.reportStudentId = '';
    App.render();
  };
  App.setReportTeacher = function (v) {
    App.state.reportTeacherId = v;
    App.render();
  };
  App.setReportStudent = function (v) {
    App.state.reportStudentId = v;
    App.render();
  };
  App.actions.setReportSubject = function (el) {
    App.state.reportSubject = el.dataset.value;
    App.state.reportTeacherId = '';
    App.render();
  };
  App.actions.printReport = function () { window.print(); };
})();
