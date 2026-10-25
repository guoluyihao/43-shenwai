/* Hash 路由 v3.1 */
(function () {
  'use strict';
  const App = window.App;
  const UI = window.UI;

  function parse() {
    let h = location.hash.replace(/^#/, '');
    if (!h) h = '/basic';
    return h.split('?')[0].split('/').filter(Boolean);
  }

  App.render = function () {
    const parts = parse();
    const root = document.getElementById('app');
    if (!App.state.role) { window.location.replace('index.html'); return; }
    if (parts[0] === 'login') {
      location.hash = App.canEdit() ? '#/basic' : '#/exams';
      return;
    }
    if (App.isSchool() && ['exams', 'evaluations', 'algorithm'].indexOf(parts[0]) === -1) {
      location.hash = '#/exams';
      return;
    }

    let content = '';
    if (parts[0] === 'schools') content = App.pages.schools(parts);
    else if (parts[0] === 'basic') content = App.pages.basic(parts);
    else if (parts[0] === 'exams') content = App.pages.exams(parts);
    else if (parts[0] === 'import') content = App.pages.import(parts);
    else if (parts[0] === 'evaluations') content = App.pages.evaluations(parts);
    else if (parts[0] === 'settings') content = App.pages.settings(parts);
    else if (parts[0] === 'algorithm') content = App.pages.algorithm(parts);
    else content = App.pages.evaluations(parts);

    root.innerHTML = UI.layout(content, parts[0]);
    UI.closeModal();
  };

  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (!action || action === 'noop') return;
    const fn = App.actions[action];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') UI.closeModal(); });
  window.addEventListener('hashchange', function () { App.render(); window.scrollTo({ top: 0, behavior: 'auto' }); });
})();
