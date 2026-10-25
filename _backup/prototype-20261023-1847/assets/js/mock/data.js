/* 成绩增值评价系统 v3.1 · 高中园数据层（本期仅基础数据 + 成绩数据） */
(function () {
  'use strict';

  const D = window.DATASET;
  if (!D) throw new Error('dataset.js 未加载');

  const SUBJECTS = [
    { code: 'YW', name: '语文', type: '必考', group: '', scoring: 'raw', full: 150, order: 1 },
    { code: 'SX', name: '数学', type: '必考', group: '', scoring: 'raw', full: 150, order: 2 },
    { code: 'YY', name: '英语', type: '必考', group: '外语', scoring: 'raw', full: 150, order: 3, language: true },
    { code: 'RY', name: '日语', type: '必考', group: '外语', scoring: 'raw', full: 150, order: 4, language: true },
    { code: 'EY', name: '俄语', type: '必考', group: '外语', scoring: 'raw', full: 150, order: 5, language: true },
    { code: 'WL', name: '物理', type: '首选', group: '', scoring: 'raw', full: 100, order: 6 },
    { code: 'HX', name: '化学', type: '再选', group: '', scoring: 'assigned', full: 100, order: 7 },
    { code: 'SW', name: '生物', type: '再选', group: '', scoring: 'assigned', full: 100, order: 8 },
    { code: 'LS', name: '历史', type: '首选', group: '', scoring: 'raw', full: 100, order: 9 },
    { code: 'ZZ', name: '政治', type: '再选', group: '', scoring: 'assigned', full: 100, order: 10 },
    { code: 'DL', name: '地理', type: '再选', group: '', scoring: 'assigned', full: 100, order: 11 }
  ];
  const SUBJECT_NAMES = SUBJECTS.map((s) => s.name);
  const STAGE_SUBJECTS = {
    高中: SUBJECT_NAMES.slice(),
    // 本期没有初中数据；初中按英语单科保留
    初中: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '道德与法治']
  };
  const SUBJECT_MAP = Object.fromEntries(SUBJECTS.map((s) => [s.name, s]));
  const BANDS9 = [4, 10.5, 22.6, 40.1, 59.9, 77.4, 89.5, 96, 100];
  const Z_BANDS9 = [1.75, 1.25, 0.75, 0.25, -0.25, -0.75, -1.25, -1.75];
  const WEIGHTS9 = [90, 80, 70, 60, 50, 40, 30, 20, 10];
  const SMALL_SAMPLE = 8;

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  const SCHOOLS = clone(D.schools);
  const GRADES = clone(D.grades);
  const CLASSES = clone(D.classes);
  const TEACHERS = clone(D.teachers);
  const ASSIGNMENTS = clone(D.assignments);
  const STUDENTS = clone(D.students);
  const EXAMS = clone(D.exams);
  const IMPORT_BATCHES = clone(D.importBatches);
  const SCHOOL_MAP = Object.fromEntries(SCHOOLS.map((s) => [s.id, s]));
  const CLASS_MAP = Object.fromEntries(CLASSES.map((c) => [c.id, c]));
  const TEACHER_MAP = Object.fromEntries(TEACHERS.map((t) => [t.id, t]));

  const SCORES = D.scores.map((row) => ({
    examId: row[0],
    studentId: row[1],
    studentNo: row[2],
    studentName: row[3],
    schoolId: row[4],
    classId: row[5],
    className: row[6],
    subject: row[7],
    raw: row[8],
    assigned: row[9],
    status: row[10],
    teacherId: row[11]
  }));

  const SCORE_MAP = {};
  function rebuildScoreMap() {
    Object.keys(SCORE_MAP).forEach((k) => { delete SCORE_MAP[k]; });
    SCORES.forEach((r) => {
      if (!SCORE_MAP[r.examId]) SCORE_MAP[r.examId] = {};
      if (!SCORE_MAP[r.examId][r.studentId]) SCORE_MAP[r.examId][r.studentId] = {};
      SCORE_MAP[r.examId][r.studentId][r.subject] = r;
    });
  }
  rebuildScoreMap();

  function snapshotFor(version) {
    const classIds = new Set(
      CLASSES.filter((c) => c.schoolId === version.schoolId && c.gradeId === version.gradeId).map((c) => c.id)
    );
    return {
      students: clone(STUDENTS.filter((s) => s.schoolId === version.schoolId && s.gradeId === version.gradeId)),
      classes: clone(CLASSES.filter((c) => classIds.has(c.id))),
      teachers: clone(TEACHERS.filter((t) => t.schoolId === version.schoolId)),
      assignments: clone(ASSIGNMENTS.filter((a) => classIds.has(a.classId)))
    };
  }

  const VERSIONS = clone(D.versions).map((v) => {
    if (D.snapshots && D.snapshots[v.id]) {
      const snap = D.snapshots[v.id];
      v.snapshot = {
        students: clone(snap.students),
        classes: clone(snap.classes),
        teachers: [],
        assignments: []
      };
    } else if (v.current) {
      v.snapshot = snapshotFor(v);
    } else {
      v.snapshot = { students: [], classes: [], teachers: [], assignments: [] };
    }
    return v;
  });

  const TASKS = [{
    id: 'T1',
    name: '高中园四校增值评价（高二期末 → 高三）',
    entryExamId: 'E1',
    exitExamId: 'E2',
    schools: ['S01', 'S02', 'S03', 'S04'],
    singleSide: [],
    schoolVersions: { S01: 'V2', S02: 'V4', S03: 'V6', S04: 'V8' },
    scope: '高中园四校 · 2027届高三',
    baseDefault: 'raw',
    baseOverrides: { 化学: 'assigned', 生物: 'assigned', 政治: 'assigned', 地理: 'assigned' },
    algorithm: 'standard',
    gradeCount: 9,
    keepThreshold: 0.25,
    stepSize: 0.5,
    smallSample: 8,
    excludePartialAbsent: true,
    status: '已完成',
    createdAt: '2026-10-23 10:00',
    updatedAt: '2026-10-23 14:10',
    resultVersion: 'R4'
  }];
  const RESULTS = {};

  function defaultTeacherFor(schoolId, classId, subject) {
    if (subject === '总分') {
      return (CLASS_MAP[classId] || {}).homeroomTeacherId || null;
    }
    const list = ASSIGNMENTS.filter((a) => a.schoolId === schoolId && a.classId === classId && a.subject === subject);
    const hit = list.find((a) => a.main) || list[0];
    return hit ? hit.teacherId : null;
  }

  function teacherFor(schoolId, classId, subject, assignments) {
    if (subject === '总分') return (CLASS_MAP[classId] || {}).homeroomTeacherId || null;
    const list = assignments || ASSIGNMENTS;
    const hit = list.find((a) => a.schoolId === schoolId && a.classId === classId && a.subject === subject && a.main)
      || list.find((a) => a.schoolId === schoolId && a.classId === classId && a.subject === subject);
    return hit ? hit.teacherId : defaultTeacherFor(schoolId, classId, subject);
  }

  function scoresFor(examId, studentId) {
    return (SCORE_MAP[examId] && SCORE_MAP[examId][studentId]) || {};
  }

  function examStudents(examId) {
    const exam = EXAMS.find((e) => e.id === examId);
    if (!exam) return [];
    const seen = new Map();
    exam.schools.forEach((sid) => {
      const cfg = exam.schoolConfig[sid] || {};
      const version = VERSIONS.find((v) => v.id === cfg.versionId);
      const snapshot = version && version.snapshot;
      const list = snapshot ? snapshot.students : STUDENTS.filter((s) => s.schoolId === sid);
      list.forEach((student) => {
        if (!seen.has(student.id)) seen.set(student.id, student);
      });
    });
    return [...seen.values()];
  }

  function matchStats(entryExamId, exitExamId) {
    const entry = examStudents(entryExamId);
    const exit = examStudents(exitExamId);
    const entryMap = new Map(entry.map((s) => [s.id, s]));
    const exitMap = new Map(exit.map((s) => [s.id, s]));
    const entryOnly = [...entryMap.keys()]
      .filter((id) => !exitMap.has(id))
      .map((id) => ({ id, name: entryMap.get(id).name, className: entryMap.get(id).className, schoolId: entryMap.get(id).schoolId }));
    const exitOnly = [...exitMap.keys()]
      .filter((id) => !entryMap.has(id))
      .map((id) => ({ id, name: exitMap.get(id).name, className: exitMap.get(id).className, schoolId: exitMap.get(id).schoolId }));
    const both = [...entryMap.keys()].filter((id) => exitMap.has(id));
    const classChanged = [];
    const languageChanged = [];
    const incomplete = [];
    let complete = 0;
    const classNo = (name) => {
      const match = String(name || '').match(/(\d+)/);
      return match ? match[1] : String(name || '');
    };

    both.forEach((id) => {
      const a = entryMap.get(id);
      const b = exitMap.get(id);
      if (classNo(a.className) !== classNo(b.className)) {
        classChanged.push({ id, name: b.name, className: b.className, from: a.className, to: b.className });
      }
      if (a.language && b.language && a.language !== b.language) {
        languageChanged.push({ id, name: b.name, className: b.className, schoolId: b.schoolId, from: a.language, to: b.language });
      }
      const subjects = b.subjects || a.subjects || [];
      const entryScores = (SCORE_MAP[entryExamId] && SCORE_MAP[entryExamId][id]) || {};
      const exitScores = (SCORE_MAP[exitExamId] && SCORE_MAP[exitExamId][id]) || {};
      const ok = subjects.length === 6 && subjects.every((subject) => {
        const x = entryScores[subject];
        const y = exitScores[subject];
        return x && y && x.status === '正常' && y.status === '正常' && x.raw != null && y.raw != null;
      });
      if (ok) complete++; else incomplete.push({ id, name: b.name, className: b.className, schoolId: b.schoolId });
    });

    let missingTeacher = 0;
    let assignedMissingAll = 0;
    both.forEach((id) => {
      const scores = (SCORE_MAP[exitExamId] && SCORE_MAP[exitExamId][id]) || {};
      Object.keys(scores).forEach((subject) => {
        const rec = scores[subject];
        if (!rec || rec.status !== '正常') return;
        if (!rec.teacherId) missingTeacher++;
        if (rec.raw != null && rec.assigned == null && SUBJECT_MAP[subject] && SUBJECT_MAP[subject].scoring === 'assigned') {
          assignedMissingAll++;
        }
      });
    });

    const entrySchools = new Set(entry.map((s) => s.schoolId));
    const exitSchools = new Set(exit.map((s) => s.schoolId));
    const singleSide = [...new Set([...entrySchools, ...exitSchools])].filter((sid) => !(entrySchools.has(sid) && exitSchools.has(sid)));

    return {
      entryCount: entry.length,
      exitCount: exit.length,
      both: both.length,
      complete,
      entryOnly,
      exitOnly,
      classChanged,
      languageChanged,
      incomplete,
      missingTeacher,
      assignedMissingAll,
      singleSide
    };
  }

  function buildTaskData(task) {
    const merged = { students: [], classes: [], teachers: [], assignments: [] };
    task.schools.forEach((sid) => {
      const vid = task.schoolVersions && task.schoolVersions[sid];
      const v = VERSIONS.find((x) => x.id === vid);
      const snap = v && v.snapshot ? v.snapshot : snapshotFor({ schoolId: sid, gradeId: (GRADES.find((g) => g.schoolId === sid) || {}).id });
      merged.students.push(...snap.students);
      merged.classes.push(...snap.classes);
      merged.teachers.push(...snap.teachers);
      merged.assignments.push(...snap.assignments);
    });
    merged.teacherMap = Object.fromEntries(merged.teachers.map((t) => [t.id, t]));
    merged.classMap = Object.fromEntries(merged.classes.map((c) => [c.id, c]));
    return merged;
  }

  function stats(values) {
    const n = values.length;
    if (!n) return { n: 0, mean: 0, std: 0 };
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = n > 1 ? values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (n - 1) : 0;
    return { n, mean, std: Math.sqrt(variance) };
  }

  function gradeForZ(z) {
    for (let i = 0; i < Z_BANDS9.length; i++) {
      if (z > Z_BANDS9[i]) return i + 1;
    }
    return 9;
  }

  function assignRanks(rows, valueKey, rankKey) {
    const sorted = rows.slice().sort((a, b) => b[valueKey] - a[valueKey]);
    let rank = 1;
    let prev = null;
    sorted.forEach((r, i) => {
      if (prev === null || r[valueKey] !== prev) rank = i + 1;
      prev = r[valueKey];
      r[rankKey] = rank;
    });
  }

  function applyZ(rows, valueKey, zKey, gradeKey, rankKey) {
    assignRanks(rows, valueKey, rankKey);
    const st = stats(rows.map((r) => r[valueKey]));
    const maxValue = rows.reduce((m, r) => Math.max(m, r[valueKey]), -Infinity);
    rows.forEach((r) => {
      let z = st.std ? (r[valueKey] - st.mean) / st.std : 0;
      if (r[valueKey] === maxValue) z = 3.1;
      r[zKey] = Math.max(-3.1, Math.min(3.1, z));
      r[gradeKey] = gradeForZ(r[zKey]);
    });
  }

  function valueOf(rec) {
    if (!rec || rec.status !== '正常') return null;
    // 逐条成绩优先赋分；没有赋分时回退原始分。
    if (rec.assigned != null) return rec.assigned;
    return rec.raw;
  }

  function progressWeight(entryGrade, levels, weights) {
    weights = weights || WEIGHTS9;
    let sum = 0;
    for (let g = entryGrade - 1; g >= Math.max(1, entryGrade - levels); g--) sum += weights[g - 1];
    return sum;
  }

  function declineWeight(entryGrade, levels, weights) {
    weights = weights || WEIGHTS9;
    let sum = 0;
    for (let g = entryGrade + 1; g <= Math.min(weights.length, entryGrade + levels); g++) sum += 100 - weights[g - 1];
    return sum;
  }

  function aggregate(records, weights) {
    weights = weights || WEIGHTS9;
    const n = records.length;
    if (!n) {
      return {
        n: 0, strengthSum: 0, keepSum: 0, progressSum: 0, declineSum: 0, levelSum: 0,
        keepCount: 0, progressCount: 0, declineCount: 0,
        strength: 0, keep: 0, progress: 0, decline: 0, rate: 0, avgLevel: 0,
        progressRatio: 0, declineRatio: 0, keepRatio: 0
      };
    }
    let strengthSum = 0, keepSum = 0, progressSum = 0, declineSum = 0, levelSum = 0;
    let pc = 0, dc = 0, kc = 0;
    records.forEach((r) => {
      strengthSum += weights[r.currentGrade - 1] || 0;
      levelSum += r.level || 0;
      if (r.status === '保持') { keepSum += Math.max(0, (weights[r.entryGrade - 1] || 0) - 10); kc++; }
      if (r.status === '进步') { progressSum += progressWeight(r.entryGrade, r.level, weights); pc++; }
      if (r.status === '退步') { declineSum += declineWeight(r.entryGrade, Math.abs(r.level), weights); dc++; }
    });
    const strength = strengthSum / n;
    const keep = keepSum / n;
    const progress = progressSum / n;
    const decline = declineSum / n;
    return {
      n,
      strengthSum: round1(strengthSum), keepSum: round1(keepSum), progressSum: round1(progressSum), declineSum: round1(declineSum),
      levelSum: round1(levelSum), keepCount: kc, progressCount: pc, declineCount: dc,
      strength: round1(strength), keep: round1(keep), progress: round1(progress), decline: round1(decline),
      rate: Math.round(((keep + progress * 2) / ((decline + 1) * 1.5)) * 100) / 100,
      avgLevel: round1(levelSum / n), progressRatio: pc / n, declineRatio: dc / n, keepRatio: kc / n
    };
  }

  function round1(v) { return Math.round(v * 10) / 10; }

  function computeTask(task, data) {
    const D2 = data || buildTaskData(task);
    const gradeCount = 9;
    const bands = BANDS9;
    const weights = WEIGHTS9;
    const smallSample = task.smallSample || 8;
    const keepThreshold = task.keepThreshold == null ? 0.25 : task.keepThreshold;
    const stepSize = task.stepSize == null ? 0.5 : task.stepSize;
    const excludePartialAbsent = task.excludePartialAbsent !== false;
    const schoolSet = new Set(task.schools);
    const schoolStudents = D2.students.filter((s) => schoolSet.has(s.schoolId));
    const partialAbsent = new Set();
    if (excludePartialAbsent) {
      schoolStudents.forEach((stu) => {
        const entry = SCORE_MAP[task.entryExamId] && SCORE_MAP[task.entryExamId][stu.id];
        const exit = SCORE_MAP[task.exitExamId] && SCORE_MAP[task.exitExamId][stu.id];
        if (!entry || !exit) return;
        const subjects = stu.subjects || [];
        if (subjects.length !== 6 || subjects.some((s) => valueOf(entry[s]) == null || valueOf(exit[s]) == null)) {
          partialAbsent.add(stu.id);
        }
      });
    }
    const statsMap = { total: {}, subjects: {} };
    const subjectModes = {};
    SUBJECT_NAMES.forEach((s) => {
      const hasAssigned = SCORES.some((r) => r.subject === s && r.assigned != null);
      subjectModes[s] = {
        mode: hasAssigned ? '赋分' : '原始分',
        fallback: false, missing: 0, rawFallback: 0, hasAssigned
      };
    });
    const rows = [];

    function build(subject) {
      const list = [];
      schoolStudents.forEach((stu) => {
        if (excludePartialAbsent && partialAbsent.has(stu.id)) return;
        const entryAll = SCORE_MAP[task.entryExamId] && SCORE_MAP[task.entryExamId][stu.id];
        const exitAll = SCORE_MAP[task.exitExamId] && SCORE_MAP[task.exitExamId][stu.id];
        if (subject === '总分') {
          if (stu.subjects.length !== 6) return;
          let eSum = 0, cSum = 0, ok = true;
          for (const s of stu.subjects) {
            const e = valueOf(entryAll ? entryAll[s] : null);
            const c = valueOf(exitAll ? exitAll[s] : null);
            if (e == null || c == null) { ok = false; break; }
            eSum += e; cSum += c;
          }
          if (!ok) return;
          const classId = (exitAll && exitAll['总分'] && exitAll['总分'].classId) || stu.classByExam[task.exitExamId] || stu.classId;
          list.push({
            studentId: stu.id, studentNo: stu.studentNo, studentName: stu.name,
            schoolId: stu.schoolId, schoolName: (SCHOOL_MAP[stu.schoolId] || {}).name,
            classId, className: (D2.classMap[classId] || {}).name || stu.className,
            selection: stu.selection, subject: '总分',
            teacherId: stu.homeroomTeacherId, teacherName: (D2.teacherMap[stu.homeroomTeacherId] || {}).name,
            entryValue: round1(eSum), currentValue: round1(cSum),
            entryRaw: null, currentRaw: null, entryAssigned: null, currentAssigned: null
          });
          return;
        }
        const e = valueOf(entryAll ? entryAll[subject] : null);
        const c = valueOf(exitAll ? exitAll[subject] : null);
        if (e == null || c == null) return;
        const rec = (exitAll && exitAll[subject]) || (entryAll && entryAll[subject]);
        list.push({
          studentId: stu.id, studentNo: stu.studentNo, studentName: stu.name,
          schoolId: stu.schoolId, schoolName: (SCHOOL_MAP[stu.schoolId] || {}).name,
          classId: rec.classId, className: (D2.classMap[rec.classId] || {}).name || rec.className || stu.className,
          selection: stu.selection, subject,
          teacherId: rec.teacherId, teacherName: (D2.teacherMap[rec.teacherId] || {}).name,
          entryValue: e, currentValue: c,
          entryRaw: (entryAll && entryAll[subject]) ? entryAll[subject].raw : null,
          currentRaw: (exitAll && exitAll[subject]) ? exitAll[subject].raw : null,
          entryAssigned: (entryAll && entryAll[subject]) ? entryAll[subject].assigned : null,
          currentAssigned: (exitAll && exitAll[subject]) ? exitAll[subject].assigned : null
        });
      });

      if (subject === '总分') {
        ['物理类', '历史类'].forEach((sel) => {
          const group = list.filter((r) => r.selection === sel);
          if (!group.length) return;
          statsMap.total[sel] = {
            n: group.length,
            entry: stats(group.map((r) => r.entryValue)),
            current: stats(group.map((r) => r.currentValue))
          };
          applyZ(group, 'entryValue', 'entryZ', 'entryGrade', 'entryRank');
          applyZ(group, 'currentValue', 'currentZ', 'currentGrade', 'currentRank');
        });
      } else {
        if (list.length) {
          statsMap.subjects[subject] = {
            n: list.length,
            entry: stats(list.map((r) => r.entryValue)),
            current: stats(list.map((r) => r.currentValue))
          };
          applyZ(list, 'entryValue', 'entryZ', 'entryGrade', 'entryRank');
          applyZ(list, 'currentValue', 'currentZ', 'currentGrade', 'currentRank');
        }
      }

      list.forEach((r) => {
        const dz = r.currentZ - r.entryZ;
        if (task.algorithm === 'grade') {
          const diff = r.entryGrade - r.currentGrade;
          r.level = diff;
          r.status = diff > 0 ? '进步' : diff < 0 ? '退步' : '保持';
        } else {
          if (Math.abs(dz) <= keepThreshold) { r.status = '保持'; r.level = 0; }
          else if (dz > keepThreshold) { r.status = '进步'; r.level = 1 + Math.floor((dz - keepThreshold) / stepSize); }
          else { r.status = '退步'; r.level = -(1 + Math.floor((Math.abs(dz) - keepThreshold) / stepSize)); }
        }
        r.zDiff = Math.round(dz * 100) / 100;
        r.entryZ = Math.round(r.entryZ * 100) / 100;
        r.currentZ = Math.round(r.currentZ * 100) / 100;
        rows.push(r);
      });
    }

    build('总分');
    SUBJECT_NAMES.forEach((s) => build(s));

    const classEval = {};
    const teacherEval = {};
    const schoolEval = {};
    ['总分'].concat(SUBJECT_NAMES).forEach((subject) => {
      const list = rows.filter((r) => r.subject === subject);

      const byClass = {};
      list.forEach((r) => { const k = r.schoolId + '||' + r.classId; (byClass[k] || (byClass[k] = [])).push(r); });
      classEval[subject] = Object.keys(byClass).map((k) => {
        const rs = byClass[k];
        const first = rs[0];
        return Object.assign({ id: first.classId, schoolId: first.schoolId, schoolName: first.schoolName, name: first.className, subject }, aggregate(rs, weights));
      });

      const byTeacher = {};
      list.forEach((r) => {
        if (!r.teacherId) return;
        const k = r.schoolId + '||' + r.teacherId;
        (byTeacher[k] || (byTeacher[k] = [])).push(r);
      });
      teacherEval[subject] = Object.keys(byTeacher).map((k) => {
        const rs = byTeacher[k];
        const first = rs[0];
        return Object.assign({ id: first.teacherId, schoolId: first.schoolId, schoolName: first.schoolName, name: first.teacherName, subject, classes: [...new Set(rs.map((r) => r.className))].join('、') }, aggregate(rs, weights));
      });

      const bySchool = {};
      list.forEach((r) => { (bySchool[r.schoolId] || (bySchool[r.schoolId] = [])).push(r); });
      schoolEval[subject] = Object.keys(bySchool).map((sid) => {
        const rs = bySchool[sid];
        return Object.assign({ id: sid, schoolId: sid, schoolName: (SCHOOL_MAP[sid] || {}).name, subject }, aggregate(rs, weights));
      });

      [classEval[subject], teacherEval[subject]].forEach((groups) => {
        const bySchoolGroups = {};
        groups.forEach((g) => { (bySchoolGroups[g.schoolId] || (bySchoolGroups[g.schoolId] = [])).push(g); });
        Object.values(bySchoolGroups).forEach((gs) => {
          gs.filter((g) => g.n >= smallSample).sort((a, b) => b.strength - a.strength).forEach((g, i) => { g.strengthRank = i + 1; });
          gs.filter((g) => g.n >= smallSample).sort((a, b) => b.rate - a.rate).forEach((g, i) => { g.rateRank = i + 1; });
        });
      });

      schoolEval[subject].filter((g) => g.n >= smallSample).sort((a, b) => b.strength - a.strength).forEach((g, i) => { g.strengthRank = i + 1; });
      schoolEval[subject].filter((g) => g.n >= smallSample).sort((a, b) => b.rate - a.rate).forEach((g, i) => { g.rateRank = i + 1; });
    });

    SUBJECT_NAMES.forEach((subject) => {
      if (!subjectModes[subject].hasAssigned) return;
      let rawFallback = 0;
      rows.filter((r) => r.subject === subject).forEach((r) => {
        if (r.entryAssigned == null && r.entryRaw != null) rawFallback++;
        if (r.currentAssigned == null && r.currentRaw != null) rawFallback++;
      });
      subjectModes[subject].rawFallback = rawFallback;
      subjectModes[subject].missing = rawFallback;
      subjectModes[subject].fallback = rawFallback > 0;
    });

    const totalRows = rows.filter((r) => r.subject === '总分');
    const classTotal = classEval['总分'] || [];
    const smallClasses = classTotal.filter((c) => c.n < smallSample).map((c) => c.schoolName + ' ' + c.name);
    const missingAssigned = SUBJECT_NAMES.reduce((s, x) => s + (subjectModes[x].missing || 0), 0);
    const fallbackSubjects = SUBJECT_NAMES.filter((s) => subjectModes[s].fallback);
    const missingTeacher = rows.filter((r) => !r.teacherId).length;

    return {
      task, rows, totals: totalRows, classEval, teacherEval, schoolEval,
      stats: statsMap,
      bands, zBands: Z_BANDS9, weights, gradeCount, keepThreshold, stepSize, smallSample, excludePartialAbsent,
      quality: {
        sample: totalRows.length,
        excluded: schoolStudents.length - totalRows.length,
        missingAssigned,
        fallbackSubjects,
        missingTeacher,
        partialAbsentExcluded: partialAbsent.size,
        smallClasses
      },
      modes: subjectModes
    };
  }

  window.MOCK = {
    schools: SCHOOLS,
    grades: GRADES,
    versions: VERSIONS,
    classes: CLASSES,
    students: STUDENTS,
    teachers: TEACHERS,
    assignments: ASSIGNMENTS,
    subjects: SUBJECTS,
    exams: EXAMS,
    tasks: TASKS,
    scores: SCORES,
    results: RESULTS,
    importBatches: IMPORT_BATCHES,
    constants: { BANDS9, Z_BANDS9, WEIGHTS9, SMALL_SAMPLE, SUBJECT_NAMES, STAGE_SUBJECTS },
    helpers: {
      teacherFor, aggregate, stats, round1, buildTaskData, computeTask,
      snapshotFor, rebuildScoreMap, defaultTeacherFor, scoresFor, examStudents, matchStats,
      progressWeight, declineWeight
    }
  };
})();


