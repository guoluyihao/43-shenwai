/* 基础数据 v3.1：年级 / 教师 / 导入更新 / 版本管理 */
(function () {
  'use strict';
  const App = window.App;
  const UI = window.UI;

  App.pages.basic = function (parts) {
    if (parts && parts[1] === 'import') return basicImportPlaceholder();
    const schoolId = App.isSchool() ? App.state.schoolId : App.state.basicSchoolId;
    if (!schoolId) return basicSchoolsPage();
    const tab = App.state.basicTab || 'grades';
    const school = window.MOCK.schools.find((s) => s.id === schoolId);
    return `<div class="page">
      <div class="page-head">
        <div>
          <div class="breadcrumb"><span>管理</span><span class="sep">/</span><span>基础数据</span><span class="sep">/</span><span>${App.esc(school ? school.name : '')}</span></div>
          <h1 class="page-title">基础数据</h1>
          <div class="page-desc">${App.esc(school ? school.name : '')} · 年级 → 班级 → 学生/班主任/科任；教师单列；科目按学段写死</div>
        </div>
        <div class="page-actions">
          ${App.canEdit() ? `<button class="btn" data-action="backBasicSchools">${UI.icon('school')}返回学校列表</button>${tab === 'grades' ? `<button class="btn btn-primary" data-action="openAddGrade">${UI.icon('plus')}新增年级</button>` : ''}` : ''}
        </div>
      </div>
      ${UI.tabs([
        { key: 'grades', label: '年级', active: tab === 'grades' },
        { key: 'teachers', label: '教师', active: tab === 'teachers' }
      ], 'setBasicTab')}
      ${tab === 'grades' ? (App.state.selectedGradeId ? gradeDetail(App.state.selectedGradeId) : gradeList(schoolId)) : ''}
      ${tab === 'teachers' ? teacherList(schoolId) : ''}
    </div>`;
  };

  function basicImportPlaceholder() {
    return `<div class="page">
      <div class="page-head"><div><div class="breadcrumb"><span>管理</span><span class="sep">/</span><span>基础数据</span><span class="sep">/</span><span>导入更新</span></div><h1 class="page-title">导入更新</h1><div class="page-desc">基础数据维护</div></div></div>
      <div class="card"><div class="card-body" style="padding:40px;text-align:center">
        <div class="empty-icon">◌</div>
        <div style="font-size:18px;font-weight:700">数据已入库</div>
        <div class="muted small mt-8">基础数据与成绩数据已导入，可在基础数据与考试详情中查看。</div>
        <div class="mt-16"><button class="btn" data-action="backBasicSchools">返回学校列表</button></div>
      </div></div>
    </div>`;
  }

  function basicSchoolsPage() {
    const schools = window.MOCK.schools.map((s) => {
      const grades = App.gradesOf(s.id);
      const classes = App.classesOfSchool(s.id);
      const students = window.MOCK.students.filter((x) => x.schoolId === s.id);
      return { ...s, grades, classCount: classes.length, studentCount: students.length };
    });
    return `<div class="page">
      <div class="page-head">
        <div><div class="breadcrumb"><span>管理</span><span class="sep">/</span><span>基础数据</span></div><h1 class="page-title">基础数据</h1><div class="page-desc">先选择学校，再进入年级与班级；运营管理员不通过顶部切换学校</div></div>
      </div>
      <div class="grid grid-3">
        ${schools.map((s) => `<div class="card" style="cursor:pointer" data-action="openBasicSchool" data-id="${s.id}">
          <div class="card-body">
            <div class="flex items-start justify-between gap-8"><div><div class="card-title" style="font-size:16px">${App.esc(s.name)}</div><div class="card-sub">${App.esc(s.city || '')} · ${App.esc(s.code)}</div></div>${UI.badge(s.enabled ? '启用' : '停用', s.enabled ? 'green' : 'gray')}</div>
            <div class="grid grid-3 mt-16">
              <div><div class="tiny weak">年级</div><div class="strong">${s.grades.length}</div></div>
              <div><div class="tiny weak">班级</div><div class="strong">${s.classCount}</div></div>
              <div><div class="tiny weak">学生</div><div class="strong">${s.studentCount}</div></div>
            </div>
            <div class="mt-12 right"><button class="btn btn-sm btn-outline" data-action="openBasicSchool" data-id="${s.id}">进入学校 →</button></div>
          </div>
        </div>`).join('')}
      </div>
    </div>`;
  }

  function gradeList(schoolId) {
    const grades = App.gradesOf(schoolId);
    return `<div class="grid grid-3">
      ${grades.map((g) => {
        const classes = App.classesOf(g.id);
        const students = window.MOCK.students.filter((s) => s.gradeId === g.id);
        const v = App.currentVersionOf(g.id);
        return `<div class="card" style="cursor:pointer" data-action="openGrade" data-id="${g.id}">
          <div class="card-body">
            <div class="flex items-start justify-between gap-8">
              <div><div class="card-title" style="font-size:16px">${App.esc(g.name)}</div><div class="card-sub">${App.esc(g.stage)} · ${App.esc(g.gradeLevel || '')} · ${App.esc(App.schoolName(g.schoolId))}</div></div>
              ${g.dirty ? UI.badge('有未保存修改', 'amber') : UI.badge('已保存', 'green')}
            </div>
            <div class="grid grid-3 mt-16">
              <div><div class="tiny weak">班级</div><div class="strong">${classes.length}</div></div>
              <div><div class="tiny weak">学生</div><div class="strong">${students.length}</div></div>
              <div><div class="tiny weak">版本</div><div class="strong">${v ? v.id : '—'}</div></div>
            </div>
            <div class="alert ${g.dirty ? 'warn' : 'info'} mt-16" style="padding:8px 10px">${g.dirty ? '当前编辑稿有未保存修改，保存后才能被考试引用' : '当前版本：' + (v ? App.esc(v.name) : '未保存')}</div>
            <div class="mt-12 right"><button class="btn btn-sm btn-outline" data-action="openGrade" data-id="${g.id}">进入年级 →</button></div>
          </div>
        </div>`;
      }).join('')}
      ${grades.length ? '' : UI.empty('暂无年级，请先导入学生名单生成年级')}
    </div>`;
  }

  function versionRefs(v) {
    const refs = [];
    (window.MOCK.exams || []).forEach((e) => {
      Object.values(e.schoolConfig || {}).forEach((cfg) => { if (cfg && cfg.versionId === v.id) refs.push('考试 ' + e.name); });
    });
    (window.MOCK.tasks || []).forEach((t) => {
      Object.values(t.schoolVersions || {}).forEach((vid) => { if (vid === v.id) refs.push('评价 ' + t.name); });
    });
    return refs;
  }

  function gradeDetail(gradeId) {
    const g = App.grade(gradeId);
    const classes = App.classesOf(gradeId);
    const versions = App.versionsOf(gradeId);
    const students = window.MOCK.students.filter((s) => s.gradeId === gradeId);
    return `<div class="card mb-16">
      <div class="card-head">
        <div><div class="card-title"><span class="dot"></span>${App.esc(g.name)}</div><div class="card-sub">${App.esc(g.stage)} · ${App.esc(g.gradeLevel || '')} · ${App.esc(App.schoolName(g.schoolId))} · ${classes.length} 个班 · ${students.length} 名学生</div></div>
        <div class="flex gap-8">
          <button class="btn btn-sm" data-action="backGrades">返回年级列表</button>
          ${App.canEdit() ? `<button class="btn btn-sm btn-primary" data-action="openSaveVersion" data-id="${gradeId}">保存版本</button>` : ''}
        </div>
      </div>
    </div>
    ${g.dirty ? `<div class="alert warn mb-16">${UI.icon('alert')}<div>当前编辑稿有未保存修改。未保存的修改不能被考试或评价任务引用。</div></div>` : ''}

    <div class="grid grid-main">
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>班级</div><div class="card-sub">点击班级查看学生、班主任、科任老师</div></div></div>
          ${UI.table({
            columns: [
              { key: 'name', label: '班级', render: (r) => `<span class="strong">${App.esc(r.name)}</span>` },
              { key: 'size', label: '人数', align: 'num' },
              { key: 'homeroom', label: '班主任' },
              { key: 'ops', label: '操作', render: (r) => `<button class="btn btn-xs" data-action="openClass" data-id="${r.id}">查看班级</button>` }
            ],
            rows: classes.map((c) => ({ ...c, homeroom: (App.teacher(c.homeroomTeacherId) || {}).name || '—' }))
          })}</div>
        <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>学生</div><div class="card-sub">仅展示前 12 名，完整名单在班级详情中</div></div></div>
          ${UI.table({
            columns: [
              { key: 'studentNo', label: '学号', render: (r) => `<span class="code">${r.studentNo}</span>` },
              { key: 'name', label: '姓名' },
              { key: 'className', label: '班级' },
              { key: 'selection', label: '选科' },
              { key: 'status', label: '状态', render: (r) => UI.badge(r.status, r.status === '在读' ? 'green' : 'amber') }
            ],
            rows: students.slice(0, 12)
          })}</div>
      </div>
      <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>版本</div><div class="card-sub">当前版本可被考试引用；历史版本可删除</div></div></div><div class="card-body">
        <div class="timeline">${versions.map((v) => { const refs = versionRefs(v); return `<div class="timeline-item ${v.current ? 'current' : 'done'}">
          <div class="flex items-center justify-between gap-8"><div><b>${v.id}</b> ${App.esc(v.name)} ${v.current ? '<span class="badge badge-blue">当前</span>' : ''}</div><div class="flex gap-6 items-center">${refs.length ? `<span class="badge badge-amber">被引用 ${refs.length}</span>` : ''}${v.current || refs.length ? '<span class="badge badge-gray">不可删除</span>' : App.canEdit() ? `<button class="btn btn-xs" data-action="deleteVersion" data-id="${v.id}">删除</button>` : ''}</div></div>
          <div class="tiny muted mt-8">${v.date} · ${App.esc(v.publisher)} ${v.source ? '· ' + App.esc(v.source) : ''}</div>
          <div class="tiny weak mt-8">${App.esc(v.note || '')}</div>
        </div>`; }).join('')}</div>
      </div></div>
    </div>`;
  }

  function teacherList(schoolId) {
    const list = App.teachersOf(schoolId).map((t) => {
      const classes = App.classesOfSchool(schoolId).filter((c) => {
        if (c.homeroomTeacherId === t.id) return true;
        return t.subject && window.MOCK.helpers.teacherFor(schoolId, c.id, t.subject) === t.id;
      }).map((c) => c.name);
      return { ...t, homeroom: t.homeroomClassId ? (App.classDef(t.homeroomClassId) || {}).name : '—', classes: classes.join('、') };
    });
    return `<div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>教师</div><div class="card-sub">学校级单列；通过教师名单/任课安排导入更新</div></div><span class="badge badge-gray">${list.length} 人</span></div>
      ${UI.table({
        columns: [
          { key: 'employeeNo', label: '工号', render: (r) => `<span class="code">${r.employeeNo}</span>` },
          { key: 'name', label: '姓名', render: (r) => `<span class="strong">${App.esc(r.name)}</span>` },
          { key: 'subject', label: '任教学科' },
          { key: 'homeroom', label: '班主任', render: (r) => r.homeroomClassId ? UI.badge(r.homeroom, 'blue') : '—' },
          { key: 'classes', label: '所带班级' },
          { key: 'status', label: '状态', render: (r) => UI.badge(r.status, 'green') }
        ],
        rows: list
      })}</div>`;
  }

  App.actions.openAddGrade = function () {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    const schoolId = App.state.basicSchoolId;
    UI.modal({
      title: '新增年级',
      sub: `${App.schoolName(schoolId)} · 新增后可导入学生名单并保存版本`,
      body: `<div class="form-grid">
        <div class="field"><label class="field-label">实际年级名称 *</label><input class="input" id="gradeName" placeholder="如：2027届高三" /></div>
        <div class="field"><label class="field-label">学段 *</label><select class="select" id="gradeStage"><option>高中</option><option>初中</option></select></div>
        <div class="field"><label class="field-label">年级层次 *</label><select class="select" id="gradeLevel"><option>高三</option><option>高二</option><option>高一</option><option>初三</option><option>初二</option><option>初一</option></select></div>
        <div class="field"><label class="field-label">入学年份 *</label><input class="input" id="gradeYear" type="number" value="2024" /></div>
      </div>
      <div class="alert info mt-16">${UI.icon('alert')}<div>新增年级会生成“当前编辑稿”，需导入学生/教师/任课，并在更新时生成版本后才能被考试引用。</div></div>`,
      footer: `<button class="btn" data-action="closeModal">取消</button><button class="btn btn-primary" data-action="saveGrade">保存</button>`
    });
  };
  App.actions.saveGrade = function () {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    const name = (document.getElementById('gradeName') || {}).value || '';
    if (!name.trim()) { UI.toast('请填写实际年级名称', 'error'); return; }
    const id = 'G' + (window.MOCK.grades.length + 1);
    window.MOCK.grades.push({
      id, schoolId: App.state.basicSchoolId, name: name.trim(),
      stage: (document.getElementById('gradeStage') || {}).value || '高中',
      gradeLevel: (document.getElementById('gradeLevel') || {}).value || '高三',
      entryYear: Number((document.getElementById('gradeYear') || {}).value || 2024),
      status: '在读', dirty: true
    });
    UI.closeModal(); UI.toast('年级已新增，请导入学生名单并生成版本'); App.render();
  };

  App.actions.setBasicTab = function (el) { App.state.basicTab = el.dataset.value; App.render(); };
  App.actions.openBasicSchool = function (el) { App.state.basicSchoolId = el.dataset.id; App.state.selectedGradeId = ''; App.state.basicTab = 'grades'; App.render(); };
  App.actions.backBasicSchools = function () { App.state.basicSchoolId = ''; App.state.selectedGradeId = ''; App.state.basicTab = 'grades'; App.render(); };
  App.actions.openGrade = function (el) { App.state.selectedGradeId = el.dataset.id; App.render(); };
  App.actions.backGrades = function () { App.state.selectedGradeId = ''; App.render(); };
  App.actions.goBasicImport = function (el) {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    const gradeId = el.dataset.id || App.state.selectedGradeId;
    if (!gradeId) { UI.toast('请先进入具体年级再导入', 'warn'); return; }
    const b = bimp();
    b.step = 1; b.fileIds = []; b.accepted = {}; b.stage = 0; b.running = false; b.done = false;
    b.gradeId = gradeId;
    App.navigate('/basic/import');
  };

  App.actions.openClass = function (el) {
    const c = App.classDef(el.dataset.id);
    const students = App.studentsOfClass(c.id);
    const subjects = (window.MOCK.constants.STAGE_SUBJECTS[App.grade(c.gradeId).stage] || []);
    const teachers = subjects.map((s) => ({ subject: s, name: (App.teacher(window.MOCK.helpers.teacherFor(c.schoolId, c.id, s)) || {}).name || '—' }));
    UI.modal({
      title: c.name,
      sub: `${App.schoolName(c.schoolId)} · ${App.gradeName(c.gradeId)} · ${students.length} 名学生`,
      wide: true,
      body: `<div class="grid grid-2 mb-16">
        <div class="card"><div class="card-body">${UI.kv([['班主任', (App.teacher(c.homeroomTeacherId) || {}).name || '—'], ['班级人数', students.length + ' 人'], ['实际年级', App.gradeName(c.gradeId)], ['所属学校', App.schoolName(c.schoolId)]])}</div></div>
        <div class="card"><div class="card-body"><div class="card-title mb-8" style="font-size:13px">科任老师</div><div class="chips">${teachers.map((t) => `<span class="badge badge-gray">${t.subject} · ${t.name}</span>`).join('')}</div></div></div>
      </div>
      <div class="card-title mb-8">学生名单</div>
      ${UI.table({
        columns: [
          { key: 'studentNo', label: '学号', render: (r) => `<span class="code">${r.studentNo}</span>` },
          { key: 'name', label: '姓名' },
          { key: 'gender', label: '性别', align: 'center' },
          { key: 'selection', label: '选科' },
          { key: 'firstSubject', label: '首选' },
          { key: 'second', label: '再选', render: (r) => (r.secondSubjects || []).join(' + ') },
          { key: 'status', label: '状态', render: (r) => UI.badge(r.status, r.status === '在读' ? 'green' : 'amber') }
        ],
        rows: students
      })}`,
      footer: `<button class="btn" data-action="closeModal">关闭</button>`
    });
  };

  App.actions.openSaveVersion = function (el) {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    UI.modal({
      title: '保存版本', sub: '保存后生成只读快照，旧版本转为停用',
      body: `<div class="field mb-12"><label class="field-label">版本名称 *</label><input class="input" id="verName" placeholder="如：期中调整后" /></div><div class="field"><label class="field-label">变更说明 *</label><textarea class="textarea" id="verNote"></textarea></div>`,
      footer: `<button class="btn" data-action="closeModal">取消</button><button class="btn btn-primary" data-action="saveVersion" data-id="${el.dataset.id}">保存</button>`
    });
  };
  App.actions.saveVersion = function (el) {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    const name = (document.getElementById('verName') || {}).value || '';
    if (!name.trim()) { UI.toast('请填写版本名称', 'error'); return; }
    const gradeId = el.dataset.id;
    const g = App.grade(gradeId);
    const versions = App.versionsOf(gradeId);
    versions.forEach((v) => { v.current = false; if (v.status === '已保存') v.status = '已停用'; });
    const id = App.nextVersionId();
    const ver = { id, schoolId: g.schoolId, gradeId, name: name.trim(), status: '已保存', date: '2026-10-23', publisher: App.state.userName || '运营管理员', note: (document.getElementById('verNote') || {}).value || '—', current: true, source: '手动保存' };
    ver.snapshot = window.MOCK.helpers.snapshotFor(ver);
    window.MOCK.versions.push(ver);
    g.dirty = false;
    UI.closeModal(); UI.toast('版本已保存，当前编辑稿已固定'); App.render();
  };

  App.actions.deleteVersion = function (el) {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    const v = window.MOCK.versions.find((x) => x.id === el.dataset.id);
    if (!v) return;
    if (v.current) { UI.toast('当前版本不可删除，请先保存新版本', 'warn'); return; }
    const refs = versionRefs(v);
    if (refs.length) { UI.toast('该版本已被考试或评价任务引用，不可删除', 'error'); return; }
    UI.modal({
      title: '删除版本',
      body: `<div class="small">确认删除版本 <b>${v.id} · ${App.esc(v.name)}</b>？<br><br>删除后该历史快照不可恢复；当前数据不受影响。</div>`,
      footer: `<button class="btn" data-action="closeModal">取消</button><button class="btn btn-danger" data-action="confirmDeleteVersion" data-id="${v.id}">确认删除</button>`
    });
  };

  App.actions.confirmDeleteVersion = function (el) {
    const id = el.dataset.id;
    const i = window.MOCK.versions.findIndex((x) => x.id === id);
    if (i < 0) { UI.closeModal(); return; }
    const v = window.MOCK.versions[i];
    if (v.current || versionRefs(v).length) { UI.closeModal(); UI.toast('该版本不可删除', 'error'); return; }
    window.MOCK.versions.splice(i, 1);
    UI.closeModal(); UI.toast('版本已删除'); App.render();
  };

  /* ================= 基础数据导入 ================= */
  const BM = window.BASIC_IMPORT_MOCK;
  function bimp() {
    if (!App.state.basicImport) {
      const sid = App.state.basicSchoolId || App.state.schoolId;
      App.state.basicImport = { step: 1, gradeId: (App.gradesOf(sid)[0] || {}).id || '', fileIds: [], accepted: {}, stage: 0, running: false, done: false };
    }
    return App.state.basicImport;
  }

  function basicImportPage() {
    if (!App.canEdit()) return `<div class="page">${UI.empty('学校管理员为只读角色，不能导入基础数据')}</div>`;
    const b = bimp();
    return `<div class="page">
      <div class="page-head">
        <div><div class="breadcrumb"><span>管理</span><span class="sep">/</span><span>基础数据</span><span class="sep">/</span><span>导入更新</span></div><h1 class="page-title">导入更新基础数据</h1><div class="page-desc">学生名单 / 教师名单 / 任课安排 → AI 解析 → 差异确认 → 更新编辑稿</div></div>
        <div class="page-actions"><button class="btn" data-action="resetBasicImport">${UI.icon('refresh')}重新开始</button></div>
      </div>
      ${stepper(b.step)}
      ${b.step === 1 ? bimpUpload(b) : b.step === 2 ? bimpParsing(b) : b.step === 3 ? bimpDiff(b) : bimpDone(b)}
    </div>`;
  }

  function stepper(step) {
    const items = ['选择年级', '上传解析', '差异确认', '更新完成'];
    return `<div class="stepper">${items.map((label, i) => `<div class="step ${i + 1 === step ? 'active' : i + 1 < step ? 'done' : ''}"><span class="step-num">${i + 1 < step ? '✓' : i + 1}</span><span>${label}</span></div>${i < items.length - 1 ? '<span class="step-line"></span>' : ''}`).join('')}</div>`;
  }

  function bimpUpload(b) {
    const grades = App.gradesOf(App.state.basicSchoolId || App.state.schoolId);
    return `<div class="grid grid-main"><div class="card">
      <div class="card-head"><div><div class="card-title"><span class="dot"></span>第一步：选择年级并上传文档</div><div class="card-sub">只支持学生名单/教师名单/任课安排；Excel / CSV</div></div></div>
      <div class="card-body">
        <div class="field mb-16" style="max-width:340px"><label class="field-label">目标实际年级</label><select class="select" onchange="App.setBasicImportGrade(this.value)">${grades.map((g) => `<option value="${g.id}" ${b.gradeId === g.id ? 'selected' : ''}>${App.schoolName(g.schoolId)} · ${g.name}</option>`).join('')}</select></div>
        <div class="upload-zone"><div class="upload-icon">${UI.icon('upload')}</div><div class="upload-title">拖拽文档到这里，或选择文件</div><div class="upload-desc">学生名单、教师名单、任课安排可多选；不需要模板</div></div>
        <div class="file-grid mt-16">${BM.FILES.map((f) => `<div class="file-card ${b.fileIds.includes(f.id) ? 'active' : ''}" data-action="toggleBasicFile" data-id="${f.id}"><div class="file-icon ${f.type === '教师名单' ? 'csv' : ''}">${f.type === '教师名单' ? 'CSV' : 'XLS'}</div><div class="file-name">${App.esc(f.name)}</div><div class="file-meta">${f.type} · ${f.size}</div><div class="file-desc">${App.esc(f.desc)}</div></div>`).join('')}</div>
        <div class="flex items-center justify-between mt-16"><div class="small muted">${b.fileIds.length ? `已选择 ${b.fileIds.length} 份文档` : '请选择文档'}</div><button class="btn btn-primary" data-action="startBasicParse" ${b.fileIds.length ? '' : 'disabled'}>开始 AI 解析 →</button></div>
      </div>
    </div><div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>规则</div></div></div><div class="card-body small" style="display:flex;flex-direction:column;gap:9px">
      <div>· 基础数据不提供独立新增/删除入口</div><div>· 新增/缺失/变更都在差异确认中处理</div><div>· 更新前默认把新数据存为新版本</div><div>· 取消“存为新版本”会覆盖当前版本，需二次确认</div>
    </div></div></div>`;
  }

  App.setBasicImportGrade = function (id) { bimp().gradeId = id; };
  App.actions.toggleBasicFile = function (el) { const b = bimp(); const i = b.fileIds.indexOf(el.dataset.id); if (i >= 0) b.fileIds.splice(i, 1); else b.fileIds.push(el.dataset.id); App.render(); };
  App.actions.startBasicParse = function () {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    const b = bimp();
    if (!b.fileIds.length) return;
    b.step = 2; b.stage = 0; b.running = true; b.done = false; App.render();
    const tick = () => {
      if (b.step !== 2) return;
      b.stage += 1;
      if (b.stage >= 4) { b.stage = 4; b.running = false; b.done = true; App.render(); setTimeout(() => { if (b.step === 2) { b.step = 3; App.render(); } }, 700); return; }
      App.render(); setTimeout(tick, 700);
    };
    setTimeout(tick, 700);
  };

  function bimpParsing(b) {
    const stages = ['识别文档类型', '提取学生/教师/任课字段', '匹配学校与年级', '生成差异清单'];
    const pct = Math.round((b.stage / 4) * 100);
    return `<div class="grid grid-main"><div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>第二步：AI 解析</div></div><span class="badge ${b.done ? 'badge-green' : 'badge-blue'}">${b.done ? '解析完成' : '解析中'}</span></div><div class="card-body"><div class="progress-label"><span>${b.done ? '解析完成' : stages[Math.min(b.stage, 3)]}</span><span>${pct}%</span></div>${UI.progress(pct, true)}<div class="parse-stages mt-16">${stages.map((s, i) => `<div class="parse-stage ${i < b.stage || b.done ? 'done' : i === b.stage ? 'active' : ''}"><span class="tick">${i < b.stage || b.done ? '✓' : i + 1}</span><span>${s}</span><span class="stage-meta">${i < b.stage || b.done ? '完成' : i === b.stage ? '进行中' : '等待'}</span></div>`).join('')}</div></div></div><div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>解析统计</div></div></div><div class="card-body">${UI.kv([['文档数', b.fileIds.length], ['学生', '120 人'], ['教师', '14 人'], ['差异', '7 项'], ['平均置信度', '94%']])}</div></div></div>`;
  }

  function bimpDiff(b) {
    const accepted = b.accepted || {};
    const left = BM.DIFFS.filter((d) => d.level === 'block' && !accepted[d.id]).length;
    return `<div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>第三步：差异确认</div><div class="card-sub">阻断项清零后更新；更新前确认是否存为新版本</div></div><span class="badge ${left ? 'badge-red' : 'badge-green'}">${left ? left + ' 项阻断' : '阻断已清零'}</span></div><div class="card-body">
      <div class="grid grid-2 mb-16"><div class="card"><div class="card-head"><div><div class="card-title" style="font-size:13px">学生名单预览</div></div></div>${UI.table({ columns: [ { key: 'no', label: '学号', render: (r) => `<span class="code">${r.no}</span>` }, { key: 'name', label: '姓名', render: (r) => r.conf < 0.8 ? `<input class="cell-input" value="${App.esc(r.name)}" onchange="App.editBasicCell('${r.no}','name',this.value)" />` : App.esc(r.name) }, { key: 'className', label: '班级' }, { key: 'selection', label: '选科' } ], rows: BM.STUDENT_ROWS })}</div><div class="card"><div class="card-head"><div><div class="card-title" style="font-size:13px">差异清单</div></div></div><div class="card-body" style="max-height:320px;overflow:auto"><div class="diff-list">${BM.DIFFS.map((d) => { const done = !!accepted[d.id]; return `<div class="diff-item ${done ? 'done' : ''}"><span class="diff-level ${d.level}">${d.level === 'block' ? '阻断' : d.level === 'confirm' ? '待确认' : '提示'}</span><div class="diff-main"><div class="diff-title">${App.esc(d.category)} · ${App.esc(d.title)}</div><div class="diff-desc">${App.esc(d.desc)}</div><div class="diff-suggest">建议：${App.esc(d.suggestion)}</div></div><div class="diff-actions">${done ? '<span class="badge badge-green">已处理</span>' : `<button class="btn btn-xs btn-primary" data-action="resolveBasicDiff" data-id="${d.id}">${d.level === 'block' ? '处理' : '接受'}</button>`}</div></div>`; }).join('')}</div></div></div></div>
      <div class="flex items-center justify-between"><div class="small">${left ? `还有 ${left} 项阻断未处理` : '可以更新当前编辑稿'}</div><div class="flex gap-8"><button class="btn" data-action="resetBasicImport">取消</button><button class="btn btn-primary" data-action="applyBasicImport" ${left ? 'disabled' : ''}>更新当前编辑稿</button></div></div>
    </div></div>`;
  }

  App.actions.resolveBasicDiff = function (el) { bimp().accepted[el.dataset.id] = true; App.render(); };
  App.editBasicCell = function (no, field, value) {
    const row = BM.STUDENT_ROWS.find((r) => r.no === no);
    if (!row) return;
    row[field] = value; row.conf = 0.99; UI.toast('已修正，置信度更新'); App.render();
  };
  App.actions.resetBasicImport = function () { App.state.basicImport = { step: 1, gradeId: App.state.selectedGradeId || '', fileIds: [], accepted: {}, stage: 0, running: false, done: false }; App.render(); };
  App.actions.applyBasicImport = function () {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    const b = bimp();
    const left = BM.DIFFS.filter((d) => d.level === 'block' && !(b.accepted || {})[d.id]).length;
    if (left) { UI.toast('仍有阻断项未处理', 'error'); return; }
    const g = App.grade(b.gradeId);
    if (!g) { UI.toast('未找到目标年级', 'error'); return; }
    const current = App.currentVersionOf(g.id);
    const currentRefs = current ? versionRefs(current) : [];
    const canOverwrite = !!current && !currentRefs.length;
    const note = !current
      ? '当前编辑稿还没有已保存版本，本次更新必须生成新版本。'
      : currentRefs.length
        ? `当前版本 <b>${current.id} · ${App.esc(current.name)}</b> 已被 ${currentRefs.length} 个考试/评价任务引用，必须存为新版本。`
        : `取消勾选将直接覆盖当前版本 <b>${current.id} · ${App.esc(current.name)}</b>，覆盖后不可恢复。`;
    UI.modal({
      title: '更新基础数据',
      sub: `${g.name} · 请选择本次更新的版本处理方式`,
      body: `<div class="field mb-12"><label class="field-label">版本名称</label><input class="input" id="basicVersionName" value="${App.esc(g.name + ' 更新 ' + new Date().toLocaleDateString('zh-CN'))}" /></div>
        <div class="field mb-12"><label class="field-label">变更说明</label><textarea class="textarea" id="basicVersionNote" placeholder="简述本次导入的变更"></textarea></div>
        <label class="flex items-center gap-8" style="cursor:pointer"><input type="checkbox" id="saveAsNewVersion" checked ${canOverwrite ? '' : 'disabled'} /> <b>存为新版本</b>${canOverwrite ? '' : '<span class="badge badge-amber">当前版本不可覆盖</span>'}</label>
        <div class="alert ${canOverwrite ? 'info' : 'warn'} mt-16">${UI.icon('alert')}<div>${note}</div></div>`,
      footer: `<button class="btn" data-action="closeModal">取消</button><button class="btn btn-primary" data-action="confirmBasicImport">确认更新</button>`
    });
  };

  App.actions.confirmBasicImport = function () {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    const b = bimp();
    const g = App.grade(b.gradeId);
    const current = g ? App.currentVersionOf(g.id) : null;
    const saveNew = (document.getElementById('saveAsNewVersion') || {}).checked !== false;
    if (!saveNew && current && versionRefs(current).length) { UI.toast('当前版本已被引用，不能覆盖，请存为新版本', 'error'); return; }
    const versionName = (document.getElementById('basicVersionName') || {}).value || (g ? g.name + ' 更新' : '基础数据更新');
    const versionNote = (document.getElementById('basicVersionNote') || {}).value || '';
    if (!saveNew && current) {
      UI.closeModal();
      UI.modal({
        title: '确认覆盖当前版本',
        body: `<div class="small">本次更新将直接覆盖当前版本 <b>${current.id} · ${App.esc(current.name)}</b>。<br><br>覆盖后原版本内容不可恢复，是否继续？</div>`,
        footer: `<button class="btn" data-action="closeModal">取消</button><button class="btn btn-danger" data-action="forceBasicImportOverwrite" data-name="${App.esc(versionName)}" data-note="${App.esc(versionNote)}">确认覆盖</button>`
      });
      return;
    }
    UI.closeModal();
    performBasicImport(saveNew, versionName, versionNote);
  };

  App.actions.forceBasicImportOverwrite = function (el) {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    UI.closeModal();
    const b = bimp();
    const g = App.grade(b.gradeId);
    const current = g ? App.currentVersionOf(g.id) : null;
    if (current && versionRefs(current).length) { UI.toast('当前版本已被引用，不能覆盖', 'error'); return; }
    performBasicImport(false, el.dataset.name || '', el.dataset.note || '');
  };

  function performBasicImport(saveNew, versionName, versionNote) {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    const b = bimp();
    const left = BM.DIFFS.filter((d) => d.level === 'block' && !(b.accepted || {})[d.id]).length;
    if (left) { UI.toast('仍有阻断项未处理', 'error'); return; }
    const g = App.grade(b.gradeId);
    if (!g) { UI.toast('未找到目标年级', 'error'); return; }
    const schoolId = g.schoolId;
    const gradeId = g.id;

    function findOrCreateClass(name) {
      let cls = window.MOCK.classes.find((c) => c.schoolId === schoolId && c.gradeId === gradeId && c.name === name);
      if (!cls) {
        cls = { id: 'C' + (window.MOCK.classes.length + 1), schoolId, gradeId, name, size: 0, homeroomTeacherId: '' };
        window.MOCK.classes.push(cls);
      }
      return cls;
    }

    // 班级/选科变更
    BM.STUDENT_UPDATES.forEach((u) => {
      const stu = window.MOCK.students.find((s) => s.studentNo === u.no && s.gradeId === gradeId);
      if (!stu) return;
      const cls = findOrCreateClass(u.className);
      stu.classId = cls.id;
      stu.className = cls.name;
      if (u.selection) {
        stu.selection = u.selection;
        stu.firstSubject = u.selection === '历史类' ? '历史' : '物理';
        stu.subjects = ['语文', '数学', stu.language || '英语', stu.firstSubject, ...(stu.secondSubjects || ['化学', '生物'])];
      }
    });

    // 缺失学生：标记转出，保留历史
    const missing = window.MOCK.students.find((s) => s.gradeId === gradeId && (s.studentNo === BM.MISSING_STUDENT.no || s.name === BM.MISSING_STUDENT.name));
    if (missing) missing.status = '转出';

    // 新增学生
    BM.STUDENT_ROWS.filter((r) => ['2026201', '2026202'].includes(r.no)).forEach((r) => {
      if (window.MOCK.students.find((s) => s.studentNo === r.no)) return;
      const cls = findOrCreateClass(r.className);
      window.MOCK.students.push({
        id: 'IMP' + r.no, schoolId, gradeId, studentNo: r.no, name: r.name, gender: '男',
        classId: cls.id, className: cls.name, selection: r.selection,
        firstSubject: r.selection === '历史类' ? '历史' : '物理', secondSubjects: ['化学', '生物'],
        language: '英语',
        subjects: ['语文', '数学', '英语', r.selection === '历史类' ? '历史' : '物理', '化学', '生物'],
        status: '在读', overall: 0, affinity: {}, classByExam: {}, homeroomTeacherId: cls.homeroomTeacherId || ''
      });
    });

    // 新增教师
    BM.TEACHER_ROWS.forEach((t) => {
      if (window.MOCK.teachers.find((x) => x.name === t.name || x.employeeNo === t.no)) return;
      window.MOCK.teachers.push({
        id: t.no, schoolId, name: t.name, subject: t.subject, homeroomClassId: null,
        employeeNo: t.no, status: '在职'
      });
    });

    // 任课变更
    BM.ASSIGNMENT_ROWS.forEach((a) => {
      const cls = findOrCreateClass(a.className);
      const teacher = window.MOCK.teachers.find((t) => t.schoolId === schoolId && t.name === a.teacherName);
      if (!teacher) return;
      const hit = window.MOCK.assignments.find((x) => x.classId === cls.id && x.subject === a.subject && x.main);
      if (hit) hit.teacherId = teacher.id;
      else window.MOCK.assignments.push({ id: 'A' + (window.MOCK.assignments.length + 1), schoolId, classId: cls.id, subject: a.subject, teacherId: teacher.id, main: true });
    });

    // 同步班级人数
    window.MOCK.classes.filter((c) => c.gradeId === gradeId).forEach((c) => {
      c.size = window.MOCK.students.filter((s) => s.classId === c.id && s.status === '在读').length;
    });

    const current = App.currentVersionOf(g.id);
    if (saveNew || !current) {
      const versions = App.versionsOf(g.id);
      versions.forEach((v) => { v.current = false; if (v.status === '已保存') v.status = '已停用'; });
      const id = App.nextVersionId();
      const ver = { id, schoolId: g.schoolId, gradeId: g.id, name: versionName || (g.name + ' 更新'), status: '已保存', date: '2026-10-23', publisher: App.state.userName || '运营管理员', note: versionNote || '基础数据导入更新', current: true, source: '导入生成' };
      ver.snapshot = window.MOCK.helpers.snapshotFor(ver);
      window.MOCK.versions.push(ver);
      b.result = { mode: 'new', id: ver.id, name: ver.name };
    } else {
      current.snapshot = window.MOCK.helpers.snapshotFor(current);
      current.date = '2026-10-23';
      current.publisher = App.state.userName || '运营管理员';
      current.note = versionNote || '基础数据导入覆盖';
      current.source = '覆盖';
      b.result = { mode: 'overwrite', id: current.id, name: current.name };
    }
    g.dirty = false;
    b.step = 4; App.render();
  };

  function bimpDone(b) {
    const g = App.grade(b.gradeId);
    const r = b.result || {};
    const msg = r.mode === 'new'
      ? `已更新并生成新版本 <b>${r.id} · ${App.esc(r.name || '')}</b>，旧版本保留。`
      : `已更新并覆盖当前版本 <b>${r.id} · ${App.esc(r.name || '')}</b>，覆盖后不可恢复。`;
    return `<div class="card" style="max-width:760px;margin:0 auto"><div class="card-body" style="text-align:center;padding:40px 24px">
      <div style="width:62px;height:62px;border-radius:50%;background:#ecfdf5;color:#10b981;display:grid;place-items:center;margin:0 auto 14px">${UI.icon('check')}</div>
      <div style="font-size:20px;font-weight:700">基础数据已更新</div>
      <div class="muted small mt-8">${App.esc(g ? g.name : '')} · ${msg}</div>
      <div class="flex gap-8 mt-16" style="justify-content:center"><button class="btn" data-action="backToGrade" data-id="${b.gradeId}">返回年级</button><button class="btn btn-primary" data-action="backToGrade" data-id="${b.gradeId}">查看版本</button></div>
    </div></div>`;
  }
  App.actions.backToGrade = function (el) { App.state.selectedGradeId = el.dataset.id; App.state.basicTab = 'grades'; App.navigate('/basic'); };
  App.actions.backToGradeAndSave = function (el) { App.actions.backToGrade(el); };
})();

