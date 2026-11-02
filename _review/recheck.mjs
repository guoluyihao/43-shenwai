import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
global.window = global;
const base = path.join(process.cwd(), 'value-added-evaluation-system-v3.1', 'prototype', 'assets', 'js', 'mock');
require(path.join(base, 'dataset.js'));
require(path.join(base, 'data.js'));
const M = global.MOCK;
const r = M.helpers.computeTask(M.tasks[0]);
const p = (...a) => console.log(...a);

p('== 学校 ==');
(r.schoolEval['总分'] || []).forEach(g => p(g.schoolName, 'n=' + g.n, 'strength=' + g.strength, 'rate=' + g.rate, 'keep=' + g.keep, 'prog=' + g.progress, 'decl=' + g.decline, 'declCount=' + g.declineCount, 'keepRatio=' + g.keepRatio.toFixed(3), 'declRatio=' + g.declineRatio.toFixed(3)));

p('\n== 博雅班级按 rate 排序 ==');
const boya = (r.classEval['总分'] || []).filter(g => g.schoolId === 'S01');
boya.slice().sort((a, b) => b.rate - a.rate).forEach(g => p(g.name, 'n=' + g.n, 'rate=' + g.rate, 'strength=' + g.strength, 'decl=' + g.decline, 'declCount=' + g.declineCount, 'declRatio=' + (g.declineRatio * 100).toFixed(1), 'rank=' + g.rateRank));

p('\n== 全部班级 rate 极端值 ==');
const allCls = [];
Object.entries(r.classEval).forEach(([sub, arr]) => arr.forEach(g => allCls.push({ sub, ...g })));
p('班级指标条数', allCls.length);
p('rate>5 的条数', allCls.filter(g => g.rate > 5).length, '涉及班', new Set(allCls.filter(g => g.rate > 5).map(g => g.name)).size);
allCls.filter(g => g.rate > 5).slice(0, 15).forEach(g => p(' ', g.sub, g.schoolId, g.name, 'n=' + g.n, 'rate=' + g.rate, 'decl=' + g.decline));

p('\n== 学科样本与增值（博雅） ==');
Object.keys(r.schoolEval).filter(s => s !== '总分').forEach(s => {
  const g = r.schoolEval[s].find(x => x.schoolId === 'S01');
  if (g) p(s, 'n=' + g.n, 'rate=' + g.rate);
});

p('\n== 各校日语/俄语样本 ==');
['日语', '俄语'].forEach(s => (r.schoolEval[s] || []).forEach(g => p(s, g.schoolName, 'n=' + g.n, 'rate=' + g.rate)));

p('\n== 05 学科差距（四校 n>=30） ==');
const subs = Object.keys(r.schoolEval).filter(s => s !== '总分');
const rows = subs.map(s => {
  const arr = r.schoolEval[s] || [];
  const ok = arr.length >= 4 && arr.every(g => g.n >= 30);
  const rates = arr.map(g => g.rate);
  return { s, ok, gap: Math.max(...rates) - Math.min(...rates), min: Math.min(...rates), max: Math.max(...rates) };
}).sort((a, b) => b.gap - a.gap);
rows.forEach(x => p(x.s, x.ok ? '四校n>=30' : '样本不足', 'gap=' + x.gap.toFixed(2), x.min + '~' + x.max));

p('\n== 学生 赵玥 / 张心怡 ==');
['2024231039', '2024230135', '2024230132'].forEach(no => {
  const t = r.totals.find(x => x.studentNo === no);
  if (!t) return p(no, 'not found');
  p(no, t.studentName, t.className, 'grades', t.entryGrade, '->', t.currentGrade, 'level=' + t.level, 'dz=' + t.zDiff, 'status=' + t.status);
  const s = r.rows.filter(x => x.studentId === t.studentId && x.subject !== '总分').map(x => `${x.subject}:${x.entryGrade}->${x.currentGrade} lv${x.level} dz${x.zDiff}`);
  p('  ', s.join(' | '));
});

p('\n== 学生报告默认学生（郑雅婍） ==');
const st = r.totals.find(x => x.studentName === '郑雅婍');
if (st) {
  p('grades', st.entryGrade, '->', st.currentGrade, 'level=' + st.level, 'dz=' + st.zDiff, 'status=' + st.status, 'rank', st.entryRank, '->', st.currentRank);
  r.rows.filter(x => x.studentId === st.studentId && x.subject !== '总分').forEach(x => p(' ', x.subject, x.entryGrade, '->', x.currentGrade, 'lv', x.level, 'dz', x.zDiff, x.status));
}

p('\n== 高三1班 生物 ==');
const bio = r.rows.filter(x => x.className === '高三1班' && x.subject === '生物');
p('rows', bio.length, bio.map(x => `${x.studentName}:${x.entryGrade}->${x.currentGrade} lv${x.level} ${x.status}`).join(' | '));

p('\n== 班级退步比例极值（博雅，n>=8） ==');
boya.filter(g => g.n >= 8).slice().sort((a, b) => b.declineRatio - a.declineRatio).forEach(g => p(g.name, g.n, (g.declineRatio * 100).toFixed(1) + '%'));
