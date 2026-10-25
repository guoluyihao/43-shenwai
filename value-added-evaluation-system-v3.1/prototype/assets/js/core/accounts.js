/* v3.1 演示账号：首页登录与系统内部共用同一份账号表 */
(function () {
  'use strict';

  const ACCOUNTS = {
    ops: { password: 'Ops@2026', role: 'admin', name: '运营管理员', schoolId: '' },
    boya: { password: 'Boya@2026', role: 'school', name: '博雅高中管理员', schoolId: 'S01' },
    hongzhi: { password: 'Hongzhi@2026', role: 'school', name: '弘知高中管理员', schoolId: 'S02' },
    ligong: { password: 'Ligong@2026', role: 'school', name: '理工高中管理员', schoolId: 'S03' },
    zhiyuan: { password: 'Zhiyuan@2026', role: 'school', name: '致远高中管理员', schoolId: 'S04' }
  };

  const OVERRIDES_KEY = 've_account_passwords';

  function readOverrides() {
    try {
      return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function passwordFor(key) {
    const overrides = readOverrides();
    return overrides[key] || (ACCOUNTS[key] ? ACCOUNTS[key].password : '');
  }

  function check(username, password) {
    const key = String(username || '').trim().toLowerCase();
    const account = ACCOUNTS[key];
    if (!account || passwordFor(key) !== String(password || '')) return null;
    return {
      key: key,
      role: account.role,
      name: account.name,
      schoolId: account.schoolId || 'S01'
    };
  }

  function remember(account) {
    if (!account || !account.key) return false;
    try {
      localStorage.setItem('ve_account', account.key);
      localStorage.setItem('ve_role', account.role);
      localStorage.setItem('ve_user', account.name);
      localStorage.setItem('ve_school', account.schoolId || 'S01');
      return true;
    } catch (e) {
      return false;
    }
  }

  function setPassword(key, password) {
    const overrides = readOverrides();
    overrides[key] = String(password || '');
    try {
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
      return true;
    } catch (e) {
      return false;
    }
  }

  window.VE_AUTH = {
    accounts: ACCOUNTS,
    check: check,
    remember: remember,
    passwordFor: passwordFor,
    setPassword: setPassword
  };
})();
