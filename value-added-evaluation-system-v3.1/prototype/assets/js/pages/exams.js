/* 考试管理 + 成绩导入 */
(function () {
  'use strict';
  const App = window.App;
  const UI = window.UI;
  const IM = window.IMPORT_MOCK;

  App.pages.exams = function (parts) {
    if (parts && parts[1] === 'new') return App.canEdit() ? examNew() : `<div class="page">${UI.empty('学校管理员为只读角色，不能新增考试')}</div>`;
    if (parts && parts[1]) return examDetail(parts[1]);
    return examList();
  };

  function subjectCountLabel(exam) {
    const count = (exam.subjects || []).length;
    return count === 11 ? '9 科（外语三选一）' : count + ' 科';
  }

  function examList() {
    const all = window.MOCK.exams.filter((e) => App.canEdit() || e.schools.includes(App.state.schoolId));
    return `<div class="page">
      <div class="page-head">
        <div>
          <div class="breadcrumb"><span>管理</span><span class="sep">/</span><span>考试管理</span></div>
          <h1 class="page-title">考试管理</h1>
          <div class="page-desc">联考可包含多所学校；只导成绩单，入库后不做统计</div>
        </div>
        <div class="page-actions">${App.canEdit() ? `<button class="btn btn-primary" data-action="newExam">${UI.icon('plus')}新增考试</button>` : ''}</div>
      </div>
      <div class="card">
        <div class="card-head"><div><div class="card-title"><span class="dot"></span>考试列表</div><div class="card-sub">点击考试查看成绩与导入记录</div></div></div>
        ${UI.table({
          columns: [
            { key: 'name', label: '考试', render: (r) => `<div class="strong">${App.esc(r.name)}</div><div class="sub">${App.esc(r.date)} · ${subjectCountLabel(r)}</div>` },
            { key: 'schools', label: '参与学校', render: (r) => r.schools.map((id) => `<span class="badge badge-blue" style="margin-right:4px">${App.esc(App.schoolName(id))}</span>`).join('') },
            { key: 'status', label: '状态', render: (r) => UI.badge(r.status, App.examStatusType(r.status)) },
            { key: 'imports', label: '导入记录', align: 'num', render: (r) => window.MOCK.importBatches.filter((b) => b.examId === r.id).length },
            { key: 'ops', label: '操作', render: (r) => `<div class="flex gap-6"><button class="btn btn-xs" data-action="openExam" data-id="${r.id}">查看</button>${App.canEdit() ? `<button class="btn btn-xs" data-action="deleteExam" data-id="${r.id}">删除</button>` : ''}</div>` }
          ],
          rows: all
        })}
      </div>
    </div>`;
  }

  App.actions.newExam = function () { if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; } App.navigate('/exams/new'); };
  App.actions.openExam = function (el) {
    App.state.examPage = 1;
    App.state.examKeyword = '';
    App.state.examSchoolFilter = '';
    App.navigate('/exams/' + el.dataset.id);
  };

  const STAGE_LEVELS = { 高中: ['高三', '高二', '高一'], 初中: ['初三', '初二', '初一'] };

  function gradeFor(schoolId, stage, gradeLevel) {
    return App.gradesOf(schoolId).find((g) => g.stage === stage && g.gradeLevel === gradeLevel);
  }

  function hasSavedVersion(schoolId, stage, gradeLevel) {
    const g = gradeFor(schoolId, stage, gradeLevel);
    return !!(g && App.currentVersionOf(g.id));
  }

  function draft() {
    if (!App.state.examDraft) {
      const stage = '高中';
      const gradeLevel = '高三';
      App.state.examDraft = {
        name: '', date: '2026-06-10', stage, gradeLevel,
        schools: [],
        subjects: (window.MOCK.constants.STAGE_SUBJECTS[stage] || []).slice()
      };
    }
    return App.state.examDraft;
  }

  function examNew() {
    if (!App.canEdit()) return `<div class="page">${UI.empty('学校管理员为只读角色，不能新增考试')}</div>`;
    const d = draft();
    const subjects = window.MOCK.constants.STAGE_SUBJECTS[d.stage] || [];
    return `<div class="page">
      <div class="page-head">
        <div><div class="breadcrumb"><span>管理</span><span class="sep">/</span><span>考试管理</span><span class="sep">/</span><span>新增考试</span></div><h1 class="page-title">新增考试</h1><div class="page-desc">先选学段和年级层次，再选学校；系统自动带出实际年级与最新已保存版本</div></div>
        <div class="page-actions"><button class="btn" data-action="backExams">返回列表</button><button class="btn btn-primary" data-action="saveExam">保存考试</button></div>
      </div>
      <div class="card mb-16">
        <div class="card-head"><div><div class="card-title"><span class="dot"></span>基本信息</div></div></div>
        <div class="card-body">
          <div class="form-grid">
            <div class="field"><label class="field-label">考试名称 *</label><input class="input" id="examName" value="${App.esc(d.name)}" onchange="App.setExamDraft('name', this.value)" placeholder="如：2026届高三联考（三模）" /></div>
            <div class="field"><label class="field-label">考试时间 *</label><input class="input" type="date" id="examDate" value="${d.date}" onchange="App.setExamDraft('date', this.value)" /></div>
            <div class="field"><label class="field-label">学段 *</label><select class="select" onchange="App.setExamStage(this.value)">${Object.keys(window.MOCK.constants.STAGE_SUBJECTS).map((s) => `<option ${d.stage === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
            <div class="field"><label class="field-label">年级层次 *</label><select class="select" onchange="App.setExamLevel(this.value)">${(STAGE_LEVELS[d.stage] || []).map((l) => `<option ${d.gradeLevel === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          </div>
        </div>
      </div>
      <div class="card mb-16">
        <div class="card-head"><div><div class="card-title"><span class="dot"></span>参与学校</div><div class="card-sub">先选择学校，系统再自动带出实际年级与最新已保存版本</div></div>
          <button class="btn btn-sm ${d.schools.length ? '' : 'btn-primary'}" data-action="openExamSchoolPicker">${d.schools.length ? '重新选择学校' : '选择学校'}</button>
        </div>
        <div class="card-body">
          ${d.schools.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>学校</th><th>实际年级（自动）</th><th>最新已保存版本（自动）</th></tr></thead><tbody>${d.schools.map((sid) => {
            const g = gradeFor(sid, d.stage, d.gradeLevel);
            const v = g ? App.currentVersionOf(g.id) : null;
            return `<tr><td class="strong">${App.schoolName(sid)}</td><td>${g ? App.esc(g.name) : '—'}</td><td>${v ? v.id + ' · ' + App.esc(v.name) : '—'}</td></tr>`;
          }).join('')}</tbody></table></div>` : `<div class="empty"><div class="empty-icon">◌</div><div>尚未选择参与学校</div><div class="mt-12"><button class="btn btn-primary" data-action="openExamSchoolPicker">选择学校</button></div></div>`}
          <div class="alert info mt-8">${UI.icon('alert')}<div>同一场考试只能包含同学段、同年级层次的学校；版本取该实际年级最新已保存版本。</div></div>
        </div>
      </div>
      ${d.schools.length ? `<div class="card">
        <div class="card-head"><div><div class="card-title"><span class="dot"></span>参与科目</div><div class="card-sub">科目按学段写死，至少选择一科</div></div></div>
        <div class="card-body"><div class="chips">${subjects.map((s) => `<button class="chip ${d.subjects.includes(s) ? 'active' : ''}" data-action="toggleExamSubject" data-value="${s}">${s}</button>`).join('')}</div></div>
      </div>` : ''}
    </div>`;
  }

  App.actions.openExamSchoolPicker = function () {
    const d = draft();
    const list = window.MOCK.schools.filter((s) => gradeFor(s.id, d.stage, d.gradeLevel));
    UI.modal({
      title: '选择参与学校',
      sub: `${d.stage} · ${d.gradeLevel} · 只显示有实际年级的学校`,
      wide: true,
      body: list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>选择</th><th>学校</th><th>实际年级</th><th>最新已保存版本</th></tr></thead><tbody>${list.map((s) => {
        const g = gradeFor(s.id, d.stage, d.gradeLevel);
        const v = g ? App.currentVersionOf(g.id) : null;
        const checked = d.schools.includes(s.id);
        return `<tr><td><input type="checkbox" data-school-pick="${s.id}" ${checked ? 'checked' : ''} ${v ? '' : 'disabled'} /></td><td class="strong">${App.esc(s.name)}</td><td>${g ? App.esc(g.name) : '—'}</td><td>${v ? v.id + ' · ' + App.esc(v.name) : '<span class="badge badge-amber">无已保存版本</span>'}</td></tr>`;
      }).join('')}</tbody></table></div>` : `<div class="empty">该学段与年级层次下暂无可选学校</div>`,
      footer: `<button class="btn" data-action="closeModal">取消</button><button class="btn btn-primary" data-action="saveExamSchoolPicker">确定</button>`
    });
  };
  App.actions.saveExamSchoolPicker = function () {
    const d = draft();
    d.schools = [...document.querySelectorAll('[data-school-pick]:checked')].map((el) => el.dataset.schoolPick);
    UI.closeModal();
    App.render();
  };

  App.setExamDraft = function (k, v) { draft()[k] = v; };
  App.setExamStage = function (stage) {
    const d = draft();
    d.stage = stage;
    d.gradeLevel = (STAGE_LEVELS[stage] || [])[0];
    d.schools = [];
    d.subjects = (window.MOCK.constants.STAGE_SUBJECTS[stage] || []).slice();
    App.render();
  };
  App.setExamLevel = function (level) {
    const d = draft();
    d.gradeLevel = level;
    d.schools = [];
    App.render();
  };
  App.toggleExamSchool = function (id, checked) {
    const d = draft();
    if (checked && !d.schools.includes(id)) d.schools.push(id);
    if (!checked) d.schools = d.schools.filter((x) => x !== id);
    App.render();
  };
  App.actions.toggleExamSubject = function (el) {
    const d = draft(); const s = el.dataset.value;
    const i = d.subjects.indexOf(s);
    if (i >= 0) d.subjects.splice(i, 1); else d.subjects.push(s);
    App.render();
  };
  App.actions.backExams = function () { App.navigate('/exams'); };
  App.actions.saveExam = function () {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    const d = draft();
    if (!d.name.trim()) { UI.toast('请填写考试名称', 'error'); return; }
    if (!d.schools.length) { UI.toast('请选择参与学校', 'error'); return; }
    if (!d.subjects.length) { UI.toast('请选择参与科目', 'error'); return; }
    const schoolConfig = {};
    for (const sid of d.schools) {
      const g = gradeFor(sid, d.stage, d.gradeLevel);
      const v = g ? App.currentVersionOf(g.id) : null;
      if (!g || !v) { UI.toast(`${App.schoolName(sid)} 缺少实际年级或已保存版本`, 'error'); return; }
      schoolConfig[sid] = { gradeId: g.id, versionId: v.id };
    }
    const maxExam = window.MOCK.exams.reduce((m, e) => Math.max(m, parseInt(String(e.id).replace(/\D/g, ''), 10) || 0), 0);
    const id = 'E' + (maxExam + 1);
    window.MOCK.exams.push({ id, name: d.name.trim(), date: d.date, type: '联考', stage: d.stage, gradeLevel: d.gradeLevel, status: '已发布', schools: d.schools.slice(), schoolConfig, subjects: d.subjects.slice() });
    App.state.examDraft = null;
    UI.toast('考试已创建');
    App.navigate('/exams/' + id);
  };

  const RESELECT_SUBJECTS = new Set(['化学', '生物', '政治', '地理']);
  const SCORE_SHEET_SUBJECTS = ['语文', '数学', '英语', '日语', '俄语', '物理', '历史', '化学', '生物', '政治', '地理'];
  const scoreRosterCache = {};

  function classSortNo(name) {
    const match = String(name || '').match(/(\d+)/);
    return match ? Number(match[1]) : 999;
  }

  function fmtScore(value) {
    if (value == null) return '';
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  }

  function buildScoreRoster(exam) {
    if (scoreRosterCache[exam.id]) return scoreRosterCache[exam.id];
    const students = window.MOCK.helpers.examStudents(exam.id);
    const rows = students.map((stu) => {
      const records = window.MOCK.helpers.scoresFor(exam.id, stu.id);
      const subjects = stu.subjects || [];
      const cells = {};
      let rawOk = subjects.length === 6;
      let assignedOk = subjects.length === 6;
      let rawTotal = 0;
      let assignedTotal = 0;

      window.MOCK.constants.SUBJECT_NAMES.forEach((subject) => {
        const record = records[subject];
        const selected = subjects.includes(subject);
        const raw = record && record.status === '正常' ? record.raw : null;
        const assigned = record && record.status === '正常' ? record.assigned : null;
        cells[subject] = {
          selected,
          raw,
          assigned,
          status: record ? record.status : (selected ? '缺考' : '')
        };
        if (!selected) return;
        if (raw == null) rawOk = false; else rawTotal += raw;
        if (RESELECT_SUBJECTS.has(subject)) {
          if (assigned == null) assignedOk = false; else assignedTotal += assigned;
        } else {
          if (raw == null) assignedOk = false; else assignedTotal += raw;
        }
      });

      return {
        id: stu.id,
        studentNo: stu.studentNo,
        studentName: stu.name,
        schoolId: stu.schoolId,
        schoolName: App.schoolName(stu.schoolId),
        className: stu.className,
        classNum: classSortNo(stu.className),
        cells,
        totalRaw: rawOk ? rawTotal : null,
        totalAssigned: assignedOk ? assignedTotal : null
      };
    });
    rows.sort((a, b) => a.schoolId.localeCompare(b.schoolId)
      || a.classNum - b.classNum
      || a.studentNo.localeCompare(b.studentNo));
    scoreRosterCache[exam.id] = rows;
    return rows;
  }

  function scoreCell(cell, key) {
    if (!cell || !cell.selected) return '<span class="weak">—</span>';
    const value = cell[key];
    if (value == null) {
      return `<span class="score-absent">${cell.status === '缺考' ? '缺考' : '—'}</span>`;
    }
    return fmtScore(value);
  }

  function scoreSheetTable(rows) {
    const head1 = [
      '<th rowspan="2" class="col-no">学号</th>',
      '<th rowspan="2" class="col-name">姓名</th>',
      '<th rowspan="2" class="col-school">学校</th>',
      '<th rowspan="2" class="col-class">班级</th>'
    ];
    const head2 = [];

    SCORE_SHEET_SUBJECTS.forEach((subject) => {
      if (RESELECT_SUBJECTS.has(subject)) {
        head1.push(`<th colspan="2">${subject}</th>`);
        head2.push('<th>原始分</th><th>赋分</th>');
      } else {
        head1.push(`<th rowspan="2">${subject}</th>`);
      }
    });
    head1.push('<th rowspan="2" class="score-total">原始总分</th><th rowspan="2" class="score-total">赋分总分</th>');

    const body = rows.map((row) => {
      const cells = [
        `<td class="col-no"><span class="code">${App.esc(row.studentNo)}</span></td>`,
        `<td class="col-name"><span class="strong">${App.esc(row.studentName)}</span></td>`,
        `<td class="col-school">${App.esc(row.schoolName)}</td>`,
        `<td class="col-class">${App.esc(row.className)}</td>`
      ];
      SCORE_SHEET_SUBJECTS.forEach((subject) => {
        const cell = row.cells[subject];
        if (RESELECT_SUBJECTS.has(subject)) {
          cells.push(`<td class="num">${scoreCell(cell, 'raw')}</td>`);
          cells.push(`<td class="num">${scoreCell(cell, 'assigned')}</td>`);
        } else {
          cells.push(`<td class="num">${scoreCell(cell, 'raw')}</td>`);
        }
      });
      cells.push(`<td class="num score-total">${row.totalRaw == null ? '<span class="weak">—</span>' : fmtScore(row.totalRaw)}</td>`);
      cells.push(`<td class="num score-total">${row.totalAssigned == null ? '<span class="weak">—</span>' : fmtScore(row.totalAssigned)}</td>`);
      return `<tr>${cells.join('')}</tr>`;
    }).join('');

    return `<div class="table-wrap score-sheet-wrap"><table class="table score-sheet">
      <thead><tr>${head1.join('')}</tr><tr>${head2.join('')}</tr></thead>
      <tbody>${body}</tbody>
    </table></div>`;
  }

  function examDetail(id) {
    const exam = window.MOCK.exams.find((e) => e.id === id);
    if (!exam) return `<div class="page">${UI.empty('考试不存在')}</div>`;
    const visibleSchools = App.canEdit() ? exam.schools : exam.schools.filter((s) => s === App.state.schoolId);
    const tab = App.state.examTab || 'scores';
    const roster = buildScoreRoster(exam).filter((row) => visibleSchools.includes(row.schoolId));
    const schoolRows = App.state.examSchoolFilter
      ? roster.filter((row) => row.schoolId === App.state.examSchoolFilter)
      : roster;
    const keyword = (App.state.examKeyword || '').trim().toLowerCase();
    const filtered = keyword
      ? schoolRows.filter((row) => row.studentName.toLowerCase().includes(keyword) || row.studentNo.toLowerCase().includes(keyword))
      : schoolRows;
    const pageSize = App.state.examPageSize || 20;
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const page = Math.min(Math.max(1, App.state.examPage || 1), pages);
    const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
    const imports = window.MOCK.importBatches.filter((b) => b.examId === exam.id && (App.canEdit() || b.schoolId === App.state.schoolId));
    const tasks = window.MOCK.tasks.filter((t) => t.entryExamId === exam.id || t.exitExamId === exam.id);

    return `<div class="page">
      <div class="page-head">
        <div>
          <div class="breadcrumb"><span>管理</span><span class="sep">/</span><span>考试管理</span><span class="sep">/</span><span>${App.esc(exam.name)}</span></div>
          <h1 class="page-title">${App.esc(exam.name)}</h1>
          <div class="page-desc">${exam.stage || '高中'} · ${exam.gradeLevel || '高三'} · ${exam.date} · ${visibleSchools.map((s) => App.schoolName(s)).join('、')}</div>
        </div>
        <div class="page-actions">
          ${App.canEdit() ? `<button class="btn" data-action="deleteExam" data-id="${exam.id}">${UI.icon('trash')}删除考试</button>` : ''}
        </div>
      </div>
      <div class="card mb-16">
        <div class="card-body" style="display:flex;gap:24px;flex-wrap:wrap">
          ${UI.kv([['参与学校', visibleSchools.map((s) => `<span class="badge badge-blue">${App.schoolName(s)}</span>`).join(' ')], ['参与科目', subjectCountLabel(exam)], ['状态', UI.badge(exam.status, App.examStatusType(exam.status))]])}
          <div class="grow"></div>
          <div class="small muted">${visibleSchools.map((s) => { const c = exam.schoolConfig[s]; return `${App.schoolName(s)}：${c.gradeLabel || App.gradeName(c.gradeId)} · ${c.versionId}`; }).join('<br>')}</div>
        </div>
      </div>
      ${UI.tabs([
        { key: 'scores', label: '成绩单', count: roster.length, active: tab === 'scores' },
        { key: 'imports', label: '导入记录', count: imports.length, active: tab === 'imports' }
      ], 'setExamTab')}
      ${tab === 'scores' ? `<div class="card">
        <div class="card-head"><div><div class="card-title"><span class="dot"></span>学生成绩单</div><div class="card-sub">一个学生一行，左右滚动查看全部科目；再选科目原始分/赋分分列；共 ${filtered.length} 名学生</div></div>
          <div class="toolbar">
            <div class="search">${UI.icon('search')}<input id="examSearch" class="input input-sm" placeholder="姓名/学号" value="${App.esc(App.state.examKeyword || '')}" oninput="if (!event.isComposing) App.setExamKeyword(this.value)" /></div>
            <select class="select select-sm" style="width:130px" onchange="App.setExamFilter('school', this.value)"><option value="">全部学校</option>${visibleSchools.map((s) => `<option value="${s}" ${App.state.examSchoolFilter === s ? 'selected' : ''}>${App.schoolName(s)}</option>`).join('')}</select>
            <select class="select select-sm" style="width:110px" onchange="App.setExamPageSize(this.value)"><option value="20" ${pageSize === 20 ? 'selected' : ''}>20 条/页</option><option value="50" ${pageSize === 50 ? 'selected' : ''}>50 条/页</option><option value="100" ${pageSize === 100 ? 'selected' : ''}>100 条/页</option></select>
          </div>
        </div>
        ${filtered.length
          ? `${scoreSheetTable(pageRows)}${UI.pagination(filtered.length, page, pageSize, 'examPage', '名学生')}`
          : UI.empty('未找到匹配学生')}
      </div>` : `<div class="card">
        <div class="card-head"><div><div class="card-title"><span class="dot"></span>导入记录</div><div class="card-sub">同一考试同一时间只允许一个导入任务；按学校覆盖</div></div></div>
        ${UI.table({
          columns: [
            { key: 'id', label: '批次', render: (r) => `<span class="code">${r.id}</span>` },
            { key: 'schoolName', label: '学校' },
            { key: 'file', label: '文件', render: (r) => `<div class="strong">${App.esc(r.file)}</div><div class="sub">${r.rows} 行</div>` },
            { key: 'status', label: '状态', render: (r) => UI.badge(r.status, App.importStatusType(r.status)) },
            { key: 'result', label: '结果', render: (r) => `成功 ${r.success} · 跳过 ${r.skipped} · 失败 ${r.failed}` },
            { key: 'confidence', label: '置信度', align: 'num', render: (r) => r.confidence + '%' },
            { key: 'time', label: '时间', render: (r) => `${r.time}<div class="sub">${r.user}</div>` }
          ],
          rows: imports
        })}
        ${!imports.length ? UI.empty('尚未导入成绩') : ''}
      </div>`}
      ${tasks.length ? `<div class="alert info mt-16">${UI.icon('alert')}<div>该考试已被 ${tasks.length} 个评价任务引用，删除考试会被拒绝。</div></div>` : ''}
    </div>`;
  }

  App.actions.setExamTab = function (el) { App.state.examTab = el.dataset.value; App.render(); };
  App.setExamFilter = function (key, v) {
    if (key === 'school') App.state.examSchoolFilter = v;
    App.state.examPage = 1;
    App.render();
  };
  App.setExamKeyword = function (value) {
    App.state.examKeyword = value;
    App.state.examPage = 1;
    App.render();
    const input = document.getElementById('examSearch');
    if (input) {
      input.focus();
      try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
    }
  };
  App.setExamPageSize = function (value) {
    App.state.examPageSize = Number(value) || 20;
    App.state.examPage = 1;
    App.render();
  };
  App.actions.examPage = function (el) {
    App.state.examPage = Number(el.dataset.page) || 1;
    App.render();
  };

  App.actions.deleteExam = function (el) {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    const exam = window.MOCK.exams.find((e) => e.id === el.dataset.id);
    const used = window.MOCK.tasks.some((t) => t.entryExamId === exam.id || t.exitExamId === exam.id);
    if (used) { UI.modal({ title: '无法删除考试', body: `<div class="small">该考试已被评价任务引用，请先删除关联的评价任务。</div>`, footer: `<button class="btn" data-action="closeModal">知道了</button>` }); return; }
    UI.modal({
      title: '删除考试',
      body: `<div class="small">确认删除 <b>${App.esc(exam.name)}</b>？该考试的成绩与导入记录将一并删除。</div>`,
      footer: `<button class="btn" data-action="closeModal">取消</button><button class="btn btn-danger" data-action="confirmDeleteExam" data-id="${exam.id}">确认删除</button>`
    });
  };
  App.actions.confirmDeleteExam = function (el) {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    const id = el.dataset.id;
    for (let i = window.MOCK.exams.length - 1; i >= 0; i--) if (window.MOCK.exams[i].id === id) window.MOCK.exams.splice(i, 1);
    for (let i = window.MOCK.scores.length - 1; i >= 0; i--) if (window.MOCK.scores[i].examId === id) window.MOCK.scores.splice(i, 1);
    for (let i = window.MOCK.importBatches.length - 1; i >= 0; i--) if (window.MOCK.importBatches[i].examId === id) window.MOCK.importBatches.splice(i, 1);
    if (window.MOCK.helpers && window.MOCK.helpers.rebuildScoreMap) window.MOCK.helpers.rebuildScoreMap();
    UI.closeModal(); UI.toast('考试已删除'); App.navigate('/exams');
  };

  /* ================= 导入向导 ================= */
  App.pages.import = function () {
    return `<div class="page">
      <div class="page-head">
        <div><div class="breadcrumb"><span>管理</span><span class="sep">/</span><span>考试管理</span><span class="sep">/</span><span>成绩导入</span></div><h1 class="page-title">成绩导入</h1><div class="page-desc">成绩数据维护</div></div>
      </div>
      <div class="card"><div class="card-body" style="padding:40px;text-align:center">
        <div class="empty-icon">◌</div>
        <div style="font-size:18px;font-weight:700">成绩数据已入库</div>
        <div class="muted small mt-8">高二期末、高三两场成绩已导入；可在考试详情查看成绩与导入记录。</div>
        <div class="mt-16"><button class="btn" data-action="backExams">返回考试列表</button></div>
      </div></div>
    </div>`;
  };

  function stepper(step) {
    const items = ['上传', 'AI 解析', '结果预览', '匹配与差异', '入库结果'];
    return `<div class="stepper">${items.map((label, i) => `<div class="step ${i + 1 === step ? 'active' : i + 1 < step ? 'done' : ''}"><span class="step-num">${i + 1 < step ? '✓' : i + 1}</span><span>${label}</span></div>${i < items.length - 1 ? '<span class="step-line"></span>' : ''}`).join('')}</div>`;
  }

  function importUpload(w) {
    const exam = window.MOCK.exams.find((e) => e.id === w.examId) || window.MOCK.exams[1];
    return `<div class="grid grid-main">
      <div class="card">
        <div class="card-head"><div><div class="card-title"><span class="dot"></span>第一步：上传成绩单</div><div class="card-sub">${App.esc(exam.name)} · ${exam.schools.map((s) => App.schoolName(s)).join('、')}</div></div></div>
        <div class="card-body">
          <div class="upload-zone">
            <div class="upload-icon">${UI.icon('upload')}</div>
            <div class="upload-title">拖拽成绩单到这里，或选择文件</div>
            <div class="upload-desc">只支持成绩单；Excel / CSV；可一次选择多所学校文件；不需要模板</div>
          </div>
          <div class="flex items-center justify-between mt-16 mb-8"><div class="card-title" style="font-size:13px">导入文件</div><span class="tiny weak">同一考试同一时间只允许一个导入任务</span></div>
          <div class="file-grid">
            ${IM.FILES.map((f) => `<div class="file-card ${w.fileIds.includes(f.id) ? 'active' : ''}" data-action="toggleImportFile" data-id="${f.id}">
              <div class="file-icon ${f.type === 'CSV' ? 'csv' : ''}">${f.type === 'CSV' ? 'CSV' : 'XLS'}</div>
              <div class="file-name">${App.esc(f.name)}</div>
              <div class="file-meta">${f.schoolName} · ${f.size}</div>
              <div class="file-desc">${App.esc(f.desc)}</div>
            </div>`).join('')}
          </div>
          <div class="flex items-center justify-between mt-16">
            <div class="small muted">${w.fileIds.length ? `已选择 ${w.fileIds.length} 份文件` : '请选择成绩单'}</div>
            <button class="btn btn-primary" data-action="startImportParse" ${w.fileIds.length ? '' : 'disabled'}>开始 AI 解析 →</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div><div class="card-title"><span class="dot"></span>覆盖规则</div></div></div>
        <div class="card-body small" style="display:flex;flex-direction:column;gap:9px">
          <div>· 涉及哪所学校，就替换该校旧成绩</div>
          <div>· 未涉及的学校保持不变</div>
          <div>· 同一考试同一时间只允许一个导入任务</div>
          <div>· 入库后只保存成绩，不做统计</div>
        </div>
      </div>
    </div>`;
  }

  App.actions.toggleImportFile = function (el) {
    const w = App.state.importWizard; const id = el.dataset.id;
    const i = w.fileIds.indexOf(id);
    if (i >= 0) w.fileIds.splice(i, 1); else w.fileIds.push(id);
    App.render();
  };
  App.actions.startImportParse = function () {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    const w = App.state.importWizard;
    const exam = window.MOCK.exams.find((e) => e.id === w.examId);
    if (exam && exam.importing) { UI.toast('该考试已有导入任务进行中', 'warn'); return; }
    if (!w.fileIds.length) return;
    if (exam) exam.importing = true;
    w.step = 2; w.stage = 0; w.running = true; w.done = false; App.render();
    const tick = () => {
      if (w.step !== 2) return;
      w.stage += 1;
      if (w.stage >= 4) { w.stage = 4; w.running = false; w.done = true; App.render(); setTimeout(() => { if (w.step === 2) { w.step = 3; App.render(); } }, 700); return; }
      App.render(); setTimeout(tick, 700);
    };
    setTimeout(tick, 700);
  };

  function importParsing(w) {
    const stages = ['识别文件结构', '定位表头与成绩列', '识别学校/班级/学生', '数据校验'];
    const pct = Math.round((w.stage / 4) * 100);
    return `<div class="grid grid-main"><div class="card">
      <div class="card-head"><div><div class="card-title"><span class="dot"></span>第二步：AI 解析</div><div class="card-sub">识别到 ${w.fileIds.length} 份成绩单</div></div><span class="badge ${w.done ? 'badge-green' : 'badge-blue'}">${w.done ? '解析完成' : '解析中'}</span></div>
      <div class="card-body">
        <div class="progress-label"><span>${w.done ? '解析完成' : stages[Math.min(w.stage, 3)]}</span><span>${pct}%</span></div>
        ${UI.progress(pct, true)}
        <div class="parse-stages mt-16">${stages.map((s, i) => `<div class="parse-stage ${i < w.stage || w.done ? 'done' : i === w.stage ? 'active' : ''}"><span class="tick">${i < w.stage || w.done ? '✓' : i + 1}</span><span>${s}</span><span class="stage-meta">${i < w.stage || w.done ? '完成' : i === w.stage ? '进行中' : '等待'}</span></div>`).join('')}</div>
      </div></div>
      <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>解析统计</div></div></div><div class="card-body">${UI.kv([['文件数', w.fileIds.length], ['识别学校', '2 所'], ['识别行数', '240 行'], ['字段数', '11 个'], ['平均置信度', '93%'], ['低置信度字段', '3 个']])}</div></div>
    </div>`;
  }

  function importPreview(w) {
    return `<div class="card mb-16">
      <div class="card-head"><div><div class="card-title"><span class="dot"></span>第三步：核对解析结果</div><div class="card-sub">黄色单元格为低置信度，需要人工确认</div></div><span class="badge badge-amber">3 个低置信度字段</span></div>
      <div class="card-body">
        <div class="split">
          <div><div class="card-title mb-8" style="font-size:13px">原文件预览</div><div class="doc-preview"><div class="doc-tabs"><span class="doc-tab active">博雅高中</span><span class="doc-tab">弘知高中</span></div><table class="doc-sheet">${IM.DOC_PREVIEW.map((row, i) => i === 0 ? `<tr><th colspan="11" style="text-align:left;background:#dbeafe">${row[0]}</th></tr>` : `<tr>${row.map((c) => i === 1 ? `<th>${c}</th>` : `<td>${c}</td>`).join('')}</tr>`).join('')}</table></div></div>
          <div><div class="card-title mb-8" style="font-size:13px">结构化成绩</div><div class="table-wrap" style="max-height:460px"><table class="table table-compact"><thead><tr>${IM.HEADERS.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${IM.ROWS.map((row) => `<tr>${row.cells.map((c, j) => { const low = c.conf < 0.8; return `<td class="${low ? 'conf-low' : c.conf < 0.9 ? 'conf-mid' : ''}">${low ? `<input class="cell-input" value="${App.esc(c.v)}" onchange="App.editImportCell('${row.id}',${j},this.value)" />` : App.esc(c.v)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
            <div class="flex justify-between mt-12"><span class="tiny weak">原文定位：第 1 个工作表 · 第 3-10 行</span><div class="flex gap-8"><button class="btn" data-action="importBack">返回上传</button><button class="btn btn-primary" data-action="importToDiff">下一步：匹配与差异 →</button></div></div>
          </div>
        </div>
      </div>
    </div>`;
  }

  App.editImportCell = function (rowId, idx, v) {
    const row = IM.ROWS.find((r) => r.id === rowId);
    row.cells[idx].v = v; row.cells[idx].conf = 0.99; UI.toast('已修正，置信度更新'); App.render();
  };
  App.actions.importBack = function () { App.state.importWizard.step = 1; App.render(); };
  App.actions.importToDiff = function () { App.state.importWizard.step = 4; App.render(); };

  function importDiff(w) {
    const accepted = w.accepted || {};
    const counts = { block: 0, confirm: 0, hint: 0 };
    IM.DIFFS.forEach((d) => counts[d.level]++);
    const left = IM.DIFFS.filter((d) => d.level === 'block' && !accepted[d.id]).length;
    const tab = w.diffTab || 'all';
    const list = IM.DIFFS.filter((d) => tab === 'all' || d.level === tab);
    const schools = [...new Set(w.fileIds.map((id) => (IM.FILES.find((f) => f.id === id) || {}).schoolName).filter(Boolean))];
    return `<div class="card mb-16">
      <div class="card-head"><div><div class="card-title"><span class="dot"></span>第四步：匹配与差异确认</div><div class="card-sub">阻断项清零后才能入库</div></div></div>
      <div class="card-body">
        <div class="diff-summary mb-16">
          <div class="diff-sum"><div class="l">差异总数</div><div class="n">${IM.DIFFS.length}</div></div>
          <div class="diff-sum block"><div class="l">阻断（剩 ${left}）</div><div class="n">${counts.block - left}/${counts.block}</div></div>
          <div class="diff-sum confirm"><div class="l">待确认</div><div class="n">${counts.confirm}</div></div>
          <div class="diff-sum hint"><div class="l">提示</div><div class="n">${counts.hint}</div></div>
          <div class="diff-sum"><div class="l">已处理</div><div class="n">${Object.keys(accepted).length}</div></div>
        </div>
        <div class="alert warn mb-16">${UI.icon('alert')}<div>本次导入将覆盖：<b>${schools.join('、')}</b>。未涉及的学校保持不变。</div></div>
        ${UI.tabs([
          { key: 'all', label: '全部', count: IM.DIFFS.length, active: tab === 'all' },
          { key: 'block', label: '阻断', count: counts.block, active: tab === 'block' },
          { key: 'confirm', label: '待确认', count: counts.confirm, active: tab === 'confirm' },
          { key: 'hint', label: '提示', count: counts.hint, active: tab === 'hint' }
        ], 'setImportTab')}
        <div class="diff-list">
          ${list.map((d) => { const done = !!accepted[d.id]; return `<div class="diff-item ${done ? 'done' : ''}">
            <span class="diff-level ${d.level}">${d.level === 'block' ? '阻断' : d.level === 'confirm' ? '待确认' : '提示'}</span>
            <div class="diff-main"><div class="diff-title">${App.esc(d.category)} · ${App.esc(d.title)}</div><div class="diff-desc">${App.esc(d.desc)}</div><div class="diff-suggest">建议：${App.esc(d.suggestion)}</div></div>
            <div class="diff-actions">${done ? '<span class="badge badge-green">已处理</span>' : `<button class="btn btn-xs btn-primary" data-action="resolveImportDiff" data-id="${d.id}">${d.level === 'block' ? '采用建议' : '接受'}</button>${d.level !== 'hint' ? `<button class="btn btn-xs btn-danger" data-action="ignoreImportDiff" data-id="${d.id}">忽略</button>` : ''}`}</div>
          </div>`; }).join('')}
        </div>
        <div class="flex items-center justify-between mt-16"><div class="small">${left ? `还有 <b style="color:#ef4444">${left}</b> 项阻断未处理` : '阻断项已清零，可以入库'}</div><button class="btn btn-primary" data-action="confirmImport" ${left ? 'disabled' : ''}>确认并入库</button></div>
      </div>
    </div>`;
  }

  App.actions.setImportTab = function (el) { App.state.importWizard.diffTab = el.dataset.value; App.render(); };
  App.actions.resolveImportDiff = function (el) { App.state.importWizard.accepted[el.dataset.id] = 'accept'; App.render(); };
  App.actions.ignoreImportDiff = function (el) { App.state.importWizard.accepted[el.dataset.id] = 'ignore'; App.render(); };
  App.actions.resetImport = function () {
    const oldExam = window.MOCK.exams.find((e) => e.id === App.state.importWizard.examId);
    if (oldExam) oldExam.importing = false;
    App.state.importWizard = { step: 1, examId: App.state.examId || 'E2', fileIds: [], accepted: {}, stage: 0, running: false, done: false, diffTab: 'all', batchId: '' };
    App.render();
  };

  App.actions.goImportExam = function (el) {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    const target = window.MOCK.exams.find((e) => e.id === (el.dataset.id || App.state.examId || 'E2'));
    if (target && target.importing) { UI.toast('该考试已有导入任务进行中', 'warn'); return; }
    const w = App.state.importWizard;
    w.step = 1; w.examId = el.dataset.id || App.state.examId || 'E2'; w.fileIds = []; w.accepted = {}; w.stage = 0; w.done = false; w.batchId = '';
    App.navigate('/import');
  };

  App.actions.confirmImport = function () {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    const w = App.state.importWizard;
    const left = IM.DIFFS.filter((d) => d.level === 'block' && !w.accepted[d.id]).length;
    if (left) { UI.toast('仍有阻断项未处理', 'error'); return; }
    const schools = [...new Set(w.fileIds.map((id) => IM.FILES.find((f) => f.id === id)).filter(Boolean).map((f) => f.schoolName))];
    const sid = 'IMP-' + (w.examId) + '-' + String(window.MOCK.importBatches.length + 1).padStart(2, '0');
    schools.forEach((name) => {
      const school = window.MOCK.schools.find((s) => s.name === name);
      if (school) {
        const old = window.MOCK.scores.filter((s) => s.examId === w.examId && s.schoolId === school.id);
        for (let i = window.MOCK.scores.length - 1; i >= 0; i--) {
          const s = window.MOCK.scores[i];
          if (s.examId === w.examId && s.schoolId === school.id) window.MOCK.scores.splice(i, 1);
        }
        window.MOCK.scores.push(...old);
      }
      const f = IM.FILES.find((x) => x.schoolName === name && w.fileIds.includes(x.id));
      window.MOCK.importBatches.unshift({ id: sid + '-' + (window.MOCK.importBatches.length + 1), examId: w.examId, schoolId: (window.MOCK.schools.find((s) => s.name === name) || {}).id, schoolName: name, file: f ? f.name : '成绩单', target: '成绩', rows: 120, success: 120, skipped: 0, failed: 0, status: '已入库', confidence: 93, user: '张老师', time: '2026-10-22 11:00' });
    });
    window.MOCK.helpers.rebuildScoreMap();
    const doneExam = window.MOCK.exams.find((e) => e.id === w.examId);
    if (doneExam) doneExam.importing = false;
    w.step = 5; w.batchId = sid; App.render();
  };

  function importDone(w) {
    const schools = [...new Set(w.fileIds.map((id) => IM.FILES.find((f) => f.id === id)).filter(Boolean).map((f) => f.schoolName))];
    return `<div class="card" style="max-width:860px;margin:0 auto"><div class="card-body" style="text-align:center;padding:40px 24px">
      <div style="width:62px;height:62px;border-radius:50%;background:#ecfdf5;color:#10b981;display:grid;place-items:center;margin:0 auto 14px">${UI.icon('check')}</div>
      <div style="font-size:20px;font-weight:700">导入完成</div>
      <div class="muted small mt-8">成绩已入库；未发布前可按批次覆盖，入库后不做统计。</div>
      <div class="card mt-16" style="text-align:left"><div class="card-body">${UI.kv([
        ['涉及学校', schools.join('、')],
        ['成功入库', 120 * schools.length + ' 条成绩记录'],
        ['覆盖方式', '按学校覆盖，未涉及学校不变']
      ])}</div></div>
      <div class="flex gap-8 mt-16" style="justify-content:center"><button class="btn" data-action="openExam" data-id="${w.examId}">查看考试详情</button><button class="btn btn-primary" data-action="newEvaluation">去建评价</button></div>
    </div></div>`;
  }
})();
