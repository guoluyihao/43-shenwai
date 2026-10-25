const fs = require('fs');
const vm = require('vm');
const path = require('path');
const base = path.join(process.cwd(), 'value-added-evaluation-system-v3.1', 'prototype', 'assets', 'js', 'mock');
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(base, 'dataset.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(base, 'data.js'), 'utf8'), ctx);
const M = ctx.window.MOCK;
const r = M.helpers.computeTask(M.tasks[0]);
const bands = [
  { key: 'G1-G3', from: 1, to: 3 },
  { key: 'G4-G6', from: 4, to: 6 },
  { key: 'G7-G9', from: 7, to: 9 }
];
function bandOf(g) { return g <= 3 ? 0 : g <= 6 ? 1 : 2; }
function bandStats(rows) {
  return bands.map(b => {
    const rs = rows.filter(x => x.entryGrade >= b.from && x.entryGrade <= b.to);
    const decline = rs.filter(x => x.status === '退步').length;
    return { n: rs.length, decline, rate: rs.length ? decline / rs.length : 0 };
  });
}
const map = {};
r.rows.forEach(x => { if (x.subject !== '总分') (map[x.studentId] || (map[x.studentId] = [])).push(x); });
function riskOf(t) {
  const subs = map[t.studentId] || [];
  const bad = subs.filter(s => s.level <= -2);
  const deep = subs.some(s => s.level <= -4);
  const severe = t.level <= -2;
  const high = t.entryGrade <= 3 && t.level <= -1;
  return { subs, bad, deep, severe, high, risk: severe || high || deep };
}
for (const s of M.schools) {
  const totals = r.totals.filter(x => x.schoolId === s.id);
  const other = r.totals.filter(x => x.schoolId !== s.id);
  const baseBands = bandStats(other);
  const risk = totals.map(t => Object.assign({}, t, riskOf(t))).filter(x => x.risk);
  const classes = {};
  totals.forEach(t => {
    const c = classes[t.classId] || (classes[t.classId] = { id: t.classId, name: t.className, n: 0, decline: 0, risk: 0, high: 0, bands: [0, 0, 0] });
    c.n++; c.bands[bandOf(t.entryGrade)]++;
    if (t.status === '退步') c.decline++;
    if (risk.some(x => x.studentId === t.studentId)) c.risk++;
    if (risk.some(x => x.studentId === t.studentId && x.high)) c.high++;
  });
  const classRows = Object.values(classes).map(c => {
    const expected = c.bands.reduce((sum, n, i) => sum + (n / c.n) * baseBands[i].rate, 0);
    const actual = c.decline / c.n;
    return { ...c, actual, expected, excess: (actual - expected) * 100, score: c.risk * (1 + Math.max(0, (actual - expected) * 100) / 10) };
  }).sort((a, b) => b.score - a.score);
  const subj = {};
  risk.forEach(x => {
    const uniq = new Set(x.bad.map(b => b.subject));
    uniq.forEach(sub => { subj[sub] = (subj[sub] || 0) + 1; });
  });
  const subjRows = Object.entries(subj).map(([subject, count]) => ({ subject, count })).sort((a, b) => b.count - a.count);
  const bandRows = bandStats(totals).map((b, i) => ({ ...b, base: baseBands[i].rate, excess: (b.rate - baseBands[i].rate) * 100 }));
  console.log('\n=== ' + s.name + ' === n=' + totals.length + ' risk=' + risk.length);
  console.log('classes top5', classRows.slice(0, 5).map(c => `${c.name} n${c.n} risk${c.risk} high${c.high} actual${(c.actual * 100).toFixed(1)} exp${(c.expected * 100).toFixed(1)} ex${c.excess.toFixed(1)} score${c.score.toFixed(1)}`));
  console.log('subjects', subjRows.slice(0, 6));
  console.log('bands', bandRows.map(b => `${b.key} n${b.n} ${(b.rate * 100).toFixed(1)} vs ${(b.base * 100).toFixed(1)} ex${b.excess.toFixed(1)}`));
}
