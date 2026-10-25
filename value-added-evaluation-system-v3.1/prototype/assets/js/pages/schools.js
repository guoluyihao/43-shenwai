/* 学校管理 */
(function () {
  'use strict';
  const App = window.App;
  const UI = window.UI;

  App.pages.schools = function () {
    if (!App.canEdit()) return `<div class="page">${UI.empty('学校管理仅对运营管理员开放')}</div>`;
    const rows = window.MOCK.schools.map((s) => {
      const grades = window.MOCK.grades.filter((g) => g.schoolId === s.id);
      const classes = window.MOCK.classes.filter((c) => c.schoolId === s.id);
      const students = window.MOCK.students.filter((x) => x.schoolId === s.id);
      const exams = window.MOCK.exams.filter((e) => e.schools.includes(s.id));
      return { ...s, gradeCount: grades.length, classCount: classes.length, studentCount: students.length, examCount: exams.length };
    });
    return `<div class="page">
      <div class="page-head">
        <div>
          <div class="breadcrumb"><span>管理</span><span class="sep">/</span><span>学校管理</span></div>
          <h1 class="page-title">学校管理</h1>
          <div class="page-desc">学校是基础数据与联考的参与单位</div>
        </div>
        <div class="page-actions"><button class="btn btn-primary" data-action="openAddSchool">${UI.icon('plus')}新增学校</button></div>
      </div>
      <div class="card">
        <div class="card-head"><div><div class="card-title"><span class="dot"></span>学校列表</div><div class="card-sub">停用后该校管理员无法登录，数据保留</div></div></div>
        ${UI.table({
          columns: [
            { key: 'name', label: '学校', render: (r) => `<div class="strong">${App.esc(r.name)}</div><div class="sub">${App.esc(r.city)} · ${App.esc(r.code)}</div>` },
            { key: 'admin', label: '管理员账号', render: (r) => `<span class="code">${App.esc(r.admin)}</span>` },
            { key: 'gradeCount', label: '年级', align: 'num' },
            { key: 'classCount', label: '班级', align: 'num' },
            { key: 'studentCount', label: '学生', align: 'num' },
            { key: 'examCount', label: '联考', align: 'num' },
            { key: 'enabled', label: '状态', render: (r) => UI.badge(r.enabled ? '启用' : '停用', r.enabled ? 'green' : 'gray') },
            { key: 'ops', label: '操作', render: (r) => `<div class="flex gap-6"><button class="btn btn-xs" data-action="toggleSchool" data-id="${r.id}">${r.enabled ? '停用' : '启用'}</button><button class="btn btn-xs btn-danger" data-action="resetSchoolPwd" data-id="${r.id}">重置密码</button></div>` }
          ],
          rows
        })}
      </div>
    </div>`;
  };

  App.actions.openAddSchool = function () {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    UI.modal({
      title: '新增学校', sub: '初始管理员密码为 123456',
      body: `<div class="form-grid">
        <div class="field"><label class="field-label">学校名称 *</label><input class="input" id="schoolName" /></div>
        <div class="field"><label class="field-label">学校编码 *</label><input class="input" id="schoolCode" /></div>
        <div class="field"><label class="field-label">管理员账号 *</label><input class="input" id="schoolAdmin" /></div>
        <div class="field"><label class="field-label">城市</label><input class="input" id="schoolCity" /></div>
      </div>`,
      footer: `<button class="btn" data-action="closeModal">取消</button><button class="btn btn-primary" data-action="saveSchool">创建</button>`
    });
  };
  App.actions.saveSchool = function () {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    const name = (document.getElementById('schoolName') || {}).value || '';
    const code = (document.getElementById('schoolCode') || {}).value || '';
    const admin = (document.getElementById('schoolAdmin') || {}).value || '';
    if (!name.trim() || !code.trim() || !admin.trim()) { UI.toast('请填写学校名称、编码、管理员账号', 'error'); return; }
    const id = 'S' + String(window.MOCK.schools.length + 1).padStart(2, '0');
    window.MOCK.schools.push({ id, name: name.trim(), code: code.trim().toUpperCase(), admin: admin.trim(), enabled: true, city: (document.getElementById('schoolCity') || {}).value || '—' });
    UI.closeModal(); UI.toast('学校创建成功'); App.render();
  };
  App.actions.toggleSchool = function (el) {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    const s = window.MOCK.schools.find((x) => x.id === el.dataset.id);
    s.enabled = !s.enabled;
    UI.toast(`已${s.enabled ? '启用' : '停用'} ${s.name}`, s.enabled ? 'success' : 'warn');
    App.render();
  };
  App.actions.resetSchoolPwd = function (el) {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    const s = window.MOCK.schools.find((x) => x.id === el.dataset.id);
    UI.modal({
      title: '重置密码',
      body: `<div class="small">确认将 <b>${App.esc(s.name)}</b> 的管理员密码重置为 <span class="code">123456</span>？</div>`,
      footer: `<button class="btn" data-action="closeModal">取消</button><button class="btn btn-primary" data-action="confirmResetPwd">确认</button>`
    });
  };
  App.actions.confirmResetPwd = function () { if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; } UI.closeModal(); UI.toast('密码已重置为 123456'); };
})();

