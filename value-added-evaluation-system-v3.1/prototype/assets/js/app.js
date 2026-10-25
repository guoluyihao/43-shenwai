/* v3.1 入口 */
(function () {
  'use strict';
  const App = window.App;
  if (!App.state.role) { window.location.replace('index.html'); return; }
  if (!location.hash || location.hash === '#/login') {
    location.hash = App.canEdit() ? '#/basic' : '#/exams';
  }
  App.render();
})();
