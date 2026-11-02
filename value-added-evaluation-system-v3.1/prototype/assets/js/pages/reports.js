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
      key: 'subject', label: '学科组长', icon: 'book', title: '学科增值报告',
      reader: '备课组长 · 教研组长', question: '全校这门学科哪个班、哪位老师、哪层学生需要先看',
      points: ['全校学科位置', '班级分布', '教师差异与分层']
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

  /* 报告级四象限：x=学业实力，y=相对进步率，参考线为均值/1.0；极端值贴顶显示 */
  function quadrant(points, opts) {
    opts = opts || {};
    if (!points.length) return `<div class="empty">暂无数据</div>`;
    const labelAll = !!opts.labelAll;
    const W = 760, H = labelAll ? 560 : 360, L = labelAll ? 64 : 56, R = labelAll ? 70 : 96, T = 26, B = 44;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const sortedY = ys.slice().sort((a, b) => a - b);
    const q = (arr, p) => {
      if (!arr.length) return 0;
      const i = (arr.length - 1) * p;
      const lo = Math.floor(i), hi = Math.ceil(i);
      return arr[lo] + (arr[hi] - arr[lo]) * (i - lo);
    };
    const yQ10 = q(sortedY, 0.1), yQ90 = q(sortedY, 0.9);
    const robustTop = yQ90 + Math.max(0.3, (yQ90 - yQ10) * 0.9);
    let yMaxData = Math.max(...ys, 1);
    let clipped = 0;
    if (yMaxData > robustTop * 1.25) {
      yMaxData = robustTop;
      clipped = ys.filter((v) => v > yMaxData).length;
    }
    let x0 = Math.min(...xs), x1 = Math.max(...xs);
    let y0 = Math.min(...ys, 1) - 0.1;
    let y1 = yMaxData;
    const xPad = Math.max(1.5, (x1 - x0) * 0.18);
    const yPad = Math.max(0.12, (y1 - y0) * 0.16);
    x0 -= xPad; x1 += xPad; y0 -= yPad; y1 += yPad;
    const X = (v) => L + ((v - x0) / (x1 - x0)) * (W - L - R);
    const Y = (v) => H - B - ((v - y0) / (y1 - y0)) * (H - T - B);
    const xRef = opts.xRef == null ? mean(xs) : opts.xRef;
    const yRef = opts.yRef == null ? mean(ys) : opts.yRef;
    const xt = ticks(x0, x1, 4);
    const yt = ticks(y0, y1, 4);
    const fmtX = (v) => v.toFixed(v >= 10 ? 0 : 1);
    const fmtY = (v) => v.toFixed(2);
    const grid = xt.map((v) => `<line class="q-grid" x1="${X(v).toFixed(1)}" y1="${T}" x2="${X(v).toFixed(1)}" y2="${H - B}"/><text class="q-tick" x="${X(v).toFixed(1)}" y="${H - B + 16}" text-anchor="middle">${fmtX(v)}</text>`).join('')
      + yt.map((v) => `<line class="q-grid" x1="${L}" y1="${Y(v).toFixed(1)}" x2="${W - R}" y2="${Y(v).toFixed(1)}"/><text class="q-tick" x="${L - 9}" y="${Y(v).toFixed(1) + 3}" text-anchor="end">${fmtY(v)}</text>`).join('');
    const tintTop = `<rect class="q-tint q-tint-a" x="${L}" y="${T}" width="${W - L - R}" height="${Math.max(0, Y(yRef) - T).toFixed(1)}"/>`;
    const tintRight = `<rect class="q-tint q-tint-b" x="${X(xRef).toFixed(1)}" y="${T}" width="${(W - R - X(xRef)).toFixed(1)}" height="${H - T - B}"/>`;
    const refs = `<line class="q-ref" x1="${X(xRef).toFixed(1)}" y1="${T}" x2="${X(xRef).toFixed(1)}" y2="${H - B}"/><line class="q-ref" x1="${L}" y1="${Y(yRef).toFixed(1)}" x2="${W - R}" y2="${Y(yRef).toFixed(1)}"/>`;
    const quadLabels = opts.quadrants || { tl: '低进高出', tr: '双高', bl: '相对靠后', br: '高位承压' };
    const qLabels = `<text class="q-quad q-quad-blue" x="${L + 8}" y="${T + 16}">${esc(quadLabels.tl)}</text>
      <text class="q-quad q-quad-green" x="${W - R - 8}" y="${T + 16}" text-anchor="end">${esc(quadLabels.tr)}</text>
      <text class="q-quad q-quad-red" x="${L + 8}" y="${H - B - 10}">${esc(quadLabels.bl)}</text>
      <text class="q-quad q-quad-amber" x="${W - R - 8}" y="${H - B - 10}" text-anchor="end">${esc(quadLabels.br)}</text>`;
    const geom = points.map((p) => {
      const isClipped = p.y > yMaxData + 1e-9;
      const cx = X(p.x), cy = Y(Math.min(p.y, yMaxData));
      const rad = Math.max(5, Math.min(14, 4 + Math.sqrt(p.size || 100) / 6));
      return { p, isClipped, cx, cy, rad };
    });
    const dots = geom.map((g) => {
      const { p, isClipped, cx, cy, rad } = g;
      const act = p.action ? ` data-action="${p.action}" data-id="${esc(p.id || '')}"` : '';
      return `<g class="pt ${p.action ? 'clickable' : ''}"${act}>
        <circle class="q-point ${p.tone || 'p1'}${isClipped ? ' q-point-clip' : ''}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rad.toFixed(1)}"><title>${esc(p.title || ((p.label || '') + '：' + f2(p.y)))}</title></circle>
      </g>`;
    }).join('');
    let labels = '';
    if (labelAll) {
      const boxes = [];
      const overlaps = (a, b) => !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
      const hitsPoint = (box, self) => geom.some((o) => o !== self && !(o.cx + o.rad < box.x || o.cx - o.rad > box.x + box.w || o.cy + o.rad < box.y || o.cy - o.rad > box.y + box.h));
      labels = geom.map((g) => {
        const text = `${g.p.label}${g.isClipped ? ' ↑' : ''}`;
        const w = g.p.label.length * 11.5 + 8;
        const h = 14;
        const cands = [];
        const dys = [4, -10, 18, -24, 32, -38, 46];
        [5, 14, 24, 34].forEach((off) => {
          dys.forEach((dy) => {
            cands.push({ tx: g.cx + g.rad + off, y: g.cy + dy, anchor: 'start' });
            cands.push({ tx: g.cx - g.rad - off, y: g.cy + dy, anchor: 'end' });
          });
        });
        [0, 14, 28, 42].forEach((off) => {
          cands.push({ tx: g.cx, y: g.cy - g.rad - 8 - off, anchor: 'middle' });
          cands.push({ tx: g.cx, y: g.cy + g.rad + 15 + off, anchor: 'middle' });
        });
        let picked = null;
        for (const c of cands) {
          const x = c.anchor === 'start' ? c.tx : c.anchor === 'end' ? c.tx - w : c.tx - w / 2;
          const box = { x, y: c.y - 11, w, h };
          if (box.x < 4 || box.x + box.w > W - 4 || box.y < T - 6 || box.y + box.h > H - B + 4) continue;
          if (boxes.some((b) => overlaps(box, b))) continue;
          if (hitsPoint(box, g)) continue;
          picked = { ...c, box };
          break;
        }
        if (!picked) {
          const c = cands[0];
          picked = { ...c, box: { x: c.tx, y: c.y - 11, w, h } };
        }
        boxes.push(picked.box);
        return `<text class="q-name q-name-all${g.p.tone === 'p2' ? ' q-name-focus' : ''}" x="${picked.tx.toFixed(1)}" y="${picked.y.toFixed(1)}" text-anchor="${picked.anchor}">${esc(text)}</text>`;
      }).join('');
    } else {
      labels = geom.map((g) => {
        const { p, isClipped, cx, cy, rad } = g;
        const anchor = cx > W - R - 96 ? 'end' : 'start';
        const tx = anchor === 'end' ? cx - rad - 7 : cx + rad + 7;
        const ty = Math.max(T + 12, Math.min(H - B - 12, cy + 4));
        return `${p.label ? `<text class="q-name" x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anchor}">${esc(p.label)}${isClipped ? ' ↑' : ''}</text>` : ''}
          ${p.sub ? `<text class="q-sub" x="${tx.toFixed(1)}" y="${(ty + 13).toFixed(1)}" text-anchor="${anchor}">${esc(p.sub + (isClipped ? ` · 实际 ${f2(p.y)}` : ''))}</text>` : ''}`;
      }).join('');
    }
    return `<svg class="q-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria || '四象限分布图')}">
      ${tintTop}${tintRight}${grid}${refs}${qLabels}${dots}${labels}
      <line class="q-axis" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"/>
      <line class="q-axis" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"/>
      <text class="q-axis-title" x="${(L + W - R) / 2}" y="${H - 10}" text-anchor="middle">${esc(opts.xLabel || '学业实力')}</text>
      <text class="q-axis-title" x="16" y="${(T + H - B) / 2}" text-anchor="middle" transform="rotate(-90 16 ${(T + H - B) / 2})">${esc(opts.yLabel || '相对进步率')}</text>
      ${clipped ? `<text class="q-sub" x="${W - R}" y="${T + 30}" text-anchor="end">${clipped} 个极值点贴顶显示</text>` : ''}
    </svg>`;
  }

  /* 等级迁移（双向分布条）：每个等级入口/评价人数与净变化 */
  function gradeShift(totals, opts) {
    opts = opts || {};
    const gc = opts.gradeCount || 9;
    const entry = new Array(gc).fill(0);
    const exit = new Array(gc).fill(0);
    totals.forEach((t) => {
      if (t.entryGrade >= 1 && t.entryGrade <= gc) entry[t.entryGrade - 1]++;
      if (t.currentGrade >= 1 && t.currentGrade <= gc) exit[t.currentGrade - 1]++;
    });
    const max = Math.max(1, ...entry, ...exit);
    const W = 640, rowH = 30, T = 42, B = 26, C = 316, L = 42, R = 70;
    const H = T + rowH * gc + B;
    const maxW = C - L - 20;
    const half = (v) => Math.max(0, (v / max) * maxW);
    const rows = [];
    for (let g = 1; g <= gc; g++) {
      const e = entry[g - 1], x = exit[g - 1];
      const y = T + (g - 1) * rowH + 3;
      const ew = half(e), xw = half(x);
      const delta = x - e;
      rows.push(`<g>
        <text class="gs-grade g${g}" x="${L - 8}" y="${(y + 13).toFixed(1)}" text-anchor="end">G${g}</text>
        ${e ? `<rect class="gs-entry-bar" x="${(C - ew).toFixed(1)}" y="${y}" width="${ew.toFixed(1)}" height="16" rx="1"><title>G${g} 入口 ${e} 人</title></rect>` : ''}
        ${x ? `<rect class="gs-exit-bar" x="${C}" y="${y}" width="${xw.toFixed(1)}" height="16" rx="1"><title>G${g} 评价 ${x} 人</title></rect>` : ''}
        <text class="gs-count ${e ? '' : 'zero'}" x="${(C - ew - 7).toFixed(1)}" y="${(y + 12).toFixed(1)}" text-anchor="end">${e || '0'}</text>
        <text class="gs-count ${x ? '' : 'zero'}" x="${(C + xw + 7).toFixed(1)}" y="${(y + 12).toFixed(1)}">${x || '0'}</text>
        <text class="gs-count ${delta === 0 ? 'zero' : ''}" x="${W - 8}" y="${(y + 12).toFixed(1)}" text-anchor="end">${delta > 0 ? '+' : ''}${delta}</text>
      </g>`);
    }
    return `<svg class="gs-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="入口与评价等级分布迁移">
      <text class="gs-axis-title" x="${C - 12}" y="${T - 16}" text-anchor="end">入口 人数</text>
      <text class="gs-axis-title" x="${C + 12}" y="${T - 16}" text-anchor="start">评价 人数</text>
      <text class="gs-axis-title" x="${W - 8}" y="${T - 16}" text-anchor="end">Δ 人数</text>
      <line class="gs-center" x1="${C}" y1="${T - 4}" x2="${C}" y2="${T + rowH * gc}"/>
      ${rows.join('')}
    </svg>`;
  }

  function classShiftGrid(r, schoolId, classes, gradeCount) {
    const gc = gradeCount || 9;
    const lowPct = (arr) => arr.slice(6).reduce((s, v) => s + v, 0) / Math.max(1, arr.reduce((s, v) => s + v, 0)) * 100;
    const rows = classes.map((c) => {
      const totals = studentTotals(r, schoolId, c.id);
      const entry = new Array(gc).fill(0);
      const exit = new Array(gc).fill(0);
      totals.forEach((t) => {
        if (t.entryGrade >= 1 && t.entryGrade <= gc) entry[t.entryGrade - 1]++;
        if (t.currentGrade >= 1 && t.currentGrade <= gc) exit[t.currentGrade - 1]++;
      });
      const ce = (r.classEval['总分'] || []).find((x) => x.schoolId === schoolId && x.id === c.id);
      return { ...c, totals, entry, exit, net: lowPct(exit) - lowPct(entry), rate: ce ? ce.rate : null };
    }).sort((a, b) => b.net - a.net);
    const bar = (arr, label) => `<div class="shift-bar" title="${label}">${arr.map((v, i) => {
      const total = Math.max(1, arr.reduce((s, x) => s + x, 0));
      return `<i class="gs-seg g${i + 1}" style="width:${(v / total * 100).toFixed(2)}%"></i>`;
    }).join('')}</div>`;
    return `<div class="shift-block">
      <div class="shift-block-head"><b>按班看迁移</b><span>G1 最好（绿）→ G9 最弱（红）；按低档净增排序，前 3 个班标红</span></div>
      <div class="shift-scale"><span>G1 最好</span><div>${Array.from({ length: 9 }, (_, i) => `<i class="gs-seg g${i + 1}"></i>`).join('')}</div><span>G9 最弱</span></div>
      <div class="shift-grid">${rows.map((c, i) => `<button type="button" class="shift-card ${i < 3 ? 'hot' : ''}" data-action="drillClassShift" data-value="${esc(c.id)}">
        <div class="shift-head"><b>${esc(c.name)}</b><em>${c.n || c.totals.length} 人</em></div>
        ${bar(c.entry, '入口')}${bar(c.exit, '评价')}
        <div class="shift-foot"><span>低档净增 <b class="${c.net > 0 ? 'r-bad' : 'r-good'}">${c.net > 0 ? '+' : ''}${c.net.toFixed(1)}pp</b></span><span>增值 ${f2(c.rate)}</span></div>
      </button>`).join('')}</div>
      <div class="shift-details">${rows.map((c) => `<div class="shift-detail" data-class="${esc(c.id)}" hidden>
        <div class="shift-detail-head"><b>${esc(c.name)} 入口 → 评价</b><button type="button" class="drill-clear" data-action="clearClassShift">收起 ×</button></div>
        ${gradeShift(c.totals, { gradeCount: gc })}
      </div>`).join('')}</div>
    </div>`;
  }

  function figure(no, title, legend, body, note) {    return `<div class="figure">
      <div class="figure-head">
        <div class="figure-label"><span class="figure-no">${esc(no)}</span><span class="figure-title">${esc(title)}</span></div>
        <div class="figure-legend">${legend || ''}</div>
      </div>
      ${body}
      ${note ? `<div class="figure-note">${note}</div>` : ''}
    </div>`;
  }

  /* ---------- 报告分层组件：结论层 / 证据块 / 明细折叠 ---------- */
  function conclusionLayer(verdict, points, nav) {
    return `<section class="report-conclusion-layer" id="sec-summary">
      <div class="layer-head">
        <span class="layer-kicker">结论摘要 / EXECUTIVE SUMMARY</span>
        <span class="layer-tag">L1 · 结论层</span>
      </div>
      ${verdict}
      <div class="conclusion-points">
        ${points.map((p) => `<div class="conclusion-point"><span>${esc(p.label)}</span><p>${drillSubjects(markNums(p.text))}</p></div>`).join('')}
      </div>
      <div class="conclusion-nav">
        <span class="conclusion-nav-label">继续看</span>
        ${nav.map((n) => `<button class="conclusion-nav-link" data-action="scrollReport" data-target="${n.target}">${esc(n.no)} ${esc(n.label)}</button>`).join('')}
      </div>
    </section>`;
  }

  function markNums(html) {
    return String(html || '').replace(/(?<!>)([+-]?\d+\.\d+|\d+(?:\.\d+)?%|\d+\s*人)/g, '<b class="hl">$1</b>');
  }
  function drillSubjects(html, target) {
    const to = target || 'sec-subject';
    return String(html || '').replace(/(语文|数学|英语|物理|历史|化学|生物|政治|地理|日语|俄语)/g,
      (m) => `<button type="button" class="drill-link" data-action="drillReport" data-scope="subject" data-value="${m}" data-target="${to}">${m}</button>`);
  }
  function drillClass(c) {
    return `<button type="button" class="drill-link" data-action="drillReport" data-scope="class" data-value="${esc(c.id)}" data-target="sec-position">${esc(c.name)}</button>`;
  }
  function normRate(v) {
    if (v == null || isNaN(v)) return null;
    const n = Number(v);
    return Math.abs(n) > 10 ? n / 100 : n;
  }
  function ratePill(v) {
    const n = normRate(v);
    if (n == null) return '—';
    const cls = n >= 1.2 ? 'strong' : n >= 1 ? 'good' : n >= 0.9 ? 'warn' : 'bad';
    return `<span class="rate-pill ${cls}">${f2(n)}</span>`;
  }
  function levelPill(v) {
    const a = Math.abs(Number(v) || 0);
    const cls = a >= 4 ? 'deep' : a >= 2 ? 'bad' : a >= 1 ? 'warn' : 'neutral';
    return `<span class="rate-pill ${cls}">${a}</span>`;
  }
  function pctPill(v, avg, goodHigh) {
    if (v == null) return '—';
    const diff = v - avg;
    const good = goodHigh ? diff > 0.02 : diff < -0.02;
    const bad = goodHigh ? diff < -0.02 : diff > 0.02;
    const cls = good ? 'good' : bad ? 'bad' : 'neutral';
    return `<span class="rate-pill ${cls}">${pct1(v)}</span>`;
  }

  function rblock(opt) {
    const split = !!opt.reading;
    return `<section class="rblock ${opt.tone ? 'rblock-' + opt.tone : ''}" id="${opt.id}">
      <header class="rblock-head">
        <div class="rblock-no">${esc(opt.no)}</div>
        <div class="rblock-heading">
          <div class="rblock-kicker">${esc(opt.layer || '证据')} / ${esc(opt.en || 'EVIDENCE')}</div>
          <h2 class="rblock-title">${esc(opt.title)}</h2>
          ${opt.question ? `<p class="rblock-question">${esc(opt.question)}</p>` : ''}
        </div>
        ${opt.status ? `<div class="rblock-status">${opt.status}</div>` : ''}
      </header>
      ${opt.lead ? `<div class="rblock-lead">${drillSubjects(markNums(opt.lead))}</div>` : ''}
      <div class="rblock-body ${split ? 'split' : 'full'}">
        <div class="rblock-visual">${opt.visual || ''}</div>
        ${split ? `<aside class="rblock-reading">
          <div class="reading-label">解读 / READING</div>
          <ol class="reading-list">${opt.reading.map((r) => `<li><b>${esc(r[0])}</b><span>${r[1]}</span></li>`).join('')}</ol>
        </aside>` : ''}
      </div>
      ${opt.foot ? `<footer class="rblock-foot">${opt.foot}</footer>` : ''}
    </section>`;
  }

  function detailFold(inner, range, title, hint) {
    return `<div class="report-fold" id="report-fold">
      <button class="report-fold-head" type="button" data-action="toggleReportFold" aria-expanded="false">
        <span class="report-fold-mark">L4</span>
        <span class="report-fold-copy"><b>${esc(title || '数据依据与全貌')}</b><small>${esc(hint || '供核对，不参与结论 · 点击展开')}</small></span>
        <span class="report-fold-meta">${esc(range || '06–07')}</span>
        <span class="report-fold-icon">＋</span>
      </button>
      <div class="report-fold-body">${inner}</div>
    </div>`;
  }

  /* 等级净迁移：入口 vs 评价，返回净增/净减最多的等级 */
  function netShift(totals, gc) {
    const entry = new Array(gc).fill(0);
    const exit = new Array(gc).fill(0);
    totals.forEach((t) => {
      if (t.entryGrade >= 1 && t.entryGrade <= gc) entry[t.entryGrade - 1]++;
      if (t.currentGrade >= 1 && t.currentGrade <= gc) exit[t.currentGrade - 1]++;
    });
    const rows = entry.map((v, i) => ({ grade: i + 1, entry: v, exit: exit[i], delta: exit[i] - v }));
    const inc = rows.slice().sort((a, b) => b.delta - a.delta)[0];
    const dec = rows.slice().sort((a, b) => a.delta - b.delta)[0];
    return { rows, inc, dec };
  }

  /* ---------- 图下数据表 / 明细子块 ---------- */
  function miniTable(columns, rows, opts) {
    opts = opts || {};
    if (!rows || !rows.length) return `<div class="empty">暂无数据</div>`;
    const head = columns.map((c) => `<th class="${c.align || ''}">${c.label}</th>`).join('');
    const body = rows.map((r, i) => `<tr class="${opts.rowClass ? opts.rowClass(r, i) : ''}">${columns.map((c) => `<td class="${c.align || ''}">${c.render ? c.render(r, i) : esc(r[c.key])}</td>`).join('')}</tr>`).join('');
    return `<div class="table-wrap detail-table-wrap"><table class="table table-compact"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function wideClassTable(r, schoolId, classes, subjects, xRef) {
    const totalEval = r.classEval['总分'] || [];
    const nr = (v) => (v == null ? null : Math.abs(v) > 10 ? v / 100 : v);
    const rows = classes.map((c) => {
      const te = totalEval.find((x) => x.schoolId === schoolId && x.id === c.id);
      const rs = r.rows.filter((x) => x.schoolId === schoolId && x.classId === c.id);
      const cn = rs.filter((x) => x.subject === '总分').length || c.n;
      const tdec = rs.filter((x) => x.subject === '总分' && x.level < 0).length;
      const tbad = rs.filter((x) => x.subject === '总分' && x.level <= -2).length;
      const cells = subjects.map((sub) => {
        const se = (r.classEval[sub] || []).find((x) => x.schoolId === schoolId && x.id === c.id);
        const srs = rs.filter((x) => x.subject === sub);
        const dec = counts(srs).decline;
        const bad = srs.filter((x) => x.level <= -2).length;
        return `<td class="wide-cell">${se ? `<b class="${se.rate >= 1 ? 'r-good' : 'r-bad'}">${f2(nr(se.rate))}</b><small>退${dec} / 掉${bad}</small>` : '—'}</td>`;
      }).join('');
      return `<tr><th>${esc(c.name)}</th><td>${cn}</td><td>${te ? `<b class="${te.rate >= 1 ? 'r-good' : 'r-bad'}">${f2(nr(te.rate))}</b>` : '—'}</td><td>退${tdec} / 掉${tbad}</td><td>${te ? quadBadge(quadName(te.strength, nr(te.rate), xRef, 1)) : '—'}</td><td>掉2档 ${tbad} 人</td>${cells}</tr>`;
    }).join('');
    return `<div class="table-wrap r-wide-wrap"><table class="table r-wide-table">
      <thead><tr><th>班级</th><th>人数</th><th>总分增值</th><th>总分退/掉</th><th>格局</th><th>关注点</th>${subjects.map((s) => `<th>${esc(s)}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div><div class="figure-note">每个学科格：上行增值表现，下行“退步人数 / 掉2档以上人数”；一行一个班，总分与各科同表。</div>`;
  }

  function wideStudentTable(r, schoolId, classId) {
    const totals = studentTotals(r, schoolId, classId);
    if (!totals.length) return `<div class="empty">暂无学生</div>`;
    const subjects = orderSubjects(Array.from(new Set(r.rows.filter((x) => x.schoolId === schoolId && (!classId || x.classId === classId) && x.subject !== '总分').map((x) => x.subject))));
    const rows = totals.map((t) => {
      const rs = r.rows.filter((x) => x.studentId === t.studentId && x.subject !== '总分');
      const cells = subjects.map((sub) => {
        const x = rs.find((y) => y.subject === sub);
        if (!x) return `<td class="wide-cell">—</td>`;
        return `<td class="wide-cell"><b class="${x.level >= 0 ? 'r-good' : 'r-bad'}">G${x.entryGrade}→G${x.currentGrade}</b><small>Δz ${sgn(x.zDiff)}</small></td>`;
      }).join('');
      return `<tr><th>${esc(t.studentNo)}</th><td>${esc(t.studentName)}</td><td>${esc(t.className)}</td><td class="wide-cell"><b>G${t.entryGrade}→G${t.currentGrade}</b><small>${t.level > 0 ? '+' : ''}${t.level} 档</small></td>${cells}</tr>`;
    }).join('');
    return `<div class="table-wrap r-wide-wrap"><table class="table r-wide-table">
      <thead><tr><th>学号</th><th>姓名</th><th>班级</th><th>总分</th>${subjects.map((s) => `<th>${esc(s)}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div><div class="figure-note">每个学科格：入口档 → 评价档，下行为 Δz；一行一个学生，总分与各科同表。</div>`;
  }

  function chartTable(no, columns, rows, note, opts) {
    return `<div class="chart-table">
      <div class="chart-table-head"><span class="chart-table-no">表 ${esc(no)}</span><span class="chart-table-note">${note || ''}</span></div>
      ${miniTable(columns, rows, opts)}
    </div>`;
  }

  function quadName(x, y, xRef, yRef) {
    const strong = x >= xRef;
    const high = y >= yRef;
    if (strong && high) return '双高';
    if (!strong && high) return '低进高出';
    if (strong) return '高位承压';
    return '相对靠后';
  }
  function quadTone(name) {
    return name === '双高' ? 'green' : name === '低进高出' ? 'blue' : name === '高位承压' ? 'amber' : 'red';
  }
  function quadBadge(name) {
    return UI.badge(name, quadTone(name));
  }

  function detailBlock(letter, title, question, body, reading) {
    return `<section class="detail-block">
      <header class="detail-head">
        <span class="detail-letter">${esc(letter)}</span>
        <div><h3>${esc(title)}</h3><p>${esc(question)}</p></div>
      </header>
      <div class="detail-body">${body}</div>
      ${reading ? `<div class="detail-reading"><span>读法</span>${reading}</div>` : ''}
    </section>`;
  }

  function detailLayer(no, blocks, sub, title) {
    return `<section class="report-section detail-layer" id="sec-appendix">
      <div class="report-sec-head">
        <span class="report-sec-no">${esc(no)}</span>
        <div><div class="report-sec-title">${esc(title || '补充明细与数据质量')}</div><div class="report-sec-sub">${esc(sub || '只保留正文未展开的表；供核对，不参与正文结论')}</div></div>
      </div>
      ${blocks}
    </section>`;
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
    let tone = 'gray';
    if (text === '高入口退步') tone = 'amber';
    else if (text === '单科重度') tone = 'crimson';
    else if (text.indexOf('单科退步≥2') === 0) tone = 'purple';
    else if (text === '总分退步≥2') tone = 'red';
    else if (text === '总分退步') tone = 'gray';
    return UI.badge(riskTagLabel(text), tone);
  }
  function riskLegend() {
    return `<div class="risk-legend">
      <span class="badge badge-red"><i class="badge-dot"></i>总分掉2档以上</span>
      <span class="badge badge-amber"><i class="badge-dot"></i>入口靠前但退步</span>
      <span class="badge badge-purple"><i class="badge-dot"></i>单科掉2档以上</span>
      <span class="badge badge-crimson"><i class="badge-dot"></i>单科掉4档以上</span>
      <span class="badge badge-gray"><i class="badge-dot"></i>总分退步</span>
    </div>`;
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
    return `<div class="scan-row">
      <div class="scan-label"><span class="scan-no">${no}</span><span>${esc(label)}</span></div>
      <div class="scan-body">
        <div class="scan-headline"><b>${position}</b>${statusBadge(status)}</div>
        <div class="scan-detail">${metric}</div>
        <div class="scan-compare"><span class="scan-diff">${diff}</span>${scale ? `<span class="scan-scale">${scale}</span>` : ''}</div>
        ${sub ? `<div class="scan-sub">${sub}</div>` : ''}
      </div>
    </div>`;
  }
  function caption(text) { return `<div class="report-caption">${text}</div>`; }
  function scopeBar(inner) { return `<div class="report-scope">${inner}</div>`; }
  function teacherViewSwitch(taught, active) {
    return `<span class="report-scope-label">视角</span><div class="view-switch">
      <button class="chip ${active ? '' : 'active'}" data-action="setTeacherView" data-value="">教师汇总</button>
      ${taught.map((c) => `<button class="chip ${active === c.id ? 'active' : ''}" data-action="setTeacherView" data-value="${esc(c.id)}">${esc(c.name)}</button>`).join('')}
    </div>`;
  }
  function subjectTeacherSwitch(teachers, active) {
    return `<span class="report-scope-label">教师</span><div class="view-switch">
      <button class="chip ${active ? '' : 'active'}" data-action="setSubjectTeacher" data-value="">学科汇总</button>
      ${teachers.map((t) => `<button class="chip ${active === t.id ? 'active' : ''}" data-action="setSubjectTeacher" data-value="${esc(t.id)}">${esc(t.name)}</button>`).join('')}
    </div>`;
  }
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
  function reportBasics(task, r, role, desc) {
    const exams = (window.MOCK && window.MOCK.exams) || [];
    const entry = exams.find((e) => e.id === task.entryExamId);
    const exit = exams.find((e) => e.id === task.exitExamId);
    const examText = `${entry ? esc(entry.name) : task.entryExamId || '入口'} → ${exit ? esc(exit.name) : task.exitExamId || '评价'}`;
    return `<section class="report-basics" aria-label="本考试报告说明">
      <div class="rb-head"><span class="rb-kicker">本考试报告说明 / REPORT BASIS</span><span class="rb-tag">先读这一页</span></div>
      <div class="rb-grid">
        <div><span>考试任务</span><b>${esc(task.name)}</b><em>${examText}</em></div>
        <div><span>统计范围</span><b>${esc(role.label)} · ${esc(desc)}</b><em>参评 ${r.quality.sample} 人 · 剔除 ${r.quality.excluded || 0} · 部分缺考 ${r.quality.partialAbsentExcluded || 0}</em></div>
        <div><span>计算口径</span><b>${task.algorithm === 'grade' ? '等级差法' : '标准分法'} · ${r.gradeCount || 9} 档</b><em>结果版本 ${esc(task.resultVersion || '—')} · 更新 ${esc(task.updatedAt || '—')}</em></div>
        <div><span>阅读说明</span><b>结论 → 证据 → 行动 → 明细</b><em>蓝=关键数字，红=退步，绿=亮点；带下划线的词可点击定位</em></div>
      </div>
      <div class="algo-panel">
        <div class="algo-steps">
          <div class="algo-title">计算过程 <span>${task.algorithm === 'grade' ? '等级差法' : '标准分法'}</span></div>
          <ol>
            <li><b>算标准分</b><span>原始分先换成标准分：<code>z =（原始分 − 联考均分）÷ 标准差</code>；入口、评价各算一次，不同科目放到同一把尺子上。</span></li>
            <li><b>划九档</b><span>按标准正态 Z 区间划成 G1–G9：<b>G1 最高（最好）</b>、<b>G9 最低（最弱）</b>；G1 > G2 > … > G9；入口档和评价档分开判定。</span></li>
            <li><b>算跨档贡献</b><span>等级权重 G1=90 … G9=10。保持/进步/退步按跨过的档位累计；进步取目标档权重，退步取 <code>100 − 目标档权重</code>，掉得越深贡献越大。</span></li>
            <li><b>合成相对进步率</b><span><code>相对进步率 =（保持值 + 进步值×2）÷（（退步值+1）×1.5）</code>；1.0 为平衡，大于 1 表示进步贡献大于退步。</span></li>
          </ol>
          <div class="algo-alt">若任务选择等级差法：不经过标准分，直接用入口档和评价档套用同一套跨档权重与合成公式。</div>
        </div>
        <div class="algo-metrics">
          <div class="algo-title">指标说明</div>
          <dl>
            <dt>学业实力</dt><dd>评价档按 90→10 权重加权平均，表示“现在站在什么位置”，是位置参考，不是增值结果。</dd>
            <dt>相对进步率</dt><dd>保持、进步、退步三类贡献的合成值；1.0 平衡，不是百分比，不能读成“提高了 1.2%”。</dd>
            <dt>进步 / 保持 / 退步</dt><dd>评价档高于、等于、低于入口档；同时看人数和占比，不能只看人数。</dd>
            <dt>平均级差</dt><dd>评价档减入口档的平均值；正数=平均升档，负数=平均降档，看幅度。</dd>
            <dt>进步面 / 保持面 / 退步面</dt><dd>对应人数 ÷ 参评人数；用于校际、班级之间比较结构。</dd>
            <dt>等级迁移</dt><dd>入口 G→评价 G 的人数结构；看低档是否变宽、高档是否变窄，不只看一个总率。</dd>
            <dt>象限</dt><dd>学业实力 × 相对进步率，以校均值与 1.0 划分双高 / 低进高出 / 高位承压 / 相对靠后。</dd>
            <dt>样本规则</dt><dd>少于 8 人的班/科/教师只展示指标、不参与排名；跨校比较先看样本与入口结构。</dd>
          </dl>
        </div>
      </div>
      <div class="algo-foot"><span>颜色：绿=进步/优势，红=退步/风险，橙=需关注，蓝=关键数字。</span><a href="algorithm.html" target="_blank" rel="noopener">查看完整算法与示例 →</a></div>
    </section>`;
  }

  function shell(task, roleKey, title, desc, scope, body) {
    const role = ROLES.find((x) => x.key === roleKey) || ROLES[0];
    const r = App.result(task.id);
    const algo = task.algorithm === 'grade' ? '等级差法' : '标准分法';
    return `<div class="page report-page">
      <header class="report-cover">
        <div class="cover-top">
          <div class="breadcrumb"><span>管理</span><span class="sep">/</span><span>评价任务</span><span class="sep">/</span><a href="#/evaluations/${task.id}/reports">报告</a><span class="sep">/</span><span>${esc(role.label)}</span></div>
          <div class="page-actions">
            <a class="btn" href="#/evaluations/${task.id}/results">查看结果</a>
            <a class="btn" href="#/evaluations/${task.id}/reports">切换报告</a>
            <button class="btn" data-action="printReport">导出 PDF</button>
          </div>
        </div>
        <div class="cover-kicker">Value-added evaluation report · ${esc(role.label)}</div>
        <h1 class="cover-title">${esc(title)}</h1>
        <div class="cover-desc">${esc(desc)}</div>
        <div class="cover-meta">
          <span>任务 <b>${esc(task.name)}</b></span>
          <span>口径 <b>${algo} / ${r.gradeCount || 9} 档</b></span>
          <span>样本 <b>${r.quality.sample} 人</b></span>
          <span>版本 <b>${esc(task.resultVersion || '—')}</b></span>
        </div>
        <span class="cover-role">${esc(role.reader)}</span>
      </header>
      ${roleBar(task.id, roleKey)}
      ${metaBar(task)}
      ${reportBasics(task, r, role, desc)}
      ${scope || ''}
      <div id="report-drill-bar" class="report-drill-bar" hidden></div>
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
          <div class="report-eyebrow">报告中心 <span>/ REPORT CENTER</span></div>
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
    const schoolXRef = mean(schools.map((s) => s.strength));
    const schoolQuad = quadrant(schools.map((s, i) => ({
      x: s.strength,
      y: s.rate,
      size: s.n,
      label: s.schoolName,
      sub: `${s.n} 人 · 增值第 ${s.rateRank}`,
      tone: ['p1', 'p2', 'p3', 'p4'][i % 4],
      title: `${s.schoolName}：学业实力 ${f1(s.strength)}，相对进步率 ${f2(s.rate)}，n=${s.n}`
    })), {
      xRef: schoolXRef,
      yRef: 1,
      xLabel: '学业实力（入口位置，越高越强）',
      yLabel: '相对进步率（1.0 为平衡点）',
      aria: '四校学业实力与相对进步率四象限'
    });
    const quadFig = figure('图 1', '四校实力 × 增值矩阵',
      '<span><i class="sq" style="background:var(--chart-1)"></i>点大小 = 参评人数</span><span><i class="sq" style="background:#a9b7ca"></i>虚线 = 均值 / 1.0</span>',
      schoolQuad,
      '横轴为入口学业实力，纵轴为相对进步率；右上“双高”、左上“低进高出”、右下“高位承压”、左下“相对靠后”，判定口径见 06-C。');
    const schoolQuadTable = chartTable('1', [
      { key: 'schoolName', label: '学校', render: (s) => `<b>${esc(s.schoolName)}</b>` },
      { key: 'strength', label: '学业实力', align: 'num', render: (s) => f1(s.strength) },
      { key: 'rate', label: '相对进步率', align: 'num', render: (s) => ratePill(s.rate) },
      { key: 'declineRatio', label: '退步比例', align: 'num', render: (s) => pct1(s.declineRatio) },
      { key: 'decline', label: '退步人数', align: 'num' },
      { key: 'n', label: '参评人数', align: 'num' },
      { key: 'ranks', label: '实力/增值排名', render: (s) => `${s.strengthRank} / ${s.rateRank}` },
      { key: 'quad', label: '象限', render: (s) => quadBadge(quadName(s.strength, s.rate, schoolXRef, 1)) }
    ], schools, '四校汇总 · 象限按四校均值与 1.0 判定');
    const scan = `<div class="report-scan">
      ${scanRow('01', '学校', esc(lowRate.schoolName), `${lowRate.n} 人中 ${lowRate.declineCount} 人退步（${pct1(lowRate.declineRatio)}）`, `增值表现 ${f2(lowRate.rate)} · 四校最低`, `${lowRate.n} 人`, overallKey, `相对最好：${esc(top.schoolName)} ${f2(top.rate)}`)}
      ${scanRow('02', '学科', '四校学科差距', '见 05 学科差异', '按增值表现最高与最低之差', `${schools.length} 校`, 'attention', '差距最大的学科优先看')}
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
        { key: 'rate', label: '增值表现', align: 'num', render: (x) => ratePill(x.rate) },
        { key: 'declineRatio', label: '退步比例', align: 'num', render: (x) => pct1(x.declineRatio) },
        { key: 'decline', label: '退步人数', align: 'num' },
        { key: 'rank', label: '整体/增值排名', render: (x) => `${x.strengthRank} / ${x.rateRank}` }
      ],
      rows: schools
    });
    const heatClass = (v) => v == null ? '' : v >= 1.2 ? 'rate-strong' : v >= 1 ? 'rate-good' : v < 0.9 ? 'rate-bad' : 'rate-mid';
    const subjectTable = `<div class="table-wrap"><table class="table r-app-table">
      <thead><tr><th>学科</th>${schools.map((s) => `<th>${esc(s.schoolName)}</th>`).join('')}</tr></thead>
      <tbody>${subjectsOf(r).map((sub) => `<tr><th>${esc(sub)}</th>${schools.map((s) => {
        const g = (r.schoolEval[sub] || []).find((x) => x.schoolId === s.schoolId);
        return `<td class="${g ? heatClass(g.rate) : ''}">${g ? f2(g.rate) : '—'}</td>`;
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
      <button class="report-toc-link active" data-action="scrollReport" data-target="sec-summary">01 结论摘要</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-position">02 四校格局</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-diff">03 指标差异</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-gap">04 差距在哪</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-subject">05 学科差异</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-grade">06 等级结构</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-positive">07 正向发现</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-actions">08 先找谁</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-appendix">09 数据质量与口径</button>
      <button class="btn btn-primary btn-sm report-toc-export" data-action="printReport">导出 PDF</button>
      <div class="report-toc-note">A4 纵向 · 导出后可打印</div>
    </aside>`;
    const positiveSubject = subjectGaps.slice().sort((a, b) => b.hi.g.rate - a.hi.g.rate)[0];
    const summary = conclusionLayer(verdict, [
      { label: '发现', text: `<b>${esc(top.schoolName)}</b> 相对进步率 ${f2(top.rate)} 最高，<b>${esc(lowRate.schoolName)}</b> ${f2(lowRate.rate)} 最低；四校极差 ${rateGap.toFixed(2)}，退步学生 ${all.decline} 人（${pct(all.declineRatio)}）。` },
      { label: '风险', text: `${esc(lowRate.schoolName)} 退步比例 ${pct1(lowRate.declineRatio)} 为四校最高；${subjectGaps[0] ? `学科差距最大的是 ${esc(subjectGaps[0].subject)}（${subjectGaps[0].gap.toFixed(2)}）` : '学科差距暂不足样本判断'}。` },
      { label: '亮点', text: `${schools.filter((s) => s.rate >= 1).length} 校达到 1.0 平衡；${positiveSubject ? `${esc(positiveSubject.hi.school.schoolName)} 的 ${esc(positiveSubject.subject)} 增值 ${f2(positiveSubject.hi.g.rate)} 为四校最高` : '样本不足，暂不做学科亮点判断'}。` },
      { label: '建议', text: `先让 ${esc(lowRate.schoolName)} 按入口段和学科拆解；再由 ${esc(subjectGaps[0] ? subjectGaps[0].subject : '教研')} 教研员牵头做跨校同题分析。` }
    ], [
      { no: '02', label: '四校格局', target: 'sec-position' },
      { no: '03', label: '指标差异', target: 'sec-diff' },
      { no: '04', label: '差距在哪', target: 'sec-gap' },
      { no: '05', label: '学科差异', target: 'sec-subject' }
    ]);
    const positionBlock = rblock({
      id: 'sec-position', no: '02', layer: '证据', en: 'POSITION',
      title: '四校格局', question: '四校各自处在什么位置？实力与增值是否匹配？',
      lead: `<b>${esc(top.schoolName)}</b> 相对进步率 ${f2(top.rate)} 最高，<b>${esc(lowRate.schoolName)}</b> ${f2(lowRate.rate)} 最低；极差 ${rateGap.toFixed(2)}。`,
      visual: quadFig + schoolQuadTable,
      reading: [
        ['读法', '横轴为入口学业实力，纵轴为相对进步率；虚线分别是四校均值与 1.0 平衡点，右上“双高”、左上“低进高出”、右下“高位承压”、左下“相对靠后”。'],
        ['提示', `${esc(top.schoolName)} 与 ${esc(lowRate.schoolName)} 的增值差为 ${rateGap.toFixed(2)}，需先排除入口结构与样本差异，再讨论教学差异。`],
        ['动作', '先到 03 看关键指标差异，到 04 看入口段，再到 05 看具体学科。']
      ],
      foot: `<span>图 1 · 四校实力 × 增值矩阵</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-position">02 四校总表</button></span>`
    });
    const metricDefs = [
      { key: 'strength', label: '学业实力', pct: false, fmt: f1 },
      { key: 'rate', label: '相对进步率', pct: false, fmt: f2 },
      { key: 'progressRatio', label: '进步面', pct: true, fmt: pct1 },
      { key: 'keepRatio', label: '保持面', pct: true, fmt: pct1 },
      { key: 'declineRatio', label: '退步面', pct: true, fmt: pct1 }
    ];
    const totalN = schools.reduce((s, x) => s + x.n, 0);
    const avgVal = (key) => schools.reduce((s, x) => s + (x[key] || 0) * x.n, 0) / Math.max(1, totalN);
    const avgStrength = avgVal('strength');
    const diffTable = miniTable([
      { key: 'schoolName', label: '学校', render: (s) => s.isAvg ? `<b>区域均值</b>` : `<b>${esc(s.schoolName)}</b>` },
      ...metricDefs.map((d) => ({ key: d.key, label: d.label, align: 'num', render: (s) => {
        const v = s.isAvg ? avgVal(d.key) : s[d.key];
        if (d.key === 'rate') return ratePill(v);
        if (d.key === 'strength') return f1(v);
        return pctPill(v, avgVal(d.key), d.key === 'progressRatio' || d.key === 'keepRatio');
      } })),
      { key: 'n', label: '参评', align: 'num' }
    ], schools.concat([{ schoolName: '区域均值', isAvg: true, n: totalN }]), '按参评人数加权 · 差异看极差');
    const diffs = metricDefs.filter((d) => d.key !== 'strength').map((d) => {
      const vals = schools.map((s) => ({ s, v: s[d.key] })).filter((x) => x.v != null);
      const hi = vals.slice().sort((a, b) => b.v - a.v)[0];
      const lo = vals.slice().sort((a, b) => a.v - b.v)[0];
      return { ...d, hi, lo, gap: hi.v - lo.v };
    }).sort((a, b) => b.gap - a.gap);
    const maxGap = Math.max(...diffs.map((d) => d.gap), 0.0001);
    const gapText = (d) => d.pct ? `${(d.gap * 100).toFixed(1)} 个百分点` : d.gap.toFixed(2);
    const diffFocus = `<div class="diff-focus">${diffs.map((d) => `<div class="diff-row">
      <span class="diff-label">${esc(d.label)}</span>
      <span class="diff-bar"><i style="width:${(d.gap / maxGap * 100).toFixed(1)}%"></i></span>
      <b>${gapText(d)}</b>
      <em>${esc(d.hi.s.schoolName)} / ${esc(d.lo.s.schoolName)}</em>
    </div>`).join('')}</div>`;
    const declineDiff = diffs.find((d) => d.key === 'declineRatio') || diffs[0];
    const diffBlock = rblock({
      id: 'sec-diff', no: '03', layer: '证据', en: 'DIFFERENCE',
      title: '关键指标差异', question: '四校差异到底落在哪个指标上？',
      lead: `四校差异集中在两项：<b>${esc(diffs[0].label)}</b> 极差 ${gapText(diffs[0])}（${esc(diffs[0].hi.s.schoolName)} / ${esc(diffs[0].lo.s.schoolName)}）；<b>退步面</b> 极差 ${gapText(declineDiff)}（${esc(declineDiff.hi.s.schoolName)} / ${esc(declineDiff.lo.s.schoolName)}）。`,
      visual: `<div class="report-subhead" id="r-app-diff">A1 关键指标对比</div>${diffTable}<div class="report-subhead mt-16">差异聚焦：最高校 − 最低校</div>${diffFocus}`,
      reading: [
        ['读法', '表格给四校关键指标与区域均值；下方条形按各指标极差排列，单位不同，只作方向参考。'],
        ['提示', '学业实力是入口，进步率是结果；两者一起看，避免把入口差异当成教学差异。'],
        ['动作', `先针对 ${esc(diffs[0].label)} 和退步面做校际拆解，再看 05 学科和 06 等级结构。`]
      ],
      foot: `<span>表 A1 · 关键指标差异</span><span class="report-check">核对：02 四校总表</span>`
    });

    const gradeDist = (rows, key) => {
      const m = {};
      rows.forEach((x) => { m[x[key]] = (m[x[key]] || 0) + 1; });
      return Array.from({ length: 9 }, (_, i) => ({ g: i + 1, pct: (m[i + 1] || 0) / Math.max(1, rows.length) }));
    };
    const gradeDelta = `<div class="grade-delta-grid">${schools.map((s) => {
      const rs = r.totals.filter((x) => x.schoolId === s.schoolId);
      const entry = gradeDist(rs, 'entryGrade');
      const exit = gradeDist(rs, 'currentGrade');
      const deltas = entry.map((x, i) => (exit[i].pct - x.pct) * 100);
      const lowNet = deltas.slice(6).reduce((a, b) => a + b, 0);
      const maxAbs = Math.max(1, ...deltas.map((d) => Math.abs(d)));
      return `<div class="gd-card"><div class="gd-head"><b>${esc(s.schoolName)}</b><span>低档净增 <b class="${lowNet > 0 ? 'r-bad' : 'r-good'}">${lowNet > 0 ? '+' : ''}${lowNet.toFixed(1)}pp</b></span></div>
        <div class="gd-plot"><div class="gd-zero"></div>${deltas.map((d, i) => {
          const good = i < 3 ? d > 0 : i > 5 ? d < 0 : null;
          const color = good === true ? '#1a9850' : good === false ? '#d73027' : '#94a3b8';
          return `<div class="gd-col" title="G${i + 1}：评价占比 − 入口占比 ${d > 0 ? '+' : ''}${d.toFixed(1)} 个百分点">
            <span class="gd-bar ${d >= 0 ? 'up' : 'down'}" style="height:${(Math.abs(d) / maxAbs * 45).toFixed(1)}%;background:${color}"></span>
            <em class="g${i + 1}">G${i + 1}</em>
          </div>`;
        }).join('')}</div>
      </div>`;
    }).join('')}</div>`;
    const gradeBlock = rblock({
      id: 'sec-grade', no: '06', layer: '证据', en: 'STRUCTURE',
      title: '等级结构变化', question: '各校入口到评价，结构往哪一档移动？',
      lead: `看每校 G1–G9 的“评价占比 − 入口占比”：<b>G1–G3 向上（绿）= 高端变厚</b>，<b>G7–G9 向上（红）= 低档变宽</b>。`,
      visual: `<div class="gd-key"><span class="gd-swatch good"></span>改善：高端增加 / 低档减少</div><div class="gd-key"><span class="gd-swatch bad"></span>恶化：低档增加 / 高端减少</div>${gradeDelta}<div class="gd-axis">G1 最好（绿标） → G5 中间 → G9 最弱（红标）；柱色=变化好坏（绿=改善、红=恶化），柱向上=该档占比增加。</div>`,
      reading: [
        ['读法', '每校一张 9 柱小图，横轴 G1–G9；柱子向上表示该档占比增加，向下表示减少。'],
        ['提示', 'G7–G9 向上（红）= 低档变宽，结构下沉；G1–G3 向上（绿）= 高端变厚。中间 G4–G6 灰色仅表示位置变化。'],
        ['动作', `先看低档净增最大的学校，回到 04 看它集中在哪类入口学生。`]
      ],
      foot: `<span>图 3 · 四校等级占比变化</span><span class="report-check">核对：06 等级结构</span>`
    });

    const balanced = schools.filter((s) => s.rate >= 1);
    const bestProg = schools.slice().sort((a, b) => b.progressRatio - a.progressRatio)[0];
    const advCounts = schools.map((s) => ({
      s,
      count: subjectsOf(r).filter((sub) => {
        const g = (r.schoolEval[sub] || []).find((x) => x.schoolId === s.schoolId);
        return g && g.n >= (r.smallSample || 30) && g.rate >= 1.2;
      }).length
    })).sort((a, b) => b.count - a.count);
    const lowHigh = schools.filter((s) => s.strength < avgStrength && s.rate >= 1);
    const shareSchool = advCounts[0].s.schoolName === bestProg.schoolName
      ? (schools.find((s) => s.schoolName !== bestProg.schoolName) || bestProg).schoolName
      : advCounts[0].s.schoolName;
    const positiveBlock = rblock({
      id: 'sec-positive', no: '07', layer: '证据', en: 'POSITIVE',
      title: '正向发现', question: '哪些学校、哪些学科已经跑出可复制的做法？',
      lead: `<b>${balanced.length} 校</b>达到 1.0 平衡；<b>${esc(bestProg.schoolName)}</b> 进步面 ${pct1(bestProg.progressRatio)} 为四校最高；${advCounts[0].count} 个优势学科集中在 ${esc(advCounts[0].s.schoolName)}。`,
      visual: `<div class="positive-grid">
        <div class="positive-card"><span>达到平衡</span><b>${balanced.length} 校</b><em>${balanced.map((s) => esc(s.schoolName)).join('、') || '暂无'}</em></div>
        <div class="positive-card"><span>进步面最高</span><b>${pct1(bestProg.progressRatio)}</b><em>${esc(bestProg.schoolName)}</em></div>
        <div class="positive-card"><span>优势学科最多</span><b>${advCounts[0].count} 科</b><em>${esc(advCounts[0].s.schoolName)} · 增值 ≥1.2</em></div>
        <div class="positive-card"><span>低进高出</span><b>${lowHigh.length} 校</b><em>${lowHigh.map((s) => esc(s.schoolName)).join('、') || '暂无'}</em></div>
      </div>${miniTable([
        { key: 'schoolName', label: '学校', render: (s) => `<b>${esc(s.schoolName)}</b>` },
        { key: 'progressRatio', label: '进步面', align: 'num', render: (s) => pct1(s.progressRatio) },
        { key: 'keepRatio', label: '保持面', align: 'num', render: (s) => pct1(s.keepRatio) },
        { key: 'adv', label: '优势学科数', align: 'num' }
      ], advCounts.map((x) => ({ ...x.s, adv: x.count })), '优势学科：该校增值 ≥1.2 且样本 ≥30 的学科')}`,
      reading: [
        ['读法', '四张卡是正向指标；下表按学校列进步面、保持面和优势学科数。'],
        ['提示', '正向发现不是表扬，而是找可复制的做法；先看优势学科集中在哪类入口学生。'],
        ['动作', `让 ${esc(advCounts[0].s.schoolName)} 和 ${esc(shareSchool)} 各出一页做法，跨校分享。`]
      ],
      foot: `<span>正向指标 · 与风险并列</span><span class="report-check">核对：07 正向发现</span>`
    });

    const gapBlock = rblock({
      id: 'sec-gap', no: '04', layer: '证据', en: 'GAP',
      title: '差距在哪', question: '差距是均值差，还是入口段和局部学校的差？',
      lead: `四校差距不在均值本身：<b>${esc(lowRate.schoolName)}</b> 退步比例 ${pct1(lowRate.declineRatio)}，<b>${esc(top.schoolName)}</b> 为 ${pct1(top.declineRatio)}。`,
      visual: scan,
      reading: [
        ['读法', '四行分别是学校、学科、入口位置、数据质量；状态标签是相对同级的判断，不是问责结论。'],
        ['提示', `${esc(lowRate.schoolName)} 的退步比例最高；若该校样本或入口结构与其他校差异大，先核对 E 数据质量再看教学。`],
        ['动作', `要求 ${esc(lowRate.schoolName)} 按班级和学科拆解，并在一周内回传拆解表。`]
      ],
      foot: `<span>扫描表 · 口径见 09</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-position">02 四校总表</button></span>`
    });
    const subjectBlock = rblock({
      id: 'sec-subject', no: '05', layer: '证据', en: 'SUBJECT',
      title: '学科差距', question: '哪一科的校际差距最大，应该先看哪科？',
      lead: `校际差距最大的学科是 <b>${esc(subjectGaps[0] ? subjectGaps[0].subject : '—')}</b>${subjectGaps[0] ? `（增值差 ${subjectGaps[0].gap.toFixed(2)}）` : ''}；前三科见下。`,
      visual: `<div class="report-hot-top">${slots}</div>${subjectTable}`,
      reading: [
        ['读法', '上方三格是校际增值差最大的学科，下方表格是各校分科增值表现；只列四校样本都 ≥30 的学科。'],
        ['提示', '差距小不代表没有问题，需结合校内分布和入口位置；差距大的学科更适合先做跨校同题分析。'],
        ['动作', `由 ${esc(subjectGaps[0] ? subjectGaps[0].subject : '教研')} 教研员牵头，两周内出一页跨校对比。`]
      ],
      foot: `<span>图 2 · 学科差距与分科值</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-subject">05 学科差异</button></span>`
    });
    const actionBlock = rblock({
      id: 'sec-actions', no: '08', layer: '行动', en: 'ACTION',
      title: '先找谁、做什么', question: '学校、学科、数据三条线，各自先做哪一件事？',
      visual: actions,
      foot: `<span>行动建议 · 不作为问责依据</span><span class="report-check">核对：05 学科差异 / 09 数据质量</span>`
    });
    const qualityTable = miniTable([
      { key: 'k', label: '项目' }, { key: 'v', label: '数值' }
    ], [
      { k: '参评人数', v: all.n }, { k: '联考样本', v: r.quality.sample || all.n },
      { k: '剔除', v: r.quality.excluded || 0 }, { k: '部分缺考', v: r.quality.partialAbsentExcluded || 0 },
      { k: '结果版本', v: task.resultVersion || '—' }
    ]);
    const detail = detailLayer('09',
      detailBlock('A', '数据质量', '样本和口径是否支持比较？',
        `<div class="report-subhead" id="r-app-e">E 数据质量</div>${qualityTable}<div class="report-note">区域页只看学校/学科汇总，不展示学生姓名和班级名单。</div>`,
        '四校总表和学科表已在正文展开；这里只核对样本、剔除、部分缺考和版本，再做校际比较。'),
      '只保留正文未展开的数据质量表', '数据质量与口径');
    const sections = summary + positionBlock + diffBlock + gapBlock + subjectBlock + gradeBlock + positiveBlock + actionBlock + detail;
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

    /* 报告级图表：等级迁移 + 班级四象限 */
    const shiftFig = figure('图 1', '入口 → 评价 等级分布迁移',
      '<span><i class="entry"></i>入口</span><span><i class="exit"></i>评价</span>',
      gradeShift(totals, { gradeCount: r.gradeCount }),
      `G1 最好、G9 最弱；按 G1–G9 统计人数：灰色为入口、蓝色为评价；右侧 Δ 为评价与入口人数之差。样本 ${totals.length} 人。`);
    const quadClasses = classes.filter((c) => c.n >= r.smallSample);
    const classXRef = mean(quadClasses.map((c) => c.strength));
    const classQuad = quadrant(quadClasses.map((c) => ({
      x: c.strength,
      y: c.rate,
      size: c.n,
      label: c.name,
      tone: c.id === topClass.id ? 'p2' : 'p1',
      title: `${c.name}：学业实力 ${f1(c.strength)}，相对进步率 ${f2(c.rate)}，${c.n} 人`
    })), {
      xRef: classXRef,
      yRef: 1,
      labelAll: true,
      xLabel: '班级学业实力（入口位置）',
      yLabel: '班级相对进步率（1.0 为平衡点）',
      aria: '班级学业实力与相对进步率四象限'
    });
    const classQuadFig = figure('图 2', '班级实力 × 增值矩阵',
      '<span><i class="sq" style="background:var(--chart-1)"></i>班级</span><span><i class="sq" style="background:var(--chart-2)"></i>当前焦点班</span>',
      classQuad,
      `只纳入人数 ≥ ${r.smallSample} 的班级；气泡大小 = 班级人数。全部班级名称直接标注在点旁；极密集处就近避让，不画引线。`);
    const shift = netShift(totals, r.gradeCount || 9);
    const shiftTable = chartTable('1', [
      { key: 'grade', label: '等级', render: (x) => `G${x.grade}` },
      { key: 'entry', label: '入口人数', align: 'num' },
      { key: 'exit', label: '评价人数', align: 'num' },
      { key: 'delta', label: 'Δ 人数', align: 'num', render: (x) => `${x.delta > 0 ? '+' : ''}${x.delta}` },
      { key: 'rate', label: '评价占比', align: 'num', render: (x) => totals.length ? pct(x.exit / totals.length) : '—' }
    ], shift.rows, `样本 ${totals.length} 人 · Δ = 评价人数 − 入口人数`);
    const classQuadTable = chartTable('2', [
      { key: 'name', label: '班级', render: (x) => `<b>${esc(x.name)}</b>` },
      { key: 'strength', label: '学业实力', align: 'num', render: (x) => f1(x.strength) },
      { key: 'rate', label: '相对进步率', align: 'num', render: (x) => ratePill(x.rate) },
      { key: 'n', label: '人数', align: 'num' },
      { key: 'ranks', label: '实力/增值排名', render: (x) => `${x.strengthRank} / ${x.rateRank}` },
      { key: 'quad', label: '象限', render: (x) => quadBadge(quadName(x.strength, x.rate, classXRef, 1)) }
    ], quadClasses.slice().sort((a, b) => a.strengthRank - b.strengthRank), `共 ${quadClasses.length} 个班 · 象限按年级均值与 1.0 判定`, {
      rowClass: (x) => x.id === topClass.id ? 'report-row-active' : ''
    });

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
      { key: 'level', label: '掉了几档', align: 'num', render: (x) => levelPill(x.level) },
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
        { key: 'rate', label: '增值表现（相对进步率）', align: 'num', render: (x) => ratePill(x.rate) },
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
        <td>${esc(s.subject)}</td><td>${s.n}</td><td>${s.declineCount || 0}</td><td>${pctPill(s.declineRatio || 0, mean(allSubjectRows.map((x) => x.declineRatio || 0)), false)}</td><td>${s.allCount}</td><td>${s.count}</td><td>${ratePill(s.rate)}</td>
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
      { key: 'level', label: '掉了几档', align: 'num', render: (x) => levelPill(x.level) },
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
      <button class="report-toc-link active" data-action="scrollReport" data-target="sec-summary">01 结论摘要</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-position">02 位置与结构</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-class">03 班级格局</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-entry">04 入口段</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-flow">05 等级流向</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-scan">06 问题扫描</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-hot">07 最集中的班和科</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-subject">08 学科结构</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-tags">09 关注名单</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-actions">10 先找谁、做什么</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-appendix">11 补充明细与数据质量</button>
      <button class="btn btn-primary btn-sm report-toc-export" data-action="printReport">导出 PDF</button>
      <div class="report-toc-note">A4 纵向 · 导出后可打印</div>
    </aside>`;
    const positiveSub = rankedSubjects(r, schoolId)[0];
    const summary = conclusionLayer(verdict, [
      { label: '发现', text: `<b>${esc(g.schoolName)}</b> 相对进步率 ${f2(g.rate)}，四校增值第 ${g.rateRank}；${pct1(g.declineRatio)} 学生总分退步（${g.declineCount} 人）。` },
      { label: '风险', text: `<b>${esc(topClass.name)}</b> ${topClass.n} 人中 ${topClass.decline} 人退步（${pct1(topClass.actual)}），比同类班高 ${topClass.excess.toFixed(1)} 个百分点；${esc(topCellText)} 最集中。` },
      { label: '亮点', text: `进步 <b class="hl-good">${g.progressCount || 0} 人</b>、保持 ${g.keepCount || 0} 人；${positiveSub ? `<b>${esc(positiveSub.subject)}</b> 增值 ${f2(positiveSub.rate)}，相对最强` : '学科样本不足'}。` },
      { label: '建议', text: `先找 ${esc(topClass.name)} 班主任和 ${esc(topSubject.subject)} 备课组；3 天内核对 ${riskAll.length} 人关注名单，再定两周复查指标。` }
    ], [
      { no: '02', label: '位置与结构', target: 'sec-position' },
      { no: '03', label: '班级格局', target: 'sec-class' },
      { no: '04', label: '入口段', target: 'sec-entry' }
    ]);
    const positionBlock = rblock({
      id: 'sec-position', no: '02', layer: '证据', en: 'POSITION',
      title: '位置与结构', question: '入口到评价，年级的等级结构发生了什么变化？',
      lead: `入口到评价：<b>G${shift.inc.grade} 净增 ${shift.inc.delta} 人</b>、<b>G${shift.dec.grade} 净减 ${Math.abs(shift.dec.delta)} 人</b>；先确认这是整体位移还是局部掉档。`,
      visual: shiftFig + classShiftGrid(r, schoolId, classes, r.gradeCount) + shiftTable,
      reading: [
        ['读法', '上图灰/蓝为入口/评价人数；下方按班小图按低档净增排序，点一个班展开同款迁移；下表给出每个等级的人数、Δ 和评价占比。'],
        ['提示', '若中段（G4–G6）净增、前段净减，说明入口中段学生相对位置下滑；需要和 04 入口段表交叉核对。'],
        ['动作', '去 03 看班级分布，去 04 看入口段和方向的局部差异。']
      ],
      foot: `<span>图 1 / 表 1 · 等级分布迁移</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-entry">B1 入口位置</button></span>`
    });
    const classBlock = rblock({
      id: 'sec-class', no: '03', layer: '证据', en: 'CLASS',
      title: '班级格局', question: '哪些班在“实力 × 增值”上偏离？',
      lead: `<b>${esc(topClass.name)}</b> 是本轮最需要先看的班：${topClass.n} 人中 ${topClass.decline} 人退步，比同类班高 ${topClass.excess.toFixed(1)} 个百分点。`,
      visual: classQuadFig + classQuadTable,
      reading: [
        ['读法', '气泡大小是班级人数；虚线是年级均值与 1.0 平衡点；图上直接标出全部班级名称，极密集处就近避让；下表可逐个核对。'],
        ['提示', `只纳入人数 ≥ ${r.smallSample} 的班；小样本班只展示指标、不参与排名，避免把波动当趋势。`],
        ['动作', `先看 ${esc(topClass.name)} 与 ${esc(broadClass.name)} 的学科结构，再到 07 用班×科矩阵定位具体失分点。`]
      ],
      foot: `<span>图 2 / 表 2 · 班级矩阵与班级表</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-class">B3 班级全表</button></span>`
    });
    const entryTable = miniTable([
      { key: 'label', label: '入口位置段', render: (b) => `<b>${bandPlain(b.key)}</b> <span class="weak">${b.label}</span>` },
      { key: 'n', label: '人数', align: 'num' },
      { key: 'decline', label: '退步人数', align: 'num' },
      { key: 'declineRate', label: '退步比例', align: 'num', render: (b) => pct1(b.declineRate) },
      { key: 'base', label: '同段基准', align: 'num', render: (b) => pct1(b.base) },
      { key: 'excess', label: '相差', align: 'num', render: (b) => `<b class="${b.excess >= 0 ? 'r-bad' : 'r-good'}">${diffPhrase(b.excess)}</b>` }
    ], bandRows, { rowClass: (b) => b.key === focusBand.key ? 'report-row-active' : '' });
    const entryBlock = rblock({
      id: 'sec-entry', no: '04', layer: '证据', en: 'ENTRY',
      title: '入口段', question: '差距是不是集中在某一类入口学生？',
      lead: `<b>${bandPlain(focusBand.key)}</b> 学生 ${focusBand.n} 人中 ${focusBand.decline} 人退步（${pct1(focusBand.declineRate)}），比同段基准高 ${Math.abs(focusBand.excess).toFixed(1)} 个百分点。`,
      visual: figure('图 3', '入口位置 × 退步差',
        '<span><i class="sq" style="background:var(--chart-1)"></i>相对同段基准的百分点差</span>',
        excessBars(bandRows),
        '向右为退步比例高于同段基准，向左为低于；同段基准优先取其他三校入口相近学生。') + entryTable,
      reading: [
        ['读法', '柱长是“比同段基准高/低几个百分点”，不是退步率本身；下表给出人数、退步比例、基准和差值。'],
        ['提示', '入口前段学生退步，对学校更值得优先看；但人数少时先用绝对人数核对，避免被百分比放大。'],
        ['动作', '把本段名单与 08 关注名单对齐，优先谈入口靠前但退步的学生。']
      ],
      foot: `<span>图 3 / 表 3 · 入口位置与退步差</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-entry">B1 入口位置</button></span>`
    });
    const flowBlock = rblock({
      id: 'sec-flow', no: '05', layer: '证据', en: 'FLOW',
      title: '等级流向', question: '入口第几档的学生，评价时去了第几档？',
      lead: flows.length
        ? `前三条流向：<b>${flows.slice(0, 3).map((f) => `第${f.from}档 → 第${f.to}档 ${f.count} 人`).join('、')}</b>；其中下降 <b class="hl-bad">${flowDown} 人</b>、上升 <b class="hl-good">${flowUp} 人</b>。`
        : '本轮没有明显的跨档流动，绝大多数学生保持在原档位。',
      visual: flowMatrix(totals) + flowNote,
      reading: [
        ['读法', '行是入口档、列是评价档：对角线为保持，上三角为升档，下三角为降档；色块越深表示人数越多。'],
        ['提示', '主要流向若集中在下三角，说明入口中段学生相对位置下滑；需要与 04 入口段、03 班级格局交叉核对。'],
        ['动作', '到 06 问题扫描看入口段/方向/班级/学科，再到 07 热点矩阵定位具体班科。']
      ],
      foot: `<span>入口第几档 → 现在第几档 · 样本 ${totals.length} 人</span><span class="report-check">核对：B3 班级全表 / D2 名单</span>`
    });
    const scanBlock = rblock({
      id: 'sec-scan', no: '06', layer: '证据', en: 'SCAN',
      title: '问题扫描', question: '哪批学生、哪个方向、哪个班、哪一科？',
      lead: `四个切口：入口段、方向、班级、学科；最先看 <b>${esc(topClass.name)}</b> 与 <b>${esc(topSubject.subject)}</b>。`,
      visual: scan,
      reading: [
        ['读法', '四行对应四个问题，状态标签是相对同级的判断，不是问责结论；明细可回到 10 数据全貌核对。'],
        ['提示', `${esc(topSubject.subject)} 在需重点关注学生中 ${topSubject.count} 人单科掉2档以上；人数不足 10 人时先按班级核对，不急着下学科结论。`],
        ['动作', '到 07 看班×科集中点，到 09 拿关注名单和标签分布。']
      ],
      foot: `<span>扫描表 · 口径见 11</span><span class="report-check">核对：B1 / B2 / B3 / C1</span>`
    });
    const hotBlock = rblock({
      id: 'sec-hot', no: '07', layer: '证据', en: 'FOCUS',
      title: '最集中的班和科', question: '问题最集中在哪几个班、哪几科？',
      lead: `最集中的三格：<b>${topCells.map((t) => `${esc(t.className)}${esc(t.subject)} ${t.count} 人`).join('、') || '暂无明显集中点'}</b>。`,
      visual: `<div class="report-hot-top">${hotSlots}</div>${hotTable}`,
      reading: [
        ['读法', '行是班级、列是学科，数字是“需重点关注学生中，该班该科掉2档以上”的人数；只列前 8 个班。'],
        ['提示', '数字是人次，同一学生多科会计多次，不等于人数；行合计不能当班里的关注人数。'],
        ['动作', `先找 ${esc(topCell ? topCell.className : topClass.name)} 班主任与 ${esc(topCell ? topCell.subject : topSubject.subject)} 备课组，做一次错题归类。`]
      ],
      foot: `<span>热点矩阵 · 全量见 11-C/D</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="app-c3">C3 重点关注矩阵</button></span>`
    });
    const subjectBlock = rblock({
      id: 'sec-subject', no: '08', layer: '证据', en: 'SUBJECT',
      title: '学科结构', question: '哪些科拖累最大，哪些科相对稳？',
      lead: `全校相对最弱的是 <b>${esc(worstSub.subject)}</b>（增值表现 ${f2(worstSub.rate)}），相对最强的是 <b>${esc(bestSub.subject)}</b>（${f2(bestSub.rate)}）。`,
      visual: stack + `<div class="report-subhead mt-16">C1 学科全表 · 人数 / 退步 / 增值表现</div>${typeof c1 !== 'undefined' ? c1 : subjectMini}`,
      reading: [
        ['读法', '按学科列人数、退步人数、退步比例、单科掉档人数和增值表现；增值表现低于 1 表示退步拖累大于进步。'],
        ['提示', `单科掉档人数多，不等于该科教学一定最弱；要结合入口位置和任课班分布，再看 11-C 的班×科矩阵。`],
        ['动作', `先找 ${esc(worstSub.subject)} 备课组做失分类型归类，再用 ${esc(bestSub.subject)} 的做法做对照。`]
      ],
      foot: `<span>表 4 · 学科全表</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-subject">C1 学科全表</button></span>`
    });
    const riskTopRows = riskAllSorted.slice(0, 20);
    const riskBlock = rblock({
      id: 'sec-tags', no: '09', layer: '证据', en: 'STUDENTS',
      title: '关注名单', question: '具体要跟进哪些学生，先谈哪一类？',
      lead: `<b>${riskAll.length} 人</b>需要重点关注（占 ${pct(riskAll.length / totals.length)}）；正文列前 ${riskTopRows.length} 人，完整名单在 11-E。`,
      visual: `${riskLegend()}<div class="report-tag-grid">${tagCards}</div><div class="report-subhead mt-16">按掉档多少排序（前 ${riskTopRows.length} 人）</div>${UI.table({ columns: appRiskCols, rows: riskTopRows, empty: '暂无需要重点关注的学生' })}`,
      reading: [
        ['读法', '四张卡是四类标签，名单按“掉了几档”从重到轻；入口档 → 现在档可以直接看变化。'],
        ['提示', `${highRisk} 人属于“入口靠前但退步”，对学校最值得先谈；名单人数不等于问题数量，不要直接问责。`],
        ['动作', '按班拆给年级，两周后只复查重点标签人数；完整名单和 CSV 在 11-E。']
      ],
      foot: `<span>标签分布 + 前 20 人 · 全量见 11-E</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="app-d2">D2 完整名单</button></span>`
    });
    const actionBlock = rblock({
      id: 'sec-actions', no: '10', layer: '行动', en: 'ACTION',
      title: '先找谁、做什么', question: '教学、班级管理、两周后复查，各先做哪一件？',
      visual: actions,
      foot: `<span>行动建议 · 不作为问责依据</span><span class="report-check">核对：D2 名单 / B3 班级全表</span>`
    });
    const detail = detailLayer('11',
      detailBlock('A', '四校对比', '四校差距在学校还是学科？',
        `<div class="report-subhead" id="app-a1">A1 四校总表</div>${compareTable}<div class="report-subhead" id="app-a2">A2 四校 × 学科（增值表现 / 单科掉2档人数）</div>${a2}`,
        '四校总表和分科表不在正文展开，这里只保留这两张；排名差不等于教学差，需结合入口结构和样本。') +
      detailBlock('B', '物理 / 历史方向', '方向差异是否解释了一部分校际差距？',
        `<div class="report-subhead" id="app-b2">B2 物理 / 历史方向</div>${b2}`,
        '方向差异需结合选科结构；入口段、流向和班级分布已在 03–05 正文展开。') +
      detailBlock('C', '完整矩阵', '班 × 科的完整集中点在哪？',
        `<div class="report-subhead" id="app-c2">C2 全部学生：班级 × 学科掉档人数</div>${c2}${matrixNote}<div class="report-subhead" id="app-c3">C3 需重点关注学生：班级 × 学科掉档人数</div>${c3}${matrixNote}`,
        '正文只列前 8 个班；这里是完整矩阵。数字是人次，同一学生多科会计多次。') +
      detailBlock('D', '名单与标签', '具体是谁，标签如何重叠？',
        `<div class="report-subhead" id="app-d1">D1 班级 × 标签全表</div>${d1}<div class="report-subhead" id="app-d2">D2 学生完整名单</div>${d2}`,
        '正文只列前 20 人；这里是全量名单。四类标签有重叠，不能相加。') +
      detailBlock('E', '数据质量', '样本、剔除和版本是否可信？',
        `<div class="report-subhead" id="app-e">E 数据质量与口径</div>${e}`,
        '先核对样本、剔除、部分缺考和版本，再做校际比较，避免把样本差异当成教学差异。') +
      detailBlock('F', '全量宽表', '一个班一行，能否同时看到总分与各科？',
        `<div class="report-subhead" id="app-wide">F 班级宽表 · 总分 + 各科增值 / 退步 / 掉档</div>${wideClassTable(r, schoolId, classes, subjectsOf(r), classXRef)}`,
        '一行一个班；每个学科格上行为增值表现，下行为退步人数/掉2档人数。比分开看总分表和学科表更快定位。') +
        `<div class="report-check"><button class="btn btn-sm" data-action="exportReportCsv">导出数据 CSV</button></div>`,
      '只保留正文未展开的表：四校总表 / 四校×学科 / 方向 / 完整矩阵 / 全量名单 / 数据质量 / 班级宽表');
    const sections = summary + positionBlock + classBlock + entryBlock + flowBlock + scanBlock + hotBlock + subjectBlock + riskBlock + actionBlock + detail;
    setTimeout(function () { if (App.initReportToc) App.initReportToc(); }, 0);
    return shell(task, 'principal', `${g.schoolName}增值报告`, `读者：校长/学校管理员 · ${g.schoolName} · 四层：结论 / 证据 / 行动 / 明细`, scopeBar(`<span class="report-scope-label">学校</span>${schoolSelect(r, schoolId)}`), `<div class="report-doc-grid"><div class="report-doc-main">${sections}</div>${toc}</div>`);
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
      { key: 'level', label: '掉了几档', align: 'num', render: (x) => levelPill(x.level) },
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
        { key: 'rate', label: '增值表现', align: 'num', render: (x) => ratePill(x.rate) }
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
        { key: 'rate', label: '增值表现', align: 'num', render: (x) => ratePill(x.rate) }
      ], rows: allSubjectRows })}
      <div class="report-subhead mt-16" id="g-app-c2">C2 班级 × 学科（需重点关注）</div>${appMatrix}
      <div class="report-subhead mt-16" id="g-app-d1">D1 班级 × 标签</div>${appTagTable}
      <div class="report-subhead mt-16" id="g-app-d2">D2 需重点关注学生名单</div>${appRiskTable}
      <div class="report-subhead mt-16" id="g-app-e">E 数据质量</div>${qualityTable}
      <div class="report-note">核对方法：正文的班级/学科/学生可在 B3、C1、C2、D2 中按同一口径找到；“需重点关注”四类标签有重叠，不能相加。</div>
    </div>`;

    const shift = netShift(totals, r.gradeCount || 9);
    const shiftFig = figure('图 1', '入口 → 评价 等级分布迁移',
      '<span><i class="entry"></i>入口</span><span><i class="exit"></i>评价</span>',
      gradeShift(totals, { gradeCount: r.gradeCount }),
      `G1 最好、G9 最弱；按 G1–G9 统计人数：灰色为入口、蓝色为评价；右侧 Δ 为评价与入口人数之差。样本 ${totals.length} 人。`);
    const quadClasses = classes.filter((x) => x.n >= r.smallSample);
    const classXRef = mean(quadClasses.map((x) => x.strength));
    const classQuad = quadrant(quadClasses.map((x) => ({
      x: x.strength,
      y: x.rate,
      size: x.n,
      label: x.name,
      tone: x.id === topClass.id ? 'p2' : 'p1',
      title: `${x.name}：学业实力 ${f1(x.strength)}，相对进步率 ${f2(x.rate)}，${x.n} 人`
    })), {
      xRef: classXRef,
      yRef: 1,
      labelAll: true,
      xLabel: '班级学业实力（入口位置）',
      yLabel: '班级相对进步率（1.0 为平衡点）',
      aria: '班级学业实力与相对进步率四象限'
    });
    const classQuadFig = figure('图 2', '班级实力 × 增值矩阵',
      '<span><i class="sq" style="background:var(--chart-1)"></i>班级</span><span><i class="sq" style="background:var(--chart-2)"></i>当前焦点班</span>',
      classQuad,
      `只纳入人数 ≥ ${r.smallSample} 的班级；气泡大小 = 班级人数。全部班级名称直接标注在点旁；极密集处就近避让，不画引线。`);
    const shiftTable = chartTable('1', [
      { key: 'grade', label: '等级', render: (x) => `G${x.grade}` },
      { key: 'entry', label: '入口人数', align: 'num' },
      { key: 'exit', label: '评价人数', align: 'num' },
      { key: 'delta', label: 'Δ 人数', align: 'num', render: (x) => `${x.delta > 0 ? '+' : ''}${x.delta}` },
      { key: 'rate', label: '评价占比', align: 'num', render: (x) => totals.length ? pct(x.exit / totals.length) : '—' }
    ], shift.rows, `样本 ${totals.length} 人 · Δ = 评价人数 − 入口人数`);
    const classQuadTable = chartTable('2', [
      { key: 'name', label: '班级', render: (x) => `<b>${esc(x.name)}</b>` },
      { key: 'strength', label: '学业实力', align: 'num', render: (x) => f1(x.strength) },
      { key: 'rate', label: '相对进步率', align: 'num', render: (x) => ratePill(x.rate) },
      { key: 'n', label: '人数', align: 'num' },
      { key: 'ranks', label: '实力/增值排名', render: (x) => `${x.strengthRank} / ${x.rateRank}` },
      { key: 'quad', label: '象限', render: (x) => quadBadge(quadName(x.strength, x.rate, classXRef, 1)) }
    ], quadClasses.slice().sort((a, b) => a.strengthRank - b.strengthRank), `共 ${quadClasses.length} 个班 · 象限按年级均值与 1.0 判定`, {
      rowClass: (x) => x.id === topClass.id ? 'report-row-active' : ''
    });
    const highCount = riskAll.filter((x) => x.tags.indexOf('高入口退步') >= 0).length;
    const flows = topFlows(totals);
    const flowDown = flows.filter((f) => f.to > f.from).reduce((s, f) => s + f.count, 0);
    const flowUp = flows.filter((f) => f.to < f.from).reduce((s, f) => s + f.count, 0);
    const flowNote = flows.length
      ? `<div class="report-inline-note">主要流向（不含保持）：${flows.map((f) => `入口第${f.from}档→现在第${f.to}档 ${f.count} 人`).join('、')}；前三条中下降 ${flowDown} 人、上升 ${flowUp} 人。</div>`
      : '';
    const stack = stackedBars(allSubjectRows)
      + `<div class="r-legend"><span class="r-stack-p">进步</span><span class="r-stack-k">保持</span><span class="r-stack-d">退步</span><span class="tiny weak">条内为人数占比，右侧为增值表现</span></div>`;

    const bandMini = miniTable([
      { key: 'label', label: '入口位置段', render: (b) => `<b>${bandPlain(b.key)}</b> <span class="weak">${b.label}</span>` },
      { key: 'n', label: '人数', align: 'num' },
      { key: 'decline', label: '退步人数', align: 'num' },
      { key: 'declineRate', label: '退步比例', align: 'num', render: (b) => pct1(b.declineRate) },
      { key: 'base', label: '同段基准', align: 'num', render: (b) => pct1(b.base) },
      { key: 'excess', label: '相差', align: 'num', render: (b) => `<b class="${b.excess >= 0 ? 'r-bad' : 'r-good'}">${diffPhrase(b.excess)}</b>` }
    ], bandRows, { rowClass: (b) => b.key === focusBand.key ? 'report-row-active' : '' });
    const subjectMini = miniTable([
      { key: 'subject', label: '学科' }, { key: 'n', label: '人数', align: 'num' },
      { key: 'declineCount', label: '退步人数', align: 'num' },
      { key: 'declineRatio', label: '退步比例', align: 'num', render: (x) => pct1(x.declineRatio || 0) },
      { key: 'allCount', label: '单科掉2档（全部）', align: 'num' },
      { key: 'count', label: '其中需重点关注', align: 'num' },
      { key: 'rate', label: '增值表现', align: 'num', render: (x) => ratePill(x.rate) }
    ], allSubjectRows);
    const riskTopRows = riskAll.slice().sort((a, b) => (a.level - b.level) || (a.entryGrade - b.entryGrade)).slice(0, 20);
    const riskTopTable = miniTable(riskCols, riskTopRows, { rowClass: (x) => x.level <= -2 ? 'report-row-warn' : '' });
    const schoolCompare = miniTable([
      { key: 'schoolName', label: '学校', render: (x) => `<b>${esc(x.schoolName)}</b>` },
      { key: 'n', label: '参评人数', align: 'num' },
      { key: 'strength', label: '学业实力', align: 'num', render: (x) => f1(x.strength) },
      { key: 'rate', label: '增值表现', align: 'num', render: (x) => ratePill(x.rate) },
      { key: 'declineRatio', label: '退步比例', align: 'num', render: (x) => pct1(x.declineRatio) },
      { key: 'rank', label: '排名（实力/增值）', render: (x) => `${x.strengthRank} / ${x.rateRank}` }
    ], (r.schoolEval['总分'] || []).slice().sort((a, b) => a.strengthRank - b.strengthRank), {
      rowClass: (x) => x.schoolId === schoolId ? 'report-row-active' : ''
    });
    const toc = `<aside class="report-toc" id="report-toc">
      <div class="report-toc-title">报告目录</div>
      <button class="report-toc-link active" data-action="scrollReport" data-target="sec-summary">01 结论摘要</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-position">02 年级结构</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-class">03 班级格局</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-entry">04 入口段</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-flow">05 等级流向</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-scan">06 问题扫描</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-hot">07 最集中的班和科</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-subject">08 学科结构</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-tags">09 关注名单</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-actions">10 先找谁、做什么</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-appendix">11 补充明细与数据质量</button>
      <button class="btn btn-primary btn-sm report-toc-export" data-action="printReport">导出 PDF</button>
      <div class="report-toc-note">A4 纵向 · 导出后可打印</div>
    </aside>`;
    const positiveSub = rankedSubjects(r, schoolId)[0];
    const summary = conclusionLayer(verdict, [
      { label: '发现', text: `${esc(g.schoolName)} 年级总分退步 ${pct1(c.declineRatio)}（${c.decline} 人）；班级退步比例差距 ${declineSpread.toFixed(1)} 个百分点。` },
      { label: '风险', text: `<b>${esc(topClass.name)}</b> ${topClass.n} 人中 ${topClass.decline} 人退步（${pct1(topClass.actual)}），比同类班高 ${topClass.excess.toFixed(1)} 个百分点；${esc(topCellText)} 最集中。` },
      { label: '亮点', text: `进步 <b class="hl-good">${c.progress} 人</b>、保持 ${c.keep} 人；${positiveSub ? `<b>${esc(positiveSub.subject)}</b> 增值 ${f2(positiveSub.rate)}，相对最强` : '学科样本不足'}。` },
      { label: '建议', text: `先找 ${esc(topClass.name)} 班主任和 ${esc(topSubject.subject)} 备课组；${riskAll.length} 人关注名单按班拆分，两周后只复查重点标签人数。` }
    ], [
      { no: '02', label: '年级结构', target: 'sec-position' },
      { no: '03', label: '班级格局', target: 'sec-class' },
      { no: '04', label: '入口段', target: 'sec-entry' }
    ]);
    const positionBlock = rblock({
      id: 'sec-position', no: '02', layer: '证据', en: 'POSITION',
      title: '年级结构', question: '入口到评价，年级的等级结构发生了什么变化？',
      lead: `入口到评价：<b>G${shift.inc.grade} 净增 ${shift.inc.delta} 人</b>、<b>G${shift.dec.grade} 净减 ${Math.abs(shift.dec.delta)} 人</b>；先确认这是整体位移还是局部掉档。`,
      visual: shiftFig + classShiftGrid(r, schoolId, classes, r.gradeCount) + shiftTable,
      reading: [
        ['读法', '上图灰/蓝为入口/评价人数；下方按班小图按低档净增排序，点一个班展开同款迁移；下表给出每个等级的人数、Δ 和评价占比。'],
        ['提示', '若中段（G4–G6）净增、前段净减，说明入口中段学生相对位置下滑；需要和 04 入口段表交叉核对。'],
        ['动作', '去 03 看班级分布，去 04 看入口段和方向的局部差异。']
      ],
      foot: `<span>图 1 / 表 1 · 等级分布迁移</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-class">B3 班级全表</button></span>`
    });
    const classBlock = rblock({
      id: 'sec-class', no: '03', layer: '证据', en: 'CLASS',
      title: '班级格局', question: '哪些班在“实力 × 增值”上偏离？',
      lead: `<b>${esc(topClass.name)}</b> 是本轮最需要先看的班：${topClass.n} 人中 ${topClass.decline} 人退步，比同类班高 ${topClass.excess.toFixed(1)} 个百分点。`,
      visual: classQuadFig + classQuadTable,
      reading: [
        ['读法', '气泡大小是班级人数；虚线是年级均值与 1.0 平衡点；图上直接标出全部班级名称，极密集处就近避让；下表可逐个核对。'],
        ['提示', `只纳入人数 ≥ ${r.smallSample} 的班；小样本班只展示指标、不参与排名，避免把波动当趋势。`],
        ['动作', `先看 ${esc(topClass.name)} 与 ${esc(worstClass.name)} 的学科结构，再到 07 用班×科矩阵定位失分点。`]
      ],
      foot: `<span>图 2 / 表 2 · 班级矩阵与班级表</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-class">B3 班级全表</button></span>`
    });
    const entryBlock = rblock({
      id: 'sec-entry', no: '04', layer: '证据', en: 'ENTRY',
      title: '入口段', question: '差距是不是集中在某一类入口学生？',
      lead: `<b>${bandPlain(focusBand.key)}</b> 学生 ${focusBand.n} 人中 ${focusBand.decline} 人退步（${pct1(focusBand.declineRate)}），比同段基准高 ${Math.abs(focusBand.excess).toFixed(1)} 个百分点。`,
      visual: figure('图 3', '入口位置 × 退步差',
        '<span><i class="sq" style="background:var(--chart-1)"></i>相对同段基准的百分点差</span>',
        excessBars(bandRows),
        '向右为退步比例高于同段基准，向左为低于；同段基准优先取其他三校入口相近学生。') + bandMini,
      reading: [
        ['读法', '柱长是“比同段基准高/低几个百分点”，不是退步率本身；下表给出人数、退步比例、基准和差值。'],
        ['提示', '入口前段学生退步，对年级更值得优先看；但人数少时先用绝对人数核对，避免被百分比放大。'],
        ['动作', '把本段名单与 08 关注名单对齐，优先谈入口靠前但退步的学生。']
      ],
      foot: `<span>图 3 / 表 3 · 入口位置与退步差</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-class">B3 班级全表</button></span>`
    });
    const flowBlock = rblock({
      id: 'sec-flow', no: '05', layer: '证据', en: 'FLOW',
      title: '等级流向', question: '入口第几档的学生，评价时去了第几档？',
      lead: flows.length
        ? `前三条流向：<b>${flows.slice(0, 3).map((f) => `第${f.from}档 → 第${f.to}档 ${f.count} 人`).join('、')}</b>；其中下降 <b class="hl-bad">${flowDown} 人</b>、上升 <b class="hl-good">${flowUp} 人</b>。`
        : '本轮没有明显的跨档流动，绝大多数学生保持在原档位。',
      visual: flowMatrix(totals) + flowNote,
      reading: [
        ['读法', '行是入口档、列是评价档：对角线为保持，上三角为升档，下三角为降档；色块越深表示人数越多。'],
        ['提示', '主要流向若集中在下三角，说明入口中段学生相对位置下滑；需要与 04 入口段、03 班级格局交叉核对。'],
        ['动作', '到 06 问题扫描看入口段/方向/班级/学科，再到 07 热点矩阵定位具体班科。']
      ],
      foot: `<span>入口第几档 → 现在第几档 · 样本 ${totals.length} 人</span><span class="report-check">核对：B3 班级全表 / D2 名单</span>`
    });
    const scanBlock = rblock({
      id: 'sec-scan', no: '06', layer: '证据', en: 'SCAN',
      title: '问题扫描', question: '入口段、方向、班级、学科，先看哪一处？',
      lead: `四个切口：入口段、方向、班级、学科；最先看 <b>${esc(topClass.name)}</b> 与 <b>${esc(topSubject.subject)}</b>。`,
      visual: scan,
      reading: [
        ['读法', '四行对应四个问题，状态标签是相对同级的判断，不是问责结论；明细可回到 10 数据全貌核对。'],
        ['提示', `${esc(topSubject.subject)} 在需重点关注学生中 ${topSubject.count} 人单科掉2档以上；人数不足 10 人时先按班级核对。`],
        ['动作', '到 07 看班×科集中点，到 09 拿关注名单和标签分布。']
      ],
      foot: `<span>扫描表 · 口径见 11</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-subject">C1 学科全表</button></span>`
    });
    const hotBlock = rblock({
      id: 'sec-hot', no: '07', layer: '证据', en: 'FOCUS',
      title: '最集中的班和科', question: '问题最集中在哪几个班、哪几科？',
      lead: `最集中的三格：<b>${topCells.map((t) => `${esc(t.className)}${esc(t.subject)} ${t.count} 人`).join('、') || '暂无明显集中点'}</b>。`,
      visual: `<div class="report-hot-top">${hotSlots}</div>${hotTable}`,
      reading: [
        ['读法', '行是班级、列是学科，数字是“需重点关注学生中，该班该科掉2档以上”的人数；只列前 8 个班。'],
        ['提示', '数字是人次，同一学生多科会计多次，不等于人数；行合计不能当班里的关注人数。'],
        ['动作', `先找 ${esc(topCell ? topCell.className : topClass.name)} 班主任与 ${esc(topCell ? topCell.subject : topSubject.subject)} 备课组，做一次错题归类。`]
      ],
      foot: `<span>热点矩阵 · 全量见 11-C</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="g-app-c2">C2 班级×学科</button></span>`
    });
    const subjectBlock = rblock({
      id: 'sec-subject', no: '08', layer: '证据', en: 'SUBJECT',
      title: '学科结构', question: '哪些科拖累最大，哪些科相对稳？',
      lead: `年级相对最弱的是 <b>${esc(worstSub.subject)}</b>（增值表现 ${f2(worstSub.rate)}），相对最强的是 <b>${esc(bestSub.subject)}</b>（${f2(bestSub.rate)}）。`,
      visual: `<div class="report-subhead">C1 学科全表 · 人数 / 退步 / 增值表现</div>${subjectMini}`,
      reading: [
        ['读法', '按学科列人数、退步人数、退步比例、单科掉档人数和增值表现；增值表现低于 1 表示退步拖累大于进步。'],
        ['提示', '单科掉档人数多，不等于该科教学一定最弱；要结合入口位置和任课班分布，再看 11-C 的班×科矩阵。'],
        ['动作', `先找 ${esc(worstSub.subject)} 备课组做失分类型归类，再用 ${esc(bestSub.subject)} 的做法做对照。`]
      ],
      foot: `<span>表 4 · 学科全表</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-subject">C1 学科全表</button></span>`
    });
    const riskBlock = rblock({
      id: 'sec-tags', no: '09', layer: '证据', en: 'STUDENTS',
      title: '关注名单', question: '具体要跟进哪些学生，先谈哪一类？',
      lead: `<b>${riskAll.length} 人</b>需要重点关注（占 ${pct(riskAll.length / totals.length)}）；正文列前 ${riskTopRows.length} 人，完整名单在 10-D。`,
      visual: `${riskLegend()}<div class="report-tag-grid">${tagCards}</div><div class="report-subhead mt-16">按掉档多少排序（前 ${riskTopRows.length} 人）</div>${riskTopTable}`,
      reading: [
        ['读法', '四张卡是四类标签，名单按“掉了几档”从重到轻；入口档 → 现在档可以直接看变化。'],
        ['提示', `${highCount} 人属于“入口靠前但退步”，对年级最值得先谈；名单人数不等于问题数量，不要直接问责。`],
        ['动作', '按班拆给班主任，两周后只复查重点标签人数；完整名单和 CSV 在 10-D。']
      ],
      foot: `<span>标签分布 + 前 20 人 · 全量见 11-D</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="g-app-d2">D2 名单</button></span>`
    });
    const actionBlock = rblock({
      id: 'sec-actions', no: '10', layer: '行动', en: 'ACTION',
      title: '先找谁、做什么', question: '教学、班级管理、两周后复查，各先做哪一件？',
      visual: actions,
      foot: `<span>行动建议 · 不作为问责依据</span><span class="report-check">核对：D2 名单 / B3 班级全表</span>`
    });
    const detail = detailLayer('11',
      detailBlock('A', '四校对比', '年级在四校中的位置如何？',
        `<div class="report-subhead" id="g-app-a1">A1 四校总表</div>${schoolCompare}`,
        '四校总表不在正文展开；入口段、流向、班级与学科已在 03–08 正文展开。') +
      detailBlock('B', '完整矩阵', '班 × 科的完整集中点在哪？',
        `<div class="report-subhead" id="g-app-c2">C2 班级 × 学科（需重点关注）</div>${appMatrix}`,
        '正文只列前 8 个班；这里是完整矩阵。数字是人次，同一学生多科会计多次。') +
      detailBlock('C', '标签与名单', '具体是谁，标签如何重叠？',
        `<div class="report-subhead" id="g-app-d1">D1 班级 × 标签</div>${appTagTable}<div class="report-subhead" id="g-app-d2">D2 需重点关注学生名单</div>${appRiskTable}`,
        '正文只列前 20 人；这里是全量名单。四类标签有重叠，不能相加。') +
      detailBlock('D', '数据质量', '样本、剔除和版本是否可信？',
        `<div class="report-subhead" id="g-app-e">E 数据质量</div>${qualityTable}`,
        '先核对样本、剔除、小样本班和版本，再做班级/学科比较。') +
      detailBlock('E', '全量宽表', '一个班一行，能否同时看到总分与各科？',
        `<div class="report-subhead" id="g-app-wide">E 班级宽表 · 总分 + 各科增值 / 退步 / 掉档</div>${wideClassTable(r, schoolId, classes, subjectsOf(r), classXRef)}`,
        '一行一个班；每个学科格上行为增值表现，下行为退步人数/掉2档人数。') +
        `<div class="report-check"><button class="btn btn-sm" data-action="exportReportCsv">导出数据 CSV</button></div>`,
      '只保留正文未展开的表：四校总表 / 完整矩阵 / 全量名单 / 数据质量 / 班级宽表');
    const sections = summary + positionBlock + classBlock + entryBlock + flowBlock + scanBlock + hotBlock + subjectBlock + riskBlock + actionBlock + detail;
    setTimeout(function () { if (App.initReportToc) App.initReportToc(); }, 0);
    return shell(task, 'grade', `${g.schoolName}年级增值报告`, `读者：年级主任/教务处 · ${g.schoolName} · 四层：结论 / 证据 / 行动 / 明细`, scopeBar(`<span class="report-scope-label">学校</span>${schoolSelect(r, schoolId)}`), `<div class="report-doc-grid"><div class="report-doc-main">${sections}</div>${toc}</div>`);
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
      { key: 'level', label: '掉了几档', align: 'num', render: (x) => levelPill(x.level) },
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
      { key: 'level', label: '掉了几档', align: 'num', render: (x) => levelPill(x.level || 0) },
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
        { key: 'rate', label: '增值表现', align: 'num', render: (x) => ratePill(x.rate) }
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
        { key: 'rate', label: '增值表现', align: 'num', render: (x) => ratePill(x.rate) }
      ], rows: subjectRows })}
      <div class="report-subhead mt-16" id="h-app-d2">D2 需重点关注学生</div>${UI.table({ columns: studentCols, rows: riskAll.slice().sort((a, b) => (a.level - b.level) || (a.entryGrade - b.entryGrade)), empty: '暂无需要重点关注的学生' })}
      <div class="report-note">核对：正文的学科可在 C1 找到，学生可在 B3/D2 找到；标签有重叠，不能相加。</div>
    </div>`;
    const shift = netShift(students, r.gradeCount || 9);
    const shiftFig = figure('图 1', '入口 → 评价 等级分布迁移',
      '<span><i class="entry"></i>入口</span><span><i class="exit"></i>评价</span>',
      gradeShift(students, { gradeCount: r.gradeCount }),
      `按 G1–G9 统计本班人数：灰色为入口、蓝色为评价；右侧 Δ 为评价与入口人数之差。样本 ${students.length} 人。`);
    const shiftTable = chartTable('1', [
      { key: 'grade', label: '等级', render: (x) => `G${x.grade}` },
      { key: 'entry', label: '入口人数', align: 'num' },
      { key: 'exit', label: '评价人数', align: 'num' },
      { key: 'delta', label: 'Δ 人数', align: 'num', render: (x) => `${x.delta > 0 ? '+' : ''}${x.delta}` },
      { key: 'rate', label: '评价占比', align: 'num', render: (x) => students.length ? pct(x.exit / students.length) : '—' }
    ], shift.rows, `样本 ${students.length} 人 · Δ = 评价人数 − 入口人数`);
    const subjectMini = miniTable([
      { key: 'subject', label: '学科' }, { key: 'n', label: '人数', align: 'num' },
      { key: 'declineCount', label: '退步人数', align: 'num' },
      { key: 'declineRatio', label: '退步比例', align: 'num', render: (x) => pct1(x.declineRatio || 0) },
      { key: 'allCount', label: '单科掉2档（全部）', align: 'num' },
      { key: 'count', label: '其中需重点关注', align: 'num' },
      { key: 'rate', label: '增值表现', align: 'num', render: (x) => ratePill(x.rate) }
    ], subjectRows);
    const riskMini = miniTable(studentCols, riskAll.slice().sort((a, b) => (a.level - b.level) || (a.entryGrade - b.entryGrade)));
    const toc = `<aside class="report-toc" id="report-toc">
      <div class="report-toc-title">报告目录</div>
      <button class="report-toc-link active" data-action="scrollReport" data-target="sec-summary">01 结论摘要</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-position">02 班级结构</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-scan">03 问题扫描</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-hot">04 最集中的学科和学生</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-subject">05 学科全表</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-tags">06 关注名单</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-actions">07 先找谁、做什么</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-appendix">08 补充明细与口径</button>
      <button class="btn btn-primary btn-sm report-toc-export" data-action="printReport">导出 PDF</button>
      <div class="report-toc-note">A4 纵向 · 导出后可打印</div>
    </aside>`;
    const positiveSubject = subjectRows.slice().sort((a, b) => b.rate - a.rate)[0];
    const summary = conclusionLayer(verdict, [
      { label: '发现', text: `${esc(g.name)} 总分退步 ${pct1(g.declineRatio)}（${g.declineCount} 人），比年级平均 ${diffPhrase((g.declineRatio - gradeRate) * 100)}；进步 ${c.progress} 人、保持 ${c.keep} 人。` },
      { label: '风险', text: `${esc(topSub.subject)} 是需重点关注最集中的学科（${topSub.count} 人）；入口靠前但退步 ${high} 人。` },
      { label: '亮点', text: `进步 <b class="hl-good">${c.progress} 人</b>、保持 ${c.keep} 人；${positiveSubject ? `<b>${esc(positiveSubject.subject)}</b> 增值 ${f2(positiveSubject.rate)}，本班相对最强` : '学科样本不足'}。` },
      { label: '建议', text: `先谈掉档最多的 ${topStudents.length} 名学生，再找 ${esc(topSub.subject)}、${esc(worstSub.subject)} 科任；两周后复查退步人数。` }
    ], [
      { no: '02', label: '班级结构', target: 'sec-position' },
      { no: '03', label: '问题在哪', target: 'sec-scan' },
      { no: '04', label: '最集中的学科和学生', target: 'sec-hot' }
    ]);
    const positionBlock = rblock({
      id: 'sec-position', no: '02', layer: '证据', en: 'POSITION',
      title: '班级结构', question: '入口到评价，本班等级结构怎么变？',
      lead: `入口到评价：<b>G${shift.inc.grade} 净增 ${shift.inc.delta} 人</b>、<b>G${shift.dec.grade} 净减 ${Math.abs(shift.dec.delta)} 人</b>；先判断是整体位移还是局部掉档。`,
      visual: shiftFig + shiftTable,
      reading: [
        ['读法', '上图灰/蓝为入口/评价人数，下表给出每个等级的人数、Δ 和评价占比；Δ 正数表示该等级人数增加。'],
        ['提示', '本班人数少，单科或单档波动可能是 1–2 人造成；先看人数再看比例，避免把波动当趋势。'],
        ['动作', '去 03 看学科和学生类型的局部差异，去 04 拿先谈名单。']
      ],
      foot: `<span>图 1 / 表 1 · 本班等级分布迁移</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="h-app-roster">B3 本班名单</button></span>`
    });
    const scanBlock = rblock({
      id: 'sec-scan', no: '03', layer: '证据', en: 'SCAN',
      title: '问题在哪', question: '班级整体、学科、学生类型、变化，先看哪一处？',
      lead: `${esc(overallText)}`,
      visual: scan,
      reading: [
        ['读法', '四行是四个切口：班级整体、学科、学生类型、变化；状态标签是相对年级平均的判断。'],
        ['提示', `本班 ${g.n} 人，退步 ${g.declineCount} 人；${esc(topSub.subject)} 是需重点关注最集中的学科（${topSub.count} 人）。`],
        ['动作', '到 04 看学科集中度和先谈名单，到 05 看全班标签分布。']
      ],
      foot: `<span>扫描表 · 口径见 08</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-subject">C1 学科全表</button></span>`
    });
    const hotBlock = rblock({
      id: 'sec-hot', no: '04', layer: '证据', en: 'FOCUS',
      title: '最集中的学科和学生', question: '先补哪科、先谈哪几名学生？',
      lead: `学科最集中在 <b>${topSubjects.map((x) => `${esc(x.subject)} ${x.count} 人`).join('、') || '暂无明显集中学科'}</b>；先谈 <b>${esc(topStudents[0] ? topStudents[0].studentName : '掉档最多的学生')}</b> 等 ${topStudents.length} 人。`,
      visual: `<div class="report-hot-top">${subjectSlots}</div><div class="report-subhead mt-16">先谈这几名学生</div>${topStudentTable}`,
      reading: [
        ['读法', '上方是学科集中度；下方名单按“掉档多少”排序，入口档 → 现在档直接看变化。'],
        ['提示', `名单不等于全部问题；入口靠前但退步的 ${high} 人优先，单科掉4档以上 ${deep} 人需要单独确认原因。`],
        ['动作', '每次谈话只定 1 个可执行目标；两周后回看同一批学生是否止跌。']
      ],
      foot: `<span>学科集中度 + 先谈名单</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-tags">D2 名单</button></span>`
    });
    const subjectBlock = rblock({
      id: 'sec-subject', no: '05', layer: '证据', en: 'SUBJECT',
      title: '学科全表', question: '本班哪几科拖累最大？',
      lead: `本班相对最弱的是 <b>${esc(worstSub.subject)}</b>（增值表现 ${f2(worstSub.rate)}），相对最强的是 <b>${esc(bestSub.subject)}</b>（${f2(bestSub.rate)}）。`,
      visual: `<div class="report-subhead">C1 学科全表 · 人数 / 退步 / 增值表现</div>${subjectMini}`,
      reading: [
        ['读法', '按学科列人数、退步人数、退步比例、单科掉档人数和增值表现；增值表现低于 1 表示退步拖累大于进步。'],
        ['提示', '本班人数少，单科 1–2 人的波动就会改变比例；先看绝对人数，再看比例。'],
        ['动作', `先找 ${esc(worstSub.subject)}、${esc(topSub.subject)} 科任核对失分类型，再定两周后的复查指标。`]
      ],
      foot: `<span>表 4 · 本班学科全表</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-subject">C1 学科全表</button></span>`
    });
    const riskBlock = rblock({
      id: 'sec-tags', no: '06', layer: '证据', en: 'STUDENTS',
      title: '关注名单', question: '具体要跟进哪些学生，先谈哪一类？',
      lead: `<b>${riskAll.length} 人</b>需要重点关注（占 ${pct(riskAll.length / g.n)}），其中入口靠前但退步 ${high} 人；完整名单见 06。`,
      visual: `${riskLegend()}<div class="report-tag-grid">${tagCards}</div><div class="report-subhead mt-16">按掉档多少排序</div>${riskMini}`,
      reading: [
        ['读法', '四张卡是四类标签，名单按“掉了几档”从重到轻；入口档 → 现在档可以直接看变化。'],
        ['提示', '标签有重叠，不能相加；全班人数少时，先看具体学生而不是比例。'],
        ['动作', '按“先谈—观察—常规”分三档跟进；两周后只复查重点标签人数。']
      ],
      foot: `<span>标签分布 + 全量名单 · 见 06</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-tags">D2 名单</button></span>`
    });
    const actionBlock = rblock({
      id: 'sec-actions', no: '07', layer: '行动', en: 'ACTION',
      title: '先找谁、做什么', question: '谈话、学科、两周后复查，各先做哪一件？',
      visual: actions,
      foot: `<span>行动建议 · 不作为问责依据</span><span class="report-check">核对：D2 名单 / C1 学科全表</span>`
    });
    const detail = detailLayer('08',
      detailBlock('A', '本班学生名单', '本班全量学生与判定？',
        `<div class="report-subhead" id="h-app-roster">B3 学生宽表 · 总分 + 各科</div>${wideStudentTable(r, schoolId, classId)}`,
        '一行一个学生：总分与六科同表，每科显示入口档 → 评价档和 Δz；用于核对，不用于公开排名。') +
      detailBlock('B', '数据口径', '本页数据边界是什么？',
        `<div class="report-note">只展示本班数据，不展示其他班学生；学科表和关注名单已在 05/06 正文展开；状态为相对年级平均的判断；等级按联考同首选组划分。</div>`,
        '先核对人数和样本，再看比例；缺考和学籍变动不在本页展开。'),
      '只保留正文未展开的学生名单与口径', '补充明细与口径');
    const sections = summary + positionBlock + scanBlock + hotBlock + subjectBlock + riskBlock + actionBlock + detail;
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
      return { id, name: rs[0].className, n: rs.length, rate: cg ? cg.rate : null, decline: cc.decline, progress: cc.progress, keep: cc.keep, bad: rs.filter((x) => x.level <= -2).length, high: rs.filter((x) => x.entryGrade <= 3 && x.level <= -1).length };
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
      { key: 'level', label: '掉了几档', align: 'num', render: (x) => levelPill(x.level) },
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
        { key: 'rate', label: '本科增值表现', align: 'num', render: (x) => ratePill(x.rate) },
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
        { key: 'rate', label: '本科增值表现', align: 'num', render: (x) => ratePill(x.rate) }
      ], rows: taught })}
      <div class="report-subhead mt-16" id="t-app-d2">D2 本科学生名单</div>${UI.table({ columns: studentCols, rows: badRows.slice().sort((a, b) => (a.level - b.level) || (a.entryGrade - b.entryGrade)), empty: '暂无本科掉档学生' })}
      <div class="report-note">核对：正文的班可在 B3 找到，学生可在 D2 找到；本科目数据不代表学生总分或其他学科。</div>
    </div>`;
    const rateBars = bars(taught.map((x) => ({
      label: x.name,
      value: x.rate == null ? 0 : x.rate,
      tone: (x.rate || 0) >= 1 ? 'good' : 'bad',
      sub: `${x.n} 人`,
      display: f2(x.rate),
      title: `${x.name}：本科增值 ${f2(x.rate)}，${x.n} 人`
    })), { ref: 1 });
    const rateFig = figure('图 1', '所教班本科增值表现',
      '<span><i class="sq" style="background:var(--chart-1)"></i>本科增值 · 1.0 平衡</span>',
      rateBars,
      '条长为本科相对进步率，1.0 为平衡点；只展示本人所教班，不代表学生总分或其他学科。');
    const rateTable = chartTable('1', [
      { key: 'name', label: '班级', render: (x) => `<b>${esc(x.name)}</b>` },
      { key: 'n', label: '本科人数', align: 'num' },
      { key: 'progress', label: '进步', align: 'num' },
      { key: 'keep', label: '保持', align: 'num' },
      { key: 'decline', label: '退步', align: 'num' },
      { key: 'bad', label: '掉2档以上', align: 'num' },
      { key: 'high', label: '入口靠前但退步', align: 'num' },
      { key: 'rate', label: '本科增值表现', align: 'num', render: (x) => ratePill(x.rate) }
    ], taught, '只含本人所教班 · 本科目内部统计');
    const riskMini = miniTable(studentCols, badRows.slice().sort((a, b) => (a.level - b.level) || (a.entryGrade - b.entryGrade)));

    /* ---------- 分班视图：单个所教班 ---------- */
    const viewClassId = App.state.reportTeacherClass || '';
    const viewClass = taught.find((c) => c.id === viewClassId);
    if (viewClass) {
      const cRows = rows.filter((x) => x.classId === viewClassId);
      const cc = counts(cRows);
      const cBad = cRows.filter((x) => x.level <= -2);
      const cHigh = cRows.filter((x) => x.entryGrade <= 3 && x.level <= -1);
      const cDeep = cRows.filter((x) => x.level <= -4);
      const cRate = viewClass.rate;
      const cKey = (cRate < 0.9 || cBad.length >= Math.max(8, cRows.length * 0.2)) ? 'problem'
        : (cRate < 1 || cBad.length >= 4) ? 'attention' : cRate >= 1.2 ? 'highlight' : 'normal';
      const cStatus = STATUS[cKey];
      const cBest = cRows.slice().sort((a, b) => (b.zDiff || 0) - (a.zDiff || 0))[0];
      const otherClass = taught.find((c) => c.id !== viewClassId) || taught[0];
      const cText = cKey === 'problem'
        ? `${viewClass.name}本科增值 ${f2(cRate)}，${cc.decline} 人退步、${cBad.length} 人掉 2 档以上；先谈入口靠前但退步的学生。`
        : cKey === 'highlight'
          ? `${viewClass.name}本科增值 ${f2(cRate)}，进步 ${cc.progress} 人、保持 ${cc.keep} 人；可总结本班做法。`
          : `${viewClass.name}本科增值 ${f2(cRate)}，接近平衡；${cBad.length} 人掉 2 档以上，需要跟进。`;
      const cVerdict = `<div class="report-verdict ${cStatus.tone}">
        <div class="verdict-top"><span class="verdict-badge">${statusBadge(cKey)}</span><span class="verdict-kicker">单班结论</span></div>
        <div class="verdict-text">${esc(cText)}</div>
        <div class="verdict-metrics">
          <div><b>${f2(cRate)}</b><span>本班本科增值表现 · 1.0 为平衡</span></div>
          <div><b>${cRows.length} 人</b><span>本科参评人数</span></div>
          <div><b>${pct1(cRows.length ? cc.decline / cRows.length : 0)}</b><span>本科退步比例 · ${cc.decline} 人</span></div>
        </div>
      </div>`;
      const cSummary = conclusionLayer(cVerdict, [
        { label: '发现', text: `本科 ${cRows.length} 人，增值 <b>${f2(cRate)}</b>；退步 ${cc.decline} 人（${pct1(cc.decline / cRows.length)}）。` },
        { label: '风险', text: `掉2档以上 <b class="hl-bad">${cBad.length} 人</b>；入口靠前但退步 <b class="hl-warn">${cHigh.length} 人</b>。` },
        { label: '亮点', text: `进步 <b class="hl-good">${cc.progress} 人</b>、保持 ${cc.keep} 人${cBest ? `；${esc(cBest.studentName)} 本科相对提升 ${sgn(cBest.zDiff)}` : ''}。` },
        { label: '建议', text: `先谈掉档最多的 ${Math.min(cBad.length, 8)} 人，再对比 ${esc(otherClass.name)} 的课堂与作业；两周后复查掉档人数。` }
      ], [
        { no: '02', label: '所教班对比', target: 'sec-position' },
        { no: '03', label: '本班问题扫描', target: 'sec-scan' },
        { no: '04', label: '关注名单', target: 'sec-tags' }
      ]);
      const cCompare = miniTable([
        { key: 'name', label: '班级', render: (x) => `<b>${esc(x.name)}</b>` },
        { key: 'n', label: '本科人数', align: 'num' },
        { key: 'progress', label: '进步', align: 'num' },
        { key: 'keep', label: '保持', align: 'num' },
        { key: 'decline', label: '退步', align: 'num' },
        { key: 'bad', label: '掉2档以上', align: 'num' },
        { key: 'high', label: '入口靠前但退步', align: 'num' },
        { key: 'rate', label: '本科增值表现', align: 'num', render: (x) => ratePill(x.rate) }
      ], taught, { rowClass: (x) => x.id === viewClassId ? 'report-row-active' : '' });
      const cScan = `<div class="report-scan">
        ${scanRow('01', '本班', esc(viewClass.name), `${cRows.length} 人中 ${cc.decline} 人本科退步（${pct1(cc.decline / cRows.length)}）`, `本科增值 ${f2(cRate)}`, `${cRows.length} 人`, cKey, `教师汇总 ${f2(g.rate)}`)}
        ${scanRow('02', '入口位置', '入口靠前但退步', `${cHigh.length} 人`, `占本科掉档 ${pct(cHigh.length / Math.max(1, cBad.length))}`, `${cBad.length} 人`, cHigh.length >= 5 ? 'attention' : 'normal', `入口前约23%学生优先看`)}
        ${scanRow('03', '学生类型', '单科掉4档以上', `${cDeep.length} 人`, `占本科掉档 ${pct(cDeep.length / Math.max(1, cBad.length))}`, `${cBad.length} 人`, cDeep.length >= 3 ? 'attention' : 'normal', `先谈掉档最多的学生`)}
        ${scanRow('04', '本科整体', '本科增值表现', f2(cRate), cRate >= 1 ? '高于平衡' : '低于平衡', `${cRows.length} 人`, cKey, `进步 ${cc.progress} / 保持 ${cc.keep} / 退步 ${cc.decline}`)}
      </div>`;
      const cTags = [
        { label: '本科掉2档以上', count: cBad.length, tone: 'red' },
        { label: '入口靠前但退步', count: cHigh.length, tone: 'amber' },
        { label: '本科掉4档以上', count: cDeep.length, tone: 'purple' },
        { label: '本科退步', count: cc.decline, tone: 'gray' }
      ].map((t) => `<div class="report-tag-card ${t.tone}"><span>${t.label}</span><b>${t.count}<small>人</small></b><em>占本科 ${pct(t.count / Math.max(1, cRows.length))}</em></div>`).join('');
      const cRisk = riskLegend() + `<div class="report-tag-grid">${cTags}</div><div class="report-subhead mt-16">本班按掉档多少排序</div>${miniTable(studentCols, cBad.slice().sort((a, b) => (a.level - b.level) || (a.entryGrade - b.entryGrade)))}`;
      const cActions = `<div class="report-recs">
        <div><b>先看班</b><span>本班 ${cRows.length} 人中 ${cc.decline} 人本科退步；对比 ${esc(otherClass.name)} 的课堂参与、作业完成和错题订正。</span></div>
        <div><b>再谈人</b><span>先谈掉档最多的 ${Math.min(cBad.length, 8)} 名学生，逐人确认失分类型：基础、审题、时间分配，还是缺课。</span></div>
        <div><b>两周后</b><span>复查本班掉2档以上人数是否少于 ${cBad.length} 人，本科退步人数是否下降。</span></div>
      </div>`;
      const cToc = `<aside class="report-toc" id="report-toc">
        <div class="report-toc-title">报告目录</div>
        <button class="report-toc-link active" data-action="scrollReport" data-target="sec-summary">01 结论摘要</button>
        <button class="report-toc-link" data-action="scrollReport" data-target="sec-position">02 所教班对比</button>
        <button class="report-toc-link" data-action="scrollReport" data-target="sec-scan">03 本班问题扫描</button>
        <button class="report-toc-link" data-action="scrollReport" data-target="sec-tags">04 关注名单</button>
        <button class="report-toc-link" data-action="scrollReport" data-target="sec-actions">05 先找谁、做什么</button>
        <button class="btn btn-primary btn-sm report-toc-export" data-action="printReport">导出 PDF</button>
        <div class="report-toc-note">A4 纵向 · 导出后可打印</div>
      </aside>`;
      const cPos = rblock({
        id: 'sec-position', no: '02', layer: '证据', en: 'CLASSES',
        title: '所教班对比', question: '本班在所教班中处于什么位置？',
        lead: `当前 <b>${esc(viewClass.name)}</b>：本科增值 ${f2(cRate)}，另一个班 ${esc(otherClass.name)} 为 ${f2(otherClass.rate)}。`,
        visual: rateFig + cCompare,
        reading: [
          ['读法', '条长与下表为各所教班本科增值；当前班在表中高亮。'],
          ['提示', '班额不同，先看人数再看比例；本科目数据不代表学生总分或其他学科。'],
          ['动作', `点顶部“${esc(otherClass.name)}”可切到另一个班；回到“教师汇总”看两班合并。`]
        ],
        foot: `<span>所教班对比 · 当前 ${esc(viewClass.name)}</span><span class="report-check">核对：所教班全表</span>`
      });
      const cScanBlock = rblock({
        id: 'sec-scan', no: '03', layer: '证据', en: 'SCAN',
        title: '本班问题扫描', question: '本班的入口、学生类型和整体表现，先看哪一处？',
        lead: esc(cText),
        visual: cScan,
        reading: [
          ['读法', '四行是本班切口：本班、入口位置、学生类型、本科整体；状态只在本班内判断。'],
          ['提示', `本班 ${cBad.length} 人掉2档以上，其中 ${cHigh.length} 人入口靠前；先谈这批学生。`],
          ['动作', '到 04 拿本班名单；两周后只复查本班掉档人数。']
        ],
        foot: `<span>单班扫描表 · 只含本班</span><span class="report-check">核对：04 关注名单</span>`
      });
      const cRiskBlock = rblock({
        id: 'sec-tags', no: '04', layer: '证据', en: 'STUDENTS',
        title: '关注名单', question: '本班具体要跟进哪些学生？',
        lead: `本班 <b>${cRows.length} 人</b>中，${cBad.length} 人掉2档以上（${pct(cBad.length / Math.max(1, cRows.length))}），${cHigh.length} 人入口靠前但退步。`,
        visual: cRisk,
        reading: [
          ['读法', '四张卡是本班标签；名单按掉档多少排序。'],
          ['提示', '标签有重叠，不能相加；单班人数少，先看具体学生，不急着看比例。'],
          ['动作', '按“先谈—观察—常规”分三档；两周后复查。']
        ],
        foot: `<span>本班标签 + 全量名单</span><span class="report-check">核对：本班名单</span>`
      });
      const cActionBlock = rblock({
        id: 'sec-actions', no: '08', layer: '行动', en: 'ACTION',
        title: '先找谁、做什么', question: '本班先做哪三件事？',
        visual: cActions + `<div class="report-inline-note">当前为单班视图，只展示 ${esc(viewClass.name)} 的本科目数据；切回“教师汇总”可看两班合并。</div>`,
        foot: `<span>行动建议 · 不作为问责依据</span><span class="report-check">核对：本班关注名单</span>`
      });
      const cSections = cSummary + cPos + cScanBlock + cRiskBlock + cActionBlock;
      setTimeout(function () { if (App.initReportToc) App.initReportToc(); }, 0);
      return shell(task, 'teacher', `${g.name} · ${subject}教学增值报告（${viewClass.name}）`, `读者：科任教师/教研组长 · ${g.schoolName} · 当前：${viewClass.name} · 仅本班本科目`, scopeBar(`<span class="report-scope-label">学校</span><span class="badge badge-gray">${esc(g.schoolName)}</span><span class="report-scope-label">科目</span>${subjectChips(r, schoolId, subject)}<span class="report-scope-label">教师</span>${teacherSelect(r, schoolId, subject, teacherId)}${teacherViewSwitch(taught, viewClassId)}`), `<div class="report-doc-grid"><div class="report-doc-main">${cSections}</div>${cToc}</div>`);
    }

    const toc = `<aside class="report-toc" id="report-toc">
      <div class="report-toc-title">报告目录</div>
      <button class="report-toc-link active" data-action="scrollReport" data-target="sec-summary">01 结论摘要</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-position">02 所教班格局</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-scan">03 问题在哪个班</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-hot">04 最集中的班和学生</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-classes">05 所教班全表</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-tags">06 关注名单</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-actions">07 先找谁、做什么</button>
      <button class="btn btn-primary btn-sm report-toc-export" data-action="printReport">导出 PDF</button>
      <div class="report-toc-note">A4 纵向 · 导出后可打印</div>
    </aside>`;
    const summary = conclusionLayer(verdict, [
      { label: '发现', text: `本科增值表现 ${f2(g.rate)}（1.0 为平衡）；${badRows.length} 人本科掉2档以上，占本科人数 ${pct(badRows.length / rows.length)}。` },
      { label: '风险', text: `<b>${drillClass(worstClass)}</b> 是所教班中相对最弱（${f2(worstClass.rate)}），${worstClass.decline} 人本科退步；入口靠前但退步 ${highRows.length} 人。` },
      { label: '亮点', text: `进步 <b class="hl-good">${counts(rows).progress} 人</b>、保持 ${counts(rows).keep} 人；<b>${drillClass(bestClass)}</b> 本科增值 ${f2(bestClass.rate)}，是所教班中相对最好。` },
      { label: '建议', text: `先看 ${drillClass(worstClass)} 与 ${drillClass(bestClass)} 的课堂/作业差异，再谈 ${topStudents.length} 名掉档学生；两周后复查掉档人数。` }
    ], [
      { no: '02', label: '所教班格局', target: 'sec-position' },
      { no: '03', label: '问题在哪个班', target: 'sec-scan' },
      { no: '04', label: '最集中的班和学生', target: 'sec-hot' }
    ]);
    const classCards = `<div class="class-compare">${taught.map((c) => `<div class="class-compare-card ${c.id === worstClass.id ? 'weak' : c.id === bestClass.id ? 'strong' : ''}">
      <div class="cc-head"><span>${esc(c.name)}</span><em>${c.n} 人</em></div>
      <b>${f2(c.rate)}</b><small>本科增值表现</small>
      <div class="cc-metrics"><span>进步 ${c.progress}</span><span>保持 ${c.keep}</span><span>退步 ${c.decline}</span></div>
      <div class="cc-metrics"><span>掉2档 ${c.bad}</span><span>入口靠前退步 ${c.high}</span></div>
    </div>`).join('')}</div>`;
    const positionBlock = rblock({
      id: 'sec-position', no: '02', layer: '证据', en: 'CLASSES',
      title: '所教班格局', question: '所教班里，哪几个班本科增值最弱？',
      lead: `<b>${esc(worstClass.name)}</b> 本科增值 ${f2(worstClass.rate)} 为所教班最低，<b>${esc(bestClass.name)}</b> ${f2(bestClass.rate)} 最高；先看最低班。`,
      visual: classCards + rateFig + rateTable,
      reading: [
        ['读法', '上方两张卡是分班对比；下面条长与下表为各所教班本科增值与进退步。'],
        ['提示', '班额不同，先看人数再看比例；本科目数据不代表学生总分，也不与其他学科直接比较。'],
        ['动作', '点顶部班级 chip 可切到单班视图；到 03 看班级/入口/学生类型，到 04 拿先谈名单。']
      ],
      foot: `<span>图 1 / 表 1 · 所教班本科增值</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-classes">B3 所教班</button></span>`
    });
    const scanBlock = rblock({
      id: 'sec-scan', no: '03', layer: '证据', en: 'SCAN',
      title: '问题在哪个班', question: '所教班、入口位置、学生类型、本科整体，先看哪一处？',
      lead: `${esc(overallText)}`,
      visual: scan,
      reading: [
        ['读法', '四行是四个切口：所教班、入口位置、学生类型、本科整体；状态标签是本科目内部的相对判断。'],
        ['提示', `${esc(worstClass.name)} ${worstClass.n} 人中 ${worstClass.decline} 人本科退步；入口靠前但退步 ${highRows.length} 人优先谈。`],
        ['动作', '到 04 看班级集中度和先谈名单，到 05 看本科目标签分布。']
      ],
      foot: `<span>扫描表 · 口径见行动块</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-classes">B3 所教班</button></span>`
    });
    const hotBlock = rblock({
      id: 'sec-hot', no: '04', layer: '证据', en: 'FOCUS',
      title: '最集中的班和学生', question: '先看哪个班、先谈哪几名学生？',
      lead: `掉档最集中在 <b>${topClasses.map((x) => `${esc(x.name)} ${x.bad} 人`).join('、') || '暂无明显集中班'}</b>；先谈 <b>${esc(topStudents[0] ? topStudents[0].studentName : '掉档最多的学生')}</b> 等 ${topStudents.length} 人。`,
      visual: `<div class="report-hot-top">${classSlots}</div><div class="report-subhead mt-16">先谈这几名学生</div>${UI.table({ columns: studentCols, rows: topStudents, empty: '暂无本科掉档学生' })}`,
      reading: [
        ['读法', '上方是班级集中度，下方名单按“掉档多少”排序；入口档 → 现在档直接看变化。'],
        ['提示', `名单不等于全部问题；入口靠前但退步 ${highRows.length} 人、单科掉4档以上 ${deepRows.length} 人需要单独确认原因。`],
        ['动作', '每次谈话只定 1 个可执行目标；两周后回看同一批学生是否止跌。']
      ],
      foot: `<span>班级集中度 + 先谈名单</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-tags">D2 名单</button></span>`
    });
    const classBlock = rblock({
      id: 'sec-classes', no: '05', layer: '证据', en: 'CLASSES',
      title: '所教班全表', question: '所教班的人数、进退步和增值表现？',
      lead: `共 ${taught.length} 个班、本科 ${rows.length} 人；相对最弱 <b>${esc(worstClass.name)}</b>（${f2(worstClass.rate)}），相对最强 <b>${esc(bestClass.name)}</b>（${f2(bestClass.rate)}）。`,
      visual: `<div class="report-subhead">B3 所教班全表</div>${rateTable}`,
      reading: [
        ['读法', '按班列本科人数、进步/保持/退步、掉2档以上和增值表现；增值低于 1 表示退步拖累大于进步。'],
        ['提示', '班额不同，先看人数再看比例；本科目数据不能外推到学生总分或其他学科。'],
        ['动作', `先看 ${esc(worstClass.name)} 与 ${esc(bestClass.name)} 的课堂/作业差异，再到 06 拿名单。`]
      ],
      foot: `<span>表 2 · 所教班全表</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-classes">B3 所教班</button></span>`
    });
    const riskBlock = rblock({
      id: 'sec-tags', no: '06', layer: '证据', en: 'STUDENTS',
      title: '关注名单', question: '本科目具体要跟进哪些学生？',
      lead: `本科 <b>${rows.length} 人</b>中，${badRows.length} 人掉2档以上（${pct(badRows.length / rows.length)}），${highRows.length} 人入口靠前但退步；名单见下。`,
      visual: `${riskLegend()}<div class="report-tag-grid">${tagCards}</div><div class="report-subhead mt-16">按掉档多少排序</div>${riskMini}`,
      reading: [
        ['读法', '四张卡是本科目内部标签，名单按“掉了几档”从重到轻；入口档 → 现在档直接看变化。'],
        ['提示', '标签有重叠，不能相加；本科目数据不能外推到学生总分或其他学科。'],
        ['动作', '按“先谈—观察—常规”分三档跟进；两周后只复查掉2档以上人数。']
      ],
      foot: `<span>标签分布 + 全量名单 · 见 06</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-tags">关注名单</button></span>`
    });
    const actionBlock = rblock({
      id: 'sec-actions', no: '07', layer: '行动', en: 'ACTION',
      title: '先找谁、做什么', question: '班级、学生、两周后复查，各先做哪一件？',
      visual: actions + `<div class="report-inline-note">只展示本人所教班与本科目；不展示其他教师、学生总分排名或其他学科；等级按联考同首选组划分。</div>`,
      foot: `<span>行动建议 · 不作为问责依据</span><span class="report-check">核对：06 关注名单 / 05 所教班全表</span>`
    });
    const sections = summary + positionBlock + scanBlock + hotBlock + classBlock + riskBlock + actionBlock;
    setTimeout(function () { if (App.initReportToc) App.initReportToc(); }, 0);
    return shell(task, 'teacher', `${g.name} · ${subject}教学增值报告`, `读者：科任教师/教研组长 · ${g.schoolName} · 仅本人所教班与本科目`, scopeBar(`<span class="report-scope-label">学校</span><span class="badge badge-gray">${esc(g.schoolName)}</span><span class="report-scope-label">科目</span>${subjectChips(r, schoolId, subject)}<span class="report-scope-label">教师</span>${teacherSelect(r, schoolId, subject, teacherId)}${teacherViewSwitch(taught, '')}`), `<div class="report-doc-grid"><div class="report-doc-main">${sections}</div>${toc}</div>`);
  }

  /* ---------- 06 学科组长 ---------- */
  function subjectLeaderPage(task, r) {
    const schoolId = defaultSchool(r);
    const subject = defaultSubject(r, schoolId);
    const schoolG = (r.schoolEval[subject] || []).find((x) => x.schoolId === schoolId);
    const allRows = r.rows.filter((x) => x.schoolId === schoolId && x.subject === subject);
    const nr = (v) => (v == null ? null : Math.abs(v) > 10 ? v / 100 : v);
    const teacherList = (r.teacherEval[subject] || []).filter((x) => x.schoolId === schoolId);
    const selectedTeacherId = App.state.reportSubjectTeacher || '';
    const selectedTeacher = teacherList.find((x) => x.id === selectedTeacherId);
    const rows = selectedTeacherId ? allRows.filter((x) => x.teacherId === selectedTeacherId) : allRows;
    const g = selectedTeacher ? { ...schoolG, rate: nr(selectedTeacher.rate), name: selectedTeacher.name } : schoolG;
    if (!g || !rows.length) return shell(task, 'subject', '学科增值报告', '当前学科没有结果', '', `<div class="card"><div class="card-body">${UI.empty('暂无结果')}</div></div>`);
    const viewLabel = selectedTeacher ? selectedTeacher.name : '全校';
    const c = counts(rows);
    const classRowsAll = (r.classEval[subject] || []).filter((x) => x.schoolId === schoolId).map((cg) => {
      const rs = allRows.filter((x) => x.classId === cg.id);
      const cc = counts(rs);
      return { id: cg.id, name: cg.name, n: rs.length, rate: nr(cg.rate), progress: cc.progress, keep: cc.keep, decline: cc.decline, bad: rs.filter((x) => x.level <= -2).length, high: rs.filter((x) => x.entryGrade <= 3 && x.level <= -1).length };
    }).sort((a, b) => (a.rate == null ? 9 : a.rate) - (b.rate == null ? 9 : b.rate));
    const classRows = selectedTeacherId
      ? classRowsAll.filter((cg) => rows.some((x) => x.classId === cg.id)).map((cg) => {
        const rs = rows.filter((x) => x.classId === cg.id);
        const cc = counts(rs);
        return { ...cg, n: rs.length, progress: cc.progress, keep: cc.keep, decline: cc.decline, bad: rs.filter((x) => x.level <= -2).length };
      })
      : classRowsAll;
    const bestClass = (classRows.filter((x) => x.n >= 8).slice(-1)[0]) || classRows[classRows.length - 1];
    const worstClass = (classRows.filter((x) => x.n >= 8)[0]) || classRows[0];
    const subjRows = orderedSubjectRows(r, schoolId).filter((x) => x.subject !== '总分');
    const byRate = subjRows.slice().sort((a, b) => b.rate - a.rate);
    const rank = byRate.findIndex((x) => x.subject === subject) + 1;
    const avgRate = mean(subjRows.map((x) => x.rate));
    const teacherRows = teacherList.map((t) => {
      const tr = allRows.filter((x) => x.teacherId === t.id);
      const tc = counts(tr);
      const classes = classRowsAll.filter((cg) => tr.some((x) => x.classId === cg.id)).map((cg) => {
        const cr = tr.filter((x) => x.classId === cg.id);
        const cc = counts(cr);
        return { ...cg, n: cr.length, progress: cc.progress, keep: cc.keep, decline: cc.decline, bad: cr.filter((x) => x.level <= -2).length };
      });
      return { id: t.id, name: t.name, n: tr.length || t.n, rate: nr(t.rate), progress: tc.progress, keep: tc.keep, decline: tc.decline, bad: tr.filter((x) => x.level <= -2).length, classes };
    }).sort((a, b) => (a.rate == null ? 9 : a.rate) - (b.rate == null ? 9 : b.rate));
    const riskRows = rows.filter((x) => x.level <= -2).sort((a, b) => (a.level - b.level) || (a.entryGrade - b.entryGrade));
    const overallKey = g.rate < 0.9 ? 'problem' : g.rate < 1 ? 'attention' : g.rate >= 1.2 ? 'highlight' : 'normal';
    const status = STATUS[overallKey];
    const verdict = `<div class="report-verdict ${status.tone}">
      <div class="verdict-top"><span class="verdict-badge">${statusBadge(overallKey)}</span><span class="verdict-kicker">${selectedTeacher ? '教师视角' : '学科结论'}</span></div>
      <div class="verdict-text">${esc(viewLabel)} ${esc(subject)}：${worstClass ? `${worstClass.name} 相对最弱` : '班级差异有限'}，${riskRows.length} 人本科掉 2 档以上；先看班级分布和教师差异。</div>
      <div class="verdict-metrics">
        <div><b>${f2(g.rate)}</b><span>${esc(viewLabel)}学科增值 · 1.0 为平衡</span></div>
        <div><b>第 ${rank} / ${subjRows.length}</b><span>校内学科增值排名</span></div>
        <div><b>${riskRows.length} 人</b><span>本科掉2档以上 · 占 ${pct(riskRows.length / rows.length)}</span></div>
      </div>
    </div>`;
    const summary = conclusionLayer(verdict, [
      { label: '发现', text: `${esc(viewLabel)} ${esc(subject)} 增值 <b>${f2(g.rate)}</b>，校内第 ${rank}/${subjRows.length}；${c.decline} 人本科退步（${pct1(c.decline / rows.length)}）。` },
      { label: '风险', text: `${worstClass ? `<b>${esc(worstClass.name)}</b> 相对最弱（${f2(worstClass.rate)}），${worstClass.bad} 人掉2档以上` : '班级样本不足'}；教师间差异见 04。` },
      { label: '亮点', text: `进步 <b class="hl-good">${c.progress} 人</b>、保持 ${c.keep} 人；${bestClass ? `<b>${esc(bestClass.name)}</b> 本科增值 ${f2(bestClass.rate)}，相对最好` : ''}。` },
      { label: '建议', text: `备课组先看 ${worstClass ? esc(worstClass.name) : '弱班'} 的课堂与作业；教研组用 05 的分层数据判断是入口中段还是后段掉档。` }
    ], [
      { no: '02', label: '全校位置', target: 'sec-position' },
      { no: '03', label: '班级分布', target: 'sec-class' },
      { no: '04', label: '教师差异', target: 'sec-teacher' }
    ]);
    const toc = `<aside class="report-toc" id="report-toc">
      <div class="report-toc-title">报告目录</div>
      <button class="report-toc-link active" data-action="scrollReport" data-target="sec-summary">01 结论摘要</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-position">02 全校位置</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-class">03 班级分布</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-teacher">04 教师差异</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-shift">05 等级迁移</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-risk">06 关注名单与行动</button>
      <button class="btn btn-primary btn-sm report-toc-export" data-action="printReport">导出 PDF</button>
      <div class="report-toc-note">A4 纵向 · 导出后可打印</div>
    </aside>`;
    const positionBlock = rblock({
      id: 'sec-position', no: '02', layer: '证据', en: 'POSITION',
      title: '全校学科位置', question: '这门学科在全校各科中处于什么位置？',
      lead: `本学科增值 <b>${f2(g.rate)}</b>，校内第 ${rank}/${subjRows.length}；${g.rate >= avgRate ? '高于' : '低于'}全校学科均值 ${f2(avgRate)}。`,
      visual: bars(byRate.map((x) => ({ label: x.subject, value: x.rate, active: x.subject === subject, sub: x.n + ' 人' })), { ref: 1 }) + miniTable([
        { key: 'subject', label: '学科', render: (x) => x.subject === subject ? `<b class="hl">${esc(x.subject)}</b>` : esc(x.subject) },
        { key: 'rate', label: '增值表现', align: 'num', render: (x) => ratePill(x.rate) },
        { key: 'diff', label: '距校均值', align: 'num', render: (x) => sgn(x.rate - avgRate) },
        { key: 'n', label: '本科人数', align: 'num' }
      ], byRate, '按增值表现排序 · 本学科高亮'),
      reading: [
        ['读法', '条形与表格为全校各科增值表现；本学科高亮，右侧为距全校学科均值的差。'],
        ['提示', '学科之间比较的是相对进步率，不是平均分；样本小的科目会标样本不足。'],
        ['动作', `先确认本学科在全校的位置，再到 03 看班级差异、04 看教师差异。`]
      ],
      foot: `<span>图 1 · 全校学科位置</span><span class="report-check">核对：01 结论 / 05 迁移</span>`
    });
    const classLead = worstClass
      ? `<b>${esc(worstClass.name)}</b> 本科增值 ${f2(worstClass.rate)} 最低` + (bestClass ? `，<b>${esc(bestClass.name)}</b> ${f2(bestClass.rate)} 最高` : '') + '；先看最低班。'
      : '本学科班级样本不足。';
    const classBlock = rblock({
      id: 'sec-class', no: '03', layer: '证据', en: 'CLASSES',
      title: selectedTeacher ? `${selectedTeacher.name} 所教班` : '班级分布',
      question: selectedTeacher ? '该教师所教班，本科表现差在哪？' : '同一门学科，哪些班明显偏弱？',
      lead: classLead,
      visual: bars(classRows.map((x) => ({ label: x.name, value: x.rate, sub: x.n + ' 人', active: worstClass && x.id === worstClass.id })), { ref: 1 }) + miniTable([
        { key: 'name', label: '班级', render: (x) => `<b>${esc(x.name)}</b>` },
        { key: 'n', label: '人数', align: 'num', render: (x) => x.n < 8 ? `${x.n} <span class="badge badge-amber">样本不足</span>` : x.n },
        { key: 'rate', label: '增值', align: 'num', render: (x) => ratePill(x.rate) },
        { key: 'progress', label: '进步', align: 'num' },
        { key: 'keep', label: '保持', align: 'num' },
        { key: 'decline', label: '退步', align: 'num' },
        { key: 'bad', label: '掉2档以上', align: 'num' }
      ], classRows, '只含本学科 · 按增值表现排序'),
      reading: [
        ['读法', '条形与表格为各教学班的学科增值；最弱班高亮，右侧是进退步人数。'],
        ['提示', '班额不同，先看人数再看比例；一个班弱不代表所有学生弱，需到 06 看名单。'],
        ['动作', `备课组先约 ${worstClass ? esc(worstClass.name) : '最弱班'} 听课，比较课堂参与和作业完成。`]
      ],
      foot: `<span>表 1 · 班级分布</span><span class="report-check">核对：06 关注名单</span>`
    });
    const teacherBlock = rblock({
      id: 'sec-teacher', no: '04', layer: '证据', en: 'TEACHERS',
      title: '教师差异', question: '同一学科不同教师，所教班差异在哪？',
      lead: teacherRows.length > 1 ? `本学科 ${teacherRows.length} 位教师；教师间增值差 ${f2((teacherRows[teacherRows.length - 1].rate || 0) - (teacherRows[0].rate || 0))}，需结合所教班入口看。` : '本学科只有一位教师，教师差异暂不展开。',
      visual: miniTable([
        { key: 'name', label: '教师', render: (x) => `<b>${esc(x.name)}</b>` },
        { key: 'classes', label: '所教班', render: (x) => x.classes.map((c) => esc(c.name)).join('、') },
        { key: 'n', label: '本科人数', align: 'num' },
        { key: 'rate', label: '增值表现', align: 'num', render: (x) => ratePill(x.rate) },
        { key: 'progress', label: '进步', align: 'num' },
        { key: 'keep', label: '保持', align: 'num' },
        { key: 'decline', label: '退步', align: 'num' },
        { key: 'bad', label: '掉2档以上', align: 'num' },
        { key: 'drill', label: '', render: (x) => `<button type="button" class="drill-link" data-action="setSubjectTeacher" data-value="${esc(x.id)}">看所教班</button>` }
      ], teacherRows, { rowClass: (x) => x.id === selectedTeacherId ? 'report-row-active' : '' }),
      reading: [
        ['读法', '一行一位教师；教师排名已按所教班入口做同层比较，不直接比原始均分。'],
        ['提示', '样本小于 8 人不参与排名；教师差异也可能是班级结构差异，需与 03 对照。'],
        ['动作', `让 ${teacherRows.length > 1 ? esc(teacherRows[teacherRows.length - 1].name) : '本学科教师'} 做一次同课异构，比较课堂与作业。`]
      ],
      foot: `<span>表 2 · 教师差异</span><span class="report-check">核对：03 班级分布</span>`
    });
    const shiftBlock = rblock({
      id: 'sec-shift', no: '05', layer: '证据', en: 'SHIFT',
      title: '等级迁移', question: '这门学科的入口到评价，等级结构怎么变？',
      lead: `本学科 ${rows.length} 人：入口到评价的净变化见下；低档变宽说明后段学生相对下滑。`,
      visual: gradeShift(rows, { gradeCount: r.gradeCount }),
      reading: [
        ['读法', '灰色为入口、蓝色为评价；右侧 Δ 为评价减入口人数。'],
        ['提示', '学科迁移与总分迁移不同；若本学科低档净增，而总分稳定，说明问题集中在这一科。'],
        ['动作', '回到 03 找低档净增最大的班，再到 06 拿名单。']
      ],
      foot: `<span>图 2 · 学科等级迁移</span><span class="report-check">核对：03 班级分布</span>`
    });
    const riskBlock = rblock({
      id: 'sec-risk', no: '06', layer: '行动', en: 'ACTION',
      title: '关注名单与行动', question: '具体先找哪些学生，备课组/教研组各做什么？',
      lead: `本科掉2档以上 <b class="hl-bad">${riskRows.length} 人</b>，其中入口靠前但退步 ${rows.filter((x) => x.entryGrade <= 3 && x.level <= -1).length} 人。`,
      visual: miniTable([
        { key: 'studentNo', label: '学号', render: (x) => `<span class="code">${esc(x.studentNo)}</span>` },
        { key: 'studentName', label: '姓名' },
        { key: 'className', label: '班级' },
        { key: 'grade', label: '入口→评价', render: (x) => `G${x.entryGrade}→G${x.currentGrade}` },
        { key: 'level', label: '掉档', align: 'num', render: (x) => levelPill(x.level) },
        { key: 'status', label: '判定', render: (x) => UI.badge(x.status, x.status === '进步' ? 'green' : x.status === '退步' ? 'red' : 'gray') }
      ], riskRows, '本科掉2档以上 · 按掉档多少排序') + `<div class="report-recs mt-16">
        <div><b>备课组</b><span>先听 ${worstClass ? esc(worstClass.name) : '最弱班'} 的课，统一本学科的基础题和审题训练。</span></div>
        <div><b>教研组</b><span>对比 03 班级与 04 教师差异，判断是班级结构还是教学差异；样本不足不做排名。</span></div>
        <div><b>两周后</b><span>复查本学科掉2档以上人数、低档净增是否收窄。</span></div>
      </div>`,
      reading: [
        ['读法', '名单只列本科掉2档以上学生；按掉档多少排序，不是问题数量。'],
        ['提示', '同一学生可能多科掉档，本表只反映本学科；不要与其他学科名单直接相加。'],
        ['动作', '按班拆分给备课组，两周后复查同一批学生。']
      ],
      foot: `<span>名单 + 行动 · 只含本学科</span><span class="report-check">核对：03 班级分布</span>`
    });
    const sections = summary + positionBlock + classBlock + teacherBlock + shiftBlock + riskBlock;
    setTimeout(function () { if (App.initReportToc) App.initReportToc(); }, 0);
    return shell(task, 'subject', `${selectedTeacher ? selectedTeacher.name + ' · ' : ''}${g.schoolName || ''}${subject}学科增值报告`, `读者：备课组长/教研组长 · ${g.schoolName || ''} · 当前：${viewLabel} · ${subject} · 不含其他学科`, scopeBar(`<span class="report-scope-label">学校</span><span class="badge badge-gray">${esc(g.schoolName)}</span><span class="report-scope-label">学科</span>${subjectChips(r, schoolId, subject)}${subjectTeacherSwitch(teacherRows, selectedTeacherId)}`), `<div class="report-doc-grid"><div class="report-doc-main">${sections}</div>${toc}</div>`);
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
        { key: 'level', label: '掉了几档', align: 'num', render: (x) => levelPill(x.level) }
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
    const subjectMini = chartTable('1', [
      { key: 'subject', label: '科目' },
      { key: 'entryGrade', label: '入口档', align: 'num', render: (x) => `G${x.entryGrade}` },
      { key: 'currentGrade', label: '评价档', align: 'num', render: (x) => `G${x.currentGrade}` },
      { key: 'zDiff', label: 'Δz', align: 'num', render: (x) => `<b class="${x.zDiff >= 0 ? 'r-good' : 'r-bad'}">${sgn(x.zDiff)}</b>` },
      { key: 'status', label: '判定', render: (x) => UI.badge(x.status, x.status === '进步' ? 'green' : x.status === '退步' ? 'red' : 'gray') },
      { key: 'level', label: '掉档', align: 'num', render: (x) => levelPill(x.level) }
    ], subs, '六科 · 只含本人');
    const toc = `<aside class="report-toc" id="report-toc">
      <div class="report-toc-title">报告目录</div>
      <button class="report-toc-link active" data-action="scrollReport" data-target="sec-summary">01 结论摘要</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-hot">02 六科变化</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-scan">03 哪科拖后腿</button>
      <button class="report-toc-link" data-action="scrollReport" data-target="sec-actions">04 我先做什么</button>
      <button class="btn btn-primary btn-sm report-toc-export" data-action="printReport">导出 PDF</button>
      <div class="report-toc-note">A4 纵向 · 导出后可打印</div>
    </aside>`;
    const summary = conclusionLayer(verdict, [
      { label: '发现', text: `总分第 ${total.entryGrade} 档 → 第 ${total.currentGrade} 档（${total.level > 0 ? '+' : ''}${total.level} 档）；同首选组排名 ${total.entryRank} → ${total.currentRank}。` },
      { label: '风险', text: `${esc(worstSub.subject)} 相对下滑最多（Δz ${sgn(worstSub.zDiff)}）；${declineSubs.length} 科退步、${keepSubs.length} 科保持。` },
      { label: '亮点', text: `进步 <b class="hl-good">${progressSubs.length} 科</b>${progressSubs.length ? `（${progressSubs.map((x) => esc(x.subject)).join('、')}）` : ''}；<b>${esc(bestSub.subject)}</b> Δz ${sgn(bestSub.zDiff)}，是当前优势科。` },
      { label: '建议', text: `先补 ${esc(worstSub.subject)} 的基础与审题，同时保持 ${esc(bestSub.subject)} 的训练节奏；两周后回看同一类错误是否重现。` }
    ], [
      { no: '02', label: '六科变化', target: 'sec-hot' },
      { no: '03', label: '哪科拖后腿', target: 'sec-scan' },
      { no: '04', label: '我先做什么', target: 'sec-actions' }
    ]);
    const subjectBlock = rblock({
      id: 'sec-hot', no: '02', layer: '证据', en: 'CHANGES',
      title: '六科变化', question: '哪几科相对上升，哪几科相对下降？',
      lead: `六科相对变化：<b>${esc(bestSub.subject)} ${sgn(bestSub.zDiff)}</b> 最高，<b>${esc(worstSub.subject)} ${sgn(worstSub.zDiff)}</b> 最低；${progressSubs.length} 科进步、${declineSubs.length} 科退步。`,
      visual: deltaBars(subs) + subjectMini,
      reading: [
        ['读法', '条形是 Δz（相对位置变化），向右为上升、向左为下降，0 为保持；下表给出六科的入口档、评价档和判定。'],
        ['提示', '单科 Δz 受试卷难度和选科组影响，先看变化方向，再看幅度；不同科目的分数不可直接比较。'],
        ['动作', '到 03 看总分、优势科、短板科的位置变化，确定先补哪一科。']
      ],
      foot: `<span>图 1 / 表 1 · 六科变化</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-hot">D1 我的成绩单</button></span>`
    });
    const scanBlock = rblock({
      id: 'sec-scan', no: '03', layer: '证据', en: 'POSITION',
      title: '哪科拖后腿', question: '总分、优势科和短板科，各自是什么位置变化？',
      lead: `总分第 ${total.entryGrade} 档 → 第 ${total.currentGrade} 档；短板科 <b>${esc(worstSub.subject)}</b>，优势科 <b>${esc(bestSub.subject)}</b>。`,
      visual: scan,
      reading: [
        ['读法', '四行是总分、优势科、短板科、六科变化；等级是联考同首选组内的相对位置。'],
        ['提示', '如果总分保持但单科波动大，先稳优势科；如果总分退步且短板科掉2档，先补基础。'],
        ['动作', '到 04 按“先补一科、稳住优势、两周后回看”执行。']
      ],
      foot: `<span>扫描表 · 只含本人</span><span class="report-check">核对：<button class="report-check-link" data-action="scrollReport" data-target="sec-hot">D1 我的成绩单</button></span>`
    });
    const actionBlock = rblock({
      id: 'sec-actions', no: '04', layer: '行动', en: 'ACTION',
      title: '我先做什么', question: '补哪科、怎么稳优势、两周后看什么？',
      visual: actions + `<div class="report-inline-note">只包含本人数据，不展示其他学生；总分按首选组比较，单科按本科目比较群体；缺考和学籍变动不在本页展开。</div>`,
      foot: `<span>行动建议 · 只针对本人数据</span><span class="report-check">核对：02 六科变化 / 03 哪科拖后腿</span>`
    });
    const sections = summary + subjectBlock + scanBlock + actionBlock;
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
    if (roleKey === 'subject') return subjectLeaderPage(task, r);
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
      const y = window.scrollY + 200;
      const visible = sections.filter((s) => s.offsetParent !== null);
      if (!visible.length) return;
      let current = visible[0];
      visible.forEach(function (s) {
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
  App.actions.toggleReportFold = function (el) {
    const fold = el.closest('.report-fold');
    if (!fold) return;
    const open = fold.classList.toggle('open');
    el.setAttribute('aria-expanded', open ? 'true' : 'false');
    const icon = el.querySelector('.report-fold-icon');
    if (icon) icon.textContent = open ? '－' : '＋';
    const hint = el.querySelector('.report-fold-copy small');
    if (hint) hint.textContent = open ? '已展开 · 点击收起' : '供核对，不参与结论 · 点击展开';
    App.initReportToc();
  };
  App.actions.scrollReport = function (el) {
    const target = document.getElementById(el.dataset.target);
    if (!target) return;
    const fold = target.closest('.report-fold');
    if (fold && !fold.classList.contains('open')) {
      fold.classList.add('open');
      const head = fold.querySelector('.report-fold-head');
      if (head) {
        head.setAttribute('aria-expanded', 'true');
        const icon = head.querySelector('.report-fold-icon');
        if (icon) icon.textContent = '－';
        const hint = head.querySelector('.report-fold-copy small');
        if (hint) hint.textContent = '已展开 · 点击收起';
      }
      App.initReportToc();
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  function afterReportSwitch() {
    setTimeout(function () { window.scrollTo(0, 0); }, 0);
  }
  App.actions.drillClassShift = function (el) {
    const key = el.dataset.value;
    document.querySelectorAll('.shift-card').forEach((n) => n.classList.toggle('active', n.dataset.value === key));
    document.querySelectorAll('.shift-detail').forEach((d) => { d.hidden = d.dataset.class !== key; });
    const detail = Array.prototype.find.call(document.querySelectorAll('.shift-detail'), (d) => d.dataset.class === key);
    if (detail) detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  App.actions.clearClassShift = function () {
    document.querySelectorAll('.shift-detail').forEach((d) => { d.hidden = true; });
    document.querySelectorAll('.shift-card').forEach((n) => n.classList.remove('active'));
  };
  App.actions.drillReport = function (el) {
    const scope = el.dataset.scope;
    const value = el.dataset.value;
    if (scope === 'class' && document.querySelector('.view-switch')) {
      App.state.reportTeacherClass = value;
      App.render();
      afterReportSwitch();
      return;
    }
    let target = document.getElementById(el.dataset.target || '');
    if (!target) target = document.getElementById('sec-subject') || document.getElementById('sec-hot') || document.getElementById('sec-scan');
    document.querySelectorAll('.drill-hit').forEach((n) => n.classList.remove('drill-hit'));
    const v = String(value || '').trim();
    document.querySelectorAll('td, th, .rblock-title, .conclusion-point p').forEach((n) => {
      if (n.textContent.trim() === v) n.classList.add('drill-hit');
    });
    document.querySelectorAll('.r-stack-row, .r-bar-row').forEach((row) => {
      const lab = row.querySelector('.r-stack-label, .r-bar-label');
      if (lab && lab.textContent.trim().indexOf(v) === 0) row.classList.add('drill-hit');
    });
    document.querySelectorAll('svg title').forEach((t) => {
      if (t.textContent.indexOf(v) >= 0 && t.parentElement) t.parentElement.classList.add('drill-hit');
    });
    const bar = document.getElementById('report-drill-bar');
    if (bar) {
      bar.hidden = false;
      bar.innerHTML = `<span class="drill-bar-label">分析定位</span><span class="drill-chip">${esc(v)} · ${scope === 'subject' ? '科目' : '班级'}</span><button type="button" class="drill-clear" data-action="clearDrill">清除定位 ×</button>`;
    }
    if (target) {
      target.classList.add('drill-section-hit');
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setTimeout(function () {
      document.querySelectorAll('.drill-hit').forEach((n) => n.classList.remove('drill-hit'));
      document.querySelectorAll('.drill-section-hit').forEach((n) => n.classList.remove('drill-section-hit'));
    }, 3000);
  };
  App.actions.clearDrill = function () {
    const bar = document.getElementById('report-drill-bar');
    if (bar) { bar.hidden = true; bar.innerHTML = ''; }
    document.querySelectorAll('.drill-hit, .drill-section-hit').forEach((n) => { n.classList.remove('drill-hit'); n.classList.remove('drill-section-hit'); });
  };
  App.setReportSchool = function (v) {
    App.state.reportSchoolId = v;
    App.state.reportClassId = '';
    App.state.reportTeacherId = '';
    App.state.reportStudentId = '';
    App.state.reportTeacherClass = '';
    App.render();
    afterReportSwitch();
  };
  App.setReportClass = function (v) {
    App.state.reportClassId = v;
    App.state.reportStudentId = '';
    App.state.reportTeacherClass = '';
    App.render();
    afterReportSwitch();
  };
  App.setReportTeacher = function (v) {
    App.state.reportTeacherId = v;
    App.state.reportTeacherClass = '';
    App.render();
    afterReportSwitch();
  };
  App.actions.setTeacherView = function (el) {
    App.state.reportTeacherClass = el.dataset.value || '';
    App.render();
    afterReportSwitch();
  };
  App.actions.setSubjectTeacher = function (el) {
    App.state.reportSubjectTeacher = el.dataset.value || '';
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
    App.state.reportTeacherClass = '';
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
