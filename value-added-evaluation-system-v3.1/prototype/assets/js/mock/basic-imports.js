/* 基础数据导入 Mock */
(function () {
  'use strict';

  const FILES = [
    { id: 'BF1', name: '明德中学_学生名单.xlsx', type: '学生名单', size: '1.2 MB', desc: '含学号、姓名、班级、选科；有 2 名新增、1 名缺失' },
    { id: 'BF2', name: '明德中学_教师名单.csv', type: '教师名单', size: '48 KB', desc: '含工号、姓名、学科；有 1 名新增教师' },
    { id: 'BF3', name: '明德中学_任课安排.xlsx', type: '任课安排', size: '96 KB', desc: '含班主任、科任；有 2 条任课变更' }
  ];

  const STUDENT_ROWS = [
    { no: '2026001', name: '王子涵', className: '高三(1)班', selection: '物理类', status: '在读', conf: 0.99 },
    { no: '2026002', name: '李宇轩', className: '高三(1)班', selection: '物理类', status: '在读', conf: 0.98 },
    { no: '2026201', name: '李梓萱', className: '高三(1)班', selection: '历史类', status: '在读', conf: 0.68 },
    { no: '2026202', name: '王浩然', className: '高三(2)班', selection: '物理类', status: '在读', conf: 0.94 },
    { no: '2026007', name: '陈思远', className: '高三(3)班', selection: '物理类', status: '在读', conf: 0.96 },
    { no: '2026012', name: '刘雨桐', className: '高三(4)班', selection: '历史类', status: '在读', conf: 0.76 }
  ];

  const TEACHER_ROWS = [
    { no: 'T35', name: '王芳华', subject: '语文', status: '在职', conf: 0.96 }
  ];

  const ASSIGNMENT_ROWS = [
    { className: '高三(1)班', subject: '语文', teacherName: '王芳华' },
    { className: '高三(2)班', subject: '数学', teacherName: '冯涛' }
  ];

  const STUDENT_UPDATES = [
    { no: '2026007', className: '高三(3)班', selection: '物理类' },
    { no: '2026012', className: '高三(4)班', selection: '历史类' },
    { no: '2026015', className: '高三(2)班', selection: '历史类' }
  ];

  const MISSING_STUDENT = { no: '2026030', name: '周子墨' };

  const DIFFS = [
    { id: 'BD1', level: 'block', category: '学籍号重复', title: '2026201 在名单中出现 2 次', desc: '同一学籍号对应不同姓名，需人工确认。', suggestion: '保留李梓萱，忽略另一条' },
    { id: 'BD2', level: 'confirm', category: '新增学生', title: '名单中有 2 名学生系统中不存在', desc: '李梓萱（2026201）、王浩然（2026202）。', suggestion: '确认后加入当前编辑稿' },
    { id: 'BD3', level: 'confirm', category: '缺失学生', title: '系统中有 1 人未出现在名单', desc: '2026030 周子墨，可能转出。', suggestion: '标记为转出，确认后从编辑稿移除' },
    { id: 'BD4', level: 'confirm', category: '班级变更', title: '2 名学生班级不一致', desc: '陈思远、刘雨桐班级与系统不同。', suggestion: '按名单更新班级' },
    { id: 'BD5', level: 'confirm', category: '新增教师', title: '教师名单中有 1 名新教师', desc: '郑洁（语文）。', suggestion: '加入教师库' },
    { id: 'BD6', level: 'confirm', category: '任课变更', title: '2 条任课关系发生变化', desc: '高三(1)班语文、高三(2)班数学。', suggestion: '按任课安排更新' },
    { id: 'BD7', level: 'hint', category: '低置信度', title: '2 个字段置信度低于 80%', desc: '李梓萱（姓名 68%）、刘雨桐（班级 76%）。', suggestion: '逐格确认' }
  ];

  window.BASIC_IMPORT_MOCK = { FILES, STUDENT_ROWS, TEACHER_ROWS, ASSIGNMENT_ROWS, STUDENT_UPDATES, MISSING_STUDENT, DIFFS };
})();
