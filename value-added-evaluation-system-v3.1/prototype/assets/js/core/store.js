/* v3.1 全局状态 */
(function () {
  'use strict';
  const App = window.App || (window.App = {});
  App.actions = App.actions || {};
  App.pages = App.pages || {};

  const store = {
    get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    remove(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  const DEFAULT_SETTINGS = {
    gradeCount: 9,
    keepThreshold: 0.25,
    stepSize: 0.5,
    smallSample: 8,
    excludePartialAbsent: true,
    algorithm: 'standard'
  };
  function readSettings() {
    try {
      const saved = JSON.parse(store.get('ve_settings') || '{}') || {};
      if (saved.gradeCount !== 9) saved.gradeCount = 9;
      return Object.assign({}, DEFAULT_SETTINGS, saved);
    } catch (e) {
      return Object.assign({}, DEFAULT_SETTINGS);
    }
  }
  App.defaultSettings = DEFAULT_SETTINGS;
  App.settings = readSettings();
  App.saveSettings = function (patch) {
    App.settings = Object.assign({}, App.settings, patch);
    store.set('ve_settings', JSON.stringify(App.settings));
    return App.settings;
  };

  const AUTH = window.VE_AUTH;
  const ACCOUNTS = AUTH.accounts;
  const savedAccountKey = store.get('ve_account');
  const savedAccount = ACCOUNTS[savedAccountKey];

  App.accounts = ACCOUNTS;
  App.state = {
    role: savedAccount ? savedAccount.role : '',
    account: savedAccount ? savedAccountKey : '',
    schoolId: savedAccount ? (savedAccount.schoolId || 'S01') : 'S01',
    userName: savedAccount ? savedAccount.name : '',
    basicTab: 'grades',
    basicSchoolId: '',
    selectedGradeId: '',
    selectedClassId: '',
    examStatus: '',
    examId: 'E2',
    examSchoolFilter: '',
    examSubjectFilter: '',
    examKeyword: '',
    examPage: 1,
    examPageSize: 20,
    importWizard: {
      step: 1, examId: 'E2', fileIds: [], accepted: {}, stage: 0,
      running: false, done: false, diffTab: 'all', batchId: ''
    },
    evalWizard: {
      taskId: '',
      config: {
        name: '',
        entryExamId: 'E1',
        exitExamId: 'E2',
        schools: ['S01', 'S02', 'S03', 'S04'],
        schoolVersions: { S01: 'V2', S02: 'V4', S03: 'V6', S04: 'V8' },
        scope: '高中园四校',
        baseDefault: 'raw',
        overrides: { 化学: 'assigned', 生物: 'assigned', 政治: 'assigned', 地理: 'assigned' }
      },
      matched: false,
      matchAccepted: {},
      matchTab: 'all',
      algorithm: App.settings.algorithm,
      gradeCount: App.settings.gradeCount,
      keepThreshold: App.settings.keepThreshold,
      stepSize: App.settings.stepSize,
      smallSample: App.settings.smallSample,
      excludePartialAbsent: App.settings.excludePartialAbsent,
      calcProgress: 0,
      calculating: false
    },
    selectedTaskId: '',
    resultsTab: 'students',
    resultAlgorithm: 'standard',
    resultSubject: '总分',
    resultSchool: '',
    resultClass: '',
    resultStatus: '',
    resultKeyword: '',
    resultPage: 1,
    processStep: '1',
    processSubject: '总分',
    processPage: 1,
    processKeyword: '',
    processStudentId: '',
    processClassId: '',
    processAggTab: 'classes',
    processExampleTab: 'student',
    processDrill: '',
    processDrillKeyword: '',
    processDrillPage: 1,
    processSampleTab: 'normal',
    processAbnormalFilter: 'all',
    processSampleKeyword: '',
    processSamplePage: 1,
    classSubject: '总分',
    teacherSubject: '总分',
    schoolSubject: '总分',
    reportSchoolId: '',
    reportClassId: '',
    reportTeacherId: '',
    reportStudentId: '',
    reportSubject: '数学'
  };

  App.school = function () {
    return (window.MOCK.schools || []).find((s) => s.id === App.state.schoolId) || window.MOCK.schools[0];
  };
  App.canEdit = function () { return App.state.role === 'admin'; };
  App.isSchool = function () { return App.state.role === 'school'; };
  App.roleLabel = function () { return App.canEdit() ? '运营管理员' : '学校管理员'; };

  App.accountName = function () { return App.state.userName || ''; };

  App.changePassword = function (oldPassword, newPassword) {
    const key = App.state.account;
    if (!key || !ACCOUNTS[key]) return 'account';
    if (AUTH.passwordFor(key) !== String(oldPassword || '')) return 'old';
    if (!AUTH.setPassword(key, String(newPassword || ''))) return 'account';
    return 'ok';
  };

  App.logout = function () {
    store.remove('ve_account');
    store.remove('ve_role');
    store.remove('ve_user');
    store.remove('ve_school');
    App.state.role = '';
    App.state.account = '';
    App.state.userName = '';
    window.location.replace('index.html');
  };

  App.switchSchool = function (id) {
    App.state.schoolId = id;
    App.state.selectedGradeId = '';
    store.set('ve_school', id);
    App.render();
  };

  App.navigate = function (path) {
    location.hash = '#' + path.replace(/^#/, '');
  };

  App.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  App.pct = function (v) { return v == null ? '—' : Math.round(v * 100) + '%'; };

  App.schoolName = function (id) {
    return (window.MOCK.schools.find((s) => s.id === id) || {}).name || '';
  };
  App.grade = function (id) { return window.MOCK.grades.find((g) => g.id === id); };
  App.gradeName = function (id) { return (App.grade(id) || {}).name || ''; };
  App.version = function (id) { return window.MOCK.versions.find((v) => v.id === id); };
  App.classDef = function (id) { return window.MOCK.classes.find((c) => c.id === id); };
  App.teacher = function (id) { return window.MOCK.teachers.find((t) => t.id === id); };
  App.task = function (id) {
    return window.MOCK.tasks.find((t) => t.id === id) || window.MOCK.tasks[0] || null;
  };
  App.result = function (id) {
    const task = App.task(id);
    if (!task) return null;
    if (!window.MOCK.results[task.id]) {
      window.MOCK.results[task.id] = window.MOCK.helpers.computeTask(
        task,
        window.MOCK.helpers.buildTaskData(task)
      );
    }
    return window.MOCK.results[task.id];
  };

  App.gradesOf = function (schoolId) {
    return window.MOCK.grades.filter((g) => !schoolId || g.schoolId === schoolId);
  };
  App.versionsOf = function (gradeId) {
    return window.MOCK.versions.filter((v) => v.gradeId === gradeId);
  };
  App.classesOf = function (gradeId) {
    return window.MOCK.classes.filter((c) => c.gradeId === gradeId);
  };
  App.classesOfSchool = function (schoolId) {
    return window.MOCK.classes.filter((c) => c.schoolId === schoolId);
  };
  App.teachersOf = function (schoolId) {
    return window.MOCK.teachers.filter((t) => t.schoolId === schoolId);
  };
  App.studentsOfClass = function (classId) {
    return window.MOCK.students.filter((s) => s.classId === classId);
  };
  App.currentVersionOf = function (gradeId) {
    return App.versionsOf(gradeId).find((v) => v.current) || null;
  };
  App.nextVersionId = function () {
    const max = (window.MOCK.versions || []).reduce((m, v) => Math.max(m, parseInt(String(v.id).replace(/\D/g, ''), 10) || 0), 0);
    return 'V' + (max + 1);
  };

  App.taskStatusType = function (status) {
    return {
      '已完成': 'green', '匹配待确认': 'amber', '计算中': 'blue',
      '草稿': 'gray', '待匹配': 'gray', '待计算': 'blue', '失败': 'red'
    }[status] || 'gray';
  };
  App.examStatusType = function (status) {
    return { '已发布': 'green', '草稿': 'gray' }[status] || 'gray';
  };
  App.importStatusType = function (status) {
    return { '已入库': 'green', '待确认': 'amber', '解析中': 'blue', '失败': 'red' }[status] || 'gray';
  };
})();
