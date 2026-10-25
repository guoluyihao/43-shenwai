/* 评价任务：列表 / 配置 / 匹配 / 算法 / 四类结果 */
(function () {
  'use strict';
  const App = window.App;
  const UI = window.UI;

  function nextTaskId() {
    const max = (window.MOCK.tasks || []).reduce((m, t) => Math.max(m, parseInt(String(t.id).replace(/\D/g, ''), 10) || 0), 0);
    return 'T' + (max + 1);
  }

  function loadTaskIntoWizard(id) {
    const t = window.MOCK.tasks.find((x) => x.id === id);
    if (!t) return;
    const w = App.state.evalWizard;
    w.taskId = t.id;
    w.config = {
      name: t.name,
      entryExamId: t.entryExamId,
      exitExamId: t.exitExamId,
      schools: (t.schools || []).slice(),
      singleSide: (t.singleSide || []).slice(),
      schoolVersions: Object.assign({}, t.schoolVersions || {}),
      scope: t.scope || '',
      baseDefault: t.baseDefault || 'raw',
      overrides: Object.assign({}, t.baseOverrides || t.overrides || {})
    };
    w.algorithm = t.algorithm || 'standard';
    w.gradeCount = 9;
    w.keepThreshold = t.keepThreshold == null ? App.settings.keepThreshold : t.keepThreshold;
    w.stepSize = t.stepSize == null ? App.settings.stepSize : t.stepSize;
    w.smallSample = t.smallSample || App.settings.smallSample;
    w.excludePartialAbsent = t.excludePartialAbsent !== false;
  }

  function matchItemsFor(w) {
    const s = window.MOCK.helpers.matchStats(w.config.entryExamId, w.config.exitExamId);
    const example = (list, count) => list.slice(0, count).map((x) => `${x.name}（${x.className}）`).join('、');
    const items = [];

    if (s.entryOnly.length) {
      items.push({
        id: 'M-entry-only', level: 'confirm', type: '仅入口',
        title: `${s.entryOnly.length} 名学生仅在高二期末出现`,
        desc: `示例：${example(s.entryOnly, 3)}；这些学生未进入当前高三名册，无法配对。`,
        suggestion: '剔除，不参与本次计算'
      });
    }
    if (s.exitOnly.length) {
      items.push({
        id: 'M-exit-only', level: 'confirm', type: '仅评价',
        title: `${s.exitOnly.length} 名学生仅在高三月考出现`,
        desc: `示例：${example(s.exitOnly, 3)}；这些学生没有高二期末成绩。`,
        suggestion: '剔除，不参与本次计算'
      });
    }
    const incompleteOther = s.incomplete.length - s.languageChanged.length;
    if (incompleteOther > 0) {
      items.push({
        id: 'M-incomplete', level: 'confirm', type: '成绩不完整',
        title: `${incompleteOther} 名学生两场未满六科`,
        desc: `包含缺考或缺科；示例：${example(s.incomplete.filter((x) => !s.languageChanged.some((y) => y.id === x.id)), 3)}。`,
        suggestion: '剔除，不参与本次计算'
      });
    }
    if (s.languageChanged.length) {
      items.push({
        id: 'M-language', level: 'confirm', type: '外语科目变更',
        title: `${s.languageChanged.length} 名学生两场外语语种不同`,
        desc: s.languageChanged.map((x) => `${x.name}：${x.from} → ${x.to}`).join('；'),
        suggestion: '剔除，不参与本次计算'
      });
    }
    if (s.classChanged.length) {
      items.push({
        id: 'M-class-change', level: 'hint', type: '班级变更',
        title: `${s.classChanged.length} 名学生两场班级不同`,
        desc: `示例：${example(s.classChanged, 3)}；结果按评价考试班级归属。`,
        suggestion: '按高三当前班级归属'
      });
    }
    if (s.missingTeacher) {
      items.push({
        id: 'M-teacher-missing', level: 'confirm', type: '教师任课缺失',
        title: `${s.missingTeacher} 条成绩未匹配到科任教师`,
        desc: '主要涉及理工高中政治、博雅高中生物；这些学生不进入教师结果。',
        suggestion: '接受；教师结果仅统计匹配到教师的成绩'
      });
    }
    if (s.assignedMissingAll) {
      items.push({
        id: 'M-assigned-missing', level: 'hint', type: '赋分缺失',
        title: `${s.assignedMissingAll} 条不完整成绩缺赋分`,
        desc: '完整样本赋分齐全；不完整学生已在总分中剔除。',
        suggestion: '不完整学生不参与计算'
      });
    }
    if (s.singleSide.length) {
      items.push({
        id: 'M-single-school', level: 'confirm', type: '学校单边',
        title: `${s.singleSide.length} 所学校只参加一场考试`,
        desc: s.singleSide.map((sid) => App.schoolName(sid)).join('、'),
        suggestion: '剔除单边学校，只计算共同参与学校'
      });
    } else {
      items.push({
        id: 'M-schools', level: 'hint', type: '学校参与检查',
        title: '4 所学校均参加两场考试',
        desc: '未发现学校单边参与。',
        suggestion: '检查通过'
      });
    }
    items.push({
      id: 'M-version', level: 'hint', type: '版本对齐',
      title: '入口 V1 高二期末快照，评价 V2 高三当前版本',
      desc: '入口/评价按历史快照与当前版本对齐，不作为版本冲突处理。',
      suggestion: '按当前版本归属班级与教师'
    });
    items.push({
      id: 'M-success', level: 'hint', type: '匹配成功',
      title: `${s.complete} 名学生两场六科完整，可进入计算`,
      desc: `入口 ${s.entryCount} 人、评价 ${s.exitCount} 人、两场都有 ${s.both} 人。`,
      suggestion: '继续算法配置'
    });
    return items;
  }

  App.pages.evaluations = function (parts) {
    if (parts && parts[1] === 'new') {
      if (!App.canEdit()) return `<div class="page">${UI.empty('学校管理员为只读角色，不能配置或计算评价任务')}</div>`;
      if (parts[2] === 'config') return evalConfig();
      if (parts[2] === 'match') return evalMatch();
      if (parts[2] === 'algorithm') return evalAlgorithm();
      return evalConfig();
    }
    if (parts && parts[2] === 'process') return evalProcess(parts[1]);
    if (parts && parts[2] === 'results') return evalResults(parts[1]);
    if (parts && parts[2] === 'reports') return App.reportPages ? App.reportPages(parts) : `<div class="page">${UI.empty('报告页未加载')}</div>`;
    return evalList();
  };

  function evalList() {
    const all = window.MOCK.tasks.filter((t) => App.canEdit() || t.schools.includes(App.state.schoolId));
    return `<div class="page">
      <div class="page-head">
        <div><div class="breadcrumb"><span>管理</span><span class="sep">/</span><span>评价任务</span></div><h1 class="page-title">评价任务</h1><div class="page-desc">选择入口/评价考试，按校选版本，计算后查看四类结果</div></div>
        <div class="page-actions">${App.canEdit() ? `<button class="btn btn-primary" data-action="newEvaluation">${UI.icon('plus')}新建评价任务</button>` : ''}</div>
      </div>
      <div class="card">
        <div class="card-head"><div><div class="card-title"><span class="dot"></span>任务列表</div><div class="card-sub">结果只能从任务进入</div></div></div>
        ${UI.table({
          columns: [
            { key: 'name', label: '任务', render: (r) => `<div class="strong">${App.esc(r.name)}</div><div class="sub">${r.schools.map((s) => App.schoolName(s)).join('、')}</div>` },
            { key: 'exams', label: '入口 → 评价', render: (r) => `<span class="small">${App.esc((window.MOCK.exams.find((e) => e.id === r.entryExamId) || {}).name)} → ${App.esc((window.MOCK.exams.find((e) => e.id === r.exitExamId) || {}).name)}</span>` },
            { key: 'algorithm', label: '算法', render: (r) => r.algorithm === 'grade' ? UI.badge('等级差法', 'purple') : r.algorithm === 'standard' ? UI.badge('标准分法', 'blue') : '<span class="weak">未选择</span>' },
            { key: 'status', label: '状态', render: (r) => UI.badge(r.status, App.taskStatusType(r.status)) },
            { key: 'updatedAt', label: '更新时间', render: (r) => `<span class="small muted">${App.esc(r.updatedAt)}</span>` },
            { key: 'ops', label: '操作', render: (r) => {
              if (r.status === '已完成') return `<div class="flex gap-6"><button class="btn btn-xs btn-primary" data-action="viewTaskResults" data-id="${r.id}">查看结果</button><button class="btn btn-xs" data-action="viewTaskReports" data-id="${r.id}">查看报告</button></div>`;
              if (r.status === '匹配待确认') return `<button class="btn btn-xs" data-action="continueTask" data-id="${r.id}">继续确认</button>`;
              return `<button class="btn btn-xs" data-action="editTask" data-id="${r.id}">继续配置</button>`;
            } }
          ],
          rows: all
        })}
      </div>
    </div>`;
  }

  App.actions.newEvaluation = function () {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    const w = App.state.evalWizard;
    w.matched = false; w.matchAccepted = {}; w.matchTab = 'all'; w.calcProgress = 0; w.calculating = false;
    w.algorithm = App.settings.algorithm;
    w.gradeCount = App.settings.gradeCount;
    w.keepThreshold = App.settings.keepThreshold;
    w.stepSize = App.settings.stepSize;
    w.smallSample = App.settings.smallSample;
    w.excludePartialAbsent = App.settings.excludePartialAbsent;
    const entryExam = window.MOCK.exams.find((e) => e.id === 'E1');
    const exitExam = window.MOCK.exams.find((e) => e.id === 'E2');
    const schools = entryExam.schools.filter((s) => exitExam.schools.includes(s));
    const singleSide = [...new Set([...entryExam.schools, ...exitExam.schools])].filter((s) => !schools.includes(s));
    const schoolVersions = {};
    schools.forEach((s) => { schoolVersions[s] = (exitExam.schoolConfig[s] || {}).versionId; });
    w.config = {
      name: '高中园四校增值评价（新建）',
      entryExamId: 'E1', exitExamId: 'E2',
      schools, singleSide, schoolVersions,
      scope: '高中园四校', baseDefault: 'raw',
      overrides: { 化学: 'assigned', 生物: 'assigned', 政治: 'assigned', 地理: 'assigned' }
    };
    w.taskId = nextTaskId();
    window.MOCK.tasks.push({
      id: w.taskId, name: w.config.name, entryExamId: 'E1', exitExamId: 'E2',
      schools: schools.slice(), singleSide: singleSide.slice(), schoolVersions: Object.assign({}, schoolVersions),
      scope: w.config.scope, baseDefault: 'raw', baseOverrides: Object.assign({}, w.config.overrides),
      algorithm: App.settings.algorithm, gradeCount: App.settings.gradeCount,
      keepThreshold: App.settings.keepThreshold, stepSize: App.settings.stepSize,
      smallSample: App.settings.smallSample,
      excludePartialAbsent: App.settings.excludePartialAbsent,
      status: '待匹配', updatedAt: '2026-10-23'
    });
    App.navigate('/evaluations/new/config');
  };
  App.actions.continueTask = function (el) {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    loadTaskIntoWizard(el.dataset.id);
    App.state.evalWizard.matched = false; App.state.evalWizard.matchAccepted = {};
    App.navigate('/evaluations/new/match');
  };
  App.actions.editTask = function (el) {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    loadTaskIntoWizard(el.dataset.id);
    App.navigate('/evaluations/new/config');
  };
  App.actions.viewTaskResults = function (el) { App.state.selectedTaskId = el.dataset.id; App.state.resultAlgorithm = App.task(el.dataset.id).algorithm || 'standard'; App.navigate('/evaluations/' + el.dataset.id + '/results'); };
  App.actions.viewTaskReports = function (el) { App.state.selectedTaskId = el.dataset.id; App.navigate('/evaluations/' + el.dataset.id + '/reports'); };

  function stepper(step) {
    const items = ['配置', '匹配', '算法', '结果'];
    return `<div class="stepper">${items.map((label, i) => `<div class="step ${i + 1 === step ? 'active' : i + 1 < step ? 'done' : ''}"><span class="step-num">${i + 1 < step ? '✓' : i + 1}</span><span>${label}</span></div>${i < items.length - 1 ? '<span class="step-line"></span>' : ''}`).join('')}</div>`;
  }

  function evalConfig() {
    const c = App.state.evalWizard.config;
    const readOnly = !App.canEdit();
    const entryExam = window.MOCK.exams.find((e) => e.id === c.entryExamId);
    const stage = (entryExam || {}).stage || '高中';
    const subjectNames = window.MOCK.constants.STAGE_SUBJECTS[stage] || window.MOCK.constants.SUBJECT_NAMES;
    const subjectRows = subjectNames.map((name) => window.MOCK.subjects.find((s) => s.name === name) || { name, scoring: 'raw', type: '必考' });
    const rawCount = subjectRows.filter((s) => s.scoring === 'raw').length;
    const assignedCount = subjectRows.length - rawCount;
    const matchSummary = window.MOCK.helpers.matchStats(c.entryExamId, c.exitExamId);
    return `<div class="page">
      <div class="page-head">
        <div><div class="breadcrumb"><span>管理</span><span class="sep">/</span><span>评价任务</span><span class="sep">/</span><span>配置</span></div><h1 class="page-title">配置评价任务</h1><div class="page-desc">两次考试可以是联考；按学校选择对应年级版本</div></div>
        <div class="page-actions"><button class="btn" data-action="saveEvalDraft">保存草稿</button>${readOnly ? '' : `<button class="btn btn-primary" data-action="evalToMatch">下一步：匹配 →</button>`}</div>
      </div>
      ${stepper(1)}
      <div class="grid grid-main">
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>基本信息</div></div></div><div class="card-body">
            <div class="form-grid">
              <div class="field" style="grid-column:span 2"><label class="field-label">任务名称 *</label><input class="input" value="${App.esc(c.name)}" ${readOnly ? 'disabled' : ''} onchange="App.setEvalField('name', this.value)" /></div>
              <div class="field"><label class="field-label">入口考试 *</label><select class="select" ${readOnly ? 'disabled' : ''} onchange="App.setEvalExam('entryExamId', this.value)">${window.MOCK.exams.map((e) => `<option value="${e.id}" ${c.entryExamId === e.id ? 'selected' : ''}>${e.name}</option>`).join('')}</select></div>
              <div class="field"><label class="field-label">评价考试 *</label><select class="select" ${readOnly ? 'disabled' : ''} onchange="App.setEvalExam('exitExamId', this.value)">${window.MOCK.exams.map((e) => `<option value="${e.id}" ${c.exitExamId === e.id ? 'selected' : ''}>${e.name}</option>`).join('')}</select></div>
              <div class="field"><label class="field-label">评价范围</label><input class="input" value="${App.esc(c.scope)}" ${readOnly ? 'disabled' : ''} onchange="App.setEvalField('scope', this.value)" /></div>
            </div>
          </div></div>

          <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>按学校选择版本</div><div class="card-sub">默认取评价考试配置的版本，可覆盖</div></div></div><div class="card-body">
            ${c.schools.map((sid) => {
              const g = App.gradesOf(sid)[0];
              const versions = g ? App.versionsOf(g.id) : [];
              return `<div class="grid grid-3 mb-12" style="align-items:end">
                <div><div class="tiny weak">学校</div><div class="strong">${App.schoolName(sid)}</div></div>
                <div><div class="tiny weak">年级</div><div>${g ? g.name : '—'}</div></div>
                <div class="field"><label class="field-label">版本</label><select class="select" ${readOnly ? 'disabled' : ''} onchange="App.setEvalSchoolVersion('${sid}', this.value)">${versions.map((v) => `<option value="${v.id}" ${c.schoolVersions[sid] === v.id ? 'selected' : ''}>${v.id} · ${v.name}${v.current ? ' · 当前' : ' · 历史'}</option>`).join('')}</select></div>
              </div>`;
            }).join('')}
            <div class="alert info mt-8">${UI.icon('alert')}<div>两场考试共同参与的学校才进入计算；单边学校会进入匹配异常。${(c.singleSide || []).length ? `<br><b>当前单边学校：${c.singleSide.map((s) => App.schoolName(s)).join('、')}</b>` : ''}</div></div>
          </div></div>

          <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>计算基础值</div><div class="card-sub">逐条成绩优先赋分；赋分缺失回退原始分</div></div></div>
            ${UI.table({
              columns: [
                { key: 'name', label: '科目' },
                { key: 'scoring', label: '科目计分方式', render: (r) => r.scoring === 'raw' ? '原始分' : '等级赋分' },
                { key: 'mode', label: '本次使用', render: (r) => r.scoring === 'raw'
                  ? '<span class="badge badge-gray">原始分</span>'
                  : '<span class="badge badge-blue">赋分优先，缺失回退原始分</span>' },
                { key: 'note', label: '提示', render: (r) => r.scoring === 'raw' ? '<span class="weak">无赋分，使用原始分</span>' : '<span class="weak">逐条判断</span>' }
              ],
              rows: subjectRows
            })}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>任务检查</div></div></div><div class="card-body small" style="display:flex;flex-direction:column;gap:8px">
            <div class="flex justify-between"><span class="muted">参与学校</span><b>${c.schools.length}</b></div>
            <div class="flex justify-between"><span class="muted">可计算样本</span><b>${matchSummary.complete} 人</b></div>
            <div class="flex justify-between"><span class="muted">仅入口 / 仅评价</span><b>${matchSummary.entryOnly.length} / ${matchSummary.exitOnly.length}</b></div>
            <div class="flex justify-between"><span class="muted">科目</span><b>${subjectRows.length}</b></div>
            <div class="flex justify-between"><span class="muted">口径</span><b>逐条赋分优先 / 缺失回退原始分</b></div>
            <div class="flex justify-between"><span class="muted">算法</span><b>匹配后选择</b></div>
          </div></div>
          <div class="alert warn">${UI.icon('alert')}<div>多校联考按联考全体统一标准化；班级/教师校内排名，学校联考排名。</div></div>
        </div>
      </div>
    </div>`;
  }

  App.setEvalField = function (k, v) { App.state.evalWizard.config[k] = v; };
  App.setEvalSchoolVersion = function (sid, v) { App.state.evalWizard.config.schoolVersions[sid] = v; };
  App.setBaseMode = function (subject, mode) { App.state.evalWizard.config.overrides[subject] = mode; App.render(); };
  App.setEvalExam = function (key, id) {
    const c = App.state.evalWizard.config;
    c[key] = id;
    const e1 = window.MOCK.exams.find((e) => e.id === c.entryExamId);
    const e2 = window.MOCK.exams.find((e) => e.id === c.exitExamId);
    c.schools = e1.schools.filter((s) => e2.schools.includes(s));
    c.singleSide = [...new Set([...e1.schools, ...e2.schools])].filter((s) => !c.schools.includes(s));
    c.schools.forEach((s) => { c.schoolVersions[s] = (e2.schoolConfig[s] || {}).versionId || c.schoolVersions[s]; });
    App.render();
  };
  App.actions.saveEvalDraft = function () { UI.toast('任务已保存为草稿'); };
  App.actions.evalToMatch = function () { if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; } App.state.evalWizard.matched = false; App.navigate('/evaluations/new/match'); };

  function evalMatch() {
    const w = App.state.evalWizard;
    const accepted = w.matchAccepted || {};
    const items = matchItemsFor(w);
    const blocks = items.filter((d) => d.level === 'block');
    const left = blocks.filter((d) => !accepted[d.id]).length;
    const tab = w.matchTab || 'all';
    const list = items.filter((d) => tab === 'all' || d.level === tab);
    const stats = window.MOCK.helpers.matchStats(w.config.entryExamId, w.config.exitExamId);
    return `<div class="page">
      <div class="page-head">
        <div><div class="breadcrumb"><span>管理</span><span class="sep">/</span><span>评价任务</span><span class="sep">/</span><span>匹配</span></div><h1 class="page-title">匹配与确认</h1><div class="page-desc">两场考试的学校与学生对齐；阻断项清零后才能进入算法</div></div>
        <div class="page-actions"><button class="btn" data-action="evalBackConfig">返回配置</button>${App.canEdit() ? `<button class="btn btn-primary" data-action="evalToAlgorithm" ${left ? 'disabled' : ''}>${left ? `还有 ${left} 项阻断` : '确认匹配并继续 →'}</button>` : ''}</div>
      </div>
      ${stepper(2)}
      <div class="card mb-16"><div class="card-body flex gap-8 wrap items-center">
        <span class="badge badge-green">匹配成功 ${stats.complete}</span>
        <span class="badge badge-amber">仅入口 ${stats.entryOnly.length}</span>
        <span class="badge badge-amber">仅评价 ${stats.exitOnly.length}</span>
        <span class="badge badge-red">不可比 ${stats.incomplete.length}</span>
        <span class="badge badge-gray">单边学校 ${stats.singleSide.length} · 教师缺失 ${stats.missingTeacher}</span>
      </div></div>
      <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>异常清单</div><div class="card-sub">按联考全体匹配，学校差异单独标注</div></div><span class="badge ${left ? 'badge-red' : 'badge-green'}">${left ? left + ' 项阻断' : '阻断已清零'}</span></div>
        <div class="card-body">
          ${UI.tabs([
            { key: 'all', label: '全部', count: items.length, active: tab === 'all' },
            { key: 'block', label: '阻断', count: blocks.length, active: tab === 'block' },
            { key: 'confirm', label: '待确认', count: items.filter((d) => d.level === 'confirm').length, active: tab === 'confirm' },
            { key: 'hint', label: '提示', count: items.filter((d) => d.level === 'hint').length, active: tab === 'hint' }
          ], 'setMatchTab')}
          <div class="diff-list">${list.map((d) => { const done = !!accepted[d.id]; return `<div class="diff-item ${done ? 'done' : ''}">
            <span class="diff-level ${d.level}">${d.level === 'block' ? '阻断' : d.level === 'confirm' ? '待确认' : '提示'}</span>
            <div class="diff-main"><div class="diff-title">${App.esc(d.type)} · ${App.esc(d.title)}</div><div class="diff-desc">${App.esc(d.desc)}</div><div class="diff-suggest">建议：${App.esc(d.suggestion)}</div></div>
            <div class="diff-actions">${done ? '<span class="badge badge-green">已处理</span>' : `<button class="btn btn-xs btn-primary" data-action="resolveMatch" data-id="${d.id}">${d.level === 'block' ? '处理' : '接受建议'}</button>`}</div>
          </div>`; }).join('')}</div>
          <div class="alert ${left ? 'warn' : 'success'} mt-16">${UI.icon(left ? 'alert' : 'check')}<div>${left ? '请先处理全部阻断项。' : '阻断项已清零，可以确认匹配。'}</div></div>
        </div>
      </div>
    </div>`;
  }

  App.actions.setMatchTab = function (el) { App.state.evalWizard.matchTab = el.dataset.value; App.render(); };
  App.actions.resolveMatch = function (el) { const w = App.state.evalWizard; w.matchAccepted = w.matchAccepted || {}; w.matchAccepted[el.dataset.id] = true; App.render(); };
  App.actions.evalBackConfig = function () { App.navigate('/evaluations/new/config'); };
  App.actions.evalToAlgorithm = function () {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    const w = App.state.evalWizard;
    const left = matchItemsFor(w).filter((d) => d.level === 'block' && !(w.matchAccepted || {})[d.id]).length;
    if (left) { UI.toast('仍有阻断项', 'error'); return; }
    w.matched = true;
    App.navigate('/evaluations/new/algorithm');
  };

  function evalAlgorithm() {
    const w = App.state.evalWizard;
    return `<div class="page">
      <div class="page-head">
        <div><div class="breadcrumb"><span>管理</span><span class="sep">/</span><span>评价任务</span><span class="sep">/</span><span>算法</span></div><h1 class="page-title">算法与参数</h1><div class="page-desc">按联考全体统一标准化；四层结果使用同一套指标</div></div>
        <div class="page-actions"><button class="btn" data-action="evalBackMatch">返回匹配</button>${App.canEdit() ? `<button class="btn btn-primary" data-action="startCalculate" ${w.calculating ? 'disabled' : ''}>${w.calculating ? '计算中…' : '开始计算 →'}</button>` : ''}</div>
      </div>
      ${stepper(3)}
      ${w.calculating ? `<div class="card mb-16"><div class="card-body"><div class="flex justify-between mb-8"><div class="strong">正在计算</div><div class="mono">${w.calcProgress || 0}%</div></div>${UI.progress(w.calcProgress || 0, true)}<div class="small muted mt-8">${(w.calcProgress || 0) < 40 ? '按科目联考全体标准化…' : (w.calcProgress || 0) < 75 ? '汇总班级/教师/学校…' : '生成四类结果…'}</div></div></div>` : ''}
      <div class="grid grid-2 mb-16">
        <div class="card" style="border-color:${w.algorithm === 'standard' ? '#0a66ff' : 'var(--border)'}"><div class="card-body">
          <div class="flex justify-between gap-12"><div><div class="flex items-center gap-8"><span class="badge badge-blue">算法一</span><b>标准分增值法</b></div><div class="small muted mt-8">联考全体标准分，比较位置变化；保持阈值 0.25，步长 0.5。</div></div><input type="radio" name="algo" ${w.algorithm === 'standard' ? 'checked' : ''} onchange="App.setAlgorithm('standard')" /></div>
        </div></div>
        <div class="card" style="border-color:${w.algorithm === 'grade' ? '#0a66ff' : 'var(--border)'}"><div class="card-body">
          <div class="flex justify-between gap-12"><div><div class="flex items-center gap-8"><span class="badge badge-purple">算法二</span><b>等级差法</b></div><div class="small muted mt-8">联考全体划等级，直接比较进了几档、掉了几档。</div></div><input type="radio" name="algo" ${w.algorithm === 'grade' ? 'checked' : ''} onchange="App.setAlgorithm('grade')" /></div>
        </div></div>
      </div>
      <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>参数</div></div></div><div class="card-body">
        <div class="form-grid-3">
          <div class="field"><label class="field-label">等级档数</label><select class="select" disabled><option value="9" selected>9 档</option></select><div class="field-hint">当前预设 9 档，支持自定义配置档位</div></div>
          <div class="field"><label class="field-label">部分缺考处理</label><select class="select" onchange="App.setEvalParam('excludePartialAbsent', this.value === '1')"><option value="1" ${w.excludePartialAbsent !== false ? 'selected' : ''}>整生剔除</option><option value="0" ${w.excludePartialAbsent === false ? 'selected' : ''}>仅剔除该科</option></select></div>
          <div class="field"><label class="field-label">保持阈值</label><input class="input" type="number" step="0.05" value="${w.keepThreshold}" onchange="App.setEvalParam('keepThreshold', Number(this.value))" /></div>
          <div class="field"><label class="field-label">每级步长</label><input class="input" type="number" step="0.05" value="${w.stepSize}" onchange="App.setEvalParam('stepSize', Number(this.value))" /></div>
        </div>
        <div class="alert info mt-16">${UI.icon('alert')}<div>学生按联考排名；班级/教师按校内排名；学校按联考排名。学校结果指标与班级一致。</div></div>
      </div></div>
    </div>`;
  }

  App.setAlgorithm = function (v) { App.state.evalWizard.algorithm = v; App.render(); };
  App.setEvalParam = function (k, v) { App.state.evalWizard[k] = v; };
  App.actions.evalBackMatch = function () { App.navigate('/evaluations/new/match'); };
  App.actions.startCalculate = function () {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    const w = App.state.evalWizard;
    if (w.calculating) return;
    w.calculating = true; w.calcProgress = 0; App.render();
    const timer = setInterval(() => {
      w.calcProgress = Math.min(100, (w.calcProgress || 0) + 9 + Math.round(Math.random() * 6));
      if (w.calcProgress >= 100) {
        clearInterval(timer); w.calculating = false;
        const taskId = w.taskId || nextTaskId();
        const task = {
          id: taskId,
          name: w.config.name,
          entryExamId: w.config.entryExamId,
          exitExamId: w.config.exitExamId,
          schools: w.config.schools,
          singleSide: w.config.singleSide || [],
          schoolVersions: w.config.schoolVersions,
          scope: w.config.scope,
          baseDefault: w.config.baseDefault,
          baseOverrides: w.config.overrides,
          algorithm: w.algorithm,
          gradeCount: w.gradeCount,
          keepThreshold: w.keepThreshold,
          stepSize: w.stepSize,
          smallSample: w.smallSample,
          excludePartialAbsent: w.excludePartialAbsent !== false,
          status: '已完成',
          updatedAt: '2026-10-23',
          resultVersion: 'R1'
        };
        window.MOCK.results[taskId] = window.MOCK.helpers.computeTask(task, window.MOCK.helpers.buildTaskData(task));
        const existing = window.MOCK.tasks.find((t) => t.id === taskId);
        if (existing) Object.assign(existing, task);
        else window.MOCK.tasks.push(task);
        App.state.selectedTaskId = taskId;
        App.state.resultAlgorithm = w.algorithm;
        UI.toast('计算完成');
        App.navigate('/evaluations/' + taskId + '/results');
        return;
      }
      App.render();
    }, 230);
  };

  function fmt2(value) {
    return value == null ? '—' : Number(value).toFixed(2);
  }

  function processClassNo(name) {
    const match = String(name || '').match(/(\d+)/);
    return match ? Number(match[1]) : 999;
  }

  function processSubjectChips(subject, action) {
    return `<div class="card mb-16"><div class="card-body"><div class="flex gap-8 wrap items-center"><span class="chip-group-label">科目</span>${resultSubjects().map((s) => `<button type="button" class="chip ${subject === s ? 'active' : ''}" data-action="${action}" data-value="${s}">${s}</button>`).join('')}</div></div></div>`;
  }

  function evalProcess(taskId) {
    const task = App.task(taskId);
    if (!task) return `<div class="page">${UI.empty('评价任务不存在')}</div>`;
    App.state.selectedTaskId = task.id;
    const r = App.result(task.id);
    if (!r) return `<div class="page">${UI.empty('暂无计算过程')}</div>`;
    const step = String(App.state.processStep || '1');
    return `<div class="page">
      <div class="page-head">
        <div><div class="breadcrumb"><span>管理</span><span class="sep">/</span><span>评价任务</span><span class="sep">/</span><span>计算过程</span></div><h1 class="page-title">${App.esc(task.name)} · 计算过程</h1><div class="page-desc">${task.schools.map((s) => App.schoolName(s)).join('、')} · 样本 ${r.quality.sample} 人 · 算法：${task.algorithm === 'grade' ? '等级差法' : '标准分法'}</div></div>
        <div class="page-actions"><button class="btn" data-action="openAlgorithm">查看算法说明</button><button class="btn" data-action="backResultsFromProcess">返回结果</button><button class="btn" data-action="backEvaluations">任务列表</button></div>
      </div>
      ${UI.tabs([
        { key: '1', label: '1 数据与口径', active: step === '1' },
        { key: '2', label: '2 联考统计', active: step === '2' },
        { key: '3', label: '3 学生标准化', active: step === '3' },
        { key: '4', label: '4 等级与判定', active: step === '4' },
        { key: '5', label: '5 四层汇总', active: step === '5' }
      ], 'setProcessStep')}
      ${step === '1' ? processStep1(r) : ''}
      ${step === '2' ? processStep2(r) : ''}
      ${step === '3' ? processStep3(r) : ''}
      ${step === '4' ? processStep4(r) : ''}
      ${step === '5' ? processStep5(r) : ''}
    </div>`;
  }

  function processDrillConfig(r, key) {
    const task = r.task;
    const match = window.MOCK.helpers.matchStats(task.entryExamId, task.exitExamId);
    const students = window.MOCK.students;
    const totalIds = new Set(r.totals.map((x) => x.studentId));
    const langIds = new Set(match.languageChanged.map((x) => x.id));
    const exitOnlyIds = new Set(match.exitOnly.map((x) => x.id));
    const incompleteIds = new Set(match.incomplete.map((x) => x.id));
    const score = (examId, studentId, subject) => window.MOCK.helpers.scoresFor(examId, studentId)[subject];
    const missingSubjects = (studentId, subjects) => (subjects || []).filter((subject) => {
      const a = score(task.entryExamId, studentId, subject);
      const b = score(task.exitExamId, studentId, subject);
      return !a || !b || a.status !== '正常' || b.status !== '正常' || a.raw == null || b.raw == null;
    });
    const missingText = (subjects, missing) => {
      if (!subjects || !subjects.length) return '无成绩 / 选科未知';
      if (missing.length === subjects.length) return '全科缺考';
      return missing.length ? `缺考/缺科：${missing.join('、')}` : '未进入结果';
    };
    const baseCols = [
      { key: 'studentNo', label: '学号', render: (x) => `<span class="code">${App.esc(x.studentNo)}</span>` },
      { key: 'studentName', label: '姓名' },
      { key: 'schoolName', label: '学校' },
      { key: 'className', label: '班级' }
    ];

    if (key === 'sample') {
      return {
        title: '可计算样本',
        desc: '两场六科完整、外语语种一致，进入总分计算的学生',
        empty: '暂无样本',
        columns: baseCols.concat([
          { key: 'entryValue', label: '入口总分', align: 'num', render: (x) => fmt2(x.entryValue) },
          { key: 'currentValue', label: '评价总分', align: 'num', render: (x) => fmt2(x.currentValue) },
          { key: 'entryGrade', label: '入口等级', align: 'center', render: (x) => `G${x.entryGrade}` },
          { key: 'currentGrade', label: '评价等级', align: 'center', render: (x) => `G${x.currentGrade}` },
          { key: 'status', label: '判定', render: (x) => UI.badge(x.status, x.status === '进步' ? 'green' : x.status === '退步' ? 'red' : 'gray') },
          { key: 'level', label: '级数', align: 'num', render: (x) => x.level > 0 ? `+${x.level}` : x.level }
        ]),
        rows: r.totals.map((x) => ({ ...x, schoolName: App.schoolName(x.schoolId) }))
      };
    }

    if (key === 'both') {
      const exitMap = new Map(window.MOCK.helpers.examStudents(task.exitExamId).map((x) => [x.id, x]));
      const rows = window.MOCK.helpers.examStudents(task.entryExamId)
        .filter((x) => exitMap.has(x.id))
        .map((x) => {
          const b = exitMap.get(x.id);
          let state = '完整';
          if (langIds.has(x.id)) state = '外语语种变更';
          else if (incompleteIds.has(x.id)) state = '未满六科';
          return {
            studentNo: x.studentNo, studentName: x.name, schoolId: x.schoolId,
            schoolName: App.schoolName(x.schoolId), className: b.className,
            complete: state
          };
        });
      return {
        title: '两场都有',
        desc: '入口与评价考试均出现的学生；不等于可计算样本',
        empty: '暂无学生',
        columns: baseCols.concat([
          { key: 'complete', label: '状态', render: (x) => x.complete === '完整' ? '<span class="badge badge-green">完整</span>' : `<span class="badge badge-amber">${App.esc(x.complete)}</span>` }
        ]),
        rows
      };
    }

    if (key === 'excluded') {
      const rows = students.filter((s) => !totalIds.has(s.id)).map((s) => {
        let reason = '未进入结果';
        if (exitOnlyIds.has(s.id)) reason = '仅评价：无高二期末成绩';
        else if (langIds.has(s.id)) reason = '外语语种变更';
        else if (!s.subjects || !s.subjects.length) reason = '无成绩 / 选科未知';
        else if (s.subjects.length < 6) reason = '选科不足六科';
        else reason = missingText(s.subjects, missingSubjects(s.id, s.subjects));
        return {
          studentNo: s.studentNo, studentName: s.name, schoolId: s.schoolId,
          schoolName: App.schoolName(s.schoolId), className: s.className, reason
        };
      });
      return {
        title: '剔除合计',
        desc: '当前高三名册内未进入可计算样本的学生；仅入口 99 人不在当前名册，未计入',
        empty: '暂无剔除学生',
        columns: baseCols.concat([{ key: 'reason', label: '剔除原因' }]),
        rows
      };
    }

    if (key === 'entryOnly') {
      return {
        title: '仅入口',
        desc: '只在高二期末出现、未进入当前高三名册的学生',
        empty: '暂无仅入口学生',
        columns: baseCols.concat([{ key: 'note', label: '说明' }]),
        rows: match.entryOnly.map((x) => ({
          studentNo: x.id, studentName: x.name, schoolId: x.schoolId, schoolName: App.schoolName(x.schoolId),
          className: x.className, note: '仅高二期末，无高三成绩'
        }))
      };
    }

    if (key === 'exitOnly') {
      return {
        title: '仅评价',
        desc: '只在高三出现、没有高二期末成绩的学生',
        empty: '暂无仅评价学生',
        columns: baseCols.concat([{ key: 'note', label: '说明' }]),
        rows: match.exitOnly.map((x) => ({
          studentNo: x.id, studentName: x.name, schoolId: x.schoolId, schoolName: App.schoolName(x.schoolId),
          className: x.className, note: '仅高三，无高二期末成绩'
        }))
      };
    }

    if (key === 'incomplete') {
      const rows = match.incomplete
        .filter((x) => !langIds.has(x.id))
        .map((x) => {
          const s = students.find((stu) => stu.id === x.id);
          const subjects = s ? s.subjects : [];
          const missing = s ? missingSubjects(x.id, subjects) : [];
          return {
            studentNo: x.id, studentName: x.name, schoolId: x.schoolId, schoolName: App.schoolName(x.schoolId),
            className: x.className,
            reason: missingText(subjects, missing)
          };
        });
      return {
        title: '两场未满六科',
        desc: '入口、评价均出现但六科不完整的学生；外语语种变更单独列出',
        empty: '暂无未满六科学生',
        columns: baseCols.concat([{ key: 'reason', label: '缺失科目 / 原因' }]),
        rows
      };
    }

    if (key === 'language') {
      return {
        title: '外语语种变更',
        desc: '两场外语语种不一致，总分不可直接比较',
        empty: '暂无外语语种变更',
        columns: baseCols.concat([
          { key: 'from', label: '入口语种' },
          { key: 'to', label: '评价语种' }
        ]),
        rows: match.languageChanged.map((x) => ({
          studentNo: x.id, studentName: x.name, schoolId: x.schoolId, schoolName: App.schoolName(x.schoolId),
          className: x.className, from: x.from, to: x.to
        }))
      };
    }

    if (key === 'teacherMissing') {
      const rows = r.rows.filter((x) => !x.teacherId).map((x) => ({
        studentNo: x.studentNo, studentName: x.studentName, schoolId: x.schoolId,
        schoolName: x.schoolName, className: x.className, subject: x.subject,
        raw: x.currentRaw, assigned: x.currentAssigned, value: x.currentValue
      }));
      return {
        title: '未匹配教师',
        desc: '这些成绩没有匹配到科任教师，不进入教师结果；一行一条成绩记录',
        empty: '没有未匹配教师的成绩',
        columns: [
          { key: 'studentNo', label: '学号', render: (x) => `<span class="code">${App.esc(x.studentNo)}</span>` },
          { key: 'studentName', label: '姓名' },
          { key: 'schoolName', label: '学校' },
          { key: 'className', label: '班级' },
          { key: 'subject', label: '科目' },
          { key: 'raw', label: '原始分', align: 'num', render: (x) => fmt2(x.raw) },
          { key: 'assigned', label: '赋分', align: 'num', render: (x) => fmt2(x.assigned) },
          { key: 'value', label: '采用值', align: 'num', render: (x) => fmt2(x.value) }
        ],
        rows
      };
    }

    if (key === 'fallback') {
      return {
        title: '赋分回退',
        desc: '逐条成绩优先赋分；该条赋分缺失时回退原始分',
        empty: '所有有赋分的成绩均已取到赋分，无逐条回退',
        columns: [
          { key: 'subject', label: '科目' },
          { key: 'mode', label: '处理方式' },
          { key: 'missing', label: '缺失条数', align: 'num' }
        ],
        rows: r.quality.fallbackSubjects.map((subject) => ({
          subject,
          mode: '逐条回退原始分',
          missing: r.modes[subject] ? r.modes[subject].missing : 0
        }))
      };
    }

    return { title: '明细', desc: '', empty: '暂无数据', columns: baseCols, rows: [] };
  }

  function processDrillDetail(r) {
    const key = App.state.processDrill;
    if (!key) return '';
    const conf = processDrillConfig(r, key);
    let rows = conf.rows || [];
    if (!App.canEdit()) rows = rows.filter((x) => x.schoolId === App.state.schoolId);
    const keyword = (App.state.processDrillKeyword || '').trim().toLowerCase();
    if (keyword) rows = rows.filter((x) => String(x.studentName || '').toLowerCase().includes(keyword) || String(x.studentNo || '').toLowerCase().includes(keyword));
    const size = 20;
    const page = Math.min(Math.max(1, App.state.processDrillPage || 1), Math.max(1, Math.ceil(rows.length / size)));
    const pageRows = rows.slice((page - 1) * size, page * size);
    return `<div class="card mt-16" id="processDrill">
      <div class="card-head"><div><div class="card-title"><span class="dot"></span>${App.esc(conf.title)} · ${rows.length} 条</div><div class="card-sub">${App.esc(conf.desc)}</div></div>
        <div class="toolbar"><div class="search">${UI.icon('search')}<input id="processDrillSearch" class="input input-sm" placeholder="姓名/学号" value="${App.esc(App.state.processDrillKeyword || '')}" oninput="if (!event.isComposing) App.setProcessDrillKeyword(this.value)" /></div><button class="btn btn-sm" data-action="closeProcessDrill">返回样本概览</button></div>
      </div>
      ${rows.length ? `${UI.table({ columns: conf.columns, rows: pageRows })}${UI.pagination(rows.length, page, size, 'processDrillPage', '条')}` : UI.empty(conf.empty)}
    </div>`;
  }

  function buildProcessSampleData(r) {
    const task = r.task;
    const match = window.MOCK.helpers.matchStats(task.entryExamId, task.exitExamId);
    const students = window.MOCK.students;
    const score = (examId, studentId, subject) => window.MOCK.helpers.scoresFor(examId, studentId)[subject];
    const missingSubjects = (studentId, subjects) => (subjects || []).filter((subject) => {
      const a = score(task.entryExamId, studentId, subject);
      const b = score(task.exitExamId, studentId, subject);
      return !a || !b || a.status !== '正常' || b.status !== '正常' || a.raw == null || b.raw == null;
    });
    const missingText = (subjects, missing) => {
      if (!subjects || !subjects.length) return '无成绩 / 选科未知';
      if (missing.length === subjects.length) return '全科缺考';
      return missing.length ? `缺考/缺科：${missing.join('、')}` : '未进入结果';
    };

    const normal = r.totals.map((x) => ({ ...x, schoolName: App.schoolName(x.schoolId) }))
      .sort((a, b) => a.schoolId.localeCompare(b.schoolId)
        || processClassNo(a.className) - processClassNo(b.className)
        || a.studentNo.localeCompare(b.studentNo));

    const studentAbnormal = [];
    match.entryOnly.forEach((x) => {
      studentAbnormal.push({
        type: '仅入口', studentNo: x.id, studentName: x.name, schoolId: x.schoolId,
        schoolName: App.schoolName(x.schoolId), className: x.className,
        note: '仅高二期末，无高三成绩'
      });
    });
    match.exitOnly.forEach((x) => {
      studentAbnormal.push({
        type: '仅评价', studentNo: x.id, studentName: x.name, schoolId: x.schoolId,
        schoolName: App.schoolName(x.schoolId), className: x.className,
        note: '仅高三，无高二期末成绩'
      });
    });
    match.incomplete.filter((x) => !match.languageChanged.some((y) => y.id === x.id)).forEach((x) => {
      const s = students.find((stu) => stu.id === x.id);
      const subjects = s ? s.subjects : [];
      const missing = s ? missingSubjects(x.id, subjects) : [];
      studentAbnormal.push({
        type: '两场未满六科', studentNo: x.id, studentName: x.name, schoolId: x.schoolId,
        schoolName: App.schoolName(x.schoolId), className: x.className,
        note: missingText(subjects, missing)
      });
    });
    match.languageChanged.forEach((x) => {
      studentAbnormal.push({
        type: '外语语种变更', studentNo: x.id, studentName: x.name, schoolId: x.schoolId,
        schoolName: App.schoolName(x.schoolId), className: x.className,
        note: `${x.from} → ${x.to}`
      });
    });
    const typeOrder = { 仅入口: 1, 仅评价: 2, 两场未满六科: 3, 外语语种变更: 4 };
    studentAbnormal.sort((a, b) => (typeOrder[a.type] || 9) - (typeOrder[b.type] || 9)
      || a.schoolId.localeCompare(b.schoolId)
      || processClassNo(a.className) - processClassNo(b.className)
      || a.studentNo.localeCompare(b.studentNo));

    const scoreAbnormal = r.rows.filter((x) => !x.teacherId).map((x) => ({
      type: '未匹配教师', studentNo: x.studentNo, studentName: x.studentName, schoolId: x.schoolId,
      schoolName: x.schoolName, className: x.className, subject: x.subject,
      raw: x.currentRaw, assigned: x.currentAssigned, value: x.currentValue
    })).sort((a, b) => a.schoolId.localeCompare(b.schoolId)
      || processClassNo(a.className) - processClassNo(b.className)
      || a.studentNo.localeCompare(b.studentNo)
      || String(a.subject).localeCompare(String(b.subject), 'zh'));

    return { normal, studentAbnormal, scoreAbnormal, match };
  }

  function processSampleStats(r) {
    const data = buildProcessSampleData(r);
    const countType = (type) => data.studentAbnormal.filter((x) => x.type === type).length;
    const stat = (tab, label, value, sub, filter) => `<button type="button" class="sample-stat" data-action="jumpProcessSample" data-tab="${tab}" data-filter="${filter || 'all'}"><span class="sample-stat-label">${label}</span><b>${value}</b><span class="sample-stat-sub">${sub}</span></button>`;
    return `<div class="sample-stats">
      ${stat('normal', '可计算样本', `${data.normal.length} 人`, '查看正常样本')}
      ${stat('studentAbnormal', '学生异常', `${data.studentAbnormal.length} 人`, '查看异常清单')}
      <div class="sample-stat static"><span class="sample-stat-label">名册内剔除</span><b>${r.quality.excluded} 人</b><span class="sample-stat-sub">当前高三名册</span></div>
      <div class="sample-stat static"><span class="sample-stat-label">两场都有</span><b>${data.match.both} 人</b><span class="sample-stat-sub">含正常与异常</span></div>
      ${stat('scoreAbnormal', '未匹配教师', `${data.scoreAbnormal.length} 条`, '查看成绩异常')}
      <div class="sample-stat static"><span class="sample-stat-label">赋分回退</span><b>${r.quality.fallbackSubjects.length ? r.quality.fallbackSubjects.length + ' 科' : '无'}</b><span class="sample-stat-sub">完整样本齐全</span></div>
    </div>
    <div class="tiny weak mt-8">口径：可计算样本 ${data.normal.length}；学生异常 ${data.studentAbnormal.length}（仅入口 ${countType('仅入口')} + 仅评价 ${countType('仅评价')} + 未满六科 ${countType('两场未满六科')} + 外语变更 ${countType('外语语种变更')}）；名册内剔除 ${r.quality.excluded}；仅入口 ${countType('仅入口')} 不在当前名册。</div>`;
  }

  function processSamplePanel(r) {
    const data = buildProcessSampleData(r);
    const tab = App.state.processSampleTab || 'normal';
    const filter = App.state.processAbnormalFilter || 'all';
    const keyword = (App.state.processSampleKeyword || '').trim().toLowerCase();
    let rows = tab === 'normal' ? data.normal : tab === 'studentAbnormal' ? data.studentAbnormal : data.scoreAbnormal;
    if (tab === 'studentAbnormal' && filter !== 'all') rows = rows.filter((x) => x.type === filter);
    if (keyword) rows = rows.filter((x) => String(x.studentName || '').toLowerCase().includes(keyword) || String(x.studentNo || '').toLowerCase().includes(keyword));
    const size = 20;
    const page = Math.min(Math.max(1, App.state.processSamplePage || 1), Math.max(1, Math.ceil(rows.length / size)));
    const pageRows = rows.slice((page - 1) * size, page * size);
    const tabCount = { normal: data.normal.length, studentAbnormal: data.studentAbnormal.length, scoreAbnormal: data.scoreAbnormal.length };
    const filterCount = {
      all: data.studentAbnormal.length,
      '仅入口': data.studentAbnormal.filter((x) => x.type === '仅入口').length,
      '仅评价': data.studentAbnormal.filter((x) => x.type === '仅评价').length,
      '两场未满六科': data.studentAbnormal.filter((x) => x.type === '两场未满六科').length,
      '外语语种变更': data.studentAbnormal.filter((x) => x.type === '外语语种变更').length
    };
    const baseCols = [
      { key: 'studentNo', label: '学号', render: (x) => `<span class="code">${App.esc(x.studentNo)}</span>` },
      { key: 'studentName', label: '姓名' },
      { key: 'schoolName', label: '学校' },
      { key: 'className', label: '班级' }
    ];
    let columns;
    if (tab === 'normal') {
      columns = baseCols.concat([
        { key: 'entryValue', label: '入口总分', align: 'num', render: (x) => fmt2(x.entryValue) },
        { key: 'currentValue', label: '评价总分', align: 'num', render: (x) => fmt2(x.currentValue) },
        { key: 'entryGrade', label: '入口等级', align: 'center', render: (x) => `G${x.entryGrade}` },
        { key: 'currentGrade', label: '评价等级', align: 'center', render: (x) => `G${x.currentGrade}` },
        { key: 'status', label: '判定', render: (x) => UI.badge(x.status, x.status === '进步' ? 'green' : x.status === '退步' ? 'red' : 'gray') },
        { key: 'level', label: '级数', align: 'num', render: (x) => x.level > 0 ? `+${x.level}` : x.level }
      ]);
    } else if (tab === 'studentAbnormal') {
      columns = [
        { key: 'type', label: '异常类型', render: (x) => UI.badge(x.type, x.type === '外语语种变更' ? 'red' : 'amber') }
      ].concat(baseCols, [{ key: 'note', label: '异常说明' }]);
    } else {
      columns = [
        { key: 'type', label: '异常类型', render: (x) => UI.badge(x.type, 'amber') },
        { key: 'studentNo', label: '学号', render: (x) => `<span class="code">${App.esc(x.studentNo)}</span>` },
        { key: 'studentName', label: '姓名' },
        { key: 'schoolName', label: '学校' },
        { key: 'className', label: '班级' },
        { key: 'subject', label: '科目' },
        { key: 'raw', label: '原始分', align: 'num', render: (x) => fmt2(x.raw) },
        { key: 'assigned', label: '赋分', align: 'num', render: (x) => fmt2(x.assigned) },
        { key: 'value', label: '采用值', align: 'num', render: (x) => fmt2(x.value) }
      ];
    }
    const chips = tab === 'studentAbnormal' ? `<div class="chips" style="margin-top:10px">
      ${[['all', '全部'], ['仅入口', '仅入口'], ['仅评价', '仅评价'], ['两场未满六科', '两场未满六科'], ['外语语种变更', '外语语种变更']].map(([key, label]) => `<button type="button" class="chip ${filter === key ? 'active' : ''}" data-action="setProcessAbnormalFilter" data-value="${key}">${label} ${filterCount[key]}</button>`).join('')}
    </div>` : '';
    return `<div class="card mt-16" id="processSamplePanel">
      <div class="card-head"><div><div class="card-title"><span class="dot"></span>样本清单</div><div class="card-sub">正常样本与学生异常分开；学生异常按类型过滤；成绩异常单列</div></div>
        <div class="toolbar"><div class="search">${UI.icon('search')}<input id="processSampleSearch" class="input input-sm" placeholder="姓名/学号" value="${App.esc(App.state.processSampleKeyword || '')}" oninput="if (!event.isComposing) App.setProcessSampleKeyword(this.value)" /></div></div>
      </div>
      <div class="card-body" style="padding-bottom:0">
        ${UI.tabs([
          { key: 'normal', label: '正常样本', count: tabCount.normal, active: tab === 'normal' },
          { key: 'studentAbnormal', label: '学生异常', count: tabCount.studentAbnormal, active: tab === 'studentAbnormal' },
          { key: 'scoreAbnormal', label: '成绩异常', count: tabCount.scoreAbnormal, active: tab === 'scoreAbnormal' }
        ], 'setProcessSampleTab')}
        ${chips}
      </div>
      ${rows.length ? `${UI.table({ columns, rows: pageRows })}${UI.pagination(rows.length, page, size, 'processSamplePage', '条')}` : UI.empty(tab === 'scoreAbnormal' ? '无成绩异常' : '无匹配记录')}
    </div>`;
  }

  function processStep1(r) {
    const task = r.task;
    const entry = window.MOCK.exams.find((e) => e.id === task.entryExamId);
    const exit = window.MOCK.exams.find((e) => e.id === task.exitExamId);
    const match = window.MOCK.helpers.matchStats(task.entryExamId, task.exitExamId);
    const modes = window.MOCK.constants.SUBJECT_NAMES.map((subject) => ({
      subject,
      scoring: (window.MOCK.subjects.find((s) => s.name === subject) || {}).scoring === 'assigned' ? '赋分' : '原始分',
      mode: r.modes[subject] ? r.modes[subject].mode : '原始分',
      fallback: r.modes[subject] && r.modes[subject].rawFallback ? `回退 ${r.modes[subject].rawFallback} 条` : '否'
    }));
    const versionText = task.schools.map((sid) => `${App.schoolName(sid)} ${(task.schoolVersions || {})[sid] || '—'}`).join('、');
    return `<div class="grid grid-2 mb-16">
      <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>任务参数</div></div></div><div class="card-body">${UI.kv([
        ['任务名称', App.esc(task.name)],
        ['入口考试', App.esc(entry ? entry.name : task.entryExamId)],
        ['评价考试', App.esc(exit ? exit.name : task.exitExamId)],
        ['参与学校', task.schools.map((s) => App.schoolName(s)).join('、')],
        ['按校版本', App.esc(versionText)],
        ['算法', task.algorithm === 'grade' ? '等级差法' : '标准分法'],
        ['等级档数', `${r.gradeCount} 档`],
        ['保持阈值 / 步长', `${r.keepThreshold} / ${r.stepSize}`],
        ['小样本阈值', `${r.smallSample} 人`],
        ['部分缺考处理', task.excludePartialAbsent !== false ? '整生剔除' : '仅剔除该科']
      ])}</div></div>
      <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>样本与剔除</div><div class="card-sub">统计在上，正常样本 / 学生异常 / 成绩异常清单在下</div></div></div><div class="card-body">
        ${processSampleStats(r)}
      </div></div>
    </div>
    ${processSamplePanel(r)}
    <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>科目口径</div><div class="card-sub">逐条成绩优先赋分；赋分缺失回退原始分</div></div></div>
      ${UI.table({
        columns: [
          { key: 'subject', label: '科目' },
          { key: 'scoring', label: '科目计分方式' },
          { key: 'mode', label: '本次使用', render: (x) => UI.badge(x.mode, x.mode === '赋分' ? 'blue' : 'gray') },
          { key: 'fallback', label: '是否回退', render: (x) => x.fallback !== '否' ? UI.badge(x.fallback, 'amber') : '否' }
        ],
        rows: modes
      })}
    </div>
    <div class="alert info mt-16">${UI.icon('alert')}<div>样本口径：入口与评价两场六科完整、外语语种一致的学生进入总分计算；单科缺考只影响该科，不必然剔除总分。</div></div>`;
  }

  function processStep2(r) {
    const rows = [];
    ['物理类', '历史类'].forEach((group) => {
      const s = r.stats.total[group];
      if (!s) return;
      rows.push({
        scope: `总分 · ${group}`, n: s.n,
        entryMean: s.entry.mean, entryStd: s.entry.std,
        currentMean: s.current.mean, currentStd: s.current.std
      });
    });
    window.MOCK.constants.SUBJECT_NAMES.forEach((subject) => {
      const s = r.stats.subjects[subject];
      if (!s) return;
      rows.push({
        scope: subject, n: s.n,
        entryMean: s.entry.mean, entryStd: s.entry.std,
        currentMean: s.current.mean, currentStd: s.current.std
      });
    });
    return `<div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>联考全体均值与标准差</div><div class="card-sub">标准分 z =（分数 − 均值）÷ 标准差；总分按首选科目分组</div></div></div>
      ${UI.table({
        columns: [
          { key: 'scope', label: '科目 / 组' },
          { key: 'n', label: '人数', align: 'num' },
          { key: 'entryMean', label: '入口均值', align: 'num', render: (x) => fmt2(x.entryMean) },
          { key: 'entryStd', label: '入口标准差', align: 'num', render: (x) => fmt2(x.entryStd) },
          { key: 'currentMean', label: '评价均值', align: 'num', render: (x) => fmt2(x.currentMean) },
          { key: 'currentStd', label: '评价标准差', align: 'num', render: (x) => fmt2(x.currentStd) }
        ],
        rows
      })}
    </div>
    <div class="alert info mt-16">${UI.icon('alert')}<div>单科参与人数可能大于总分样本：单科缺考只剔除该科，总分要求六科完整。</div></div>`;
  }

  function processStudentDetail(r) {
    const studentId = App.state.processStudentId;
    if (!studentId) return '';
    const total = r.totals.find((x) => x.studentId === studentId);
    if (!total) return `<div class="card mt-16" id="processStudentDetail"><div class="card-body">${UI.empty('该学生不在当前样本中')}<div class="mt-12"><button class="btn btn-sm" data-action="backProcessStudent">返回学生列表</button></div></div></div>`;
    const student = window.MOCK.students.find((s) => s.id === studentId) || {};
    const subjectRows = window.MOCK.constants.SUBJECT_NAMES
      .map((subject) => r.rows.find((x) => x.studentId === studentId && x.subject === subject))
      .filter(Boolean);
    const ts = r.stats.total[total.selection] || {};
    const withStats = (x) => {
      const st = r.stats.subjects[x.subject] || {};
      return {
        ...x,
        em: st.entry ? st.entry.mean : null, es: st.entry ? st.entry.std : null,
        cm: st.current ? st.current.mean : null, cs: st.current ? st.current.std : null,
        ew: r.weights[x.entryGrade - 1] || 0, cw: r.weights[x.currentGrade - 1] || 0
      };
    };
    const calcRows = subjectRows.map(withStats);
    calcRows.push({
      ...total, subject: '总分',
      em: ts.entry ? ts.entry.mean : null, es: ts.entry ? ts.entry.std : null,
      cm: ts.current ? ts.current.mean : null, cs: ts.current ? ts.current.std : null,
      ew: r.weights[total.entryGrade - 1] || 0, cw: r.weights[total.currentGrade - 1] || 0
    });
    const inputRows = subjectRows.map((x) => ({
      ...x,
      entryMode: x.entryAssigned != null ? '赋分' : (x.entryRaw != null ? '原始分' : '—'),
      currentMode: x.currentAssigned != null ? '赋分' : (x.currentRaw != null ? '原始分' : '—')
    })).concat([{
      ...total, subject: '总分',
      entryRaw: null, entryAssigned: null, currentRaw: null, currentAssigned: null,
      entryMode: '六科合计', currentMode: '六科合计'
    }]);
    const currentWeight = r.weights[total.currentGrade - 1] || 0;
    const keepContrib = total.status === '保持' ? Math.max(0, (r.weights[total.entryGrade - 1] || 0) - 10) : 0;
    const progressContrib = total.status === '进步' ? window.MOCK.helpers.progressWeight(total.entryGrade, total.level, r.weights) : 0;
    const declineContrib = total.status === '退步' ? window.MOCK.helpers.declineWeight(total.entryGrade, Math.abs(total.level), r.weights) : 0;
    const classGroup = r.classEval['总分'].find((x) => x.id === total.classId && x.schoolId === total.schoolId);
    const teacherGroup = r.teacherEval['总分'].find((x) => x.id === total.teacherId && x.schoolId === total.schoolId);
    const schoolGroup = r.schoolEval['总分'].find((x) => x.id === total.schoolId);
    const keepCount = subjectRows.filter((x) => x.status === '保持').length;
    const progressCount = subjectRows.filter((x) => x.status === '进步').length;
    const declineCount = subjectRows.filter((x) => x.status === '退步').length;
    let phrase = '';
    if (total.status === '进步') phrase = `总分相对位置上升，进步 ${total.level} 级`;
    else if (total.status === '退步') phrase = `总分相对位置下降，退步 ${Math.abs(total.level)} 级`;
    else phrase = '总分相对位置基本保持';
    return `<div class="card mt-16" id="processStudentDetail">
      <div class="card-head"><div><div class="card-title"><span class="dot"></span>${App.esc(total.studentName)} · 完整计算链路</div><div class="card-sub">${App.esc(total.studentNo)} · ${App.esc(total.schoolName)} ${App.esc(total.className)} · ${App.esc(total.selection)} · 入口 → 评价 → 判定 → 汇总</div></div>
        <div class="toolbar"><button class="btn btn-sm" data-action="backProcessStudent">返回学生列表</button></div>
      </div>
      <div class="card-body">
        <div class="grid grid-2 mb-16">
          <div>${UI.kv([
            ['学号', `<span class="code">${App.esc(total.studentNo)}</span>`],
            ['姓名', App.esc(total.studentName)],
            ['学校 / 班级', `${App.esc(total.schoolName)} / ${App.esc(total.className)}`],
            ['首选组', App.esc(total.selection)],
            ['外语语种', App.esc(student.language || '—')],
            ['入口考试', App.esc((window.MOCK.exams.find((e) => e.id === r.task.entryExamId) || {}).name || r.task.entryExamId)],
            ['评价考试', App.esc((window.MOCK.exams.find((e) => e.id === r.task.exitExamId) || {}).name || r.task.exitExamId)]
          ])}</div>
          <div>${UI.kv([
            ['等级档数', `${r.gradeCount} 档`],
            ['保持阈值 / 步长', `${r.keepThreshold} / ${r.stepSize}`],
            ['部分缺考', r.excludePartialAbsent ? '整生剔除' : '仅剔除该科'],
            ['入口总分 / 评价总分', `${fmt2(total.entryValue)} / ${fmt2(total.currentValue)}`],
            ['总分 z / Δz', `${fmt2(total.entryZ)} → ${fmt2(total.currentZ)} / ${fmt2(total.zDiff)}`],
            ['总分判定', `${total.status}（${total.level > 0 ? '+' : ''}${total.level} 级）`]
          ])}</div>
        </div>

        <div class="card mb-16"><div class="card-head"><div><div class="card-title"><span class="dot"></span>Step 1 · 原始输入与采用值</div><div class="card-sub">逐条成绩优先赋分；赋分缺失回退原始分</div></div></div>
          ${UI.table({ columns: [
            { key: 'subject', label: '科目' },
            { key: 'entryRaw', label: '入口原始', align: 'num', render: (x) => fmt2(x.entryRaw) },
            { key: 'entryAssigned', label: '入口赋分', align: 'num', render: (x) => fmt2(x.entryAssigned) },
            { key: 'entryValue', label: '入口采用', align: 'num', render: (x) => `<b>${fmt2(x.entryValue)}</b>` },
            { key: 'entryMode', label: '入口方式' },
            { key: 'currentRaw', label: '评价原始', align: 'num', render: (x) => fmt2(x.currentRaw) },
            { key: 'currentAssigned', label: '评价赋分', align: 'num', render: (x) => fmt2(x.currentAssigned) },
            { key: 'currentValue', label: '评价采用', align: 'num', render: (x) => `<b>${fmt2(x.currentValue)}</b>` },
            { key: 'currentMode', label: '评价方式' }
          ], rows: inputRows })}
        </div>

        <div class="card mb-16"><div class="card-head"><div><div class="card-title"><span class="dot"></span>Step 2 · 单科与总分标准化</div><div class="card-sub">均值、标准差、z、排名、等级、权重</div></div></div>
          ${UI.table({ columns: [
            { key: 'subject', label: '科目' },
            { key: 'em', label: '入口均值', align: 'num', render: (x) => fmt2(x.em) },
            { key: 'es', label: '入口标准差', align: 'num', render: (x) => fmt2(x.es) },
            { key: 'entryZ', label: '入口 z', align: 'num', render: (x) => fmt2(x.entryZ) },
            { key: 'entryRank', label: '入口排名', align: 'num' },
            { key: 'entryGrade', label: '入口等级', align: 'center', render: (x) => `G${x.entryGrade}` },
            { key: 'ew', label: '入口权重', align: 'num' },
            { key: 'cm', label: '评价均值', align: 'num', render: (x) => fmt2(x.cm) },
            { key: 'cs', label: '评价标准差', align: 'num', render: (x) => fmt2(x.cs) },
            { key: 'currentZ', label: '评价 z', align: 'num', render: (x) => fmt2(x.currentZ) },
            { key: 'currentRank', label: '评价排名', align: 'num' },
            { key: 'currentGrade', label: '评价等级', align: 'center', render: (x) => `G${x.currentGrade}` },
            { key: 'cw', label: '评价权重', align: 'num' },
          ], rows: calcRows })}
          <div class="formula-block mt-16">
            ${calcRows.map((x) => `<div>${App.esc(x.subject)}：入口 z =（${fmt2(x.entryValue)} − ${fmt2(x.em)}）÷ ${fmt2(x.es)} ≈ <b>${fmt2(x.entryZ)}</b>；评价 z =（${fmt2(x.currentValue)} − ${fmt2(x.cm)}）÷ ${fmt2(x.cs)} ≈ <b>${fmt2(x.currentZ)}</b></div>`).join('')}
            <div class="mt-8">z 已限幅到 [-3.1, 3.1]；每个排名组第一名为 3.1；等级按 Z 区间判定。</div>
          </div>
        </div>

        <div class="card mb-16"><div class="card-head"><div><div class="card-title"><span class="dot"></span>Step 3 · 判定与级数</div><div class="card-sub">Δz = 评价 z − 入口 z；|Δz| ≤ ${r.keepThreshold} 保持</div></div></div>
          ${UI.table({ columns: [
            { key: 'subject', label: '科目' },
            { key: 'entryGrade', label: '入口等级', align: 'center', render: (x) => `G${x.entryGrade}` },
            { key: 'currentGrade', label: '评价等级', align: 'center', render: (x) => `G${x.currentGrade}` },
            { key: 'zDiff', label: 'Δz', align: 'num', render: (x) => `<b>${fmt2(x.zDiff)}</b>` },
            { key: 'status', label: '判定', render: (x) => UI.badge(x.status, x.status === '进步' ? 'green' : x.status === '退步' ? 'red' : 'gray') },
            { key: 'level', label: '级数', align: 'num', render: (x) => x.level > 0 ? `+${x.level}` : x.level }
          ], rows: calcRows })}
        </div>

        <div class="card mb-16"><div class="card-head"><div><div class="card-title"><span class="dot"></span>Step 4 · 六科总分与汇总贡献</div><div class="card-sub">总分由六科采用值相加；权重贡献进入班级/教师/学校汇总</div></div></div>
          <div class="formula-block">
            <div>入口总分 = ${subjectRows.map((x) => fmt2(x.entryValue)).join(' + ')} = <b>${fmt2(total.entryValue)}</b></div>
            <div>评价总分 = ${subjectRows.map((x) => fmt2(x.currentValue)).join(' + ')} = <b>${fmt2(total.currentValue)}</b></div>
            <div>入口总分 z =（${fmt2(total.entryValue)} − ${fmt2(ts.entry ? ts.entry.mean : null)}）÷ ${fmt2(ts.entry ? ts.entry.std : null)} ≈ <b>${fmt2(total.entryZ)}</b></div>
            <div>评价总分 z =（${fmt2(total.currentValue)} − ${fmt2(ts.current ? ts.current.mean : null)}）÷ ${fmt2(ts.current ? ts.current.std : null)} ≈ <b>${fmt2(total.currentZ)}</b></div>
            <div>总分 Δz = ${fmt2(total.currentZ)} − ${fmt2(total.entryZ)} = <b>${fmt2(total.zDiff)}</b>；判定 <b>${total.status}</b>，级数 ${total.level > 0 ? '+' : ''}${total.level}。</div>
          </div>
          <div class="grid grid-2 mt-16">
            <div>${UI.kv([
              ['评价等级 / 权重', `G${total.currentGrade} / ${currentWeight}`],
              ['保持贡献', fmt2(keepContrib)],
              ['进步贡献', fmt2(progressContrib)],
              ['退步贡献', fmt2(declineContrib)],
              ['计入班级分子', `权重 ${fmt2(currentWeight)} + 保持 ${fmt2(keepContrib)} + 进步 ${fmt2(progressContrib)} + 退步 ${fmt2(declineContrib)}`]
            ])}</div>
            <div>${UI.kv([
              ['班级', classGroup ? `${classGroup.schoolName} ${classGroup.name}` : '—'],
              ['班级人数', classGroup ? classGroup.n : '—'],
              ['班级学业实力', classGroup ? fmt2(classGroup.strength) : '—'],
              ['班级相对进步率', classGroup ? classGroup.rate : '—'],
              ['班级排名', classGroup ? `${classGroup.strengthRank || '—'} / ${classGroup.rateRank || '—'}` : '—']
            ])}</div>
          </div>
          <div class="mt-16">${UI.table({ columns: [
            { key: 'level', label: '汇总层级' },
            { key: 'name', label: '对象' },
            { key: 'n', label: '人数', align: 'num' },
            { key: 'strength', label: '学业实力', align: 'num', render: (x) => fmt2(x.strength) },
            { key: 'rate', label: '相对进步率', align: 'num', render: (x) => x.n < r.smallSample ? '样本不足' : x.rate },
            { key: 'strengthRank', label: '实力排名', align: 'num', render: (x) => x.strengthRank || '—' },
            { key: 'rateRank', label: '进步率排名', align: 'num', render: (x) => x.rateRank || '—' }
          ], rows: [
            { level: '班级', name: classGroup ? `${classGroup.schoolName} ${classGroup.name}` : '—', n: classGroup ? classGroup.n : 0, strength: classGroup ? classGroup.strength : 0, rate: classGroup ? classGroup.rate : 0, strengthRank: classGroup ? classGroup.strengthRank : null, rateRank: classGroup ? classGroup.rateRank : null },
            { level: '教师', name: teacherGroup ? `${teacherGroup.schoolName} ${teacherGroup.name}` : (total.teacherName || '—'), n: teacherGroup ? teacherGroup.n : 0, strength: teacherGroup ? teacherGroup.strength : 0, rate: teacherGroup ? teacherGroup.rate : 0, strengthRank: teacherGroup ? teacherGroup.strengthRank : null, rateRank: teacherGroup ? teacherGroup.rateRank : null },
            { level: '学校', name: schoolGroup ? schoolGroup.schoolName : total.schoolName, n: schoolGroup ? schoolGroup.n : 0, strength: schoolGroup ? schoolGroup.strength : 0, rate: schoolGroup ? schoolGroup.rate : 0, strengthRank: schoolGroup ? schoolGroup.strengthRank : null, rateRank: schoolGroup ? schoolGroup.rateRank : null }
          ] })}</div>
          <div class="alert info mt-16">${UI.icon('alert')}<div>汇总时先把全班/教师/学校学生的权重/贡献相加，再除以对应人数；所以这里的“贡献”是该生计入汇总分子的原始值，不是最终指标。</div></div>
        </div>

        <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>Step 5 · 结论</div></div></div><div class="card-body">
          <div class="flex gap-8 wrap items-center mb-12">
            ${UI.badge(total.status, total.status === '进步' ? 'green' : total.status === '退步' ? 'red' : 'gray')}
            <span>总分 ${App.esc(total.status)}，${total.level > 0 ? '+' : ''}${total.level} 级</span>
            <span class="muted">六科：保持 ${keepCount} · 进步 ${progressCount} · 退步 ${declineCount}</span>
          </div>
          <div class="small" style="line-height:1.9">${App.esc(total.studentName)} 的${phrase}；入口总分 ${fmt2(total.entryValue)}，评价总分 ${fmt2(total.currentValue)}，总分 z 从 ${fmt2(total.entryZ)} 变为 ${fmt2(total.currentZ)}。该生评价权重 ${currentWeight}，保持贡献 ${fmt2(keepContrib)}，进步贡献 ${fmt2(progressContrib)}，退步贡献 ${fmt2(declineContrib)}，进入班级汇总。</div>
        </div></div>
      </div>
    </div>`;
  }

  function processStep3(r) {
    const subject = App.state.processSubject || '总分';
    let rows = r.rows.filter((x) => x.subject === subject);
    if (!App.canEdit()) rows = rows.filter((x) => x.schoolId === App.state.schoolId);
    const keyword = (App.state.processKeyword || '').trim().toLowerCase();
    if (keyword) rows = rows.filter((x) => x.studentName.toLowerCase().includes(keyword) || x.studentNo.toLowerCase().includes(keyword));
    rows = rows.slice().sort((a, b) => a.schoolId.localeCompare(b.schoolId)
      || processClassNo(a.className) - processClassNo(b.className)
      || a.studentNo.localeCompare(b.studentNo));
    const size = 20;
    const page = Math.min(Math.max(1, App.state.processPage || 1), Math.max(1, Math.ceil(rows.length / size)));
    const pageRows = rows.slice((page - 1) * size, page * size);
    return `${processSubjectChips(subject, 'setProcessSubject')}
      <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>学生级标准分与等级</div><div class="card-sub">${App.esc(subject)} · 入口 → 评价 · 共 ${rows.length} 条 · 点击学生查看完整计算链路</div></div>
        <div class="toolbar"><div class="search">${UI.icon('search')}<input id="processSearch" class="input input-sm" placeholder="姓名/学号" value="${App.esc(App.state.processKeyword || '')}" oninput="if (!event.isComposing) App.setProcessKeyword(this.value)" /></div></div>
      </div>
      ${rows.length ? `${UI.table({
        columns: [
          { key: 'studentNo', label: '学号', render: (x) => `<span class="code">${App.esc(x.studentNo)}</span>` },
          { key: 'studentName', label: '姓名', render: (x) => `<button type="button" data-action="openProcessStudent" data-id="${x.studentId}" style="border:0;background:none;color:var(--primary);cursor:pointer;padding:0;font:inherit">${App.esc(x.studentName)}</button>` },
          { key: 'schoolName', label: '学校' },
          { key: 'className', label: '班级' },
          { key: 'entryValue', label: '入口值', align: 'num', render: (x) => fmt2(x.entryValue) },
          { key: 'entryZ', label: '入口 z', align: 'num', render: (x) => fmt2(x.entryZ) },
          { key: 'currentValue', label: '评价值', align: 'num', render: (x) => fmt2(x.currentValue) },
          { key: 'currentZ', label: '评价 z', align: 'num', render: (x) => fmt2(x.currentZ) },
          { key: 'zDiff', label: 'Δz', align: 'num', render: (x) => `<b>${fmt2(x.zDiff)}</b>` },
          { key: 'entryGrade', label: '入口等级', align: 'center', render: (x) => `G${x.entryGrade}` },
          { key: 'currentGrade', label: '评价等级', align: 'center', render: (x) => `G${x.currentGrade}` },
          { key: 'status', label: '进退步', render: (x) => UI.badge(x.status, x.status === '进步' ? 'green' : x.status === '退步' ? 'red' : 'gray') },
          { key: 'level', label: '级数', align: 'num', render: (x) => x.level > 0 ? `+${x.level}` : x.level },
          { key: 'action', label: '', render: (x) => `<button type="button" class="btn btn-sm" data-action="openProcessStudent" data-id="${x.studentId}">查看计算</button>` }
        ],
        rows: pageRows
      })}${UI.pagination(rows.length, page, size, 'processPage', '条')}` : UI.empty('未找到匹配记录')}
      </div>
      ${processStudentDetail(r)}
      <div class="alert info mt-16">${UI.icon('alert')}<div>Δz = 评价标准分 − 入口标准分；|Δz| ≤ ${r.keepThreshold} 为保持，Δz &gt; ${r.keepThreshold} 为进步，Δz &lt; -${r.keepThreshold} 为退步；级数按步长 ${r.stepSize} 计算。</div></div>`;
  }

  function processStep4(r) {
    const bandRows = r.bands.map((pct, i) => {
      const prev = i === 0 ? null : r.bands[i - 1];
      const z = i === 0 ? `Z > ${r.zBands[0]}`
        : i === r.bands.length - 1 ? `Z ≤ ${r.zBands[r.zBands.length - 1]}`
          : `${r.zBands[i]} < Z ≤ ${r.zBands[i - 1]}`;
      return {
        grade: `G${i + 1}`,
        z,
        share: `${Math.round((pct - (prev || 0)) * 10) / 10}%`,
        weight: r.weights[i]
      };
    });
    const statusRows = ['总分'].concat(window.MOCK.constants.SUBJECT_NAMES).map((subject) => {
      const list = r.rows.filter((x) => x.subject === subject);
      const keep = list.filter((x) => x.status === '保持').length;
      const progress = list.filter((x) => x.status === '进步').length;
      const decline = list.filter((x) => x.status === '退步').length;
      return {
        subject, n: list.length, keep, progress, decline,
        avgLevel: list.length ? list.reduce((s, x) => s + (x.level || 0), 0) / list.length : 0
      };
    });
    return `<div class="grid grid-2 mb-16">
      <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>等级 Z 区间与权重</div><div class="card-sub">按标准正态 Z 区间划等级；Z 限幅 [-3.1, 3.1]</div></div></div>
        ${UI.table({ columns: [
          { key: 'grade', label: '等级' },
          { key: 'z', label: 'Z 区间' },
          { key: 'share', label: '理论占比', align: 'num' },
          { key: 'weight', label: '权重', align: 'num' }
        ], rows: bandRows })}
      </div>
      <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>判定规则</div></div></div><div class="card-body small" style="display:flex;flex-direction:column;gap:8px">
        <div>标准分法：|Δz| ≤ ${r.keepThreshold} 保持；Δz &gt; ${r.keepThreshold} 进步；Δz &lt; -${r.keepThreshold} 退步。</div>
        <div>级数：进步 = 1 + floor((Δz − 阈值) ÷ 步长)；退步取负。</div>
        <div>等级差法：入口等级 − 评价等级，正数为进步。</div>
        <div>保持值、进步值、退步值按入口等级权重和跨级权重计算。</div>
      </div></div>
    </div>
    <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>各科判定分布</div><div class="card-sub">按科目统计保持 / 进步 / 退步人数与平均级数</div></div></div>
      ${UI.table({ columns: [
        { key: 'subject', label: '科目' },
        { key: 'n', label: '人数', align: 'num' },
        { key: 'keep', label: '保持', align: 'num' },
        { key: 'progress', label: '进步', align: 'num' },
        { key: 'decline', label: '退步', align: 'num' },
        { key: 'avgLevel', label: '平均级数', align: 'num', render: (x) => x.avgLevel > 0 ? `+${fmt2(x.avgLevel)}` : fmt2(x.avgLevel) }
      ], rows: statusRows })}
    </div>`;
  }

  function processClassDetail(r) {
    const classId = App.state.processClassId;
    const subject = App.state.processSubject || '总分';
    if (!classId || (App.state.processAggTab || 'classes') !== 'classes') return '';
    const group = (r.classEval[subject] || []).find((x) => x.id === classId);
    if (!group) return `<div class="card mt-16" id="processClassDetail"><div class="card-body">${UI.empty('该班级在当前科目下没有汇总数据')}<div class="mt-12"><button class="btn btn-sm" data-action="backProcessClass">返回班级列表</button></div></div></div>`;
    if (!App.canEdit() && group.schoolId !== App.state.schoolId) return '';
    const members = r.rows.filter((x) => x.subject === subject && x.classId === group.id && x.schoolId === group.schoolId)
      .slice().sort((a, b) => a.studentNo.localeCompare(b.studentNo));
    const rows = members.map((x) => {
      const currentWeight = r.weights[x.currentGrade - 1] || 0;
      const keepContrib = x.status === '保持' ? Math.max(0, (r.weights[x.entryGrade - 1] || 0) - 10) : 0;
      const progressContrib = x.status === '进步' ? window.MOCK.helpers.progressWeight(x.entryGrade, x.level, r.weights) : 0;
      const declineContrib = x.status === '退步' ? window.MOCK.helpers.declineWeight(x.entryGrade, Math.abs(x.level), r.weights) : 0;
      return {
        studentNo: x.studentNo, studentName: x.studentName, entryGrade: x.entryGrade, currentGrade: x.currentGrade,
        status: x.status, level: x.level, currentWeight, keepContrib, progressContrib, declineContrib
      };
    });
    const sum = rows.reduce((a, x) => {
      a.currentWeight += x.currentWeight; a.keepContrib += x.keepContrib;
      a.progressContrib += x.progressContrib; a.declineContrib += x.declineContrib;
      return a;
    }, { currentWeight: 0, keepContrib: 0, progressContrib: 0, declineContrib: 0 });
    const totalRow = {
      studentNo: '', studentName: '合计', entryGrade: '', currentGrade: '', status: '', level: '',
      currentWeight: sum.currentWeight, keepContrib: sum.keepContrib,
      progressContrib: sum.progressContrib, declineContrib: sum.declineContrib
    };
    const classRecord = window.MOCK.classes.find((c) => c.id === group.id);
    const homeroom = classRecord && window.MOCK.teachers.find((t) => t.id === classRecord.homeroomTeacherId);
    return `<div class="card mt-16" id="processClassDetail">
      <div class="card-head"><div><div class="card-title"><span class="dot"></span>${App.esc(group.schoolName)} ${App.esc(group.name)} · 班级完整计算过程</div><div class="card-sub">${App.esc(subject)} · ${group.n} 人 · 校内排名</div></div>
        <div class="toolbar"><button class="btn btn-sm" data-action="backProcessClass">返回班级列表</button></div>
      </div>
      <div class="card-body">
        <div class="grid grid-2 mb-16">
          <div>${UI.kv([
            ['学校 / 班级', `${App.esc(group.schoolName)} / ${App.esc(group.name)}`],
            ['科目', App.esc(subject)],
            ['班级人数', `${group.n} 人`],
            ['班主任', homeroom ? App.esc(homeroom.name) : '—'],
            ['学业实力 / 相对进步率', `${fmt2(group.strength)} / ${group.n < r.smallSample ? '样本不足' : group.rate}`],
            ['校内排名（实力 / 进步率）', `${group.strengthRank || '—'} / ${group.rateRank || '—'}`]
          ])}</div>
          <div>${UI.kv([
            ['保持人数 / 进步人数 / 退步人数', `${group.keepCount} / ${group.progressCount} / ${group.declineCount}`],
            ['Σ评价权重 / 学业实力', `${fmt2(group.strengthSum)} / ${fmt2(group.strength)}`],
            ['Σ保持贡献 / 保持值', `${fmt2(group.keepSum)} / ${fmt2(group.keep)}`],
            ['Σ进步贡献 / 进步值', `${fmt2(group.progressSum)} / ${fmt2(group.progress)}`],
            ['Σ退步贡献 / 退步值', `${fmt2(group.declineSum)} / ${fmt2(group.decline)}`],
            ['平均级数', group.avgLevel > 0 ? `+${fmt2(group.avgLevel)}` : fmt2(group.avgLevel)]
          ])}</div>
        </div>

        <div class="card mb-16"><div class="card-head"><div><div class="card-title"><span class="dot"></span>Step 1 · 班级成员逐人取值</div><div class="card-sub">评价权重、保持贡献、进步贡献、退步贡献</div></div></div>
          ${UI.table({ columns: [
            { key: 'studentNo', label: '学号', render: (x) => x.studentNo ? `<span class="code">${App.esc(x.studentNo)}</span>` : '' },
            { key: 'studentName', label: '姓名', render: (x) => x.studentName === '合计' ? '<b>合计</b>' : App.esc(x.studentName) },
            { key: 'entryGrade', label: '入口等级', align: 'center', render: (x) => x.entryGrade ? `G${x.entryGrade}` : '' },
            { key: 'currentGrade', label: '评价等级', align: 'center', render: (x) => x.currentGrade ? `G${x.currentGrade}` : '' },
            { key: 'status', label: '判定', render: (x) => x.status ? UI.badge(x.status, x.status === '进步' ? 'green' : x.status === '退步' ? 'red' : 'gray') : '' },
            { key: 'level', label: '级数', align: 'num', render: (x) => x.level === '' ? '' : (x.level > 0 ? `+${x.level}` : x.level) },
            { key: 'currentWeight', label: '评价权重', align: 'num', render: (x) => fmt2(x.currentWeight) },
            { key: 'keepContrib', label: '保持贡献', align: 'num', render: (x) => fmt2(x.keepContrib) },
            { key: 'progressContrib', label: '进步贡献', align: 'num', render: (x) => fmt2(x.progressContrib) },
            { key: 'declineContrib', label: '退步贡献', align: 'num', render: (x) => fmt2(x.declineContrib) }
          ], rows: rows.concat([totalRow]) })}
        </div>

        <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>Step 2 · 汇总公式代入</div><div class="card-sub">先求和，再除以人数，最后算相对进步率</div></div></div><div class="card-body">
          <div class="formula-block">
            <div>人数 n = ${group.n}</div>
            <div>学业实力 = Σ评价权重 ${fmt2(group.strengthSum)} ÷ ${group.n} = <b>${fmt2(group.strength)}</b></div>
            <div>保持值 = Σ保持贡献 ${fmt2(group.keepSum)} ÷ ${group.n} = <b>${fmt2(group.keep)}</b></div>
            <div>进步值 = Σ进步贡献 ${fmt2(group.progressSum)} ÷ ${group.n} = <b>${fmt2(group.progress)}</b></div>
            <div>退步值 = Σ退步贡献 ${fmt2(group.declineSum)} ÷ ${group.n} = <b>${fmt2(group.decline)}</b></div>
            <div>相对进步率 =（${fmt2(group.keep)} + ${fmt2(group.progress)}×2）÷（（${fmt2(group.decline)}+1）×1.5）= <b>${group.rate}</b></div>
            <div>平均级数 = Σ级数 ${fmt2(group.levelSum)} ÷ ${group.n} = <b>${group.avgLevel > 0 ? '+' : ''}${fmt2(group.avgLevel)}</b></div>
          </div>
          ${group.n < r.smallSample ? `<div class="alert warn mt-16">${UI.icon('alert')}<div>该班人数少于 ${r.smallSample} 人，只展示指标，不参与排名。</div></div>` : ''}
          <div class="alert info mt-16">${UI.icon('alert')}<div>班级排名是校内排名；学业实力、保持值、进步值、退步值都是“先求全班总和，再除以班级人数”。相对进步率再用四个均值合成，不是百分比。</div></div>
        </div></div>
      </div>
    </div>`;
  }

  function processStep5(r) {
    const subject = App.state.processSubject || '总分';
    const tab = App.state.processAggTab || 'classes';
    const conf = tab === 'teachers'
      ? { groups: r.teacherEval[subject], label: '教师', nameKey: 'name' }
      : tab === 'schools'
        ? { groups: r.schoolEval[subject], label: '学校', nameKey: 'schoolName' }
        : { groups: r.classEval[subject], label: '班级', nameKey: 'name' };
    let groups = (conf.groups || []).slice();
    if (!App.canEdit() && tab !== 'schools') groups = groups.filter((g) => g.schoolId === App.state.schoolId);
    if (tab === 'schools') groups.sort((a, b) => (a.rateRank || 99) - (b.rateRank || 99));
    else if (tab === 'classes') groups.sort((a, b) => a.schoolName.localeCompare(b.schoolName, 'zh')
      || processClassNo(a.name) - processClassNo(b.name));
    else groups.sort((a, b) => a.schoolName.localeCompare(b.schoolName, 'zh') || String(a.name).localeCompare(String(b.name), 'zh'));
    const columns = [];
    if (tab === 'schools') {
      columns.push({ key: 'name', label: '学校', render: (x) => App.esc(x.schoolName) });
    } else {
      columns.push({ key: 'schoolName', label: '学校' });
      columns.push({ key: 'name', label: conf.label, render: (x) => tab === 'classes'
        ? `<button type="button" data-action="openProcessClass" data-id="${x.id}" style="border:0;background:none;color:var(--primary);cursor:pointer;padding:0;font:inherit">${App.esc(x[conf.nameKey])}</button>`
        : App.esc(x[conf.nameKey]) });
    }
    columns.push(
      { key: 'n', label: '人数', align: 'num', render: (x) => x.n < r.smallSample ? `${x.n} <span class="badge badge-amber">样本不足（&lt;${r.smallSample}人）</span>` : x.n },
      { key: 'strengthSum', label: '实力权重Σ', align: 'num', render: (x) => fmt2(x.strengthSum) },
      { key: 'strength', label: '学业实力', align: 'num', render: (x) => fmt2(x.strength) },
      { key: 'keepSum', label: '保持Σ', align: 'num', render: (x) => fmt2(x.keepSum) },
      { key: 'keep', label: '保持值', align: 'num', render: (x) => fmt2(x.keep) },
      { key: 'progressSum', label: '进步Σ', align: 'num', render: (x) => fmt2(x.progressSum) },
      { key: 'progress', label: '进步值', align: 'num', render: (x) => fmt2(x.progress) },
      { key: 'declineSum', label: '退步Σ', align: 'num', render: (x) => fmt2(x.declineSum) },
      { key: 'decline', label: '退步值', align: 'num', render: (x) => fmt2(x.decline) },
      { key: 'keepCount', label: '保持人数', align: 'num' },
      { key: 'progressCount', label: '进步人数', align: 'num' },
      { key: 'declineCount', label: '退步人数', align: 'num' },
      { key: 'rate', label: '相对进步率', align: 'num', render: (x) => x.n < r.smallSample ? `<span class="weak">样本不足（&lt;${r.smallSample}人）</span>` : `<b>${x.rate}</b>` },
      { key: 'avgLevel', label: '平均级数', align: 'num', render: (x) => x.avgLevel > 0 ? `+${fmt2(x.avgLevel)}` : fmt2(x.avgLevel) }
    );
    if (tab === 'classes') {
      columns.push({ key: 'action', label: '', render: (x) => `<button type="button" class="btn btn-sm" data-action="openProcessClass" data-id="${x.id}">查看计算</button>` });
    }
    return `${processSubjectChips(subject, 'setProcessSubject')}
      <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>四层汇总过程</div><div class="card-sub">汇总输入为人数、权重和、各级人数；输出为均值与相对进步率；班级可点击查看完整计算</div></div></div>
        ${UI.tabs([
          { key: 'classes', label: '班级', active: tab === 'classes' },
          { key: 'teachers', label: '教师', active: tab === 'teachers' },
          { key: 'schools', label: '学校', active: tab === 'schools' }
        ], 'setProcessAggTab')}
        ${UI.table({ columns, rows: groups })}
      </div>
      ${processClassDetail(r)}
      <div class="alert info mt-16">${UI.icon('alert')}<div>学业实力 = Σ评价等级权重 ÷ 人数；保持值 = Σ(入口等级权重 − 10) ÷ 人数；进步值 = Σ进步跨级权重 ÷ 人数；退步值 = Σ(100 − 退步等级权重) ÷ 人数；相对进步率 =（保持值 + 进步值×2）÷（（退步值+1）×1.5）。</div></div>`;
  }

  function processStep6(r) {
    const formulaRows = [
      { item: '标准分', formula: 'z =（分数 − 联考均值）÷ 联考标准差', note: '同科目、同首选组内计算；标准差为样本标准差（n−1）' },
      { item: '总分', formula: '总分 = 六科采用值之和', note: '每科逐条优先赋分、缺失回退原始分；按物理类/历史类分组标准化' },
      { item: 'Z 限幅', formula: 'z = clamp((x − μ) ÷ σ, -3.1, 3.1)；组内第一名 z=3.1', note: '先算原始标准分，再限幅并处理第一名' },
      { item: '等级', formula: '按标准正态 Z 区间划分 G1…G9', note: 'G1 Z>1.75，G9 Z≤-1.75；理论占比 4%/6.5%/…/4%' },
      { item: '标准分判定', formula: '|Δz| ≤ 阈值 → 保持；Δz > 阈值 → 进步；Δz < −阈值 → 退步', note: `当前阈值 ${r.keepThreshold}` },
      { item: '级数', formula: '进步 = 1 + floor((Δz − 阈值) ÷ 步长)；退步取负', note: `当前步长 ${r.stepSize}` },
      { item: '等级差法', formula: '级数 = 入口等级 − 评价等级', note: '正数为进步，负数为退步，0 为保持' },
      { item: '学业实力', formula: 'Σ（本次等级权重）÷ 人数', note: '按评价等级权重求和后除以人数' },
      { item: '保持值', formula: 'Σ（入口等级权重 − 10）÷ 人数', note: '仅统计判定为保持的学生' },
      { item: '进步值', formula: 'Σ（进步跨级权重）÷ 人数', note: '从入口等级向上跨级对应的权重和' },
      { item: '退步值', formula: 'Σ（100 − 退步等级权重）÷ 人数', note: '从入口等级向下跨级对应的权重和' },
      { item: '相对进步率', formula: '（保持值 + 进步值×2）÷（（退步值+1）×1.5）', note: '班级、教师、学校指标一致' },
      { item: '平均进退步', formula: 'Σ级数 ÷ 人数', note: '正数为平均进步，负数为平均退步' },
      { item: '小样本', formula: `人数 < ${r.smallSample} 不排名`, note: '仅标注样本不足，不参与排名' }
    ];
    return `<div class="grid grid-2 mb-16">
      <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>计算链路</div></div></div><div class="card-body small" style="display:flex;flex-direction:column;gap:10px">
        <div><b>① 数据准备</b>：确定入口/评价考试、参与学校、按校版本、科目口径，剔除无法配对或不完整学生。</div>
        <div><b>② 联考统计</b>：按科目（总分按首选组）计算人数、均值、标准差。</div>
        <div><b>③ 标准分</b>：入口、评价分别计算 z；Δz = 评价 z − 入口 z。</div>
        <div><b>④ 限幅与等级</b>：原始 z 限幅、组内第一名 3.1，按 Z 区间划等级并取权重。</div>
        <div><b>⑤ 判定</b>：按 Δz 或等级差判定保持/进步/退步，计算级数。</div>
        <div><b>⑥ 四层汇总</b>：学生 → 班级 → 教师 → 学校，逐层汇总权重和与人数。</div>
      </div></div>
      <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>本次参数</div></div></div><div class="card-body">${UI.kv([
        ['算法', r.task.algorithm === 'grade' ? '等级差法' : '标准分法'],
        ['等级档数', `${r.gradeCount} 档`],
        ['档位上限', r.bands.map((x) => x + '%').join(' / ')],
        ['档位权重', r.weights.join(' / ')],
        ['保持阈值', r.keepThreshold],
        ['步长', r.stepSize],
        ['小样本阈值', `${r.smallSample} 人`],
        ['统计总体', '联考全体（4 校）']
      ])}</div></div>
    </div>
    <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>公式与判定</div><div class="card-sub">结果页所有指标均由以下公式计算</div></div></div>
      ${UI.table({ columns: [
        { key: 'item', label: '项目' },
        { key: 'formula', label: '公式' },
        { key: 'note', label: '说明' }
      ], rows: formulaRows })}
    </div>
    <div class="alert info mt-16">${UI.icon('alert')}<div>边界：部分缺考由任务参数决定整生剔除或仅剔除该科；总分要求六科完整；赋分逐条优先、缺失回退原始分；外语语种不一致按不可比剔除；班级/教师少于 ${r.smallSample} 人不排名。</div></div>`;
  }

  function processStep7(r) {
    const tab = App.state.processExampleTab || 'student';
    return `<div class="card mb-16"><div class="card-body"><div class="flex gap-8 wrap items-center"><span class="chip-group-label">示例</span><button type="button" class="chip ${tab === 'student' ? 'active' : ''}" data-action="setProcessExampleTab" data-value="student">一个学生</button><button type="button" class="chip ${tab === 'class' ? 'active' : ''}" data-action="setProcessExampleTab" data-value="class">一个班级</button></div></div></div>
      ${tab === 'student' ? processStudentExample(r) : processClassExample(r)}`;
  }

  function processStudentExample(r) {
    const total = r.totals.find((x) => x.studentNo === '2024230101') || r.totals[0];
    if (!total) return UI.empty('暂无可展示学生');
    const subjectRows = window.MOCK.constants.SUBJECT_NAMES
      .map((subject) => r.rows.find((x) => x.studentId === total.studentId && x.subject === subject))
      .filter(Boolean);
    const totalStats = r.stats.total[total.selection] || {};
    const scoreRows = subjectRows.map((x) => {
      const st = r.stats.subjects[x.subject] || {};
      return {
        subject: x.subject,
        entryRaw: x.entryRaw, entryAssigned: x.entryAssigned, entryValue: x.entryValue,
        entryMean: st.entry ? st.entry.mean : null, entryStd: st.entry ? st.entry.std : null,
        currentRaw: x.currentRaw, currentAssigned: x.currentAssigned, currentValue: x.currentValue,
        currentMean: st.current ? st.current.mean : null, currentStd: st.current ? st.current.std : null
      };
    });
    scoreRows.push({
      subject: '总分', entryRaw: null, entryAssigned: null, entryValue: total.entryValue,
      entryMean: totalStats.entry ? totalStats.entry.mean : null, entryStd: totalStats.entry ? totalStats.entry.std : null,
      currentRaw: null, currentAssigned: null, currentValue: total.currentValue,
      currentMean: totalStats.current ? totalStats.current.mean : null, currentStd: totalStats.current ? totalStats.current.std : null
    });
    const judgeRows = subjectRows.map((x) => ({
      subject: x.subject, entryZ: x.entryZ, entryRank: x.entryRank, entryGrade: x.entryGrade,
      currentZ: x.currentZ, currentRank: x.currentRank, currentGrade: x.currentGrade,
      zDiff: x.zDiff, status: x.status, level: x.level
    }));
    judgeRows.push({
      subject: '总分', entryZ: total.entryZ, entryRank: total.entryRank, entryGrade: total.entryGrade,
      currentZ: total.currentZ, currentRank: total.currentRank, currentGrade: total.currentGrade,
      zDiff: total.zDiff, status: total.status, level: total.level
    });
    const firstSubject = subjectRows[0];
    return `<div class="card mb-16"><div class="card-head"><div><div class="card-title"><span class="dot"></span>示例学生</div><div class="card-sub">${App.esc(total.studentName)} · ${App.esc(total.studentNo)} · ${App.esc(total.schoolName)} ${App.esc(total.className)} · ${App.esc(total.selection)} · 外语 ${App.esc((window.MOCK.students.find((s) => s.id === total.studentId) || {}).language || '—')}</div></div></div>
      <div class="card-body">${UI.kv([
        ['入口总分', fmt2(total.entryValue)],
        ['评价总分', fmt2(total.currentValue)],
        ['入口 z / 评价 z', `${fmt2(total.entryZ)} / ${fmt2(total.currentZ)}`],
        ['Δz', fmt2(total.zDiff)],
        ['入口等级 → 评价等级', `G${total.entryGrade} → G${total.currentGrade}`],
        ['判定', `${total.status}（${total.level > 0 ? '+' : ''}${total.level} 级）`]
      ])}</div></div>
      <div class="card mb-16"><div class="card-head"><div><div class="card-title"><span class="dot"></span>第一步：六科分数与联考统计量</div><div class="card-sub">采用值 = 本次口径下的分数；再选科目同时列出原始分和赋分</div></div></div>
        ${UI.table({ columns: [
          { key: 'subject', label: '科目' },
          { key: 'entryRaw', label: '入口原始', align: 'num', render: (x) => x.entryRaw == null ? '<span class="weak">—</span>' : fmt2(x.entryRaw) },
          { key: 'entryAssigned', label: '入口赋分', align: 'num', render: (x) => x.entryAssigned == null ? '<span class="weak">—</span>' : fmt2(x.entryAssigned) },
          { key: 'entryValue', label: '入口采用', align: 'num', render: (x) => `<b>${fmt2(x.entryValue)}</b>` },
          { key: 'entryMean', label: '入口均值', align: 'num', render: (x) => fmt2(x.entryMean) },
          { key: 'entryStd', label: '入口标准差', align: 'num', render: (x) => fmt2(x.entryStd) },
          { key: 'currentRaw', label: '评价原始', align: 'num', render: (x) => x.currentRaw == null ? '<span class="weak">—</span>' : fmt2(x.currentRaw) },
          { key: 'currentAssigned', label: '评价赋分', align: 'num', render: (x) => x.currentAssigned == null ? '<span class="weak">—</span>' : fmt2(x.currentAssigned) },
          { key: 'currentValue', label: '评价采用', align: 'num', render: (x) => `<b>${fmt2(x.currentValue)}</b>` },
          { key: 'currentMean', label: '评价均值', align: 'num', render: (x) => fmt2(x.currentMean) },
          { key: 'currentStd', label: '评价标准差', align: 'num', render: (x) => fmt2(x.currentStd) }
        ], rows: scoreRows })}
      </div>
      <div class="card mb-16"><div class="card-head"><div><div class="card-title"><span class="dot"></span>第二步：标准分、排名、等级与判定</div><div class="card-sub">z、排名、等级、Δz、判定、级数</div></div></div>
        ${UI.table({ columns: [
          { key: 'subject', label: '科目' },
          { key: 'entryZ', label: '入口 z', align: 'num', render: (x) => fmt2(x.entryZ) },
          { key: 'entryRank', label: '入口排名', align: 'num' },
          { key: 'entryGrade', label: '入口等级', align: 'center', render: (x) => `G${x.entryGrade}` },
          { key: 'currentZ', label: '评价 z', align: 'num', render: (x) => fmt2(x.currentZ) },
          { key: 'currentRank', label: '评价排名', align: 'num' },
          { key: 'currentGrade', label: '评价等级', align: 'center', render: (x) => `G${x.currentGrade}` },
          { key: 'zDiff', label: 'Δz', align: 'num', render: (x) => `<b>${fmt2(x.zDiff)}</b>` },
          { key: 'status', label: '判定', render: (x) => UI.badge(x.status, x.status === '进步' ? 'green' : x.status === '退步' ? 'red' : 'gray') },
          { key: 'level', label: '级数', align: 'num', render: (x) => x.level > 0 ? `+${x.level}` : x.level }
        ], rows: judgeRows })}
      </div>
      <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>第三步：逐项代入公式</div></div></div><div class="card-body small" style="display:flex;flex-direction:column;gap:8px">
        <div>入口 ${App.esc(firstSubject.subject)} z =（${fmt2(firstSubject.entryValue)} − ${fmt2(firstSubject.entryZ == null ? null : (r.stats.subjects[firstSubject.subject] || {}).entry.mean)}）÷ ${fmt2((r.stats.subjects[firstSubject.subject] || {}).entry.std)} = <b>${fmt2(firstSubject.entryZ)}</b></div>
        <div>入口总分 z =（${fmt2(total.entryValue)} − ${fmt2(totalStats.entry ? totalStats.entry.mean : null)}）÷ ${fmt2(totalStats.entry ? totalStats.entry.std : null)} = <b>${fmt2(total.entryZ)}</b></div>
        <div>评价总分 z =（${fmt2(total.currentValue)} − ${fmt2(totalStats.current ? totalStats.current.mean : null)}）÷ ${fmt2(totalStats.current ? totalStats.current.std : null)} = <b>${fmt2(total.currentZ)}</b></div>
        <div>总分 Δz = ${fmt2(total.currentZ)} − ${fmt2(total.entryZ)} = <b>${fmt2(total.zDiff)}</b>；|Δz| ${Math.abs(total.zDiff) >= r.keepThreshold ? '≥' : '<'} ${r.keepThreshold}，判定为 <b>${total.status}</b>，级数 ${total.level > 0 ? '+' : ''}${total.level}。</div>
        <div>入口等级 G${total.entryGrade} → 评价等级 G${total.currentGrade}；总分为 ${total.selection} 组内标准化，排名为组内联考排名。</div>
      </div></div>`;
  }

  function processClassExample(r) {
    const cls = r.classEval['总分'].find((x) => x.schoolId === 'S01' && x.name === '高三1班') || r.classEval['总分'][0];
    if (!cls) return UI.empty('暂无可展示班级');
    const members = r.totals.filter((x) => x.classId === cls.id).slice().sort((a, b) => a.studentNo.localeCompare(b.studentNo));
    const contributions = members.map((x) => {
      const currentWeight = r.weights[x.currentGrade - 1] || 0;
      const keepContrib = x.status === '保持' ? Math.max(0, (r.weights[x.entryGrade - 1] || 0) - 10) : 0;
      const progressContrib = x.status === '进步' ? window.MOCK.helpers.progressWeight(x.entryGrade, x.level, r.weights) : 0;
      const declineContrib = x.status === '退步' ? window.MOCK.helpers.declineWeight(x.entryGrade, Math.abs(x.level), r.weights) : 0;
      return {
        studentNo: x.studentNo, studentName: x.studentName,
        entryGrade: x.entryGrade, currentGrade: x.currentGrade,
        status: x.status, level: x.level,
        currentWeight, keepContrib, progressContrib, declineContrib
      };
    });
    const sum = contributions.reduce((acc, x) => {
      acc.currentWeight += x.currentWeight;
      acc.keepContrib += x.keepContrib;
      acc.progressContrib += x.progressContrib;
      acc.declineContrib += x.declineContrib;
      return acc;
    }, { currentWeight: 0, keepContrib: 0, progressContrib: 0, declineContrib: 0 });
    const rows = contributions.concat([{
      studentNo: '', studentName: '合计', entryGrade: '', currentGrade: '', status: '', level: '',
      currentWeight: sum.currentWeight, keepContrib: sum.keepContrib, progressContrib: sum.progressContrib, declineContrib: sum.declineContrib
    }]);
    return `<div class="card mb-16"><div class="card-head"><div><div class="card-title"><span class="dot"></span>示例班级</div><div class="card-sub">${App.esc(cls.schoolName)} ${App.esc(cls.name)} · 班主任 ${App.esc((window.MOCK.classes.find((c) => c.id === cls.id) || {}).homeroomTeacherId ? ((window.MOCK.teachers.find((t) => t.id === window.MOCK.classes.find((c) => c.id === cls.id).homeroomTeacherId) || {}).name || '—') : '—')} · ${cls.n} 人</div></div></div>
      <div class="card-body">${UI.kv([
        ['人数', cls.n],
        ['学业实力', fmt2(cls.strength)],
        ['保持值', fmt2(cls.keep)],
        ['进步值', fmt2(cls.progress)],
        ['退步值', fmt2(cls.decline)],
        ['相对进步率', cls.n < r.smallSample ? `样本不足（&lt;${r.smallSample}人）` : cls.rate],
        ['校内实力排名 / 进步率排名', `${cls.strengthRank || '—'} / ${cls.rateRank || '—'}`]
      ])}</div></div>
      <div class="card mb-16"><div class="card-head"><div><div class="card-title"><span class="dot"></span>第一步：班级成员逐人取值</div><div class="card-sub">评价权重、保持贡献、进步贡献、退步贡献</div></div></div>
        ${UI.table({ columns: [
          { key: 'studentNo', label: '学号', render: (x) => x.studentNo ? `<span class="code">${App.esc(x.studentNo)}</span>` : '' },
          { key: 'studentName', label: '姓名', render: (x) => x.studentName === '合计' ? '<b>合计</b>' : App.esc(x.studentName) },
          { key: 'entryGrade', label: '入口等级', align: 'center', render: (x) => x.entryGrade ? `G${x.entryGrade}` : '' },
          { key: 'currentGrade', label: '评价等级', align: 'center', render: (x) => x.currentGrade ? `G${x.currentGrade}` : '' },
          { key: 'status', label: '判定', render: (x) => x.status ? UI.badge(x.status, x.status === '进步' ? 'green' : x.status === '退步' ? 'red' : 'gray') : '' },
          { key: 'level', label: '级数', align: 'num', render: (x) => x.level === '' ? '' : (x.level > 0 ? `+${x.level}` : x.level) },
          { key: 'currentWeight', label: '评价权重', align: 'num', render: (x) => fmt2(x.currentWeight) },
          { key: 'keepContrib', label: '保持贡献', align: 'num', render: (x) => fmt2(x.keepContrib) },
          { key: 'progressContrib', label: '进步贡献', align: 'num', render: (x) => fmt2(x.progressContrib) },
          { key: 'declineContrib', label: '退步贡献', align: 'num', render: (x) => fmt2(x.declineContrib) }
        ], rows })}
      </div>
      <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>第二步：汇总公式代入</div></div></div><div class="card-body small" style="display:flex;flex-direction:column;gap:8px">
        <div>人数 n = <b>${cls.n}</b></div>
        <div>学业实力 = Σ评价权重 ${fmt2(cls.strengthSum)} ÷ ${cls.n} = <b>${fmt2(cls.strength)}</b></div>
        <div>保持值 = Σ保持贡献 ${fmt2(cls.keepSum)} ÷ ${cls.n} = <b>${fmt2(cls.keep)}</b></div>
        <div>进步值 = Σ进步贡献 ${fmt2(cls.progressSum)} ÷ ${cls.n} = <b>${fmt2(cls.progress)}</b></div>
        <div>退步值 = Σ退步贡献 ${fmt2(cls.declineSum)} ÷ ${cls.n} = <b>${fmt2(cls.decline)}</b></div>
        <div>相对进步率 =（${fmt2(cls.keep)} + ${fmt2(cls.progress)}×2）÷（（${fmt2(cls.decline)}+1）×1.5）= <b>${cls.rate}</b></div>
        <div>平均级数 = Σ级数 ÷ ${cls.n} = <b>${cls.avgLevel > 0 ? '+' : ''}${fmt2(cls.avgLevel)}</b></div>
      </div></div>`;
  }

  App.actions.setProcessExampleTab = function (el) {
    App.state.processExampleTab = el.dataset.value;
    App.render();
  };
  App.actions.jumpProcessSample = function (el) {
    App.state.processSampleTab = el.dataset.tab || 'normal';
    App.state.processAbnormalFilter = el.dataset.filter || 'all';
    App.state.processSamplePage = 1;
    App.state.processSampleKeyword = '';
    App.render();
    const target = document.getElementById('processSamplePanel');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  App.actions.setProcessSampleTab = function (el) {
    App.state.processSampleTab = el.dataset.value;
    App.state.processAbnormalFilter = 'all';
    App.state.processSamplePage = 1;
    App.state.processSampleKeyword = '';
    App.render();
  };
  App.actions.setProcessAbnormalFilter = function (el) {
    App.state.processAbnormalFilter = el.dataset.value;
    App.state.processSamplePage = 1;
    App.render();
  };
  App.actions.processSamplePage = function (el) {
    App.state.processSamplePage = Number(el.dataset.page) || 1;
    App.render();
  };
  App.setProcessSampleKeyword = function (value) {
    App.state.processSampleKeyword = value;
    App.state.processSamplePage = 1;
    App.render();
    const input = document.getElementById('processSampleSearch');
    if (input) {
      input.focus();
      try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
    }
  };

  App.actions.openProcess = function (el) {
    const id = el.dataset.id || App.state.selectedTaskId;
    if (!id) return;
    App.state.selectedTaskId = id;
    App.state.processStep = '1';
    App.state.processSubject = '总分';
    App.state.processPage = 1;
    App.state.processKeyword = '';
    App.state.processStudentId = '';
    App.state.processClassId = '';
    App.state.processAggTab = 'classes';
    App.state.processExampleTab = 'student';
    App.state.processDrill = '';
    App.state.processDrillKeyword = '';
    App.state.processDrillPage = 1;
    App.state.processSampleTab = 'normal';
    App.state.processAbnormalFilter = 'all';
    App.state.processSampleKeyword = '';
    App.state.processSamplePage = 1;
    App.navigate('/evaluations/' + id + '/process');
  };
  App.actions.backResultsFromProcess = function () {
    const id = App.state.selectedTaskId;
    if (id) App.navigate('/evaluations/' + id + '/results');
  };
  App.actions.setProcessStep = function (el) {
    App.state.processStep = el.dataset.value;
    if (el.dataset.value !== '1') {
      App.state.processDrill = '';
      App.state.processDrillKeyword = '';
      App.state.processDrillPage = 1;
    }
    if (el.dataset.value !== '3') App.state.processStudentId = '';
    if (el.dataset.value !== '5') App.state.processClassId = '';
    App.render();
  };
  App.actions.openProcessDrill = function (el) {
    App.state.processDrill = el.dataset.value;
    App.state.processDrillKeyword = '';
    App.state.processDrillPage = 1;
    App.render();
    const target = document.getElementById('processDrill');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  App.actions.closeProcessDrill = function () {
    App.state.processDrill = '';
    App.state.processDrillKeyword = '';
    App.state.processDrillPage = 1;
    App.render();
  };
  App.actions.processDrillPage = function (el) {
    App.state.processDrillPage = Number(el.dataset.page) || 1;
    App.render();
  };
  App.setProcessDrillKeyword = function (value) {
    App.state.processDrillKeyword = value;
    App.state.processDrillPage = 1;
    App.render();
    const input = document.getElementById('processDrillSearch');
    if (input) {
      input.focus();
      try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
    }
  };
  App.actions.setProcessSubject = function (el) { App.state.processSubject = el.dataset.value; App.state.processPage = 1; App.render(); };
  App.actions.setProcessAggTab = function (el) {
    App.state.processAggTab = el.dataset.value;
    if (el.dataset.value !== 'classes') App.state.processClassId = '';
    App.render();
  };
  App.actions.processPage = function (el) { App.state.processPage = Number(el.dataset.page) || 1; App.render(); };
  App.actions.openProcessStudent = function (el) {
    App.state.processStudentId = el.dataset.id;
    App.render();
    const target = document.getElementById('processStudentDetail');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  App.actions.backProcessStudent = function () {
    App.state.processStudentId = '';
    App.render();
  };
  App.actions.openProcessClass = function (el) {
    App.state.processClassId = el.dataset.id;
    App.render();
    const target = document.getElementById('processClassDetail');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  App.actions.backProcessClass = function () {
    App.state.processClassId = '';
    App.render();
  };
  App.setProcessKeyword = function (value) {
    App.state.processKeyword = value;
    App.state.processPage = 1;
    App.render();
    const input = document.getElementById('processSearch');
    if (input) {
      input.focus();
      try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
    }
  };

  function evalResults(taskId) {
    const task = App.task(taskId || 'T1');
    const r = App.result(task.id);
    const tab = App.state.resultsTab || 'students';
    const isAdmin = App.canEdit();
    const algo = App.state.resultAlgorithm || task.algorithm;
    const ownSample = isAdmin ? r.quality.sample : r.totals.filter((x) => x.schoolId === App.state.schoolId).length;
    const ownTotal = isAdmin ? r.quality.sample + r.quality.excluded : window.MOCK.students.filter((s) => s.schoolId === App.state.schoolId).length;
    const ownExcluded = Math.max(0, ownTotal - ownSample);
    return `<div class="page">
      <div class="page-head">
        <div><div class="breadcrumb"><span>管理</span><span class="sep">/</span><span>评价任务</span><span class="sep">/</span><span>结果</span></div><h1 class="page-title">${App.esc(task.name)}</h1><div class="page-desc">${task.schools.map((s) => App.schoolName(s)).join('、')} · 联考统一计算 · 只呈现计算结果</div></div>
        <div class="page-actions"><button class="btn" data-action="backEvaluations">返回任务列表</button><a class="btn" href="#/evaluations/${task.id}/reports">查看报告</a><button class="btn" data-action="openProcess" data-id="${task.id}">计算过程</button><button class="btn" data-action="exportResults">${UI.icon('download')}导出当前结果</button></div>
      </div>
      <div class="card mb-16"><div class="card-body flex gap-8 wrap items-center">
        <span class="badge badge-blue">算法：${algo === 'grade' ? '等级差法' : '标准分法'}</span>
        <span class="badge badge-purple">口径：必考原始分 / 选考赋分</span>
        <span class="badge badge-gray">样本：${ownSample} 人</span>
        <span class="badge badge-gray">剔除：${ownExcluded} 人</span>
        <span class="badge badge-gray">部分缺考：${r.excludePartialAbsent ? `整生剔除 ${r.quality.partialAbsentExcluded} 人` : '仅剔除该科'}</span>
        <span class="badge badge-gray">小样本：少于 ${r.smallSample} 人不排名</span>
        ${r.quality.fallbackSubjects.length ? `<span class="badge badge-amber">回退原始分：${r.quality.fallbackSubjects.join('、')}</span>` : ''}
        ${r.quality.missingTeacher ? '<span class="badge badge-amber">部分成绩未匹配教师，已从教师结果剔除</span>' : ''}
      </div></div>
      ${UI.tabs([
        { key: 'students', label: '学生结果', active: tab === 'students' },
        { key: 'classes', label: '班级结果', active: tab === 'classes' },
        { key: 'teachers', label: '教师结果', active: tab === 'teachers' },
        { key: 'schools', label: '学校结果', active: tab === 'schools' }
      ], 'setResultsTab')}
      ${tab === 'students' ? studentResults(r) : ''}
      ${tab === 'classes' ? classResults(r) : ''}
      ${tab === 'teachers' ? teacherResults(r) : ''}
      ${tab === 'schools' ? schoolResults(r) : ''}
    </div>`;
  }

  function resultSubjects() {
    const task = App.task(App.state.selectedTaskId || 'T1');
    const exam = window.MOCK.exams.find((e) => e.id === task.exitExamId);
    const stage = (exam || {}).stage || '高中';
    return ['总分'].concat(window.MOCK.constants.STAGE_SUBJECTS[stage] || window.MOCK.constants.SUBJECT_NAMES);
  }

  function subjectChips(subject, action) {
    return `<div class="card mb-16"><div class="card-body"><div class="flex gap-8 wrap items-center"><span class="chip-group-label">科目</span>${resultSubjects().map((s) => UI.chip(s, subject === s, action, s)).join('')}</div></div></div>`;
  }

  function studentResults(r) {
    const st = App.state;
    let rows = r.rows.filter((x) => x.subject === (st.resultSubject || '总分'));
    if (!App.canEdit()) rows = rows.filter((x) => x.schoolId === App.state.schoolId);
    if (st.resultSchool) rows = rows.filter((x) => x.schoolId === st.resultSchool);
    if (st.resultClass) rows = rows.filter((x) => x.classId === st.resultClass);
    if (st.resultStatus) rows = rows.filter((x) => x.status === st.resultStatus);
    if (st.resultKeyword) rows = rows.filter((x) => x.studentName.includes(st.resultKeyword) || x.studentNo.includes(st.resultKeyword));
    rows.sort((a, b) => a.schoolId.localeCompare(b.schoolId) || a.className.localeCompare(b.className, 'zh') || a.studentNo.localeCompare(b.studentNo));
    const size = 12;
    const page = Math.min(st.resultPage || 1, Math.max(1, Math.ceil(rows.length / size)));
    const pageRows = rows.slice((page - 1) * size, page * size);
    return `<div class="card">
      <div class="card-head"><div><div class="card-title"><span class="dot"></span>学生结果</div><div class="card-sub">默认一行一个学生（总分），可切换科目；学生排名为联考排名</div></div>
        <div class="toolbar">
          <div class="search">${UI.icon('search')}<input class="input input-sm" placeholder="姓名/学号" value="${App.esc(st.resultKeyword)}" onchange="App.setResultFilter('keyword', this.value)" /></div>
          <select class="select select-sm" style="width:120px" onchange="App.setResultFilter('school', this.value)"><option value="">全部学校</option>${window.MOCK.schools.filter((s) => App.canEdit() || s.id === App.state.schoolId).map((s) => `<option value="${s.id}" ${st.resultSchool === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
          <select class="select select-sm" style="width:120px" onchange="App.setResultSubject(this.value)">${resultSubjects().map((s) => `<option ${st.resultSubject === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
          <select class="select select-sm" style="width:110px" onchange="App.setResultFilter('status', this.value)"><option value="">全部状态</option><option ${st.resultStatus === '进步' ? 'selected' : ''}>进步</option><option ${st.resultStatus === '保持' ? 'selected' : ''}>保持</option><option ${st.resultStatus === '退步' ? 'selected' : ''}>退步</option></select>
        </div>
      </div>
      ${UI.table({
        columns: [
          { key: 'studentNo', label: '学号', render: (x) => `<span class="code">${x.studentNo}</span>` },
          { key: 'studentName', label: '姓名' },
          { key: 'schoolName', label: '学校' },
          { key: 'className', label: '班级' },
          { key: 'subject', label: '科目' },
          { key: 'entryValue', label: '入口', align: 'num' },
          { key: 'currentValue', label: '评价', align: 'num' },
          { key: 'currentRank', label: '联考排名', align: 'num' },
          { key: 'grade', label: '等级变化', render: (x) => `G${x.entryGrade} → G${x.currentGrade}` },
          { key: 'status', label: '进退步', render: (x) => UI.badge(x.status, x.status === '进步' ? 'green' : x.status === '退步' ? 'red' : 'gray') },
          { key: 'level', label: '级数', align: 'num', render: (x) => x.level > 0 ? `+${x.level}` : x.level }
        ],
        rows: pageRows
      })}
      ${UI.pagination(rows.length, page, size, 'resultPage')}
    </div>`;
  }

  function classResults(r) {
    const subject = App.state.classSubject || '总分';
    const groups = (r.classEval[subject] || []).filter((g) => App.canEdit() || g.schoolId === App.state.schoolId).slice().sort((a, b) => a.schoolId.localeCompare(b.schoolId) || (a.rateRank || 99) - (b.rateRank || 99));
    return `${subjectChips(subject, 'setClassSubject')}
      <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>班级结果</div><div class="card-sub">班级排名为校内排名；指标与学校结果一致</div></div></div>
      ${UI.table({
        columns: [
          { key: 'schoolName', label: '学校' },
          { key: 'name', label: '班级' },
          { key: 'n', label: '人数', align: 'num', render: (g) => g.n < r.smallSample ? `${g.n} <span class="badge badge-amber">样本不足（&lt;${r.smallSample}人）</span>` : g.n },
          { key: 'strength', label: '学业实力', align: 'num' },
          { key: 'keep', label: '保持值', align: 'num' },
          { key: 'progress', label: '进步值', align: 'num' },
          { key: 'decline', label: '退步值', align: 'num' },
          { key: 'rate', label: '相对进步率', align: 'num', render: (g) => g.n < r.smallSample ? `<span class="weak">样本不足（&lt;${r.smallSample}人）</span>` : `<b style="color:${g.rate >= 1 ? '#047857' : '#b91c1c'}">${g.rate}</b>` },
          { key: 'avgLevel', label: '平均进退步', align: 'num', render: (g) => g.n < r.smallSample ? '—' : (g.avgLevel > 0 ? `+${g.avgLevel}` : g.avgLevel) },
          { key: 'progressRatio', label: '进步占比', align: 'num', render: (g) => Math.round(g.progressRatio * 100) + '%' },
          { key: 'declineRatio', label: '退步占比', align: 'num', render: (g) => Math.round(g.declineRatio * 100) + '%' },
          { key: 'strengthRank', label: '实力排名', align: 'num', render: (g) => g.strengthRank ? `<span class="badge badge-blue">${g.strengthRank}</span>` : '—' },
          { key: 'rateRank', label: '进步率排名', align: 'num', render: (g) => g.rateRank ? `<span class="badge badge-green">${g.rateRank}</span>` : '—' }
        ],
        rows: groups
      })}</div>`;
  }

  function teacherResults(r) {
    const subject = App.state.teacherSubject || '总分';
    const groups = (r.teacherEval[subject] || []).filter((g) => App.canEdit() || g.schoolId === App.state.schoolId).slice().sort((a, b) => a.schoolId.localeCompare(b.schoolId) || (a.rateRank || 99) - (b.rateRank || 99));
    return `${subjectChips(subject, 'setTeacherSubject')}
      <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>教师结果</div><div class="card-sub">教师排名为校内排名；总分为班主任归属</div></div></div>
      ${UI.table({
        columns: [
          { key: 'schoolName', label: '学校' },
          { key: 'name', label: '教师' },
          { key: 'subject', label: '科目' },
          { key: 'classes', label: '任教班级' },
          { key: 'n', label: '人数', align: 'num', render: (g) => g.n < r.smallSample ? `${g.n} <span class="badge badge-amber">样本不足（&lt;${r.smallSample}人）</span>` : g.n },
          { key: 'strength', label: '学业实力', align: 'num' },
          { key: 'keep', label: '保持值', align: 'num' },
          { key: 'progress', label: '进步值', align: 'num' },
          { key: 'decline', label: '退步值', align: 'num' },
          { key: 'rate', label: '相对进步率', align: 'num', render: (g) => g.n < r.smallSample ? `<span class="weak">样本不足（&lt;${r.smallSample}人）</span>` : `<b style="color:${g.rate >= 1 ? '#047857' : '#b91c1c'}">${g.rate}</b>` },
          { key: 'avgLevel', label: '平均进退步', align: 'num', render: (g) => g.n < r.smallSample ? '—' : (g.avgLevel > 0 ? `+${g.avgLevel}` : g.avgLevel) },
          { key: 'progressRatio', label: '进步占比', align: 'num', render: (g) => Math.round(g.progressRatio * 100) + '%' },
          { key: 'strengthRank', label: '实力排名', align: 'num', render: (g) => g.strengthRank ? `<span class="badge badge-blue">${g.strengthRank}</span>` : '—' },
          { key: 'rateRank', label: '进步率排名', align: 'num', render: (g) => g.rateRank ? `<span class="badge badge-green">${g.rateRank}</span>` : '—' }
        ],
        rows: groups
      })}</div>`;
  }

  function schoolResults(r) {
    const subject = App.state.schoolSubject || '总分';
    const groups = (r.schoolEval[subject] || []).slice().sort((a, b) => (a.rateRank || 99) - (b.rateRank || 99));
    return `${subjectChips(subject, 'setSchoolSubject')}
      <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>学校结果</div><div class="card-sub">学校排名为联考排名；指标与班级结果完全一致</div></div></div>
      ${UI.table({
        columns: [
          { key: 'schoolName', label: '学校' },
          { key: 'n', label: '人数', align: 'num', render: (g) => g.n < r.smallSample ? `${g.n} <span class="badge badge-amber">样本不足（&lt;${r.smallSample}人）</span>` : g.n },
          { key: 'strength', label: '学业实力', align: 'num' },
          { key: 'keep', label: '保持值', align: 'num' },
          { key: 'progress', label: '进步值', align: 'num' },
          { key: 'decline', label: '退步值', align: 'num' },
          { key: 'rate', label: '相对进步率', align: 'num', render: (g) => g.n < r.smallSample ? `<span class="weak">样本不足（&lt;${r.smallSample}人）</span>` : `<b style="color:${g.rate >= 1 ? '#047857' : '#b91c1c'}">${g.rate}</b>` },
          { key: 'avgLevel', label: '平均进退步', align: 'num', render: (g) => g.n < r.smallSample ? '—' : (g.avgLevel > 0 ? `+${g.avgLevel}` : g.avgLevel) },
          { key: 'progressRatio', label: '进步占比', align: 'num', render: (g) => Math.round(g.progressRatio * 100) + '%' },
          { key: 'declineRatio', label: '退步占比', align: 'num', render: (g) => Math.round(g.declineRatio * 100) + '%' },
          { key: 'strengthRank', label: '实力排名', align: 'num', render: (g) => g.strengthRank ? `<span class="badge badge-blue">${g.strengthRank}</span>` : '—' },
          { key: 'rateRank', label: '进步率排名', align: 'num', render: (g) => g.rateRank ? `<span class="badge badge-green">${g.rateRank}</span>` : '—' }
        ],
        rows: groups
      })}</div>`;
  }

  App.actions.backEvaluations = function () { App.navigate('/evaluations'); };
  App.actions.setResultsTab = function (el) { App.state.resultsTab = el.dataset.value; App.render(); };
  App.actions.setClassSubject = function (el) { App.state.classSubject = el.dataset.value; App.render(); };
  App.actions.setTeacherSubject = function (el) { App.state.teacherSubject = el.dataset.value; App.render(); };
  App.actions.setSchoolSubject = function (el) { App.state.schoolSubject = el.dataset.value; App.render(); };
  App.setResultSubject = function (v) { App.state.resultSubject = v; App.state.resultPage = 1; App.render(); };
  App.setResultFilter = function (k, v) {
    const map = { school: 'resultSchool', class: 'resultClass', status: 'resultStatus', keyword: 'resultKeyword' };
    App.state[map[k] || k] = v; App.state.resultPage = 1; App.render();
  };
  App.actions.resultPage = function (el) { App.state.resultPage = Number(el.dataset.page); App.render(); };
  App.actions.exportResults = function () {
    const task = App.task(App.state.selectedTaskId || 'T1');
    const r = App.result(task.id);
    const tab = App.state.resultsTab || 'students';
    const lines = [];
    let headers = [];
    if (tab === 'students') {
      let rows = r.rows.filter((x) => x.subject === (App.state.resultSubject || '总分'));
      if (!App.canEdit()) rows = rows.filter((x) => x.schoolId === App.state.schoolId);
      if (App.state.resultSchool) rows = rows.filter((x) => x.schoolId === App.state.resultSchool);
      if (App.state.resultStatus) rows = rows.filter((x) => x.status === App.state.resultStatus);
      if (App.state.resultKeyword) rows = rows.filter((x) => x.studentName.includes(App.state.resultKeyword) || x.studentNo.includes(App.state.resultKeyword));
      headers = ['学号', '姓名', '学校', '班级', '科目', '入口', '评价', '联考排名', '入口等级', '评价等级', '进退步', '级数'];
      rows.forEach((x) => lines.push([x.studentNo, x.studentName, x.schoolName, x.className, x.subject, x.entryValue, x.currentValue, x.currentRank, 'G' + x.entryGrade, 'G' + x.currentGrade, x.status, x.level]));
    } else {
      const conf = tab === 'classes'
        ? { groups: r.classEval[App.state.classSubject || '总分'], nameKey: 'name', label: '班级' }
        : tab === 'teachers'
          ? { groups: r.teacherEval[App.state.teacherSubject || '总分'], nameKey: 'name', label: '教师' }
          : { groups: r.schoolEval[App.state.schoolSubject || '总分'], nameKey: 'schoolName', label: '学校' };
      const groups = (conf.groups || []).filter((g) => App.canEdit() || tab === 'schools' || g.schoolId === App.state.schoolId);
      headers = ['学校', conf.label, '人数', '学业实力', '保持值', '进步值', '退步值', '相对进步率', '平均进退步', '进步占比', '退步占比', '实力排名', '进步率排名'];
      groups.forEach((g) => lines.push([g.schoolName, g[conf.nameKey], g.n, g.strength, g.keep, g.progress, g.decline, g.rate, g.avgLevel, Math.round(g.progressRatio * 100) + '%', Math.round(g.declineRatio * 100) + '%', g.strengthRank || '—', g.rateRank || '—']));
    }
    const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const csv = '\uFEFF' + [headers, ...lines].map((row) => row.map(esc).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = task.name + '_' + tab + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    UI.toast('已导出当前结果 CSV');
  };
})();


