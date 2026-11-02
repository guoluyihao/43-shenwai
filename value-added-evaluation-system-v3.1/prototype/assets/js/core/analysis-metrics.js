/* 分析报告数据派生层：只读结果，不回写旧数据 */
(function () {
  'use strict';

  const AM = {};
  const T = 0.25;
  const BANDS = [
    { key: 'G1-G3', label: '入口前约23%', from: 1, to: 3 },
    { key: 'G4-G6', label: '入口中间约55%', from: 4, to: 6 },
    { key: 'G7-G9', label: '入口后约23%', from: 7, to: 9 }
  ];
  const SUBJECT_ORDER = ['语文', '数学', '英语', '物理', '历史', '化学', '生物', '政治', '地理', '日语', '俄语'];

  function num(v) { return typeof v === 'number' && !isNaN(v); }

  function describe(values) {
    const v = (values || []).filter(num);
    const n = v.length;
    if (!n) return { n: 0, mean: null, sd: null, min: null, max: null, q25: null, q50: null, q75: null };
    const mean = v.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n);
    const s = v.slice().sort((a, b) => a - b);
    const q = (p) => s[Math.min(n - 1, Math.max(0, Math.floor(p * (n - 1))))];
    return { n, mean, sd, min: s[0], max: s[n - 1], q25: q(0.25), q50: q(0.5), q75: q(0.75) };
  }

  function normalCdf(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  }

  function expectedBelow(mean, sd, threshold) {
    const th = threshold == null ? T : threshold;
    if (!num(mean) || !num(sd) || sd <= 0) return null;
    return normalCdf((-th - mean) / sd);
  }

  function expectedAbove(mean, sd, threshold) {
    const th = threshold == null ? T : threshold;
    if (!num(mean) || !num(sd) || sd <= 0) return null;
    return 1 - normalCdf((th - mean) / sd);
  }

  function bandIndex(grade) { return grade <= 3 ? 0 : grade <= 6 ? 1 : 2; }
  function classNum(name) { const m = String(name || '').match(/(\d+)班/); return m ? parseInt(m[1], 10) : 99; }

  function bandStats(totals) {
    return BANDS.map((b) => {
      const rows = (totals || []).filter((x) => x.entryGrade >= b.from && x.entryGrade <= b.to);
      const progress = rows.filter((x) => x.status === '进步').length;
      const keep = rows.filter((x) => x.status === '保持').length;
      const decline = rows.filter((x) => x.status === '退步').length;
      return {
        key: b.key, label: b.label, n: rows.length,
        progress, keep, decline,
        progressRate: rows.length ? progress / rows.length : 0,
        keepRate: rows.length ? keep / rows.length : 0,
        rate: rows.length ? decline / rows.length : 0
      };
    });
  }

  function counts(rows) {
    const c = { n: rows.length, progress: 0, keep: 0, decline: 0 };
    rows.forEach((x) => { if (x.status === '进步') c.progress++; else if (x.status === '保持') c.keep++; else c.decline++; });
    c.progressRatio = c.n ? c.progress / c.n : 0;
    c.keepRatio = c.n ? c.keep / c.n : 0;
    c.declineRatio = c.n ? c.decline / c.n : 0;
    return c;
  }

  function orderSubjects(names) {
    return (names || []).slice().sort((a, b) => {
      const ia = SUBJECT_ORDER.indexOf(a), ib = SUBJECT_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || String(a).localeCompare(String(b), 'zh');
    });
  }

  /* 班级重组：入口班级号 vs 评价班级号 */
  let recompCache = null;
  function recompositionMap() {
    if (recompCache) return recompCache;
    const byStu = {};
    (window.MOCK.scores || []).forEach((s) => {
      const o = byStu[s.studentId] || (byStu[s.studentId] = {});
      if (!o[s.examId]) o[s.examId] = s;
    });
    const map = {};
    Object.keys(byStu).forEach((id) => {
      const e = byStu[id].E1, x = byStu[id].E2;
      if (!e || !x) return;
      const m1 = String(e.className || '').match(/(\d+)班/);
      const m2 = String(x.className || '').match(/(\d+)班/);
      map[id] = {
        entry: e.className || '', exit: x.className || '',
        changed: !!(m1 && m2 && m1[1] !== m2[1])
      };
    });
    recompCache = map;
    return map;
  }

  function classRecomposition(totals) {
    const map = recompositionMap();
    let matched = 0, changed = 0;
    const sources = {};
    totals.forEach((t) => {
      const rec = map[t.studentId];
      if (!rec) return;
      matched++;
      if (rec.changed) changed++;
      const key = rec.entry || '未知';
      sources[key] = (sources[key] || 0) + 1;
    });
    const src = Object.keys(sources).map((name) => ({ name, count: sources[name] })).sort((a, b) => b.count - a.count);
    return { matched, changed, ratio: matched ? changed / matched : null, sources: src, top: src[0] || null };
  }

  function histogram(values, step) {
    const v = (values || []).filter(num);
    const st = step || 0.25;
    const min = -2.5, max = 2.5;
    const bins = [];
    for (let x = min; x < max - 1e-9; x += st) {
      bins.push({ from: x, to: x + st, count: 0 });
    }
    v.forEach((x) => {
      let i = Math.floor((x - min) / st);
      i = Math.max(0, Math.min(bins.length - 1, i));
      bins[i].count++;
    });
    return bins;
  }

  function corr(xs, ys) {
    const pairs = xs.map((x, i) => [x, ys[i]]).filter((p) => num(p[0]) && num(p[1]));
    const n = pairs.length;
    if (n < 3) return null;
    const mx = pairs.reduce((a, p) => a + p[0], 0) / n;
    const my = pairs.reduce((a, p) => a + p[1], 0) / n;
    let s = 0, sx = 0, sy = 0;
    pairs.forEach((p) => { s += (p[0] - mx) * (p[1] - my); sx += (p[0] - mx) ** 2; sy += (p[1] - my) ** 2; });
    return sx && sy ? s / Math.sqrt(sx * sy) : null;
  }

  function keepWeight(grade, weights) { return Math.max(0, (weights[grade - 1] || 0) - 10); }
  function progressWeight(grade, levels, weights) {
    let sum = 0;
    for (let g = grade - 1; g >= Math.max(1, grade - levels); g--) sum += weights[g - 1] || 0;
    return sum;
  }
  function declineWeight(grade, levels, weights) {
    let sum = 0;
    for (let g = grade + 1; g <= Math.min(weights.length, grade + levels); g++) sum += 100 - (weights[g - 1] || 0);
    return sum;
  }

  /* 目标反推：把当前“退步”中最浅的学生逐步改为“保持”，估算达到目标 rate 需要多少人。
     这是换算，不是预测；其他条件不变。 */
  function simulateToTarget(rows, target, weights) {
    const w = weights && weights.length ? weights : [90, 80, 70, 60, 50, 40, 30, 20, 10];
    const list = (rows || []).filter((x) => num(x.entryGrade));
    const n = list.length;
    if (!n) return null;
    let keep = 0, prog = 0, decl = 0;
    list.forEach((x) => {
      if (x.status === '保持') keep += keepWeight(x.entryGrade, w);
      else if (x.status === '进步') prog += progressWeight(x.entryGrade, x.level, w);
      else decl += declineWeight(x.entryGrade, Math.abs(x.level), w);
    });
    const rate = (keep + 2 * prog) / ((decl + n) * 1.5);
    const declines = list.filter((x) => x.status === '退步');
    const candidates = declines.map((x) => ({
      x,
      keep: keepWeight(x.entryGrade, w),
      decline: declineWeight(x.entryGrade, Math.abs(x.level), w),
      level: Math.abs(x.level)
    })).sort((a, b) => (a.keep + a.decline) - (b.keep + b.decline) || a.level - b.level);
    const level1 = declines.filter((x) => Math.abs(x.level) === 1).length;
    if (rate >= target) return { n, current: rate, target, need: 0, declines: declines.length, level1, reachable: true };
    let curKeep = keep, curDecl = decl, need = null;
    for (let i = 0; i < candidates.length; i++) {
      curKeep += candidates[i].keep;
      curDecl -= candidates[i].decline;
      if ((curKeep + 2 * prog) / ((curDecl + n) * 1.5) >= target) { need = i + 1; break; }
    }
    return { n, current: rate, target, need, declines: declines.length, level1, reachable: need != null };
  }

  function riskRows(totals, rowsByStudent) {
    const list = totals.map((t) => {
      const subs = rowsByStudent[t.studentId] || [];
      const bad = subs.filter((s) => s.level <= -2);
      const deep = subs.some((s) => s.level <= -4);
      const severe = t.level <= -2;
      const high = t.entryGrade <= 3 && t.level <= -1;
      const tags = [];
      if (severe) tags.push('总分掉2档以上');
      else if (t.status === '退步') tags.push('总分退步');
      if (high) tags.push('入口靠前但退步');
      if (bad.length) tags.push('单科掉2档以上');
      if (deep) tags.push('单科掉4档以上');
      return Object.assign({}, t, {
        subs, bad, deep, severe, high, tags,
        risk: severe || high || deep,
        worst: subs.slice().sort((a, b) => a.level - b.level)[0] || null
      });
    });
    const risk = list.filter((x) => x.risk);
    return {
      list, risk,
      counts: {
        risk: risk.length,
        severe: risk.filter((x) => x.severe).length,
        high: risk.filter((x) => x.high).length,
        subject2: risk.filter((x) => x.bad.length).length,
        deep: risk.filter((x) => x.deep).length,
        progress: list.filter((x) => x.status === '进步').length,
        keep: list.filter((x) => x.status === '保持').length,
        decline: list.filter((x) => x.status === '退步').length
      }
    };
  }

  function build(r, schoolId) {
    const school = (r.schoolEval['总分'] || []).find((x) => x.schoolId === schoolId) || null;
    const totals = (r.totals || []).filter((x) => x.schoolId === schoolId);
    const other = (r.totals || []).filter((x) => x.schoolId !== schoolId);
    const global = describe((r.totals || []).map((x) => x.zDiff));
    const schoolD = describe(totals.map((x) => x.zDiff));
    const subjects = orderSubjects(Object.keys(r.schoolEval || {}).filter((s) => s !== '总分' && (r.schoolEval[s] || []).length));
    const rowsByStudent = {};
    const rowsBySubject = {};
    const rowsByTeacher = {};
    (r.rows || []).forEach((x) => {
      if (x.subject === '总分') return;
      (rowsByStudent[x.studentId] || (rowsByStudent[x.studentId] = [])).push(x);
      (rowsBySubject[x.subject] || (rowsBySubject[x.subject] = [])).push(x);
      if (x.teacherName) (rowsByTeacher[x.teacherName] || (rowsByTeacher[x.teacherName] = [])).push(x);
    });

    const peerTotals = other.length ? other : (r.totals || []);
    const peerBands = bandStats(peerTotals);
    const ownBands = bandStats(totals);
    const bandRows = ownBands.map((b, i) => Object.assign({}, b, {
      base: peerBands[i].rate,
      excess: b.rate - peerBands[i].rate,
      progressBase: peerBands[i].progressRate,
      progressExcess: b.progressRate - peerBands[i].progressRate
    }));

    const classRaw = (r.classEval['总分'] || []).filter((c) => c.schoolId === schoolId);
    const classStats = classRaw.map((c) => {
      const members = totals.filter((x) => x.classId === c.id);
      const d = describe(members.map((x) => x.zDiff));
      const cc = counts(members);
      const bandN = [0, 0, 0];
      members.forEach((x) => { bandN[bandIndex(x.entryGrade)]++; });
      const expected = members.length
        ? bandN.reduce((s, n, i) => s + (n / members.length) * peerBands[i].rate, 0)
        : null;
      const recomp = classRecomposition(members);
      return Object.assign({}, c, {
        n: members.length, mean: d.mean, sd: d.sd,
        progress: cc.progress, progressRatio: cc.progressRatio,
        keep: cc.keep, keepRatio: cc.keepRatio,
        decline: cc.decline, declineRatio: cc.declineRatio,
        expected, excess: expected == null ? null : cc.declineRatio - expected,
        recomp
      });
    }).sort((a, b) => classNum(a.name) - classNum(b.name));

    const subjectRows = subjects.map((sub) => {
      const g = (r.schoolEval[sub] || []).find((x) => x.schoolId === schoolId);
      const rows = (rowsBySubject[sub] || []).filter((x) => x.schoolId === schoolId);
      const d = describe(rows.map((x) => x.zDiff));
      const cc = counts(rows);
      return {
        subject: sub, n: rows.length, mean: d.mean, sd: d.sd,
        progressCount: cc.progress, keepCount: cc.keep, declineCount: cc.decline,
        progressRatio: cc.progressRatio, keepRatio: cc.keepRatio,
        decline: cc.decline, declineRatio: cc.declineRatio,
        expected: expectedBelow(d.mean, d.sd),
        rate: g ? g.rate : null
      };
    }).filter((x) => x.n > 0);
    const subjectMeanRate = subjectRows.length ? subjectRows.reduce((a, x) => a + (x.rate || 0), 0) / subjectRows.length : null;

    const teacherGroups = subjects.map((sub) => {
      const ts = (r.teacherEval[sub] || []).filter((t) => t.schoolId === schoolId).map((t) => {
        const rows = (rowsByTeacher[t.name] || []).filter((x) => x.schoolId === schoolId && x.subject === sub);
        const d = describe(rows.map((x) => x.zDiff));
        const cc = counts(rows);
        return {
          subject: sub, name: t.name, classes: t.classes || '', n: rows.length,
          mean: d.mean, sd: d.sd,
          progress: cc.progress, progressRatio: cc.progressRatio,
          keep: cc.keep, keepRatio: cc.keepRatio,
          decline: cc.decline, declineRatio: cc.declineRatio,
          rate: t.rate, expected: expectedBelow(d.mean, d.sd)
        };
      }).filter((x) => x.n > 0).sort((a, b) => (a.mean == null ? 99 : a.mean) - (b.mean == null ? 99 : b.mean));
      const valid = ts.filter((x) => x.n >= 8 && num(x.mean));
      const means = valid.map((x) => x.mean).sort((a, b) => a - b);
      return {
        subject: sub, teachers: ts,
        valid: valid.length,
        min: means.length ? means[0] : null,
        med: means.length ? means[Math.floor(means.length / 2)] : null,
        max: means.length ? means[means.length - 1] : null
      };
    }).filter((g) => g.teachers.length);

    const risk = riskRows(totals, rowsByStudent);

    const direction = ['物理类', '历史类'].map((sel) => {
      const rows = totals.filter((x) => x.selection === sel);
      return { sel, n: rows.length, ...counts(rows) };
    }).filter((x) => x.n > 0);

    const grade = [];
    for (let g = 1; g <= 9; g++) {
      const entry = totals.filter((x) => x.entryGrade === g).length;
      const exit = totals.filter((x) => x.currentGrade === g).length;
      grade.push({ grade: g, entry, exit, delta: exit - entry });
    }

    const matrix = [];
    (r.classEval['总分'] || []).filter((c) => c.schoolId === schoolId).forEach((c) => {
      const row = { classId: c.id, name: c.name, n: 0, cells: {}, total: 0 };
      const members = totals.filter((x) => x.classId === c.id);
      row.n = members.length;
      subjects.forEach((sub) => {
        const ids = {};
        members.forEach((t) => {
          const bad = (rowsByStudent[t.studentId] || []).some((x) => x.subject === sub && x.level <= -2);
          if (bad) ids[t.studentId] = 1;
        });
        row.cells[sub] = Object.keys(ids).length;
        row.total += row.cells[sub];
      });
      matrix.push(row);
    });

    const progressMatrix = [];
    (r.classEval['总分'] || []).filter((c) => c.schoolId === schoolId).forEach((c) => {
      const row = { classId: c.id, name: c.name, n: 0, cells: {}, total: 0 };
      const members = totals.filter((x) => x.classId === c.id);
      row.n = members.length;
      subjects.forEach((sub) => {
        const ids = {};
        members.forEach((t) => {
          const good = (rowsByStudent[t.studentId] || []).some((x) => x.subject === sub && x.level >= 2);
          if (good) ids[t.studentId] = 1;
        });
        row.cells[sub] = Object.keys(ids).length;
        row.total += row.cells[sub];
      });
      progressMatrix.push(row);
    });

    const classCorr = corr(classStats.filter((c) => c.n >= 8).map((c) => c.strength), classStats.filter((c) => c.n >= 8).map((c) => c.mean));

    return {
      schoolId, school, totals, other, global, schoolD,
      subjects, subjectRows, subjectMeanRate,
      classes: classStats, classCorr,
      teachers: teacherGroups,
      risk, direction, grade, bands: bandRows,
      matrix, progressMatrix, histogram: histogram(totals.map((x) => x.zDiff), 0.25),
      threshold: T
    };
  }

  AM.describe = describe;
  AM.normalCdf = normalCdf;
  AM.expectedBelow = expectedBelow;
  AM.expectedAbove = expectedAbove;
  AM.bandStats = bandStats;
  AM.counts = counts;
  AM.histogram = histogram;
  AM.corr = corr;
  AM.simulateToTarget = simulateToTarget;
  AM.keepWeight = keepWeight;
  AM.progressWeight = progressWeight;
  AM.declineWeight = declineWeight;
  AM.classRecomposition = classRecomposition;
  AM.riskRows = riskRows;
  AM.build = build;
  AM.recompositionMap = recompositionMap;
  AM.orderSubjects = orderSubjects;
  AM.classNum = classNum;
  AM.BANDS = BANDS;
  window.AnalysisMetrics = AM;
})();
