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

  const SUBJECT_ORDER = ['语文', '数学', '英语', '物理', '历史', '化学', '生物', '政治', '地理', '日语', '俄语'];
  const STUDENT_SUBJECT_POS = { 语文: 1, 数学: 2, 英语: 3, 日语: 3, 俄语: 3, 物理: 4, 历史: 4, 化学: 5, 生物: 6, 政治: 7, 地理: 8 };
  function subjectRank(name) {
    const i = SUBJECT_ORDER.indexOf(name);
    return i >= 0 ? i : 99;
  }
  function orderSubjects(names) {
    return names.slice().sort((a, b) => subjectRank(a) - subjectRank(b) || a.localeCompare(b, 'zh'));
  }

  function subjectsOf(r) {
    return orderSubjects(Object.keys(r.schoolEval || {}).filter((s) => s !== '总分' && (r.schoolEval[s] || []).length));
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
    return r.rows.filter((x) => x.studentId === studentId && x.subject !== '总分')
      .slice()
      .sort((a, b) => (STUDENT_SUBJECT_POS[a.subject] || 99) - (STUDENT_SUBJECT_POS[b.subject] || 99) || a.subject.localeCompare(b.subject, 'zh'));
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
  function orderedSubjectRows(r, schoolId) {
    return subjectsOf(r).map((sub) => {
      const g = (r.schoolEval[sub] || []).find((x) => x.schoolId === schoolId);
      return g ? Object.assign({}, g, { subject: sub }) : null;
    }).filter(Boolean);
  }
  function rankedSubjects(r, schoolId) {
    const all = orderedSubjectRows(r, schoolId);
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

  const BANDS = [
    { key: 'G1-G3', label: 'G1–G3', short: '前段', from: 1, to: 3 },
    { key: 'G4-G6', label: 'G4–G6', short: '中段', from: 4, to: 6 },
    { key: 'G7-G9', label: 'G7–G9', short: '后段', from: 7, to: 9 }
  ];
  function bandStats(rows) {
    return BANDS.map((b) => {
      const rs = rows.filter((x) => x.entryGrade >= b.from && x.entryGrade <= b.to);
      const c = counts(rs);
      return Object.assign({}, b, c, { declineRate: c.declineRatio });
    });
  }
  function bandIndex(grade) { return grade <= 3 ? 0 : grade <= 6 ? 1 : 2; }
  const STATUS = {
    problem: { label: '重点关注', tone: 'red' },
    attention: { label: '关注', tone: 'amber' },
    normal: { label: '正常', tone: 'gray' },
    highlight: { label: '较好', tone: 'green' }
  };
  const BAND_PLAIN = { 'G1-G3': '入口前约23%', 'G4-G6': '入口中间约55%', 'G7-G9': '入口后约23%' };
  function bandPlain(key) { return BAND_PLAIN[key] || key; }
  function diffPhrase(v) { return `${v >= 0 ? '高' : '低'} ${Math.abs(v).toFixed(1)} 个百分点`; }
  function statusBadge(key) {
    const s = STATUS[key] || STATUS.normal;
    return UI.badge(s.label, s.tone);
  }
  function statusFromExcess(ex, n, minN) {
    if (n < (minN || 8)) return 'normal';
    if (ex >= 10) return 'problem';
    if (ex >= 5) return 'attention';
    if (ex <= -10) return 'highlight';
    return 'normal';
  }
  function selectionStats(rows) {
    return ['物理类', '历史类'].map((sel) => {
      const c = counts(rows.filter((x) => x.selection === sel));
      return { sel, n: c.n, decline: c.decline, declineRate: c.declineRatio };
    }).filter((x) => x.n > 0);
  }
  function classProblemRows(r, schoolId, baseBands, riskByClass) {
    return classList(r, schoolId).filter((c) => c.n >= r.smallSample).map((c) => {
      const members = studentTotals(r, schoolId, c.id);
      const decline = members.filter((x) => x.status === '退步').length;
      const bandN = [0, 0, 0];
      members.forEach((x) => { bandN[bandIndex(x.entryGrade)]++; });
      const expected = bandN.reduce((sum, n, i) => sum + (n / c.n) * baseBands[i].declineRate, 0);
      const actual = decline / c.n;
      return Object.assign({}, c, {
        decline,
        actual,
        expected,
        excess: (actual - expected) * 100,
        risk: riskByClass[c.id] || 0
      });
    });
  }
  function subjectRowsMap(r) {
    const map = {};
    r.rows.forEach((x) => {
      if (x.subject !== '总分') (map[x.studentId] || (map[x.studentId] = [])).push(x);
    });
    return map;
  }
  function buildRiskRows(r, schoolId, classId, map) {
    return studentTotals(r, schoolId, classId).map((t) => {
      const subs = map[t.studentId] || [];
      const bad = subs.filter((s) => s.level <= -2);
      const deep = subs.some((s) => s.level <= -4);
      const worst = subs.slice().sort((a, b) => a.level - b.level)[0];
      const severe = t.level <= -2;
      const high = t.entryGrade <= 3 && t.level <= -1;
      const tags = [];
      if (severe) tags.push('总分退步≥2');
      else if (t.status === '退步') tags.push('总分退步');
      if (high) tags.push('高入口退步');
      if (bad.length) tags.push(`单科退步≥2·${bad.length}科`);
      if (deep) tags.push('单科重度');
      return Object.assign({}, t, { subs, bad, deep, worst, tags, risk: severe || high || deep });
    }).filter((x) => x.risk);
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
    const list = visibleClasses(r, schoolId);
    const saved = App.state.reportClassId;
    if (saved && list.some((c) => c.id === saved)) return saved;
    const valid = list.filter((c) => c.n >= r.smallSample).sort((a, b) => a.rate - b.rate);
    return (valid[0] || list[0] || {}).id || '';
  }
  function defaultSubject(r, schoolId) {
    const saved = App.state.reportSubject;
    if (saved && teacherList(r, schoolId, saved).length) return saved;
    const subs = visibleSubjects(r, schoolId);
    return subs.includes('数学') ? '数学' : (subs[0] || '语文');
  }
  function defaultTeacher(r, schoolId, subject) {
    const list = visibleTeachers(r, schoolId, subject);
    const saved = App.state.reportTeacherId;
    if (saved && list.some((t) => t.id === saved)) return saved;
    const sorted = list.slice().sort((a, b) => b.n - a.n);
    return (sorted[0] || {}).id || '';
  }
  function defaultStudent(r, schoolId, classId) {
    const list = visibleStudents(r, schoolId, classId);
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
      const act = p.action ? ` data-action="${p.action}" data-id="${esc(p.id || '')}"` : '';
      return `<g class="pt ${p.action ? 'clickable' : ''}"${act}>
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

  function excessBars(rows) {
    const max = Math.max(5, ...rows.map((r) => Math.abs(r.excess)));
    return `<div class="r-excess">${rows.map((r) => {
      const pos = r.excess >= 0;
      const w = Math.min(50, (Math.abs(r.excess) / max) * 50);
      return `<div class="r-excess-row">
        <div class="r-excess-label">${esc(bandPlain(r.key))}<small>${r.n}人</small></div>
        <div class="r-excess-track"><span class="r-excess-zero"></span><span class="r-excess-fill ${pos ? 'neg' : 'pos'}" style="width:${w.toFixed(1)}%"></span></div>
        <div class="r-excess-val ${pos ? 'neg' : 'pos'}">${pos ? '+' : ''}${r.excess.toFixed(1)}</div>
      </div>`;
    }).join('')}</div>`;
  }

  function stackedBars(rows) {
    return `<div class="r-stack">${rows.map((s) => {
      const p = Math.max(0, s.progressRatio * 100);
      const k = Math.max(0, s.keepRatio * 100);
      const d = Math.max(0, s.declineRatio * 100);
      return `<div class="r-stack-row" title="${esc(s.subject)}：进步 ${s.progressCount || 0} 人 / 保持 ${s.keepCount || 0} 人 / 退步 ${s.declineCount || 0} 人；增值表现 ${f2(s.rate)}">
        <div class="r-stack-label">${esc(s.subject)}<small>${s.n}人</small></div>
        <div class="r-stack-track"><span class="p" style="width:${p.toFixed(1)}%"></span><span class="k" style="width:${k.toFixed(1)}%"></span><span class="d" style="width:${d.toFixed(1)}%"></span></div>
        <div class="r-stack-val">${f2(s.rate)}</div>
      </div>`;
    }).join('')}</div>`;
  }

  function flowMatrix(rows) {
    const grades = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const m = {};
    let max = 1;
    rows.forEach((x) => {
      const k = x.entryGrade + '|' + x.currentGrade;
      m[k] = (m[k] || 0) + 1;
      if (m[k] > max) max = m[k];
    });
    const head = `<tr><th class="flow-corner">入口 \\ 出口</th>${grades.map((g) => `<th>G${g}</th>`).join('')}</tr>`;
    const body = grades.map((e) => `<tr><th>G${e}</th>${grades.map((x) => {
      const c = m[e + '|' + x] || 0;
      let cls = 'flow-zero';
      let style = '';
      if (c) {
        const ratio = c / max;
        if (x < e) { cls = 'flow-up'; style = `background:rgba(16,185,129,${(0.12 + ratio * 0.55).toFixed(2)})`; }
        else if (x > e) { cls = 'flow-down'; style = `background:rgba(239,68,68,${(0.12 + ratio * 0.55).toFixed(2)})`; }
        else { cls = 'flow-keep'; style = `background:rgba(100,116,139,${(0.12 + ratio * 0.35).toFixed(2)})`; }
      }
      return `<td class="${cls}" style="${style}" title="入口 G${e} → 出口 G${x}：${c} 人">${c || ''}</td>`;
    }).join('')}</tr>`).join('');
    return `<div class="table-wrap r-flow-wrap"><table class="r-flow"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
  }

  function riskTagLabel(text) {
    if (text === '总分退步≥2') return '总分掉2档以上';
    if (text === '总分退步') return '总分退步';
    if (text === '高入口退步') return '入口靠前但退步';
    if (text === '单科重度') return '单科掉4档以上';
    if (text.indexOf('单科退步≥2') === 0) {
      const m = text.match(/·(\d+)科/);
      return m ? (m[1] === '1' ? '1科掉2档以上' : `${m[1]}科各掉2档以上`) : '单科掉2档以上';
    }
    return text;
  }
  function riskTag(text) {
    const tone = text.indexOf('高入口') >= 0 ? 'red' : text.indexOf('单科') >= 0 ? 'purple' : text.indexOf('≥2') >= 0 ? 'amber' : 'gray';
    return UI.badge(riskTagLabel(text), tone);
  }

  function topFlows(rows, n) {
    const m = {};
    rows.forEach((x) => {
      if (x.entryGrade === x.currentGrade) return;
      const k = x.entryGrade + '|' + x.currentGrade;
      m[k] = (m[k] || 0) + 1;
    });
    return Object.keys(m).map((k) => {
      const p = k.split('|');
      return { from: +p[0], to: +p[1], count: m[k] };
    }).sort((a, b) => b.count - a.count).slice(0, n || 3);
  }

  /* ---------- 页面组件 ---------- */
  function kpi(label, value, sub, tone) {
    return `<div class="stat ${tone || ''}"><div class="stat-label">${esc(label)}</div><div class="stat-value">${value}</div>${sub ? `<div class="stat-sub">${sub}</div>` : ''}</div>`;
  }
  function conclusions(items) {
    return `<div class="report-conclusions">${items.map((t, i) => `<div class="report-conclusion"><div class="report-c-no">0${i + 1}</div><div>${t}</div></div>`).join('')}</div>`;
  }
  function section(no, title, sub, body, id) {
    return `<section class="report-section"${id ? ` id="${id}"` : ''}><div class="report-sec-head"><span class="report-sec-no">${no}</span><div><div class="report-sec-title">${esc(title)}</div>${sub ? `<div class="report-sec-sub">${esc(sub)}</div>` : ''}</div></div>${body}</section>`;
  }
  function checkLine(items) {
    return `<div class="report-check">核对：${items.map((x) => `<button class="report-check-link" data-action="scrollReport" data-target="${x.target}">${x.label}</button>`).join(' / ')}</div>`;
  }
  function scanRow(no, label, position, metric, diff, scale, status, sub) {
    return `<div class="report-scan-row">
      <div class="scan-label"><span class="scan-no">${no}</span>${esc(label)}</div>
      <div class="scan-main"><b>${position}</b><span>${metric}</span></div>
      <div class="scan-diff">${diff}</div>
      <div class="scan-scale">${scale}</div>
      <div class="scan-status">${statusBadge(status)}</div>
      ${sub ? `<div class="scan-sub">${sub}</div>` : ''}
    </div>`;
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
          <button class="btn" data-action="printReport">导出 PDF</button>
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
  function reportAccount() {
    return (App.accounts && App.accounts[App.state.account]) || {};
  }
  function canSwitchAllReports() {
    return App.canEdit() || App.isSchool();
  }
  function visibleClasses(r, schoolId) {
    const all = classList(r, schoolId);
    if (canSwitchAllReports()) return all;
    const acct = reportAccount();
    if (acct.classIds && acct.classIds.length) return all.filter((c) => acct.classIds.indexOf(c.id) >= 0);
    return all.filter((c) => c.id === App.state.reportClassId);
  }
  function visibleTeachers(r, schoolId, subject) {
    const all = teacherList(r, schoolId, subject);
    if (canSwitchAllReports()) return all;
    const acct = reportAccount();
    if (acct.teacherId) return all.filter((t) => t.id === acct.teacherId);
    return all.filter((t) => t.id === App.state.reportTeacherId);
  }
  function visibleSubjects(r, schoolId) {
    const all = subjectsOf(r).filter((s) => teacherList(r, schoolId, s).length);
    if (canSwitchAllReports()) return all;
    const acct = reportAccount();
    if (acct.teacherId) return all.filter((s) => teacherList(r, schoolId, s).some((t) => t.id === acct.teacherId));
    return all.filter((s) => s === App.state.reportSubject);
  }
  function visibleStudents(r, schoolId, classId) {
    const all = studentTotals(r, schoolId, classId);
    if (canSwitchAllReports()) return all;
    const acct = reportAccount();
    if (acct.studentId) return all.filter((s) => s.studentId === acct.studentId);
    if (acct.classIds && acct.classIds.length) return acct.classIds.indexOf(classId) >= 0 ? all : [];
    return all.filter((s) => s.studentId === App.state.reportStudentId);
  }
  function classSelect(r, schoolId, current) {
    const list = visibleClasses(r, schoolId).slice().sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    if (!list.length) return `<span class="weak">暂无可查看班级</span>`;
    return `<select class="select select-sm" style="width:160px" onchange="App.setReportClass(this.value)">${list.map((c) => `<option value="${c.id}" ${c.id === current ? 'selected' : ''}>${esc(c.name)}（${c.n}人）</option>`).join('')}</select>`;
  }
  function teacherSelect(r, schoolId, subject, current) {
    const list = visibleTeachers(r, schoolId, subject).slice().sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    if (!list.length) return `<span class="weak">暂无可查看教师</span>`;
    return `<select class="select select-sm" style="width:180px" onchange="App.setReportTeacher(this.value)">${list.map((t) => `<option value="${t.id}" ${t.id === current ? 'selected' : ''}>${esc(t.name)}（${t.n}人）</option>`).join('')}</select>`;
  }
  function studentSelect(r, schoolId, classId, current) {
    const list = visibleStudents(r, schoolId, classId).slice().sort((a, b) => a.studentNo.localeCompare(b.studentNo));
    if (!list.length) return `<span class="weak">暂无可查看学生</span>`;
    return `<input id="report-student-search" class="input" style="width:150px" type="search" placeholder="搜姓名 / 学号" oninput="App.filterReportStudents(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();App.pickFirstStudent();}" />
      <select id="report-student-select" class="select select-sm" style="width:220px" onchange="App.setReportStudent(this.value)">${list.map((s) => `<option value="${s.studentId}" ${s.studentId === current ? 'selected' : ''}>${esc(s.studentName)}（${esc(s.studentNo)}）</option>`).join('')}</select>
      <span id="report-student-count" class="tiny weak">共 ${list.length} 人</span>`;
  }
  function subjectChips(r, schoolId, current) {
    const subs = visibleSubjects(r, schoolId);
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
    const top = byRate[0], lowRate = byRate[byRate.length - 1];
    const rateGap = top.rate - lowRate.rate;
    const overallKey = lowRate.rate < 0.9 ? 'problem' : lowRate.rate < 1 ? 'attention' : rateGap >= 1 ? 'attention' : 'normal';
    const overall = STATUS[overallKey];
    const overallText = overallKey === 'problem'
      ? `这轮四校差距主要在${lowRate.schoolName}：增值表现 ${f2(lowRate.rate)}，退步比例 ${pct1(lowRate.declineRatio)}；先看这所学校的学科和入口段。`
      : overallKey === 'attention'
        ? `这轮四校整体接近平衡，但${lowRate.schoolName}的增值表现 ${f2(lowRate.rate)} 需要关注。`
        : `这轮四校整体接近平衡，${top.schoolName}相对领先，未发现明显异常。`;
    const verdict = `<div class="report-verdict ${overall.tone}">
      <div class="verdict-top"><span class="verdict-badge">${statusBadge(overallKey)}</span><span class="verdict-kicker">一句话结论</span></div>
      <div class="verdict-text">${esc(overallText)}</div>
      <div class="verdict-metrics">
        <div><b>${rateGap.toFixed(2)}</b><span>四校增值表现极差 · 最高与最低</span></div>
        <div><b>${pct1(lowRate.declineRatio)}</b><span>${esc(lowRate.schoolName)}退步比例 · 四校最高</span></div>
        <div><b>${all.decline} 人</b><span>四校退步学生 · 占参评 ${pct(all.declineRatio)}</span></div>
      </div>
    </div>`;
    const scan = `<div class="report-scan">
      ${scanRow('01', '学校', esc(lowRate.schoolName), `${lowRate.n} 人中 ${lowRate.declineCount} 人退步（${pct1(lowRate.declineRatio)}）`, `增值表现 ${f2(lowRate.rate)} · 四校最低`, `${lowRate.n} 人`, overallKey, `相对最好：${esc(top.schoolName)} ${f2(top.rate)}`)}
      ${scanRow('02', '学科', '四校学科差距', '见 A2 学科表', '按增值表现最高与最低之差', `${schools.length} 校`, 'attention', '差距最大的学科优先看')}
      ${scanRow('03', '入口位置', '入口前约23%', '见各校入口位置表', '四校同位置对比', `${schools.length} 校`, 'attention', '入口前段退步比例优先')}
      ${scanRow('04', '数据质量', '四校样本', `${all.n} 人参评`, `剔除 ${r.quality.excluded || 0} 人`, `${schools.length} 校`, 'normal', `结果版本 ${task.resultVersion || '—'}`)}
    </div>`;
    const subjectGaps = subjectsOf(r).map((sub) => {
      const rows = schools.map((s) => ({ school: s, g: (r.schoolEval[sub] || []).find((x) => x.schoolId === s.schoolId) })).filter((x) => x.g);
      if (!rows.length || !rows.every((x) => x.g.n >= 30)) return null;
      const hi = rows.slice().sort((a, b) => b.g.rate - a.g.rate)[0];
      const lo = rows.slice().sort((a, b) => a.g.rate - b.g.rate)[0];
      return { subject: sub, hi, lo, gap: hi.g.rate - lo.g.rate };
    }).filter(Boolean).sort((a, b) => b.gap - a.gap).slice(0, 3);
    const slots = [0, 1, 2].map((i) => {
      const x = subjectGaps[i];
      return x ? `<div class="report-hot-slot"><span>${esc(x.subject)}</span><b>差 ${x.gap.toFixed(2)}</b></div>` : `<div class="report-hot-slot empty"><span>—</span><b>暂无数据</b></div>`;
    }).join('');
    const schoolTable = UI.table({
      columns: [
        { key: 'schoolName', label: '学校', render: (x) => `<b>${esc(x.schoolName)}</b>` },
        { key: 'n', label: '参评人数', align: 'num' },
        { key: 'rate', label: '增值表现', align: 'num', render: (x) => f2(x.rate) },
        { key: 'declineRatio', label: '退步比例', align: 'num', render: (x) => pct1(x.declineRatio) },
        { key: 'decline', label: '退步人数', align: 'num' },
        { key: 'rank', label: '整体/增值排名', render: (x) => `${x.strengthRank} / ${x.rateRank}` }
      ],
      rows: schools
    });
    const subjectTable = `<div class="table-wrap"><table class="table r-app-table">
      <thead><tr><th>学科</th>${schools.map((s) => `<th>${esc(s.schoolName)}</th>`).join('')}</tr></thead>
      <tbody>${subjectsOf(r).map((sub) => `<tr><th>${esc(sub)}</th>${schools.map((s) => {
        const g = (r.schoolEval[sub] || []).find((x) => x.schoolId === s.schoolId);
        return `<td>${g ? f2(g.rate) : '—'}</td>`;
      }).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
    const actions = `<div class="report-recs">
      <div><b>先看学校</b><span>先看 ${esc(lowRate.schoolName)}：增值表现 ${f2(lowRate.rate)}、退步比例 ${pct1(lowRate.declineRatio)}，要求学校按班级和学科拆解。</span></div>
      <div><b>再看学科</b><span>四校差距最大的学科是 ${esc(subjectGaps[0] ? subjectGaps[0].subject : '—')}，由教研员牵头做一次跨校同题分析。</span></div>
      <div><b>数据核对</b><span>先核对入口、评价、缺考、小样本；再做校际比较，避免把样本差异当成教学差异。</span></div>
    </div>`;
    const appendix = `<div class="report-appendix">
      <div class="report-inline-note">以下为四校汇总数据，不含学生姓名；学生明细只在各校内部报告查看。</div>
      <div class="report-subhead mt-16" id="r-app-a1">A1 四校总表</div>${schoolTable}
      <div class="report-subhead mt-16" id="r-app-a2">A2 四校 × 学科（增值表现）</div>${subjectTable}
      <div class="report-subhead mt-16" id="r-app-e">E 数据质量</div>${UI.table({ columns: [
        { key: 'k', label: '项目' }, { key: 'v', label: '数值' }
      ], rows: [
        { k: '参评人数', v: all.n }, { k: '联考样本', v: r.quality.sample || all.n },
        { k: '剔除', v: r.quality.excluded || 0 }, { k: '部分缺考', v: r.quality.partialAbsentExcluded || 0 },
        { k: '结果版本', v: task.resultVersion || '—' }
      ] })}
      <div class="report-note">区域页只看学校/学科/入口段汇总，不展示学生姓名和班级名单。</div>
    </div>`;
    const toc = `<aside class="report-toc" id="report-toc">
      <div class="report-toc-title">报告目录</div>
      <button class="report-toc-link active" data-action="scrollReport" data-target="sec-overall">01 四校怎么样</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-scan">02 差距在哪</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-hot">03 最集中的学校和学科</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-tags">04 涉及多少学校/学生</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-actions">05 先找谁</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-evidence">06 数据依据</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-appendix">07 数据全貌</button>
      <button class="btn btn-primary btn-sm report-toc-export" data-action="printReport">导出 PDF</button>
      <div class="report-toc-note">A4 纵向 · 导出后可打印</div>
    </aside>`;
    const sections = section('01', '四校怎么样', '一句话结论 + 三个关键数', verdict + checkLine([{ target: 'r-app-a1', label: 'A1 四校总表' }]), 'sec-overall')
      + section('02', '差距在哪', '学校 / 学科 / 入口位置 / 数据质量', scan, 'sec-scan')
      + section('03', '最集中的学校和学科', '按四校同学科增值差距排序', `<div class="report-hot-top">${slots}</div>${subjectTable}`, 'sec-hot')
      + section('04', '涉及多少学校/学生', '只到学校汇总，不含学生姓名', schoolTable, 'sec-tags')
      + section('05', '先找谁', '学校、学科、数据三条线', actions, 'sec-actions')
      + section('06', '数据依据', '四校总表与学科表', `${schoolTable}${subjectTable}` + checkLine([{ target: 'r-app-a2', label: 'A2 四校×学科' }]), 'sec-evidence')
      + section('07', '数据全貌', '四校汇总数据，不含学生姓名', appendix, 'sec-appendix');
    setTimeout(function () { if (App.initReportToc) App.initReportToc(); }, 0);
    return shell(task, 'region', '区域/联考增值报告', `读者：区域/联考管理员 · ${schools.length} 校 · 仅学校汇总，不含学生姓名`, '', `<div class="report-doc-grid"><div class="report-doc-main">${sections}</div>${toc}</div>`);
  }

  /* ---------- 02 校长 ---------- */
  function principalPage(task, r) {
    const schoolId = defaultSchool(r);
    const g = schoolRow(r, schoolId);
    if (!g) return shell(task, 'principal', '学校增值报告', '当前任务没有该校结果', '', `<div class="card"><div class="card-body">${UI.empty('暂无结果')}</div></div>`);

    const classes = classList(r, schoolId);
    const totals = studentTotals(r, schoolId);
    const c = counts(totals);
    const subjects = rankedSubjects(r, schoolId);
    const bestSub = subjects[0];
    const worstSub = subjects[subjects.length - 1];

    /* 同段基准：优先其他学校，单校任务回退全校 */
    const otherTotals = r.totals.filter((x) => x.schoolId !== schoolId);
    const hasPeers = otherTotals.length > 0;
    const peerBandLabel = hasPeers ? '其他三校入口相近的学生' : '全校入口相近的学生';
    const peerClassLabel = hasPeers ? '其他三校同类班' : '全校同类班';
    const baseBands = bandStats(hasPeers ? otherTotals : r.totals);
    const ownBands = bandStats(totals);
    const bandRows = ownBands.map((b, i) => Object.assign({}, b, {
      base: baseBands[i].declineRate,
      excess: (b.declineRate - baseBands[i].declineRate) * 100
    }));
    const worstBand = bandRows.slice().sort((a, b) => b.excess - a.excess)[0];
    const bestBand = bandRows.slice().sort((a, b) => a.excess - b.excess)[0];

    /* 关注名单与热点格子 */
    const map = subjectRowsMap(r);
    const riskAll = buildRiskRows(r, schoolId, '', map);
    const riskByClass = {};
    riskAll.forEach((x) => { riskByClass[x.classId] = (riskByClass[x.classId] || 0) + 1; });
    const riskRows = riskAll.slice().sort((a, b) => (a.level - b.level) || (a.entryGrade - b.entryGrade)).slice(0, 30);
    const severeRisk = riskAll.filter((x) => x.level <= -2).length;
    const highRisk = riskAll.filter((x) => x.tags.indexOf('高入口退步') >= 0).length;
    const subjRisk = riskAll.filter((x) => x.bad.length > 0).length;
    const deepRisk = riskAll.filter((x) => x.deep).length;

    /* 结构扫描：班级与选科类 */
    const classProblems = classProblemRows(r, schoolId, baseBands, riskByClass);
    const topClass = classProblems.slice().sort((a, b) => b.excess - a.excess)[0]
      || { name: '—', n: 0, decline: 0, actual: 0, expected: 0, excess: 0, risk: 0 };
    const broadClasses = classProblems.slice().sort((a, b) => b.risk - a.risk);
    const broadClass = broadClasses.find((x) => x.id !== topClass.id) || broadClasses[0] || topClass;
    const selStats = selectionStats(totals);
    const selWorst = selStats.slice().sort((a, b) => b.declineRate - a.declineRate)[0] || { sel: '—', n: 0, declineRate: 0 };
    const selGap = selStats.length > 1
      ? (Math.max(...selStats.map((x) => x.declineRate)) - Math.min(...selStats.map((x) => x.declineRate))) * 100
      : 0;
    const selText = selStats.map((x) => `${x.sel} ${pct1(x.declineRate)}`).join(' · ');

    const badBySubject = {};
    riskAll.forEach((x) => x.bad.forEach((s) => { badBySubject[s.subject] = (badBySubject[s.subject] || 0) + 1; }));
    const allBadBySubject = {};
    r.rows.forEach((x) => {
      if (x.schoolId === schoolId && x.subject !== '总分' && x.level <= -2) {
        allBadBySubject[x.subject] = (allBadBySubject[x.subject] || 0) + 1;
      }
    });
    const subjBad = badBySubject[worstSub.subject] || 0;
    const allSubjectRows = subjectsOf(r).map((sub) => {
      const s = (r.schoolEval[sub] || []).find((x) => x.schoolId === schoolId);
      return s ? Object.assign({}, s, { subject: sub, count: badBySubject[sub] || 0, allCount: allBadBySubject[sub] || 0 }) : null;
    }).filter(Boolean);
    const badSubjectRows = allSubjectRows.filter((x) => x.count > 0).sort((a, b) => b.count - a.count);
    const topSubject = badSubjectRows[0] || Object.assign({}, worstSub, { count: subjBad });

    /* 固定四行状态 */
    const entryStatus = bandRows.every((b) => b.excess < 0) ? 'highlight' : statusFromExcess(worstBand.excess, worstBand.n, 30);
    const selStatus = (selGap >= 8 && selStats.every((x) => x.n >= 30)) ? 'attention' : 'normal';
    const classStatus = (topClass.excess >= 10 && topClass.risk >= 8) ? 'problem'
      : topClass.excess >= 5 ? 'attention' : topClass.excess <= -10 ? 'highlight' : 'normal';
    const subjStatus = (topSubject.rate < 1 && topSubject.count >= 10) ? 'problem'
      : topSubject.count >= 10 ? 'attention'
        : topSubject.rate >= 1.5 ? 'highlight' : 'normal';
    const rowStatuses = [entryStatus, selStatus, classStatus, subjStatus];
    const overallKey = rowStatuses.indexOf('problem') >= 0 ? 'problem'
      : bandRows.every((b) => b.excess < 0) ? 'highlight'
        : rowStatuses.indexOf('attention') >= 0 ? 'attention' : 'normal';
    const overall = STATUS[overallKey];
    const focusBand = overallKey === 'highlight' ? bestBand : worstBand;

    const hotCols = subjectsOf(r);
    const classMap = Object.fromEntries(classes.map((x) => [x.id, x]));
    const cell = {};
    riskAll.forEach((x) => {
      const seen = {};
      x.bad.forEach((s) => {
        if (seen[s.subject]) return;
        seen[s.subject] = 1;
        const k = x.classId + '|' + s.subject;
        cell[k] = (cell[k] || 0) + 1;
      });
    });
    const allCell = {};
    const allBadBySchoolSubject = {};
    r.rows.forEach((x) => {
      if (x.subject === '总分' || x.level > -2) return;
      const sk = x.schoolId + '|' + x.subject;
      allBadBySchoolSubject[sk] = (allBadBySchoolSubject[sk] || 0) + 1;
      if (x.schoolId !== schoolId) return;
      const k = x.classId + '|' + x.subject;
      allCell[k] = (allCell[k] || 0) + 1;
    });
    const tagByClass = {};
    riskAll.forEach((x) => {
      const t = tagByClass[x.classId] || (tagByClass[x.classId] = { total2: 0, high: 0, subject2: 0, deep: 0, total: 0 });
      t.total++;
      if (x.level <= -2) t.total2++;
      if (x.tags.indexOf('高入口退步') >= 0) t.high++;
      if (x.bad.length) t.subject2++;
      if (x.deep) t.deep++;
    });
    const tagTopRows = classes.map((c) => {
      const t = tagByClass[c.id] || { total: 0, total2: 0, high: 0, subject2: 0, deep: 0 };
      return Object.assign({}, c, t);
    }).sort((a, b) => b.total - a.total || b.total2 - a.total2).slice(0, 8);
    const tagTopTable = `<div class="report-subhead mt-16">标签分布（前 8 班）</div>
      <div class="table-wrap"><table class="table r-app-table">
      <thead><tr><th>班级</th><th>需重点关注</th><th>总分掉2档</th><th>入口靠前但退步</th><th>至少1科掉2档</th><th>单科掉4档</th></tr></thead>
      <tbody>${tagTopRows.map((c) => `<tr class="${c.id === topClass.id ? 'report-row-active' : ''}"><td>${esc(c.name)}</td><td><b>${c.total}</b></td><td>${c.total2}</td><td>${c.high}</td><td>${c.subject2}</td><td>${c.deep}</td></tr>`).join('')}</tbody>
      </table></div><div class="report-caption">四类标签有重叠，不能相加；全量 18 班见附录 D1。</div>`;
    const topCells = Object.keys(cell).map((k) => {
      const p = k.split('|');
      return { classId: p[0], className: (classMap[p[0]] || {}).name || '', subject: p[1], count: cell[k] };
    }).sort((a, b) => b.count - a.count).slice(0, 3);
    const topCell = topCells[0] || null;
    const topCellText = topCell ? `${topCell.className}${topCell.subject} ${topCell.count} 人` : '暂无明显集中点';

    const overallText = overallKey === 'problem'
      ? `${g.schoolName}这轮先看${topClass.name}：${topClass.n} 人中 ${topClass.decline} 人总分退步（${pct1(topClass.actual)}），比${peerClassLabel}${diffPhrase(topClass.excess)}；最集中的是${topCellText}。`
      : overallKey === 'attention'
        ? `${g.schoolName}这轮整体接近其他三校同水平学生，但${topClass.name}、${topSubject.subject}等局部需要关注。`
        : overallKey === 'highlight'
          ? `${g.schoolName}这轮整体好于其他三校同水平学生：${bandPlain(focusBand.key)}学生退步比例 ${pct1(focusBand.declineRate)}，比其他三校低 ${Math.abs(focusBand.excess).toFixed(1)} 个百分点；没有发现明显问题。`
          : `${g.schoolName}这轮整体接近其他三校同水平学生，没有发现明显异常。`;

    const verdict = `<div class="report-verdict ${overall.tone}">
      <div class="verdict-top"><span class="verdict-badge">${statusBadge(overallKey)}</span><span class="verdict-kicker">一句话结论</span></div>
      <div class="verdict-text">${esc(overallText)}</div>
      <div class="verdict-metrics">
        <div><b>第 ${g.rateRank} 名</b><span>四校增值排名（共 4 所）</span></div>
        <div><b>${pct1(focusBand.declineRate)}</b><span>${bandPlain(focusBand.key)}学生退步比例 · ${peerBandLabel} ${pct1(focusBand.base)}</span></div>
        <div><b>${riskAll.length} 人</b><span>需要重点关注 · 占全校 ${pct(riskAll.length / totals.length)}</span></div>
      </div>
    </div>`;

    const entrySub = bandRows.map((b) => `${bandPlain(b.key)} ${pct1(b.declineRate)}`).join(' · ');
    const scan = `<div class="report-scan">
      ${scanRow('01', '入口时的位置', bandPlain(focusBand.key), `${focusBand.n} 人中 ${focusBand.decline} 人退步（${pct1(focusBand.declineRate)}）`, `比${peerBandLabel}${diffPhrase(focusBand.excess)}`, `${focusBand.n} 人`, entryStatus, entrySub)}
      ${scanRow('02', '物理/历史方向', esc(selWorst.sel), `${selWorst.n} 人中 ${selWorst.decline} 人退步（${pct1(selWorst.declineRate)}）`, `比另一方向高 ${selGap.toFixed(1)} 个百分点`, `${selWorst.n} 人`, selStatus, esc(selText))}
      ${scanRow('03', '班级', esc(topClass.name), `${topClass.n} 人中 ${topClass.decline} 人总分退步（${pct1(topClass.actual)}）`, `比${peerClassLabel}${diffPhrase(topClass.excess)}`, `${topClass.risk} 人需重点关注`, classStatus, `涉及人数最多：${esc(broadClass.name)} ${broadClass.risk} 人`)}
      ${scanRow('04', '学科', esc(topSubject.subject), `需重点关注学生中 ${topSubject.count} 人单科掉2档以上`, `最集中的是${esc(topCellText)}`, '全校最多', subjStatus, `全校相对最弱：${esc(worstSub.subject)}${worstSub.rate < 1 ? '（拖累大于进步）' : '（进步仍大于退步）'}`)}
    </div>`;

    /* 热点矩阵 */
    const hotRows = classProblems.slice().sort((a, b) => b.risk - a.risk).slice(0, 8);
    const hotSlots = [0, 1, 2].map((i) => {
      const t = topCells[i];
      return t
        ? `<div class="report-hot-slot"><span>${esc(t.className)} ${esc(t.subject)}</span><b>${t.count} 人</b></div>`
        : `<div class="report-hot-slot empty"><span>—</span><b>暂无明显集中点</b></div>`;
    }).join('');
    const hotTable = `<div class="table-wrap r-hot-wrap"><table class="r-hot">
      <thead><tr><th>班级</th>${hotCols.map((s) => `<th>${esc(s)}</th>`).join('')}<th>合计</th></tr></thead>
      <tbody>${hotRows.map((c0) => `<tr><th>${esc(c0.name)}<small>${c0.risk}人</small></th>${hotCols.map((s) => {
        const n = cell[c0.id + '|' + s] || 0;
        return `<td class="${n ? 'on' : ''}" title="${esc(c0.name + ' ' + s)}：${n} 人单科掉2档以上">${n || ''}</td>`;
      }).join('')}<td class="sum">${c0.risk}</td></tr>`).join('')}</tbody>
    </table></div><div class="report-caption">行是班级，列是学科；数字是“需重点关注学生中，这个班这一科掉了2档及以上”的人数。只列需重点关注学生最多的8个班，空白为0人。全部学生的矩阵见附录 C2。</div>`;

    /* 个体规模 */
    const tagDefs = [
      { key: 'total2', label: '总分掉2档以上', count: severeRisk, tone: 'red' },
      { key: 'high', label: '入口靠前但退步', count: highRisk, tone: 'amber' },
      { key: 'subject2', label: '至少1科掉2档以上', count: subjRisk, tone: 'purple' },
      { key: 'deep', label: '单科掉4档以上', count: deepRisk, tone: 'red' }
    ];
    const tagCards = tagDefs.map((t) => `<div class="report-tag-card ${t.tone}">
      <span>${t.label}</span><b>${t.count}<small>人</small></b><em>占 ${pct(t.count / totals.length)}</em>
    </div>`).join('');
    const riskCols = [
      { key: 'studentNo', label: '学号', render: (x) => `<span class="code">${esc(x.studentNo)}</span>` },
      { key: 'studentName', label: '姓名' },
      { key: 'className', label: '班级' },
      { key: 'grade', label: '入口第几档 → 现在', render: (x) => `第${x.entryGrade}档 → 第${x.currentGrade}档` },
      { key: 'level', label: '掉了几档', align: 'num', render: (x) => Math.abs(x.level) },
      { key: 'tags', label: '情况', render: (x) => x.tags.map(riskTag).join(' ') },
      { key: 'worst', label: '最需要补的科', render: (x) => x.worst && x.worst.level < 0 ? `${esc(x.worst.subject)}（掉${Math.abs(x.worst.level)}档）` : '—' }
    ];
    const riskTable = `<div class="report-list-note">共 ${riskAll.length} 人需要重点关注；正文按“掉档多少”从重到轻列前 ${riskRows.length} 人，完整名单由系统导出。四类标签有重叠，不能相加。</div>`
      + UI.table({ columns: riskCols, rows: riskRows, empty: '暂无需要重点关注的学生' });

    /* 行动清单 */
    const isGood = overallKey === 'highlight' || overallKey === 'normal';
    const hotSubs = topCells.map((t) => t.subject).filter((s, i, arr) => arr.indexOf(s) === i);
    const teachSubs = hotSubs.length ? hotSubs.join('、') : topSubject.subject;
    const hotGroups = {};
    topCells.forEach((t) => {
      (hotGroups[t.className] || (hotGroups[t.className] = [])).push(`${t.subject}${t.count}人`);
    });
    const hotText = Object.keys(hotGroups).map((k) => `${k}${hotGroups[k].join('、')}`).join('；') || '相关班级和学科';
    const targetIds = [];
    [topClass.id, topCell ? topCell.classId : ''].forEach((id) => {
      if (id && targetIds.indexOf(id) < 0) targetIds.push(id);
    });
    const targetNames = targetIds.map((id) => (classMap[id] || {}).name).filter(Boolean).join('、') || topClass.name;
    const targetRisk = targetIds.reduce((s, id) => s + (riskByClass[id] || 0), 0) || topClass.risk;
    const targetDecline = targetIds.reduce((s, id) => {
      const c0 = classProblems.find((x) => x.id === id);
      return s + (c0 ? c0.decline : 0);
    }, 0) || topClass.decline;
    const trendText = isGood ? `是否保持在 ${pct1(focusBand.declineRate)} 左右` : `是否从 ${pct1(focusBand.declineRate)} 降下来`;
    const teachText = isGood
      ? `找 ${esc(teachSubs)} 备课组：总结可复制的做法，形成一页经验卡。`
      : `找 ${esc(teachSubs)} 备课组：先看 ${esc(hotText)} 的共同失分点，做错题归类；2 周后看这几科掉2档以上的人数是否下降。`;
    const actions = `<div class="report-recs">
      <div><b>教学上</b><span>${teachText}</span></div>
      <div><b>班级管理</b><span>找 ${esc(targetNames)} 班主任和${esc(teachSubs)}老师：${isGood ? '保持节奏，继续关注名单里的学生' : `3 天内核对 ${targetRisk} 人名单，先谈入口时靠前但退步的学生`}。</span></div>
      <div><b>两周后</b><span>年级主任复查：${bandPlain(focusBand.key)}学生退步比例${trendText}，${esc(targetNames)}退步人数是否控制在 ${targetDecline} 人以内。</span></div>
    </div>`;

    /* 数据依据 */
    const compareTable = UI.table({
      columns: [
        { key: 'schoolName', label: '学校', render: (x) => x.schoolId === schoolId ? `<b>${esc(x.schoolName)}</b>` : esc(x.schoolName) },
        { key: 'n', label: '参评人数', align: 'num' },
        { key: 'strength', label: '整体位置（学业实力）', align: 'num', render: (x) => f1(x.strength) },
        { key: 'rate', label: '增值表现（相对进步率）', align: 'num', render: (x) => `<b class="${x.rate >= 1 ? 'r-good' : 'r-bad'}">${f2(x.rate)}</b>` },
        { key: 'decline', label: '退步拖累（退步值）', align: 'num', render: (x) => f1(x.decline) },
        { key: 'rank', label: '排名（整体/增值）', render: (x) => `${x.strengthRank} / ${x.rateRank}` }
      ],
      rows: (r.schoolEval['总分'] || []).slice().sort((a, b) => a.strengthRank - b.strengthRank),
      rowClass: (x) => x.schoolId === schoolId ? 'report-row-active' : ''
    });
    const bandTable = UI.table({
      columns: [
        { key: 'label', label: '入口位置段', render: (b) => `<b>${bandPlain(b.key)}</b> <span class="tiny weak">${b.label}</span>` },
        { key: 'n', label: '人数', align: 'num' },
        { key: 'decline', label: '退步人数', align: 'num' },
        { key: 'declineRate', label: '退步比例', align: 'num', render: (b) => pct1(b.declineRate) },
        { key: 'base', label: peerBandLabel, align: 'num', render: (b) => pct1(b.base) },
        { key: 'excess', label: '相差', align: 'num', render: (b) => `<b class="${b.excess >= 0 ? 'r-bad' : 'r-good'}">${diffPhrase(b.excess)}</b>` }
      ],
      rows: bandRows
    });
    const stack = stackedBars(allSubjectRows)
      + `<div class="r-legend"><span class="r-stack-p">进步</span><span class="r-stack-k">保持</span><span class="r-stack-d">退步</span><span class="tiny weak">条内为人数占比，右侧为增值表现</span></div>`;
    const flows = topFlows(totals);
    const flowDown = flows.filter((f) => f.to > f.from).reduce((s, f) => s + f.count, 0);
    const flowUp = flows.filter((f) => f.to < f.from).reduce((s, f) => s + f.count, 0);
    const flowNote = flows.length
      ? `<div class="report-inline-note">主要流向（不含保持）：${flows.map((f) => `入口第${f.from}档→现在第${f.to}档 ${f.count} 人`).join('、')}；前三条中下降 ${flowDown} 人、上升 ${flowUp} 人。</div>`
      : '';
    const evidence = `<div class="report-evidence">
      <div class="report-subhead mt-16">四校对比</div>${compareTable}
      <div class="report-subhead mt-16">入口时的位置</div>${bandTable}${excessBars(bandRows)}<div class="report-caption">柱长单位为“百分点”；向右=比同位置高，向左=低。</div>
      <div class="report-subhead mt-16">入口第几档 → 现在第几档</div>${flowMatrix(totals)}${flowNote}
      <div class="report-subhead mt-16">各科进步 / 保持 / 退步</div>${stack}
      <div class="report-note">读法：入口前23% ≈ 系统 G1–G3（理论22.6%）；掉档=等级下降，掉2档=从第3档到第5档；增值指数 1.0 为平衡点；同水平=按入口成绩与其他三校位置相同的学生比；需要重点关注的学生是学生跟进名单，不等于学校问题数量。</div>
      <div class="report-note">判定：重点关注=相差≥10个百分点且人数≥8（入口位置段≥30、学科≥10人且增值指数<1）；关注=未达重点关注但人数较多或弱于平衡；较好=明显好于同水平。</div>
    </div>`;

    const check = (items) => `<div class="report-check">核对：${items.map((x) => `<button class="report-check-link" data-action="scrollReport" data-target="${x.target}">${x.label}</button>`).join(' / ')}</div>`;

    /* 附录：数据全貌 */
    const schoolRows = (r.schoolEval['总分'] || []).slice().sort((a, b) => a.strengthRank - b.strengthRank);
    const allClassRows = classes.map((c) => {
      const cp = classProblems.find((x) => x.id === c.id);
      const members = studentTotals(r, schoolId, c.id);
      const decline = members.filter((x) => x.status === '退步').length;
      return Object.assign({}, c, {
        decline,
        actual: c.n ? decline / c.n : 0,
        excess: cp ? cp.excess : null,
        risk: riskByClass[c.id] || 0,
        small: c.n < r.smallSample
      });
    }).sort((a, b) => b.risk - a.risk || b.excess - a.excess);
    const tagRows = allClassRows.map((c) => {
      const t = tagByClass[c.id] || { total: 0, total2: 0, high: 0, subject2: 0, deep: 0 };
      return Object.assign({}, c, t);
    });
    const a2 = `<div class="table-wrap"><table class="table r-app-table">
      <thead><tr><th>学科</th>${schoolRows.map((s) => `<th>${esc(s.schoolName)}<small>增值 / 掉档</small></th>`).join('')}</tr></thead>
      <tbody>${subjectsOf(r).map((sub) => `<tr><th>${esc(sub)}</th>${schoolRows.map((s) => {
        const g = (r.schoolEval[sub] || []).find((x) => x.schoolId === s.schoolId);
        const bad = allBadBySchoolSubject[s.schoolId + '|' + sub] || 0;
        return `<td>${g ? `<b class="${g.rate >= 1 ? 'r-good' : 'r-bad'}">${f2(g.rate)}</b>` : '—'}<small>${bad}人</small></td>`;
      }).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
    const b2 = `<div class="table-wrap"><table class="table r-app-table">
      <thead><tr><th>方向</th><th>人数</th><th>退步人数</th><th>退步比例</th><th>比另一方向</th></tr></thead>
      <tbody>${selStats.map((s) => {
        const other = selStats.find((x) => x.sel !== s.sel);
        const gap = other ? (s.declineRate - other.declineRate) * 100 : null;
        return `<tr><td>${esc(s.sel)}</td><td>${s.n}</td><td>${s.decline}</td><td>${pct1(s.declineRate)}</td><td>${gap == null ? '—' : diffPhrase(gap)}</td></tr>`;
      }).join('')}</tbody>
    </table></div>`;
    const b3 = `<div class="table-wrap"><table class="table r-app-table">
      <thead><tr><th>班级</th><th>人数</th><th>总分退步</th><th>退步比例</th><th>比同类班</th><th>总分掉2档</th><th>入口靠前但退步</th><th>至少1科掉2档</th><th>单科掉4档</th><th>需重点关注</th></tr></thead>
      <tbody>${tagRows.map((c) => `<tr class="${c.id === topClass.id ? 'report-row-active' : ''}">
        <td>${esc(c.name)}${c.small ? ' <span class="badge badge-amber">小样本</span>' : ''}</td><td>${c.n}</td><td>${c.decline}</td><td>${pct1(c.actual)}</td>
        <td>${c.excess == null ? '—' : diffPhrase(c.excess)}</td><td>${c.total2}</td><td>${c.high}</td><td>${c.subject2}</td><td>${c.deep}</td><td>${c.risk}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
    const c1 = `<div class="table-wrap"><table class="table r-app-table">
      <thead><tr><th>学科</th><th>人数</th><th>退步人数</th><th>退步比例</th><th>单科掉2档（全部）</th><th>其中需重点关注</th><th>增值表现</th></tr></thead>
      <tbody>${allSubjectRows.map((s) => `<tr class="${s.subject === topSubject.subject ? 'report-row-active' : ''}">
        <td>${esc(s.subject)}</td><td>${s.n}</td><td>${s.declineCount || 0}</td><td>${pct1(s.declineRatio || 0)}</td><td>${s.allCount}</td><td>${s.count}</td><td><b class="${s.rate >= 1 ? 'r-good' : 'r-bad'}">${f2(s.rate)}</b></td>
      </tr>`).join('')}</tbody>
    </table></div>`;
    const matrixTable = (data, ref) => `<div class="table-wrap r-hot-wrap"><table class="r-hot">
      <thead><tr><th>班级</th>${hotCols.map((s) => `<th>${esc(s)}</th>`).join('')}<th>合计</th></tr></thead>
      <tbody>${allClassRows.map((c0) => {
        const vals = hotCols.map((s) => data[c0.id + '|' + s] || 0);
        return `<tr><th>${esc(c0.name)}<small>${c0.n}人</small></th>${vals.map((n, i) => `<td class="${n ? 'on' : ''} ${ref && topCell && topCell.classId === c0.id && topCell.subject === hotCols[i] ? 'ref' : ''}" title="${esc(c0.name + ' ' + hotCols[i])}：${n} 人">${n || ''}</td>`).join('')}<td class="sum">${vals.reduce((a, b) => a + b, 0)}</td></tr>`;
      }).join('')}</tbody>
    </table></div>`;
    const c2 = matrixTable(allCell, false);
    const c3 = matrixTable(cell, true);
    const matrixNote = `<div class="report-caption">“合计”是该班各科掉档人次，同一学生多科会计多次，不等于人数。</div>`;
    const d1 = `<div class="table-wrap"><table class="table r-app-table">
      <thead><tr><th>班级</th><th>需重点关注</th><th>总分掉2档</th><th>入口靠前但退步</th><th>至少1科掉2档</th><th>单科掉4档</th></tr></thead>
      <tbody>${tagRows.map((c) => `<tr><td>${esc(c.name)}</td><td><b>${c.total}</b></td><td>${c.total2}</td><td>${c.high}</td><td>${c.subject2}</td><td>${c.deep}</td></tr>`).join('')}</tbody>
    </table></div>`;
    const riskAllSorted = riskAll.slice().sort((a, b) => (a.level - b.level) || (a.entryGrade - b.entryGrade));
    const appRiskCols = [
      { key: 'studentNo', label: '学号', render: (x) => `<span class="code">${esc(x.studentNo)}</span>` },
      { key: 'studentName', label: '姓名' },
      { key: 'className', label: '班级' },
      { key: 'grade', label: '入口第几档 → 现在', render: (x) => `第${x.entryGrade}档 → 第${x.currentGrade}档` },
      { key: 'level', label: '掉了几档', align: 'num', render: (x) => Math.abs(x.level) },
      { key: 'tags', label: '情况', render: (x) => x.tags.map(riskTagLabel).join('；') },
      { key: 'worst', label: '最需要补的科', render: (x) => x.worst && x.worst.level < 0 ? `${esc(x.worst.subject)}（掉${Math.abs(x.worst.level)}档）` : '—' }
    ];
    const d2 = `<div class="report-list-note">全部 ${riskAllSorted.length} 人，按“掉档多少”从重到轻排列。</div>`
      + UI.table({ columns: appRiskCols, rows: riskAllSorted, empty: '暂无需要重点关注的学生' });
    const quality = r.quality || {};
    const e = `<div class="table-wrap"><table class="table r-app-table">
      <thead><tr><th>项目</th><th>数值</th><th>说明</th></tr></thead>
      <tbody>
        <tr><td>联考样本</td><td>${quality.sample || r.totals.length}</td><td>入口、评价都有成绩的学生</td></tr>
        <tr><td>剔除</td><td>${quality.excluded || 0}</td><td>缺考、成绩不完整等</td></tr>
        <tr><td>其中部分缺考</td><td>${quality.partialAbsentExcluded || 0}</td><td>按任务设置剔除</td></tr>
        <tr><td>参评人数</td><td>${r.totals.length}</td><td>进入本次评价的学生</td></tr>
        <tr><td>小样本班</td><td>${(quality.smallClasses || []).length}</td><td>${(quality.smallClasses || []).join('、') || '无'}；只展示指标，不参与排名</td></tr>
        <tr><td>结果版本</td><td>${esc(task.resultVersion || '—')}</td><td>报告与结果版本绑定</td></tr>
        <tr><td>参数</td><td>等级 ${r.gradeCount} 档 / 保持阈值 ${r.keepThreshold} / 级差 ${r.stepSize} / 小样本 ${r.smallSample}</td><td>算法参数</td></tr>
      </tbody>
    </table></div>`;
    const appendix = `<div class="report-appendix">
      <div class="report-inline-note">以下为全量数据，供核对正文判断，不参与正文结论。正文的“需重点关注学生”是学生跟进名单，不等于学校问题数量。</div>
      <div class="report-subhead mt-16" id="app-a1">A1 四校总表</div>${compareTable}
      <div class="report-subhead mt-16" id="app-a2">A2 四校 × 学科（增值表现 / 单科掉2档人数）</div>${a2}
      <div class="report-subhead mt-16" id="app-b1">B1 入口时的位置</div>${bandTable}
      <div class="report-subhead mt-16" id="app-b2">B2 物理 / 历史方向</div>${b2}
      <div class="report-subhead mt-16" id="app-b3">B3 班级全表</div>${b3}
      <div class="report-subhead mt-16" id="app-c1">C1 学科全表</div>${c1}
      <div class="report-subhead mt-16" id="app-c2">C2 全部学生：班级 × 学科掉档人数</div>${c2}${matrixNote}
      <div class="report-subhead mt-16" id="app-c3">C3 需重点关注学生：班级 × 学科掉档人数</div>${c3}${matrixNote}
      <div class="report-subhead mt-16" id="app-d1">D1 班级 × 标签全表</div>${d1}
      <div class="report-subhead mt-16" id="app-d2">D2 学生完整名单</div>${d2}
      <div class="report-subhead mt-16" id="app-e">E 数据质量与口径</div>${e}
      <div class="report-note">核对方法：正文的班/科/学生可在 B3、C2、C3、D2 中按同一口径找到；矩阵数字为人数，不是分数；“需重点关注”四类标签有重叠，不能相加。</div>
      <div class="report-check"><button class="btn btn-sm" data-action="exportReportCsv">导出数据 CSV</button></div>
    </div>`;

    const csvCell = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csvRows = [];
    const csvPush = (arr) => csvRows.push(arr.map(csvCell).join(','));
    csvPush([`${g.schoolName}增值报告数据全貌`]);
    csvPush(['结果版本', task.resultVersion || '']);
    csvPush([]);
    csvPush(['A1 四校总表']);
    csvPush(['学校', '参评人数', '整体位置', '增值表现', '退步拖累', '整体排名', '增值排名']);
    schoolRows.forEach((s) => csvPush([s.schoolName, s.n, f1(s.strength), f2(s.rate), f1(s.decline), s.strengthRank, s.rateRank]));
    csvPush([]);
    csvPush(['B1 入口时的位置']);
    csvPush(['入口位置段', '人数', '退步人数', '退步比例', '其他三校同位置', '相差（百分点）']);
    bandRows.forEach((b) => csvPush([bandPlain(b.key), b.n, b.decline, pct1(b.declineRate), pct1(b.base), b.excess.toFixed(1)]));
    csvPush([]);
    csvPush(['B3 班级全表']);
    csvPush(['班级', '人数', '总分退步', '退步比例', '比同类班（百分点）', '总分掉2档', '入口靠前但退步', '至少1科掉2档', '单科掉4档', '需重点关注']);
    tagRows.forEach((c) => csvPush([c.name, c.n, c.decline, pct1(c.actual), c.excess == null ? '' : c.excess.toFixed(1), c.total2, c.high, c.subject2, c.deep, c.risk]));
    csvPush([]);
    csvPush(['C1 学科全表']);
    csvPush(['学科', '人数', '退步人数', '退步比例', '单科掉2档（全部）', '其中需重点关注', '增值表现']);
    allSubjectRows.forEach((s) => csvPush([s.subject, s.n, s.declineCount || 0, pct1(s.declineRatio || 0), s.allCount, s.count, f2(s.rate)]));
    csvPush([]);
    csvPush(['D1 班级×标签全表']);
    csvPush(['班级', '需重点关注', '总分掉2档', '入口靠前但退步', '至少1科掉2档', '单科掉4档']);
    tagRows.forEach((c) => csvPush([c.name, c.total, c.total2, c.high, c.subject2, c.deep]));
    csvPush([]);
    csvPush(['D2 学生完整名单']);
    csvPush(['学号', '姓名', '班级', '入口第几档', '现在第几档', '掉了几档', '标签', '最需要补的科']);
    riskAllSorted.forEach((x) => csvPush([
      x.studentNo, x.studentName, x.className, x.entryGrade, x.currentGrade, Math.abs(x.level),
      x.tags.map(riskTagLabel).join('；'),
      x.worst ? `${x.worst.subject}（掉${Math.abs(x.worst.level)}档）` : ''
    ]));
    csvPush([]);
    csvPush(['E 数据质量']);
    csvPush(['联考样本', quality.sample || '']);
    csvPush(['剔除', quality.excluded || 0]);
    csvPush(['部分缺考', quality.partialAbsentExcluded || 0]);
    csvPush(['参评人数', r.totals.length]);
    csvPush(['小样本班', (quality.smallClasses || []).join('；')]);
    csvPush(['结果版本', task.resultVersion || '']);
    if (typeof window !== 'undefined') window.__REPORT_CSV__ = csvRows.join('\r\n');

    const toc = `<aside class="report-toc" id="report-toc">
      <div class="report-toc-title">报告目录</div>
      <button class="report-toc-link active" data-action="scrollReport" data-target="sec-overall">01 这轮怎么样</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-scan">02 问题在哪</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-hot">03 最集中的班和科</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-tags">04 涉及多少学生</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-actions">05 先找谁、做什么</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-evidence">06 数据依据</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-appendix">07 数据全貌</button>
      <button class="btn btn-primary btn-sm report-toc-export" data-action="printReport">导出 PDF</button>
      <div class="report-toc-note">A4 纵向 · 导出后可打印</div>
    </aside>`;
    const sections = section('01', '这轮怎么样', '一句话结论 + 三个关键数', verdict + check([{ target: 'app-a1', label: 'A1 四校总表' }, { target: 'app-b3', label: 'B3 班级全表' }]), 'sec-overall')
      + section('02', '问题在哪', '先看四件事：哪批学生、哪个方向、哪个班、哪一科', scan + check([{ target: 'app-b1', label: 'B1 入口位置' }, { target: 'app-b2', label: 'B2 物理/历史' }, { target: 'app-b3', label: 'B3 班级全表' }, { target: 'app-c1', label: 'C1 学科全表' }]), 'sec-scan')
      + section('03', '最集中的班和科', '需重点关注学生中，单科掉2档以上人数；按人数排序', `<div class="report-hot-top">${hotSlots}</div>${hotTable}` + check([{ target: 'app-c3', label: 'C3 重点关注矩阵' }, { target: 'app-c2', label: 'C2 全部学生矩阵' }]), 'sec-hot')
      + section('04', '涉及多少学生', '四类标签有重叠，不能相加', `<div class="report-tag-grid">${tagCards}</div>${tagTopTable}${riskTable}` + check([{ target: 'app-d1', label: 'D1 班级×标签' }, { target: 'app-d2', label: 'D2 完整名单' }]), 'sec-tags')
      + section('05', '先找谁、做什么', '教学、班级管理、两周后复查', actions + check([{ target: 'app-d2', label: 'D2 完整名单' }]), 'sec-actions')
      + section('06', '数据依据', '四校对比、入口位置、流向、各科结构', evidence + check([{ target: 'app-a1', label: 'A1 四校总表' }, { target: 'app-a2', label: 'A2 四校×学科' }, { target: 'app-b1', label: 'B1 入口位置' }, { target: 'app-c1', label: 'C1 学科全表' }, { target: 'app-e', label: 'E 数据质量' }]), 'sec-evidence')
      + section('07', '数据全貌', '全量数据，供核对；不参与正文结论', appendix, 'sec-appendix');
    setTimeout(function () { if (App.initReportToc) App.initReportToc(); }, 0);
    return shell(task, 'principal', `${g.schoolName}增值报告`, `读者：校长/学校管理员 · ${g.schoolName} · 六段：这轮怎么样 / 问题在哪 / 最集中的班和科 / 涉及多少学生 / 先找谁做什么 / 数据依据 / 数据全貌`, scopeBar(`<span class="report-scope-label">学校</span>${schoolSelect(r, schoolId)}`), `<div class="report-doc-grid"><div class="report-doc-main">${sections}</div>${toc}</div>`);
  }

  /* ---------- 03 年级 ---------- */
  function gradePage(task, r) {
    const schoolId = defaultSchool(r);
    const g = schoolRow(r, schoolId);
    if (!g) return shell(task, 'grade', '年级增值报告', '当前任务没有该校结果', '', `<div class="card"><div class="card-body">${UI.empty('暂无结果')}</div></div>`);
    const totals = studentTotals(r, schoolId);
    const classes = classList(r, schoolId);
    const valid = classes.filter((x) => x.n >= r.smallSample).slice().sort((a, b) => b.rate - a.rate);
    const worstClass = valid[valid.length - 1] || classes[0];
    const spread = valid.length > 1 ? (valid[0].rate - worstClass.rate) : 0;
    const declineSpread = valid.length > 1
      ? (Math.max(...valid.map((x) => x.declineRatio || 0)) - Math.min(...valid.map((x) => x.declineRatio || 0))) * 100
      : 0;
    const c = counts(totals);
    const subjects = rankedSubjects(r, schoolId);
    const bestSub = subjects[0], worstSub = subjects[subjects.length - 1];
    const small = classes.filter((x) => x.n < r.smallSample);
    const otherTotals = r.totals.filter((x) => x.schoolId !== schoolId);
    const hasPeers = otherTotals.length > 0;
    const peerBandLabel = hasPeers ? '其他三校入口相近的学生' : '全校入口相近的学生';
    const peerClassLabel = hasPeers ? '其他三校同类班' : '全校同类班';
    const baseBands = bandStats(hasPeers ? otherTotals : r.totals);
    const bandRows = bandStats(totals).map((b, i) => Object.assign({}, b, {
      base: baseBands[i].declineRate,
      excess: (b.declineRate - baseBands[i].declineRate) * 100
    }));
    const worstBand = bandRows.slice().sort((a, b) => b.excess - a.excess)[0];
    const bestBand = bandRows.slice().sort((a, b) => a.excess - b.excess)[0];
    const selStats = selectionStats(totals);
    const selWorst = selStats.slice().sort((a, b) => b.declineRate - a.declineRate)[0] || { sel: '—', n: 0, decline: 0, declineRate: 0 };
    const selGap = selStats.length > 1 ? (Math.max(...selStats.map((x) => x.declineRate)) - Math.min(...selStats.map((x) => x.declineRate))) * 100 : 0;

    const map = subjectRowsMap(r);
    const riskAll = buildRiskRows(r, schoolId, '', map);
    const riskByClass = {};
    riskAll.forEach((x) => { riskByClass[x.classId] = (riskByClass[x.classId] || 0) + 1; });
    const classProblems = classProblemRows(r, schoolId, baseBands, riskByClass);
    const topClass = classProblems.slice().sort((a, b) => b.excess - a.excess)[0] || {
      name: '—', n: 0, decline: 0, actual: 0, expected: 0, excess: 0, risk: 0
    };
    const badBySubject = {};
    riskAll.forEach((x) => x.bad.forEach((s) => { badBySubject[s.subject] = (badBySubject[s.subject] || 0) + 1; }));
    const allBadBySubject = {};
    r.rows.forEach((x) => {
      if (x.schoolId === schoolId && x.subject !== '总分' && x.level <= -2) allBadBySubject[x.subject] = (allBadBySubject[x.subject] || 0) + 1;
    });
    const allSubjectRows = orderedSubjectRows(r, schoolId).map((s) => Object.assign({}, s, {
      count: badBySubject[s.subject] || 0,
      allCount: allBadBySubject[s.subject] || 0
    }));
    const topSubject = allSubjectRows.filter((x) => x.count > 0).sort((a, b) => b.count - a.count)[0]
      || Object.assign({}, worstSub, { count: 0, allCount: 0 });

    const hotCols = subjectsOf(r);
    const classMap = Object.fromEntries(classes.map((x) => [x.id, x]));
    const cell = {}, allCell = {};
    riskAll.forEach((x) => {
      const seen = {};
      x.bad.forEach((s) => {
        if (seen[s.subject]) return;
        seen[s.subject] = 1;
        const k = x.classId + '|' + s.subject;
        cell[k] = (cell[k] || 0) + 1;
      });
    });
    r.rows.forEach((x) => {
      if (x.schoolId !== schoolId || x.subject === '总分' || x.level > -2) return;
      const k = x.classId + '|' + x.subject;
      allCell[k] = (allCell[k] || 0) + 1;
    });
    const topCells = Object.keys(cell).map((k) => {
      const p = k.split('|');
      return { classId: p[0], className: (classMap[p[0]] || {}).name || '', subject: p[1], count: cell[k] };
    }).sort((a, b) => b.count - a.count).slice(0, 3);
    const topCell = topCells[0] || null;
    const topCellText = topCell ? `${topCell.className}${topCell.subject} ${topCell.count} 人` : '暂无明显集中点';
    const tagByClass = {};
    riskAll.forEach((x) => {
      const t = tagByClass[x.classId] || (tagByClass[x.classId] = { total: 0, total2: 0, high: 0, subject2: 0, deep: 0 });
      t.total++;
      if (x.level <= -2) t.total2++;
      if (x.tags.indexOf('高入口退步') >= 0) t.high++;
      if (x.bad.length) t.subject2++;
      if (x.deep) t.deep++;
    });
    const tagTopRows = classes.map((x) => Object.assign({}, x, tagByClass[x.id] || { total: 0, total2: 0, high: 0, subject2: 0, deep: 0 }))
      .sort((a, b) => b.total - a.total || b.total2 - a.total2).slice(0, 8);

    const entryStatus = bandRows.every((b) => b.excess < 0) ? 'highlight' : statusFromExcess(worstBand.excess, worstBand.n, 30);
    const classStatus = (topClass.excess >= 10 && topClass.risk >= 8) ? 'problem'
      : topClass.excess >= 5 ? 'attention' : topClass.excess <= -10 ? 'highlight' : 'normal';
    const subjStatus = (topSubject.rate < 1 && topSubject.count >= 10) ? 'problem'
      : topSubject.count >= 10 ? 'attention' : topSubject.rate >= 1.5 ? 'highlight' : 'normal';
    const overallKey = (classStatus === 'problem' || subjStatus === 'problem') ? 'problem'
      : bandRows.every((b) => b.excess < 0) ? 'highlight'
        : (classStatus === 'attention' || subjStatus === 'attention') ? 'attention' : 'normal';
    const overall = STATUS[overallKey];
    const focusBand = overallKey === 'highlight' ? bestBand : worstBand;
    const overallText = overallKey === 'problem'
      ? `${g.schoolName}这轮先看${topClass.name}：${topClass.n} 人中 ${topClass.decline} 人总分退步（${pct1(topClass.actual)}），比${peerClassLabel}${diffPhrase(topClass.excess)}；最集中的是${topCellText}。`
      : overallKey === 'attention'
        ? `${g.schoolName}这轮整体接近同水平，但${topClass.name}、${topSubject.subject}等局部需要关注。`
        : overallKey === 'highlight'
          ? `${g.schoolName}这轮整体好于同水平：${bandPlain(focusBand.key)}学生退步比例 ${pct1(focusBand.declineRate)}，比其他三校低 ${Math.abs(focusBand.excess).toFixed(1)} 个百分点。`
          : `${g.schoolName}这轮整体接近同水平，没有发现明显异常。`;

    const verdict = `<div class="report-verdict ${overall.tone}">
      <div class="verdict-top"><span class="verdict-badge">${statusBadge(overallKey)}</span><span class="verdict-kicker">一句话结论</span></div>
      <div class="verdict-text">${esc(overallText)}</div>
      <div class="verdict-metrics">
        <div><b>${pct1(c.declineRatio)}</b><span>年级总分退步比例 · ${c.decline} 人退步</span></div>
        <div><b>${declineSpread.toFixed(1)} 个百分点</b><span>班级退步比例差距 · 最高与最低之差</span></div>
        <div><b>${riskAll.length} 人</b><span>需要重点关注 · 占年级 ${pct(riskAll.length / totals.length)}</span></div>
      </div>
    </div>`;

    const entrySub = bandRows.map((b) => `${bandPlain(b.key)} ${pct1(b.declineRate)}`).join(' · ');
    const scan = `<div class="report-scan">
      ${scanRow('01', '入口时的位置', bandPlain(focusBand.key), `${focusBand.n} 人中 ${focusBand.decline} 人退步（${pct1(focusBand.declineRate)}）`, `比${peerBandLabel}${diffPhrase(focusBand.excess)}`, `${focusBand.n} 人`, entryStatus, entrySub)}
      ${scanRow('02', '物理/历史方向', esc(selWorst.sel), `${selWorst.n} 人中 ${selWorst.decline} 人退步（${pct1(selWorst.declineRate)}）`, `比另一方向高 ${selGap.toFixed(1)} 个百分点`, `${selWorst.n} 人`, selGap >= 8 ? 'attention' : 'normal', esc(selStats.map((x) => `${x.sel} ${pct1(x.declineRate)}`).join(' · ')))}
      ${scanRow('03', '班级', esc(topClass.name), `${topClass.n} 人中 ${topClass.decline} 人总分退步（${pct1(topClass.actual)}）`, `比${peerClassLabel}${diffPhrase(topClass.excess)}`, `${topClass.risk} 人需重点关注`, classStatus, `退步比例最高：${esc(worstClass.name)} ${pct1(worstClass.declineRatio || 0)}`)}
      ${scanRow('04', '学科', esc(topSubject.subject), `需重点关注学生中 ${topSubject.count} 人单科掉2档以上`, `最集中的是${esc(topCellText)}`, '年级最多', subjStatus, `相对最弱：${esc(worstSub.subject)}（拖累大于进步）`)}
    </div>`;

    const hotRows = classProblems.slice().sort((a, b) => b.risk - a.risk).slice(0, 8);
    const hotSlots = [0, 1, 2].map((i) => {
      const t = topCells[i];
      return t ? `<div class="report-hot-slot"><span>${esc(t.className)} ${esc(t.subject)}</span><b>${t.count} 人</b></div>` : `<div class="report-hot-slot empty"><span>—</span><b>暂无明显集中点</b></div>`;
    }).join('');
    const hotTable = `<div class="table-wrap r-hot-wrap"><table class="r-hot">
      <thead><tr><th>班级</th>${hotCols.map((s) => `<th>${esc(s)}</th>`).join('')}<th>合计</th></tr></thead>
      <tbody>${hotRows.map((x) => `<tr><th>${esc(x.name)}<small>${x.risk}人</small></th>${hotCols.map((s) => {
        const n = cell[x.id + '|' + s] || 0;
        return `<td class="${n ? 'on' : ''}">${n || ''}</td>`;
      }).join('')}<td class="sum">${x.risk}</td></tr>`).join('')}</tbody>
    </table></div><div class="report-caption">数字是需重点关注学生中，这个班这一科掉了2档及以上的人数；只列需重点关注学生最多的8个班。</div>`;

    const tagDefs = [
      { label: '总分掉2档以上', count: riskAll.filter((x) => x.level <= -2).length, tone: 'red' },
      { label: '入口靠前但退步', count: riskAll.filter((x) => x.tags.indexOf('高入口退步') >= 0).length, tone: 'amber' },
      { label: '至少1科掉2档以上', count: riskAll.filter((x) => x.bad.length > 0).length, tone: 'purple' },
      { label: '单科掉4档以上', count: riskAll.filter((x) => x.deep).length, tone: 'red' }
    ];
    const tagCards = tagDefs.map((t) => `<div class="report-tag-card ${t.tone}"><span>${t.label}</span><b>${t.count}<small>人</small></b><em>占 ${pct(t.count / totals.length)}</em></div>`).join('');
    const tagTopTable = `<div class="report-subhead mt-16">标签分布（前 8 班）</div><div class="table-wrap"><table class="table r-app-table">
      <thead><tr><th>班级</th><th>需重点关注</th><th>总分掉2档</th><th>入口靠前但退步</th><th>至少1科掉2档</th><th>单科掉4档</th></tr></thead>
      <tbody>${tagTopRows.map((x) => `<tr class="${x.id === topClass.id ? 'report-row-active' : ''}"><td>${esc(x.name)}</td><td><b>${x.total}</b></td><td>${x.total2}</td><td>${x.high}</td><td>${x.subject2}</td><td>${x.deep}</td></tr>`).join('')}</tbody>
    </table></div><div class="report-caption">四类标签有重叠，不能相加；全量见附录 D1。</div>`;

    const riskCols = [
      { key: 'studentNo', label: '学号', render: (x) => `<span class="code">${esc(x.studentNo)}</span>` },
      { key: 'studentName', label: '姓名' },
      { key: 'className', label: '班级' },
      { key: 'grade', label: '入口第几档 → 现在', render: (x) => `第${x.entryGrade}档 → 第${x.currentGrade}档` },
      { key: 'level', label: '掉了几档', align: 'num', render: (x) => Math.abs(x.level) },
      { key: 'tags', label: '情况', render: (x) => x.tags.map(riskTag).join(' ') },
      { key: 'worst', label: '最需要补的科', render: (x) => x.worst && x.worst.level < 0 ? `${esc(x.worst.subject)}（掉${Math.abs(x.worst.level)}档）` : '—' }
    ];
    const riskRows = riskAll.slice().sort((a, b) => (a.level - b.level) || (a.entryGrade - b.entryGrade)).slice(0, 30);
    const riskTable = `<div class="report-list-note">共 ${riskAll.length} 人需要重点关注；正文列前 ${riskRows.length} 人，完整名单见附录 D2。</div>` + UI.table({ columns: riskCols, rows: riskRows, empty: '暂无需要重点关注的学生' });

    const targetNames = topClass.name;
    const actions = `<div class="report-recs">
      <div><b>教学上</b><span>找 ${esc(topSubject.subject)}、${esc(worstSub.subject)} 备课组：先看 ${esc(topCellText)} 的共同失分点，做错题归类；2 周后看这两科掉2档以上人数是否下降。</span></div>
      <div><b>班级管理</b><span>找 ${esc(targetNames)} 班主任和${esc(topSubject.subject)}老师：3 天内核对 ${topClass.risk} 人名单，先谈入口时靠前但退步的学生。</span></div>
      <div><b>两周后</b><span>年级主任复查：${bandPlain(focusBand.key)}学生退步比例是否从 ${pct1(focusBand.declineRate)} 降下来，${esc(targetNames)}退步人数是否控制在 ${topClass.decline} 人以内。</span></div>
    </div>`;

    const classTable = UI.table({
      columns: [
        { key: 'name', label: '班级' },
        { key: 'n', label: '人数', align: 'num' },
        { key: 'decline', label: '总分退步', align: 'num' },
        { key: 'actual', label: '退步比例', align: 'num', render: (x) => pct1(x.actual) },
        { key: 'excess', label: '比同类班', align: 'num', render: (x) => x.excess == null ? '—' : diffPhrase(x.excess) },
        { key: 'risk', label: '需重点关注', align: 'num' }
      ],
      rows: classProblems.slice().sort((a, b) => b.risk - a.risk),
      rowClass: (x) => x.id === topClass.id ? 'report-row-active' : ''
    });
    const evidence = `<div class="report-evidence">
      <div class="report-subhead mt-16">班级全表</div>${classTable}
      <div class="report-subhead mt-16">学科全表</div>${UI.table({ columns: [
        { key: 'subject', label: '学科' }, { key: 'n', label: '人数', align: 'num' },
        { key: 'declineCount', label: '退步人数', align: 'num' },
        { key: 'declineRatio', label: '退步比例', align: 'num', render: (x) => pct1(x.declineRatio || 0) },
        { key: 'count', label: '需重点关注单科掉档', align: 'num' },
        { key: 'rate', label: '增值表现', align: 'num', render: (x) => f2(x.rate) }
      ], rows: allSubjectRows })}
      <div class="report-note">状态：重点关注 / 关注 / 正常 / 较好；入口段比较使用其他三校入口相近学生，单校任务回退全校。</div>
    </div>`;
    const allClassRows = classes.map((x) => {
      const cp = classProblems.find((y) => y.id === x.id);
      const members = studentTotals(r, schoolId, x.id);
      const decline = members.filter((y) => y.status === '退步').length;
      const t = tagByClass[x.id] || { total: 0, total2: 0, high: 0, subject2: 0, deep: 0 };
      return Object.assign({}, x, t, {
        decline,
        actual: x.n ? decline / x.n : 0,
        excess: cp ? cp.excess : null,
        risk: riskByClass[x.id] || 0
      });
    }).sort((a, b) => b.risk - a.risk || b.excess - a.excess);
    const appClassTable = `<div class="table-wrap"><table class="table r-app-table">
      <thead><tr><th>班级</th><th>人数</th><th>总分退步</th><th>退步比例</th><th>比同类班</th><th>总分掉2档</th><th>入口靠前但退步</th><th>至少1科掉2档</th><th>单科掉4档</th><th>需重点关注</th></tr></thead>
      <tbody>${allClassRows.map((x) => `<tr class="${x.id === topClass.id ? 'report-row-active' : ''}"><td>${esc(x.name)}${x.n < r.smallSample ? ' <span class="badge badge-amber">小样本</span>' : ''}</td><td>${x.n}</td><td>${x.decline}</td><td>${pct1(x.actual)}</td><td>${x.excess == null ? '—' : diffPhrase(x.excess)}</td><td>${x.total2}</td><td>${x.high}</td><td>${x.subject2}</td><td>${x.deep}</td><td>${x.risk}</td></tr>`).join('')}</tbody>
    </table></div>`;
    const appTagTable = `<div class="table-wrap"><table class="table r-app-table">
      <thead><tr><th>班级</th><th>需重点关注</th><th>总分掉2档</th><th>入口靠前但退步</th><th>至少1科掉2档</th><th>单科掉4档</th></tr></thead>
      <tbody>${allClassRows.map((x) => `<tr><td>${esc(x.name)}</td><td><b>${x.total}</b></td><td>${x.total2}</td><td>${x.high}</td><td>${x.subject2}</td><td>${x.deep}</td></tr>`).join('')}</tbody>
    </table></div>`;
    const appRiskTable = UI.table({ columns: riskCols, rows: riskAll.slice().sort((a, b) => (a.level - b.level) || (a.entryGrade - b.entryGrade)), empty: '暂无需要重点关注的学生' });
    const appMatrix = `<div class="table-wrap r-hot-wrap"><table class="r-hot">
      <thead><tr><th>班级</th>${hotCols.map((s) => `<th>${esc(s)}</th>`).join('')}<th>合计</th></tr></thead>
      <tbody>${allClassRows.map((x) => {
        const vals = hotCols.map((s) => cell[x.id + '|' + s] || 0);
        return `<tr><th>${esc(x.name)}<small>${x.n}人</small></th>${vals.map((n, i) => `<td class="${n ? 'on' : ''}">${n || ''}</td>`).join('')}<td class="sum">${vals.reduce((a, b) => a + b, 0)}</td></tr>`;
      }).join('')}</tbody>
    </table></div><div class="report-caption">数字为需重点关注学生中单科掉2档以上人数；合计为各科人次，不等于人数。</div>`;
    const q = r.quality || {};
    const qualityTable = `<div class="table-wrap"><table class="table r-app-table">
      <thead><tr><th>项目</th><th>数值</th><th>说明</th></tr></thead>
      <tbody>
        <tr><td>参评人数</td><td>${r.totals.length}</td><td>进入本次评价的学生</td></tr>
        <tr><td>联考样本</td><td>${q.sample || r.totals.length}</td><td>入口、评价都有成绩</td></tr>
        <tr><td>剔除</td><td>${q.excluded || 0}</td><td>缺考、成绩不完整等</td></tr>
        <tr><td>小样本班</td><td>${(q.smallClasses || []).length}</td><td>${(q.smallClasses || []).join('、') || '无'}；只展示指标，不参与排名</td></tr>
        <tr><td>结果版本</td><td>${esc(task.resultVersion || '—')}</td><td>报告与结果版本绑定</td></tr>
      </tbody>
    </table></div>`;

    const appendix = `<div class="report-appendix">
      <div class="report-inline-note">以下为本年级全量数据，供核对；不包含其他学校学生。</div>
      <div class="report-subhead mt-16" id="g-app-b3">B3 班级全表</div>${appClassTable}
      <div class="report-subhead mt-16" id="g-app-c1">C1 学科全表</div>${UI.table({ columns: [
        { key: 'subject', label: '学科' }, { key: 'n', label: '人数', align: 'num' },
        { key: 'declineCount', label: '退步人数', align: 'num' },
        { key: 'declineRatio', label: '退步比例', align: 'num', render: (x) => pct1(x.declineRatio || 0) },
        { key: 'allCount', label: '单科掉2档（全部）', align: 'num' },
        { key: 'count', label: '其中需重点关注', align: 'num' },
        { key: 'rate', label: '增值表现', align: 'num', render: (x) => f2(x.rate) }
      ], rows: allSubjectRows })}
      <div class="report-subhead mt-16" id="g-app-c2">C2 班级 × 学科（需重点关注）</div>${appMatrix}
      <div class="report-subhead mt-16" id="g-app-d1">D1 班级 × 标签</div>${appTagTable}
      <div class="report-subhead mt-16" id="g-app-d2">D2 需重点关注学生名单</div>${appRiskTable}
      <div class="report-subhead mt-16" id="g-app-e">E 数据质量</div>${qualityTable}
      <div class="report-note">核对方法：正文的班级/学科/学生可在 B3、C1、C2、D2 中按同一口径找到；“需重点关注”四类标签有重叠，不能相加。</div>
    </div>`;

    const toc = `<aside class="report-toc" id="report-toc">
      <div class="report-toc-title">报告目录</div>
      <button class="report-toc-link active" data-action="scrollReport" data-target="sec-overall">01 年级怎么样</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-scan">02 问题在哪</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-hot">03 最集中的班和科</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-tags">04 涉及多少学生</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-actions">05 先找谁、做什么</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-evidence">06 数据依据</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-appendix">07 数据全貌</button>
      <button class="btn btn-primary btn-sm report-toc-export" data-action="printReport">导出 PDF</button>
      <div class="report-toc-note">A4 纵向 · 导出后可打印</div>
    </aside>`;
    const sections = section('01', '年级怎么样', '一句话结论 + 三个关键数', verdict + checkLine([{ target: 'g-app-b3', label: 'B3 班级全表' }]), 'sec-overall')
      + section('02', '问题在哪', '入口位置 / 方向 / 班级 / 学科', scan + checkLine([{ target: 'g-app-b3', label: 'B3 班级全表' }, { target: 'g-app-c1', label: 'C1 学科全表' }]), 'sec-scan')
      + section('03', '最集中的班和科', '需重点关注学生中，单科掉2档以上人数', `<div class="report-hot-top">${hotSlots}</div>${hotTable}`, 'sec-hot')
      + section('04', '涉及多少学生', '四类标签有重叠，不能相加', `<div class="report-tag-grid">${tagCards}</div>${tagTopTable}${riskTable}` + checkLine([{ target: 'g-app-d1', label: 'D1 班级×标签' }, { target: 'g-app-d2', label: 'D2 名单' }]), 'sec-tags')
      + section('05', '先找谁、做什么', '教学、班级管理、两周后复查', actions, 'sec-actions')
      + section('06', '数据依据', '班级、学科、入口位置', evidence + checkLine([{ target: 'g-app-b3', label: 'B3 班级全表' }, { target: 'g-app-c1', label: 'C1 学科全表' }]), 'sec-evidence')
      + section('07', '数据全貌', '本年级全量数据，供核对', appendix, 'sec-appendix');
    setTimeout(function () { if (App.initReportToc) App.initReportToc(); }, 0);
    return shell(task, 'grade', `${g.schoolName}年级增值报告`, `读者：年级主任/教务处 · ${g.schoolName} · 六段：年级怎么样 / 问题在哪 / 最集中的班和科 / 涉及多少学生 / 先找谁做什么 / 数据依据 / 数据全貌`, scopeBar(`<span class="report-scope-label">学校</span>${schoolSelect(r, schoolId)}`), `<div class="report-doc-grid"><div class="report-doc-main">${sections}</div>${toc}</div>`);
  }

  /* ---------- 04 班主任 ---------- */
  function homeroomPage(task, r) {
    const schoolId = defaultSchool(r);
    const classId = defaultClass(r, schoolId);
    const g = classRow(r, schoolId, classId);
    if (!g) return shell(task, 'homeroom', '班级增值报告', '当前任务没有该班结果', '', `<div class="card"><div class="card-body">${UI.empty('暂无结果')}</div></div>`);
    const students = studentTotals(r, schoolId, classId);
    const c = counts(students);
    const gradeTotals = studentTotals(r, schoolId);
    const gradeRate = counts(gradeTotals).declineRatio;
    const allSubjectRows = subjectsOf(r).map((sub) => classSubject(r, schoolId, classId, sub)).filter((x) => x && x.n > 0);
    const validSubjects = allSubjectRows.filter((x) => x.n >= r.smallSample);
    const subjectsByRate = (validSubjects.length ? validSubjects : allSubjectRows).slice().sort((a, b) => b.rate - a.rate);
    const bestSub = subjectsByRate[0], worstSub = subjectsByRate[subjectsByRate.length - 1];
    const map = subjectRowsMap(r);
    const riskAll = buildRiskRows(r, schoolId, classId, map);
    const badBySubject = {};
    riskAll.forEach((x) => x.bad.forEach((s) => { badBySubject[s.subject] = (badBySubject[s.subject] || 0) + 1; }));
    const allBadBySubject = {};
    r.rows.forEach((x) => {
      if (x.schoolId === schoolId && x.classId === classId && x.subject !== '总分' && x.level <= -2) allBadBySubject[x.subject] = (allBadBySubject[x.subject] || 0) + 1;
    });
    const subjectRows = allSubjectRows.map((s) => Object.assign({}, s, {
      count: badBySubject[s.subject] || 0,
      allCount: allBadBySubject[s.subject] || 0
    }));
    const topSubjects = subjectRows.filter((x) => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 3);
    const severe = riskAll.filter((x) => x.level <= -2).length;
    const high = riskAll.filter((x) => x.tags.indexOf('高入口退步') >= 0).length;
    const subjectRisk = riskAll.filter((x) => x.bad.length > 0).length;
    const deep = riskAll.filter((x) => x.deep).length;
    const overallKey = (g.declineRatio >= 0.5 || riskAll.length >= Math.max(8, g.n * 0.25)) ? 'problem'
      : (riskAll.length >= 4 || g.rate < 1) ? 'attention' : g.rate >= 1.2 ? 'highlight' : 'normal';
    const overall = STATUS[overallKey];
    const topSub = topSubjects[0] || { subject: worstSub.subject, count: 0 };
    const overallText = overallKey === 'problem'
      ? `${g.name}这轮先看${topSub.subject}：${g.n} 人中 ${g.declineCount} 人总分退步（${pct1(g.declineRatio)}），比年级平均高 ${(g.declineRatio - gradeRate >= 0 ? '+' : '')}${((g.declineRatio - gradeRate) * 100).toFixed(1)} 个百分点；${riskAll.length} 人需要重点关注。`
      : overallKey === 'attention'
        ? `${g.name}这轮整体接近年级平均，但${topSub.subject}等局部需要关注。`
        : overallKey === 'highlight'
          ? `${g.name}这轮整体好于年级平均，${bestSub.subject}表现相对突出。`
          : `${g.name}这轮整体接近年级平均，没有发现明显异常。`;

    const verdict = `<div class="report-verdict ${overall.tone}">
      <div class="verdict-top"><span class="verdict-badge">${statusBadge(overallKey)}</span><span class="verdict-kicker">一句话结论</span></div>
      <div class="verdict-text">${esc(overallText)}</div>
      <div class="verdict-metrics">
        <div><b>${pct1(g.declineRatio)}</b><span>班级总分退步比例 · ${g.declineCount} 人退步</span></div>
        <div><b>${(subjectsByRate[0].rate - worstSub.rate).toFixed(2)}</b><span>学科增值表现差距 · 最高与最低</span></div>
        <div><b>${riskAll.length} 人</b><span>需要重点关注 · 占全班 ${pct(riskAll.length / g.n)}</span></div>
      </div>
    </div>`;

    const scan = `<div class="report-scan">
      ${scanRow('01', '班级整体', esc(g.name), `${g.n} 人中 ${g.declineCount} 人总分退步（${pct1(g.declineRatio)}）`, `比年级平均${diffPhrase((g.declineRatio - gradeRate) * 100)}`, `${g.n} 人`, overallKey === 'problem' ? 'problem' : overallKey === 'attention' ? 'attention' : 'normal', `进步 ${c.progress} / 保持 ${c.keep} / 退步 ${c.decline}`)}
      ${scanRow('02', '学科', esc(topSub.subject), `需重点关注学生中 ${topSub.count} 人单科掉2档以上`, `本班相对最弱：${esc(worstSub.subject)} ${f2(worstSub.rate)}`, `${allBadBySubject[topSub.subject] || 0} 人单科掉档`, topSub.count >= 10 ? 'attention' : 'normal', `相对最强：${esc(bestSub.subject)} ${f2(bestSub.rate)}`)}
      ${scanRow('03', '学生类型', '入口靠前但退步', `${high} 人`, `占需重点关注 ${pct(high / Math.max(1, riskAll.length))}`, `${riskAll.length} 人`, high >= 8 ? 'attention' : 'normal', `单科掉4档以上：${deep} 人`)}
      ${scanRow('04', '变化', '总分退步比例', pct1(g.declineRatio), `比年级平均${diffPhrase((g.declineRatio - gradeRate) * 100)}`, `${g.n} 人`, overallKey === 'problem' ? 'problem' : 'attention', `进步 ${c.progress} / 保持 ${c.keep} / 退步 ${c.decline}`)}
    </div>`;

    const subjectSlots = [0, 1, 2].map((i) => {
      const t = topSubjects[i];
      return t ? `<div class="report-hot-slot"><span>${esc(t.subject)}</span><b>${t.count} 人</b></div>` : `<div class="report-hot-slot empty"><span>—</span><b>暂无集中学科</b></div>`;
    }).join('');
    const topStudents = riskAll.slice().sort((a, b) => (a.level - b.level) || (a.entryGrade - b.entryGrade)).slice(0, 8);
    const studentCols = [
      { key: 'studentNo', label: '学号', render: (x) => `<span class="code">${esc(x.studentNo)}</span>` },
      { key: 'studentName', label: '姓名' },
      { key: 'grade', label: '入口第几档 → 现在', render: (x) => `第${x.entryGrade}档 → 第${x.currentGrade}档` },
      { key: 'level', label: '掉了几档', align: 'num', render: (x) => Math.abs(x.level) },
      { key: 'tags', label: '情况', render: (x) => x.tags.map(riskTag).join(' ') },
      { key: 'worst', label: '最需要补的科', render: (x) => x.worst && x.worst.level < 0 ? `${esc(x.worst.subject)}（掉${Math.abs(x.worst.level)}档）` : '—' }
    ];
    const topStudentTable = UI.table({ columns: studentCols, rows: topStudents, empty: '暂无需要重点关注的学生' });
    const tagCards = [
      { label: '总分掉2档以上', count: severe, tone: 'red' },
      { label: '入口靠前但退步', count: high, tone: 'amber' },
      { label: '至少1科掉2档以上', count: subjectRisk, tone: 'purple' },
      { label: '单科掉4档以上', count: deep, tone: 'red' }
    ].map((t) => `<div class="report-tag-card ${t.tone}"><span>${t.label}</span><b>${t.count}<small>人</small></b><em>占 ${pct(t.count / g.n)}</em></div>`).join('');
    const allStudents = students.slice().sort((a, b) => (a.level - b.level) || (a.entryGrade - b.entryGrade));
    const rosterCols = [
      { key: 'studentNo', label: '学号', render: (x) => `<span class="code">${esc(x.studentNo)}</span>` },
      { key: 'studentName', label: '姓名' },
      { key: 'grade', label: '入口第几档 → 现在', render: (x) => `第${x.entryGrade}档 → 第${x.currentGrade}档` },
      { key: 'level', label: '掉了几档', align: 'num', render: (x) => Math.abs(x.level || 0) },
      { key: 'status', label: '判定', render: (x) => UI.badge(x.status, x.status === '进步' ? 'green' : x.status === '退步' ? 'red' : 'gray') }
    ];
    const rosterTable = UI.table({ columns: rosterCols, rows: allStudents, empty: '暂无学生' });
    const actions = `<div class="report-recs">
      <div><b>先谈人</b><span>先谈 ${topStudents.length} 名掉档最多的学生，再谈入口靠前但退步的 ${high} 人；每次谈话只定 1 个可执行目标。</span></div>
      <div><b>再补科</b><span>找 ${esc(topSub.subject)}、${esc(worstSub.subject)} 科任：先看本班这两科的单科掉档名单，统一错题类型与下一次作业分层。</span></div>
      <div><b>两周后</b><span>班主任复查：本班总分退步人数是否少于 ${g.declineCount} 人，${esc(topSub.subject)}单科掉档人数是否下降。</span></div>
    </div>`;
    const evidence = `<div class="report-evidence">
      <div class="report-subhead mt-16">本班学科全表</div>${UI.table({ columns: [
        { key: 'subject', label: '学科' }, { key: 'n', label: '人数', align: 'num' },
        { key: 'declineCount', label: '退步人数', align: 'num' },
        { key: 'declineRatio', label: '退步比例', align: 'num', render: (x) => pct1(x.declineRatio || 0) },
        { key: 'allCount', label: '单科掉2档（全部）', align: 'num' },
        { key: 'count', label: '其中需重点关注', align: 'num' },
        { key: 'rate', label: '增值表现', align: 'num', render: (x) => f2(x.rate) }
      ], rows: subjectRows })}
      <div class="report-note">状态：重点关注 / 关注 / 正常 / 较好；本页只展示本班数据，不展示其他班学生。</div>
    </div>`;
    const appendix = `<div class="report-appendix">
      <div class="report-inline-note">以下为本班全量数据，供核对；不包含其他班学生。</div>
      <div class="report-subhead mt-16" id="h-app-roster">B3 本班学生名单</div>${rosterTable}
      <div class="report-subhead mt-16" id="h-app-c1">C1 本班学科全表</div>${UI.table({ columns: [
        { key: 'subject', label: '学科' }, { key: 'n', label: '人数', align: 'num' },
        { key: 'declineCount', label: '退步人数', align: 'num' },
        { key: 'declineRatio', label: '退步比例', align: 'num', render: (x) => pct1(x.declineRatio || 0) },
        { key: 'allCount', label: '单科掉2档（全部）', align: 'num' },
        { key: 'count', label: '其中需重点关注', align: 'num' },
        { key: 'rate', label: '增值表现', align: 'num', render: (x) => f2(x.rate) }
      ], rows: subjectRows })}
      <div class="report-subhead mt-16" id="h-app-d2">D2 需重点关注学生</div>${UI.table({ columns: studentCols, rows: riskAll.slice().sort((a, b) => (a.level - b.level) || (a.entryGrade - b.entryGrade)), empty: '暂无需要重点关注的学生' })}
      <div class="report-note">核对：正文的学科可在 C1 找到，学生可在 B3/D2 找到；标签有重叠，不能相加。</div>
    </div>`;
    const toc = `<aside class="report-toc" id="report-toc">
      <div class="report-toc-title">报告目录</div>
      <button class="report-toc-link active" data-action="scrollReport" data-target="sec-overall">01 班级怎么样</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-scan">02 问题在哪</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-hot">03 最集中的学科和学生</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-tags">04 涉及多少学生</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-actions">05 先找谁、做什么</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-evidence">06 数据依据</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-appendix">07 数据全貌</button>
      <button class="btn btn-primary btn-sm report-toc-export" data-action="printReport">导出 PDF</button>
      <div class="report-toc-note">A4 纵向 · 导出后可打印</div>
    </aside>`;
    const sections = section('01', '班级怎么样', '一句话结论 + 三个关键数', verdict + checkLine([{ target: 'h-app-roster', label: 'B3 本班名单' }]), 'sec-overall')
      + section('02', '问题在哪', '班级整体 / 学科 / 学生类型 / 变化', scan + checkLine([{ target: 'h-app-c1', label: 'C1 学科全表' }]), 'sec-scan')
      + section('03', '最集中的学科和学生', '学科按掉档人数排序，学生按掉档多少排序', `<div class="report-hot-top">${subjectSlots}</div><div class="report-subhead mt-16">先谈这几名学生</div>${topStudentTable}`, 'sec-hot')
      + section('04', '涉及多少学生', '四类标签有重叠，不能相加', `<div class="report-tag-grid">${tagCards}</div>${checkLine([{ target: 'h-app-d2', label: 'D2 名单' }])}`, 'sec-tags')
      + section('05', '先找谁、做什么', '谈话、学科、两周后复查', actions, 'sec-actions')
      + section('06', '数据依据', '本班学科与样本说明', evidence, 'sec-evidence')
      + section('07', '数据全貌', '本班全量数据，供核对', appendix, 'sec-appendix');
    setTimeout(function () { if (App.initReportToc) App.initReportToc(); }, 0);
    return shell(task, 'homeroom', `${g.name}班级增值报告`, `读者：班主任 · ${g.schoolName} ${g.name} · 仅本班数据`, scopeBar(`<span class="report-scope-label">学校</span><span class="badge badge-gray">${esc(g.schoolName)}</span><span class="report-scope-label">班级</span>${classSelect(r, schoolId, classId)}`), `<div class="report-doc-grid"><div class="report-doc-main">${sections}</div>${toc}</div>`);
  }

  /* ---------- 05 科任教师 ---------- */
  function teacherPage(task, r) {
    const schoolId = defaultSchool(r);
    const subject = defaultSubject(r, schoolId);
    const teacherId = defaultTeacher(r, schoolId, subject);
    const g = (r.teacherEval[subject] || []).find((x) => x.id === teacherId && x.schoolId === schoolId);
    if (!g) return shell(task, 'teacher', '教师教学增值报告', '当前对象没有教师结果', '', `<div class="card"><div class="card-body">${UI.empty('暂无结果')}</div></div>`);
    const rows = r.rows.filter((x) => x.teacherId === teacherId && x.subject === subject);
    const byClass = {};
    rows.forEach((x) => { (byClass[x.classId] || (byClass[x.classId] = [])).push(x); });
    const taught = Object.keys(byClass).map((id) => {
      const rs = byClass[id];
      const cc = counts(rs);
      const cg = classSubject(r, schoolId, id, subject);
      return { id, name: rs[0].className, n: rs.length, rate: cg ? cg.rate : null, decline: cc.decline, progress: cc.progress, keep: cc.keep, bad: rs.filter((x) => x.level <= -2).length };
    }).sort((a, b) => (a.rate == null ? 9 : a.rate) - (b.rate == null ? 9 : b.rate));
    const worstClass = taught[0], bestClass = taught[taught.length - 1];
    const badRows = rows.filter((x) => x.level <= -2);
    const deepRows = rows.filter((x) => x.level <= -4);
    const highRows = rows.filter((x) => x.entryGrade <= 3 && x.level <= -1);
    const topClasses = taught.slice().sort((a, b) => b.bad - a.bad).slice(0, 3);
    const topStudents = badRows.slice().sort((a, b) => (a.level - b.level) || (a.entryGrade - b.entryGrade)).slice(0, 8);
    const overallKey = (g.rate < 0.9 || badRows.length >= Math.max(8, rows.length * 0.2)) ? 'problem'
      : (g.rate < 1 || badRows.length >= 4) ? 'attention' : g.rate >= 1.2 ? 'highlight' : 'normal';
    const overall = STATUS[overallKey];
    const overallText = overallKey === 'problem'
      ? `这科先看${worstClass.name}：${worstClass.n} 人中 ${worstClass.decline} 人本科目退步，${badRows.length} 人掉了 2 档以上；掉档最多的是${topStudents[0] ? `${topStudents[0].className}${topStudents[0].studentName}` : '本科目学生'}。`
      : overallKey === 'attention'
        ? `这科整体接近平衡，但${worstClass.name}和${badRows.length} 名掉档学生需要关注。`
        : overallKey === 'highlight'
          ? `这科整体表现较好，${bestClass.name}相对突出，可总结可复制做法。`
          : `这科整体接近平衡，没有发现明显异常。`;
    const verdict = `<div class="report-verdict ${overall.tone}">
      <div class="verdict-top"><span class="verdict-badge">${statusBadge(overallKey)}</span><span class="verdict-kicker">一句话结论</span></div>
      <div class="verdict-text">${esc(overallText)}</div>
      <div class="verdict-metrics">
        <div><b>${f2(g.rate)}</b><span>本科增值表现 · 1.0 为平衡</span></div>
        <div><b>${taught.length} 个班</b><span>班级增值差距 ${bestClass && worstClass ? f2(bestClass.rate - worstClass.rate) : '—'}</span></div>
        <div><b>${badRows.length} 人</b><span>本科掉2档以上 · 占本科人数 ${pct(badRows.length / rows.length)}</span></div>
      </div>
    </div>`;
    const scan = `<div class="report-scan">
      ${scanRow('01', '所教班', esc(worstClass.name), `${worstClass.n} 人中 ${worstClass.decline} 人本科目退步`, `本科增值 ${f2(worstClass.rate)} · 所教班最低`, `${worstClass.n} 人`, overallKey === 'problem' ? 'problem' : 'attention', `相对最好：${esc(bestClass.name)} ${f2(bestClass.rate)}`)}
      ${scanRow('02', '入口位置', '入口靠前但单科退步', `${highRows.length} 人`, `占本科掉档 ${pct(highRows.length / Math.max(1, badRows.length))}`, `${badRows.length} 人`, highRows.length >= 8 ? 'attention' : 'normal', `入口前约23%学生优先看`)}
      ${scanRow('03', '学生类型', '单科掉4档以上', `${deepRows.length} 人`, `占本科掉档 ${pct(deepRows.length / Math.max(1, badRows.length))}`, `${badRows.length} 人`, deepRows.length >= 5 ? 'attention' : 'normal', `先谈掉档最多的学生`)}
      ${scanRow('04', '本科整体', '本科增值表现', f2(g.rate), g.rate >= 1 ? '高于平衡' : '低于平衡', `${rows.length} 人`, overallKey === 'problem' ? 'problem' : overallKey === 'attention' ? 'attention' : 'normal', `进步 ${counts(rows).progress} / 保持 ${counts(rows).keep} / 退步 ${counts(rows).decline}`)}
    </div>`;
    const classSlots = [0, 1, 2].map((i) => {
      const x = topClasses[i];
      return x ? `<div class="report-hot-slot"><span>${esc(x.name)}</span><b>${x.bad} 人</b></div>` : `<div class="report-hot-slot empty"><span>—</span><b>暂无集中班</b></div>`;
    }).join('');
    const studentCols = [
      { key: 'studentNo', label: '学号', render: (x) => `<span class="code">${esc(x.studentNo)}</span>` },
      { key: 'studentName', label: '姓名' },
      { key: 'className', label: '班级' },
      { key: 'grade', label: '入口第几档 → 现在', render: (x) => `第${x.entryGrade}档 → 第${x.currentGrade}档` },
      { key: 'level', label: '掉了几档', align: 'num', render: (x) => Math.abs(x.level) },
      { key: 'status', label: '判定', render: (x) => UI.badge(x.status, x.status === '进步' ? 'green' : x.status === '退步' ? 'red' : 'gray') }
    ];
    const tagCards = [
      { label: '本科掉2档以上', count: badRows.length, tone: 'red' },
      { label: '入口靠前但退步', count: highRows.length, tone: 'amber' },
      { label: '本科掉4档以上', count: deepRows.length, tone: 'purple' },
      { label: '本科退步', count: counts(rows).decline, tone: 'gray' }
    ].map((t) => `<div class="report-tag-card ${t.tone}"><span>${t.label}</span><b>${t.count}<small>人</small></b><em>占本科 ${pct(t.count / rows.length)}</em></div>`).join('');
    const actions = `<div class="report-recs">
      <div><b>先看班</b><span>先看 ${esc(worstClass.name)}：${worstClass.n} 人中 ${worstClass.decline} 人本科目退步；对比 ${esc(bestClass.name)} 的课堂参与、作业完成和错题订正。</span></div>
      <div><b>再谈人</b><span>先谈掉档最多的 ${topStudents.length} 名学生，逐人确认失分类型：基础、审题、时间分配，还是缺课。</span></div>
      <div><b>两周后</b><span>复查本科掉2档以上人数是否少于 ${badRows.length} 人，${esc(worstClass.name)}本科退步人数是否下降。</span></div>
    </div>`;
    const evidence = `<div class="report-evidence">
      <div class="report-subhead mt-16">所教班全表</div>${UI.table({ columns: [
        { key: 'name', label: '班级' }, { key: 'n', label: '本科人数', align: 'num' },
        { key: 'rate', label: '本科增值表现', align: 'num', render: (x) => f2(x.rate) },
        { key: 'decline', label: '本科退步', align: 'num' },
        { key: 'bad', label: '掉2档以上', align: 'num' }
      ], rows: taught })}
      <div class="report-note">本页仅展示本人所教班和本科目数据，不展示其他教师、学生总分排名或其他学科。</div>
    </div>`;
    const appendix = `<div class="report-appendix">
      <div class="report-inline-note">以下为本人所教班、本科目全量数据；不展示其他教师或其他学科。</div>
      <div class="report-subhead mt-16" id="t-app-b3">B3 所教班全表</div>${UI.table({ columns: [
        { key: 'name', label: '班级' }, { key: 'n', label: '本科人数', align: 'num' },
        { key: 'progress', label: '进步', align: 'num' }, { key: 'keep', label: '保持', align: 'num' },
        { key: 'decline', label: '退步', align: 'num' }, { key: 'bad', label: '掉2档以上', align: 'num' },
        { key: 'rate', label: '本科增值表现', align: 'num', render: (x) => f2(x.rate) }
      ], rows: taught })}
      <div class="report-subhead mt-16" id="t-app-d2">D2 本科学生名单</div>${UI.table({ columns: studentCols, rows: badRows.slice().sort((a, b) => (a.level - b.level) || (a.entryGrade - b.entryGrade)), empty: '暂无本科掉档学生' })}
      <div class="report-note">核对：正文的班可在 B3 找到，学生可在 D2 找到；本科目数据不代表学生总分或其他学科。</div>
    </div>`;
    const toc = `<aside class="report-toc" id="report-toc">
      <div class="report-toc-title">报告目录</div>
      <button class="report-toc-link active" data-action="scrollReport" data-target="sec-overall">01 这科怎么样</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-scan">02 问题在哪个班</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-hot">03 最集中的班和学生</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-tags">04 涉及多少学生</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-actions">05 先找谁、做什么</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-evidence">06 数据依据</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-appendix">07 数据全貌</button>
      <button class="btn btn-primary btn-sm report-toc-export" data-action="printReport">导出 PDF</button>
      <div class="report-toc-note">A4 纵向 · 导出后可打印</div>
    </aside>`;
    const sections = section('01', '这科怎么样', '一句话结论 + 三个关键数', verdict + checkLine([{ target: 't-app-b3', label: 'B3 所教班' }]), 'sec-overall')
      + section('02', '问题在哪个班', '所教班 / 入口位置 / 学生类型 / 本科整体', scan, 'sec-scan')
      + section('03', '最集中的班和学生', '班级按掉档人数排序，学生按掉档多少排序', `<div class="report-hot-top">${classSlots}</div><div class="report-subhead mt-16">先谈这几名学生</div>${UI.table({ columns: studentCols, rows: topStudents, empty: '暂无本科掉档学生' })}`, 'sec-hot')
      + section('04', '涉及多少学生', '本科目内部统计', `<div class="report-tag-grid">${tagCards}</div>` + checkLine([{ target: 't-app-d2', label: 'D2 名单' }]), 'sec-tags')
      + section('05', '先找谁、做什么', '班级、学生、两周后复查', actions, 'sec-actions')
      + section('06', '数据依据', '所教班与本科数据', evidence, 'sec-evidence')
      + section('07', '数据全貌', '本人所教班全量数据', appendix, 'sec-appendix');
    setTimeout(function () { if (App.initReportToc) App.initReportToc(); }, 0);
    return shell(task, 'teacher', `${g.name} · ${subject}教学增值报告`, `读者：科任教师/教研组长 · ${g.schoolName} · 仅本人所教班与本科目`, scopeBar(`<span class="report-scope-label">学校</span><span class="badge badge-gray">${esc(g.schoolName)}</span><span class="report-scope-label">科目</span>${subjectChips(r, schoolId, subject)}<span class="report-scope-label">教师</span>${teacherSelect(r, schoolId, subject, teacherId)}`), `<div class="report-doc-grid"><div class="report-doc-main">${sections}</div>${toc}</div>`);
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
    const overallKey = total.status === '退步' ? 'problem' : total.status === '保持' ? 'normal' : 'highlight';
    const overall = STATUS[overallKey];
    const overallText = overallKey === 'problem'
      ? `这次总分从第${total.entryGrade}档到第${total.currentGrade}档，掉了${Math.abs(total.level)}档；先补${worstSub.subject}，再稳优势科。`
      : overallKey === 'highlight'
        ? `这次总分从第${total.entryGrade}档到第${total.currentGrade}档，进步${total.level}档；保持节奏，优先补${worstSub.subject}。`
        : `这次总分保持在第${total.currentGrade}档；下一步把${worstSub.subject}从“保持”变成“进步”。`;
    const verdict = `<div class="report-verdict ${overall.tone}">
      <div class="verdict-top"><span class="verdict-badge">${statusBadge(overallKey)}</span><span class="verdict-kicker">一句话结论</span></div>
      <div class="verdict-text">${esc(overallText)}</div>
      <div class="verdict-metrics">
        <div><b>第 ${total.currentGrade} 档</b><span>现在的位置 · 入口第 ${total.entryGrade} 档</span></div>
        <div><b>${progressSubs.length} 科进步</b><span>${keepSubs.length} 科保持 / ${declineSubs.length} 科退步</span></div>
        <div><b>${esc(worstSub.subject)}</b><span>最需要先补的一科 · 相对下滑最多</span></div>
      </div>
    </div>`;
    const scan = `<div class="report-scan">
      ${scanRow('01', '总分', `第${total.entryGrade}档 → 第${total.currentGrade}档`, `${total.status}${total.level ? `（${sgn(total.level)}档）` : '（0档）'}`, `同首选组排名 ${total.entryRank} → ${total.currentRank}`, '总分', overallKey, `入口 ${f1(total.entryValue)} → 评价 ${f1(total.currentValue)}`)}
      ${scanRow('02', '优势科', esc(bestSub.subject), `相对位置上升最多（Δz ${sgn(bestSub.zDiff)}）`, `第${bestSub.entryGrade}档 → 第${bestSub.currentGrade}档`, '1 科', 'normal', '保持优势，不要被短板拖累')}
      ${scanRow('03', '短板科', esc(worstSub.subject), `相对位置下降最多（Δz ${sgn(worstSub.zDiff)}）`, `第${worstSub.entryGrade}档 → 第${worstSub.currentGrade}档`, '1 科', declineSubs.length >= 2 ? 'problem' : 'attention', '先补基础，再谈难题')}
      ${scanRow('04', '六科变化', `${progressSubs.length} 科进步`, `${keepSubs.length} 科保持 / ${declineSubs.length} 科退步`, '共 6 科', '6 科', declineSubs.length >= 3 ? 'attention' : 'normal', '单科明细见 06')}
    </div>`;
    const subjectTable = UI.table({
      columns: [
        { key: 'subject', label: '科目' },
        { key: 'entryValue', label: '入口', align: 'num', render: (x) => f1(x.entryValue) },
        { key: 'currentValue', label: '评价', align: 'num', render: (x) => f1(x.currentValue) },
        { key: 'grade', label: '入口第几档 → 现在', render: (x) => `第${x.entryGrade}档 → 第${x.currentGrade}档` },
        { key: 'zDiff', label: '相对变化', align: 'num', render: (x) => `<b class="${x.zDiff >= 0 ? 'r-good' : 'r-bad'}">${sgn(x.zDiff)}</b>` },
        { key: 'status', label: '判定', render: (x) => UI.badge(x.status, x.status === '进步' ? 'green' : x.status === '退步' ? 'red' : 'gray') },
        { key: 'level', label: '掉了几档', align: 'num', render: (x) => Math.abs(x.level) }
      ],
      rows: subs,
      rowClass: (x) => x.subject === worstSub.subject ? 'report-row-warn' : ''
    });
    const tagCards = [
      { label: '总分掉2档以上', count: total.level <= -2 ? 1 : 0, tone: 'red' },
      { label: '单科掉2档以上', count: subs.filter((x) => x.level <= -2).length, tone: 'purple' },
      { label: '单科掉4档以上', count: subs.filter((x) => x.level <= -4).length, tone: 'red' },
      { label: '保持/进步科目', count: progressSubs.length + keepSubs.length, tone: 'green' }
    ].map((t) => `<div class="report-tag-card ${t.tone}"><span>${t.label}</span><b>${t.count}<small>${t.label.indexOf('科目') >= 0 ? '科' : '项'}</small></b><em>${t.label.indexOf('科目') >= 0 ? '共 6 科' : '个人标签'}</em></div>`).join('');
    const actions = `<div class="report-recs">
      <div><b>先补一科</b><span>先补 ${esc(worstSub.subject)}：把最近一次试卷分成“基础、审题、时间”三类失分，每类只定 1 个动作。</span></div>
      <div><b>稳住优势</b><span>${esc(bestSub.subject)} 是相对优势，保持现有节奏，不要因为补短板停掉优势科的训练。</span></div>
      <div><b>两周后</b><span>两周后回看 ${esc(worstSub.subject)} 的错题是否重现；如果同一类错误还在，找科任换一种讲法。</span></div>
    </div>`;
    const appendix = `<div class="report-appendix">
      <div class="report-inline-note">以下只包含本人数据，不展示其他学生。</div>
      <div class="report-subhead mt-16" id="s-app-d1">D1 我的六科成绩单</div>${subjectTable}
      <div class="report-note">等级为联考同首选组内的相对位置；不同科目、不同选科组的比较群体不同，不能直接比分数。</div>
    </div>`;
    const toc = `<aside class="report-toc" id="report-toc">
      <div class="report-toc-title">报告目录</div>
      <button class="report-toc-link active" data-action="scrollReport" data-target="sec-overall">01 我这次怎么样</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-scan">02 哪科拖后腿</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-hot">03 我的强弱科</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-tags">04 我的变化</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-actions">05 我先做什么</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-evidence">06 数据依据</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-appendix">07 我的成绩单</button>
      <button class="btn btn-primary btn-sm report-toc-export" data-action="printReport">导出 PDF</button>
      <div class="report-toc-note">A4 纵向 · 导出后可打印</div>
    </aside>`;
    const sections = section('01', '我这次怎么样', '一句话结论 + 三个关键数', verdict + checkLine([{ target: 's-app-d1', label: 'D1 我的成绩单' }]), 'sec-overall')
      + section('02', '哪科拖后腿', '总分 / 优势科 / 短板科 / 六科变化', scan, 'sec-scan')
      + section('03', '我的强弱科', '按相对变化排序，只展示本人', deltaBars(subs), 'sec-hot')
      + section('04', '我的变化', '个人标签，不是排名', `<div class="report-tag-grid">${tagCards}</div>`, 'sec-tags')
      + section('05', '我先做什么', '补一科、稳优势、两周后回看', actions, 'sec-actions')
      + section('06', '数据依据', '六科入口/评价/等级/变化', subjectTable, 'sec-evidence')
      + section('07', '我的成绩单', '只含本人数据', appendix, 'sec-appendix');
    setTimeout(function () { if (App.initReportToc) App.initReportToc(); }, 0);
    return shell(task, 'student', `${total.studentName}个人增值报告`, `读者：学生/家长 · ${total.schoolName} ${total.className} · 仅本人数据`, scopeBar(`<span class="report-scope-label">学校</span><span class="badge badge-gray">${esc(total.schoolName)}</span><span class="report-scope-label">班级</span>${classSelect(r, schoolId, classId)}<span class="report-scope-label">学生</span>${studentSelect(r, schoolId, classId, studentId)}`), `<div class="report-doc-grid"><div class="report-doc-main">${sections}</div>${toc}</div>`);
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
  let tocScrollHandler = null;
  App.initReportToc = function () {
    const links = Array.prototype.slice.call(document.querySelectorAll('.report-toc-link'));
    const sections = links.map((l) => document.getElementById(l.dataset.target)).filter(Boolean);
    if (!sections.length) return;
    if (tocScrollHandler) window.removeEventListener('scroll', tocScrollHandler);
    const update = function () {
      const y = window.scrollY + 140;
      let current = sections[0];
      sections.forEach(function (s) {
        const top = s.getBoundingClientRect().top + window.scrollY;
        if (top <= y) current = s;
      });
      links.forEach(function (l) {
        l.classList.toggle('active', l.dataset.target === current.id);
      });
    };
    tocScrollHandler = update;
    window.addEventListener('scroll', update, { passive: true });
    update();
  };
  App.actions.scrollReport = function (el) {
    const target = document.getElementById(el.dataset.target);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  function afterReportSwitch() {
    setTimeout(function () { window.scrollTo(0, 0); }, 0);
  }
  App.setReportSchool = function (v) {
    App.state.reportSchoolId = v;
    App.state.reportClassId = '';
    App.state.reportTeacherId = '';
    App.state.reportStudentId = '';
    App.render();
    afterReportSwitch();
  };
  App.setReportClass = function (v) {
    App.state.reportClassId = v;
    App.state.reportStudentId = '';
    App.render();
    afterReportSwitch();
  };
  App.setReportTeacher = function (v) {
    App.state.reportTeacherId = v;
    App.render();
    afterReportSwitch();
  };
  App.setReportStudent = function (v) {
    App.state.reportStudentId = v;
    App.render();
    afterReportSwitch();
  };
  App.filterReportStudents = function (q) {
    const sel = document.getElementById('report-student-select');
    if (!sel) return;
    const query = String(q || '').trim().toLowerCase();
    let shown = 0;
    Array.prototype.slice.call(sel.options).forEach(function (o) {
      const hit = !query || o.textContent.toLowerCase().indexOf(query) >= 0 || o.value.toLowerCase().indexOf(query) >= 0;
      o.hidden = !hit;
      o.disabled = !hit;
      if (hit) shown++;
    });
    const count = document.getElementById('report-student-count');
    if (count) count.textContent = query ? `找到 ${shown} 人` : `共 ${sel.options.length} 人`;
  };
  App.pickFirstStudent = function () {
    const sel = document.getElementById('report-student-select');
    if (!sel) return;
    const opt = Array.prototype.slice.call(sel.options).find(function (o) { return !o.disabled && !o.hidden; });
    if (!opt) { UI.toast('没有匹配的学生', 'error'); return; }
    sel.value = opt.value;
    App.setReportStudent(opt.value);
  };
  App.actions.setReportSubject = function (el) {
    App.state.reportSubject = el.dataset.value;
    App.state.reportTeacherId = '';
    App.render();
    afterReportSwitch();
  };
  App.actions.printReport = function () { window.print(); };
  App.actions.exportReportCsv = function () {
    const csv = typeof window !== 'undefined' ? window.__REPORT_CSV__ : '';
    if (!csv) { UI.toast('当前没有可导出的数据', 'error'); return; }
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '增值报告数据全貌.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  };
})();
