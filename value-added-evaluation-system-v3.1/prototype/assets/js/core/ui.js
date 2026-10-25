/* v3.1 UI 组件与布局 */
(function () {
  'use strict';
  const App = window.App;
  const UI = window.UI || (window.UI = {});

  const ICONS = {
    school: '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/><path d="M9 9h.01M15 9h.01M9 12h.01M15 12h.01"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    exam: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    students: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    check: '<path d="m20 6-11 11-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15v3M12 9v9M17 5v13"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/>'
  };

  UI.icon = function (name, cls) {
    const p = ICONS[name] || ICONS.file;
    return `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  };

  UI.badge = function (text, type) {
    const t = type || 'gray';
    return `<span class="badge badge-${t}"><span class="badge-dot"></span>${App.esc(text)}</span>`;
  };
  UI.chip = function (label, active, action, value) {
    return `<button type="button" class="chip ${active ? 'active' : ''}" data-action="${action}" data-value="${App.esc(value == null ? label : value)}">${App.esc(label)}</button>`;
  };
  UI.tabs = function (items, action) {
    return `<div class="tabs">${items.map((it) => `<button type="button" class="tab ${it.active ? 'active' : ''}" data-action="${action}" data-value="${App.esc(it.key)}">${App.esc(it.label)}${it.count != null ? `<span class="count">${it.count}</span>` : ''}</button>`).join('')}</div>`;
  };
  UI.stat = function (label, value, sub, tone) {
    return `<div class="stat ${tone || ''}"><div class="stat-label">${App.esc(label)}</div><div class="stat-value">${value}</div>${sub ? `<div class="stat-sub">${App.esc(sub)}</div>` : ''}</div>`;
  };
  UI.progress = function (pct, lg) {
    return `<div class="progress ${lg ? 'lg' : ''}"><div class="progress-bar" style="width:${Math.max(0, Math.min(100, pct))}%"></div></div>`;
  };
  UI.empty = function (text, sub) {
    return `<div class="empty"><div class="empty-icon">◌</div><div>${App.esc(text)}</div>${sub ? `<div class="tiny weak mt-8">${App.esc(sub)}</div>` : ''}</div>`;
  };
  UI.kv = function (rows) {
    return `<dl class="kv">${rows.map(([k, v]) => `<dt>${App.esc(k)}</dt><dd>${v == null ? '—' : v}</dd>`).join('')}</dl>`;
  };
  UI.alert = function (type, title, text) {
    return `<div class="alert ${type}"><div><div class="alert-title">${App.esc(title)}</div><div>${text}</div></div></div>`;
  };

  UI.table = function ({ columns, rows, empty, rowClass }) {
    if (!rows || !rows.length) return `<div class="empty"><div class="empty-icon">◌</div>${App.esc(empty || '暂无数据')}</div>`;
    const head = columns.map((c) => `<th class="${c.align || ''}" ${c.width ? `style="width:${c.width}"` : ''}>${c.label}</th>`).join('');
    const body = rows.map((r, i) => {
      const tds = columns.map((c) => {
        const val = c.render ? c.render(r, i) : App.esc(r[c.key]);
        return `<td class="${c.align || ''}">${val == null ? '' : val}</td>`;
      }).join('');
      return `<tr class="${rowClass ? rowClass(r, i) : ''}">${tds}</tr>`;
    }).join('');
    const wide = columns.length >= 9 ? ' table-wide' : '';
    return `<div class="table-wrap"><table class="table${wide}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  };

  UI.pagination = function (total, page, size, action, unit) {
    const unitLabel = unit || '条';
    const pages = Math.max(1, Math.ceil(total / size));
    const cur = Math.min(Math.max(1, page), pages);
    const nums = [];
    const start = Math.max(1, cur - 2);
    const end = Math.min(pages, start + 4);
    for (let i = start; i <= end; i++) nums.push(i);
    return `<div class="pagination">
      <div class="small muted">共 ${total} ${unitLabel} · 第 ${cur}/${pages} 页 · 每页 ${size} 条</div>
      <div class="page-btns">
        <button class="page-btn" data-action="${action}" data-page="${cur - 1}" ${cur <= 1 ? 'disabled' : ''}>上一页</button>
        ${nums.map((n) => `<button class="page-btn ${n === cur ? 'active' : ''}" data-action="${action}" data-page="${n}">${n}</button>`).join('')}
        <button class="page-btn" data-action="${action}" data-page="${cur + 1}" ${cur >= pages ? 'disabled' : ''}>下一页</button>
      </div>
    </div>`;
  };

  UI.layout = function (content, active) {
    const st = App.state;
    const isAdmin = App.canEdit();
    const school = App.school();
    const cur = (location.hash || '').replace(/^#/, '');
    const home = isAdmin ? '/basic' : '/exams';
    const nav = (href, icon, label, exact) => {
      const isActive = exact ? cur === href : cur === href || cur.indexOf(href + '/') === 0 || (href === '/exams' && cur === '/import');
      return `<a class="nav-link ${isActive ? 'active' : ''}" href="#${href}"><span class="nav-icon">${UI.icon(icon)}</span><span>${label}</span></a>`;
    };
    const roleText = isAdmin ? '全校数据 · 可编辑' : '本校数据 · 只读';
    return `<div class="app-shell">
      <header class="topbar">
        <div class="topbar-left">
          <a class="brand" href="#${home}" aria-label="成绩增值评价系统首页">
            <span class="brand-mark">VE</span>
            <span class="brand-text"><span class="brand-name">成绩增值评价系统</span></span>
          </a>
          <div class="topbar-divider"></div>
          <span class="badge">${isAdmin ? '全部学校' : App.esc(school.name)}</span>
        </div>
        <div class="topbar-right">
          <div class="user-chip"><div class="avatar">${App.esc((st.userName || '用户').slice(0, 1))}</div><div><div class="user-name">${App.esc(st.userName || '用户')}</div><div class="user-role">${App.esc(roleText)}</div></div></div>
          <button class="btn btn-sm btn-ghost" data-action="openChangePwd">修改密码</button>
          <button class="btn btn-sm btn-ghost" data-action="logout">退出</button>
        </div>
      </header>
      <div class="layout">
        <aside class="sidebar">
          <div class="nav-group"><div class="nav-title">管理</div>
            ${isAdmin ? nav('/schools', 'school', '学校管理', false) : ''}
            ${isAdmin ? nav('/basic', 'layers', '基础数据', false) : ''}
            ${nav('/exams', 'exam', '考试管理', false)}
            ${nav('/evaluations', 'target', '评价任务', false)}
            ${isAdmin ? nav('/settings', 'settings', '参数配置', false) : ''}
          </div>
          <div class="nav-group"><div class="nav-title">帮助</div>
            ${nav('/algorithm', 'book', '算法说明', false)}
          </div>
          <div class="sidebar-foot">
            <span class="tag">v3.1</span>
            <p>评价用于改进，不用于简单问责。</p>
            <small>高中园 · 四校联考</small>
          </div>
        </aside>
        <main class="main">
          ${App.isSchool() ? `<div class="readonly-banner">${UI.icon('alert')}<span>当前为学校管理员只读视图：可查看本校考试、本校明细结果，以及多校学校层对比；不能新增、修改、导入、确认、计算或删除。</span></div>` : ''}
          ${content}
        </main>
      </div>
    </div>`;
  };

  UI.modal = function ({ title, sub, body, footer, wide, xwide }) {
    document.getElementById('modal-root').innerHTML = `<div class="modal-mask" data-action="maskClose">
      <div class="modal ${wide ? 'wide' : ''} ${xwide ? 'xwide' : ''}" role="dialog" aria-modal="true">
        <div class="modal-head"><div><div class="modal-title">${App.esc(title || '')}</div>${sub ? `<div class="modal-sub">${App.esc(sub)}</div>` : ''}</div><button class="modal-close" data-action="closeModal">×</button></div>
        <div class="modal-body">${body || ''}</div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
      </div></div>`;
  };
  UI.closeModal = function () { document.getElementById('modal-root').innerHTML = ''; };
  UI.toast = function (msg, type) {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(18px)'; el.style.transition = 'all .2s'; }, 2400);
    setTimeout(() => el.remove(), 2700);
  };

  App.actions.logout = function () { App.logout(); };
  App.actions.openChangePwd = function () {
    UI.modal({
      title: '修改密码',
      sub: '修改当前账号密码，需验证原密码',
      body: `<div class="field mb-12"><label class="field-label">原密码</label><input class="input" type="password" id="pwdOld" placeholder="请输入原密码" /></div>
        <div class="field mb-12"><label class="field-label">新密码 *</label><input class="input" type="password" id="pwdNew" placeholder="至少 6 位" /></div>
        <div class="field"><label class="field-label">确认新密码 *</label><input class="input" type="password" id="pwdNew2" placeholder="再次输入新密码" /></div>`,
      footer: `<button class="btn" data-action="closeModal">取消</button><button class="btn btn-primary" data-action="saveChangePwd">保存</button>`
    });
  };
  App.actions.saveChangePwd = function () {
    const oldPwd = (document.getElementById('pwdOld') || {}).value || '';
    const p1 = (document.getElementById('pwdNew') || {}).value || '';
    const p2 = (document.getElementById('pwdNew2') || {}).value || '';
    if (p1.length < 6) { UI.toast('新密码至少 6 位', 'error'); return; }
    if (p1 !== p2) { UI.toast('两次输入的密码不一致', 'error'); return; }
    const result = App.changePassword(oldPwd, p1);
    if (result === 'old') { UI.toast('原密码不正确', 'error'); return; }
    if (result !== 'ok') { UI.toast('当前账号不支持修改密码', 'error'); return; }
    UI.closeModal(); UI.toast('密码已修改');
  };
  App.actions.closeModal = function () { UI.closeModal(); };
  App.actions.maskClose = function (el, e) { if (e.target === el) UI.closeModal(); };
  App.actions.toast = function (el) { UI.toast(el.dataset.message || '操作成功', el.dataset.tone || 'success'); };
  App.actions.noop = function () {};
})();
