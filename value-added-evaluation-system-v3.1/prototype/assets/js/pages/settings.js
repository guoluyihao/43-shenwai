/* v3.1 系统参数配置（仅运营管理员） */
(function () {
  'use strict';
  const App = window.App;
  const UI = window.UI;

  function bandTable(bands, weights, title, zBands) {
    const rows = bands.map((pct, i) => {
      const prev = i === 0 ? 0 : bands[i - 1];
      const z = i === 0 ? `Z > ${zBands[0]}`
        : i === bands.length - 1 ? `Z ≤ ${zBands[zBands.length - 1]}`
          : `${zBands[i]} < Z ≤ ${zBands[i - 1]}`;
      return {
        grade: `G${i + 1}`,
        z,
        share: `${Math.round((pct - prev) * 10) / 10}%`,
        weight: weights[i]
      };
    });
    return `<div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>${title}</div><div class="card-sub">G1 最高、G9 最低；等级由 Z 区间判定，权重只在等级确定后参与汇总</div></div><span class="tag">默认 9 档 · 可自定义</span></div>
      <div class="card-body" style="padding-bottom:2px">
        <div class="ruler-band" aria-label="9 档等级与权重示意">
          ${weights.map((w, i) => `<div class="band b${i + 1}"><b>G${i + 1}</b><small>${w}</small></div>`).join('')}
        </div>
        <div class="ruler-foot"><span>权重只参与汇总，不参与划档</span><span>Z 区间与理论占比见下表</span></div>
      </div>
      ${UI.table({ columns: [
        { key: 'grade', label: '等级' },
        { key: 'z', label: 'Z 区间' },
        { key: 'share', label: '理论占比', align: 'num' },
        { key: 'weight', label: '权重', align: 'num' }
      ], rows })}
    </div>`;
  }

  App.pages.settings = function () {
    if (!App.canEdit()) {
      return `<div class="page"><div class="page-head"><div><h1 class="page-title">参数配置</h1><div class="page-desc">运营管理员维护评价默认参数</div></div></div>${UI.empty('学校管理员为只读角色', '参数配置仅对运营管理员开放')}</div>`;
    }
    const s = App.settings;
    const c = window.MOCK.constants;
    const task = App.task('T1');
    return `<div class="page">
      <div class="page-head">
        <div><div class="breadcrumb"><span>管理</span><span class="sep">/</span><span>参数配置</span></div><h1 class="page-title">参数配置</h1><div class="page-desc">维护新建评价任务的默认算法参数；已完成任务保留自己的参数快照</div></div>
        <div class="page-actions"><button class="btn" data-action="openAlgorithm">查看算法说明</button><button class="btn" data-action="resetSettings">恢复默认</button><button class="btn btn-primary" data-action="saveSettings">保存参数</button></div>
      </div>
      <div class="grid grid-2 mb-16">
        <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>默认参数</div><div class="card-sub">仅影响之后新建的任务，不自动重算已完成任务</div></div></div><div class="card-body">
          <div class="form-grid-2">
            <div class="field"><label class="field-label">默认等级档数</label><select id="settingsGradeCount" class="select"><option value="9" selected>9 档</option></select><div class="field-hint">当前预设 9 档，支持自定义配置档位</div></div>
            <div class="field"><label class="field-label">默认算法</label><select id="settingsAlgorithm" class="select"><option value="standard" ${s.algorithm === 'standard' ? 'selected' : ''}>标准分增值法</option><option value="grade" ${s.algorithm === 'grade' ? 'selected' : ''}>等级差法</option></select><div class="field-hint">标准分法使用保持阈值与步长</div></div>
            <div class="field"><label class="field-label">保持阈值</label><input id="settingsThreshold" class="input" type="number" min="0.05" max="2" step="0.05" value="${s.keepThreshold}" /><div class="field-hint">|Δz| 小于该值判定保持</div></div>
            <div class="field"><label class="field-label">每级步长</label><input id="settingsStep" class="input" type="number" min="0.1" max="3" step="0.05" value="${s.stepSize}" /><div class="field-hint">超过阈值后每跨一级所需的 Δz</div></div>
            <div class="field"><label class="field-label">小样本阈值</label><input id="settingsSample" class="input" type="number" min="1" max="100" step="1" value="${s.smallSample}" /><div class="field-hint">当前：少于 ${s.smallSample} 人的班级/教师不排名</div></div>
            <div class="field"><label class="field-label">部分缺考处理</label><select id="settingsPartialAbsent" class="select"><option value="1" ${s.excludePartialAbsent ? 'selected' : ''}>整生剔除</option><option value="0" ${!s.excludePartialAbsent ? 'selected' : ''}>仅剔除该科</option></select><div class="field-hint">新建任务默认；任务内仍可单独调整</div></div>
            <div class="field"><label class="field-label">当前任务</label><div class="input" style="display:flex;align-items:center;background:var(--surface-2)">${task ? `${App.esc(task.name)} · ${task.gradeCount} 档 · ${task.resultVersion}` : '—'}</div><div class="field-hint">当前任务使用 ${task ? task.gradeCount : '—'} 档计算</div></div>
          </div>
          <div class="alert info mt-16">${UI.icon('alert')}<div>参数保存后写入浏览器本地设置，刷新页面仍保留；新建任务自动带入。已有任务的结果不会因全局默认变化而改变。</div></div>
        </div></div>
        <div class="card" style="align-self:start"><div class="card-head"><div><div class="card-title"><span class="dot"></span>参数口径</div></div></div><div class="card-body small" style="display:flex;flex-direction:column;gap:9px">
          <div><b>等级档数</b>：当前预设 9 档，按标准正态 Z 区间划分；理论占比为 4% / 6.5% / 12.1% / 17.5% / 19.8% / 17.5% / 12.1% / 6.5% / 4%；档位支持自定义配置。</div>
          <div><b>标准分法</b>：|Δz| ≤ 阈值保持；Δz &gt; 阈值进步；Δz &lt; −阈值退步。</div>
          <div><b>级数</b>：进步 = 1 + floor((Δz − 阈值) ÷ 步长)，退步取负。</div>
          <div><b>等级差法</b>：级数 = 入口等级 − 评价等级。</div>
          <div><b>小样本</b>：班级/教师人数少于 ${s.smallSample} 人时只展示指标，不参与排名。</div>
          <div><b>部分缺考</b>：整生剔除时，任一科缺考即不进入该任务任何统计；仅剔除该科时，其他科仍保留。</div>
        </div></div>
      </div>
      <div class="mb-16">
        ${bandTable(c.BANDS9, c.WEIGHTS9, '9 档 Z 区间与权重（默认，支持自定义配置档位）', c.Z_BANDS9)}
      </div>
      <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>参数与结果版本</div></div></div><div class="card-body">${UI.kv([
        ['默认等级档数', `${s.gradeCount} 档`],
        ['默认算法', s.algorithm === 'grade' ? '等级差法' : '标准分增值法'],
        ['保持阈值', s.keepThreshold],
        ['每级步长', s.stepSize],
        ['小样本阈值', `${s.smallSample} 人`],
        ['部分缺考处理', s.excludePartialAbsent ? '整生剔除' : '仅剔除该科'],
        ['生效范围', '新建评价任务'],
        ['已完成任务', '保留任务自身参数，不自动重算'],
        ['修改权限', '运营管理员']
      ])}</div></div>
    </div>`;
  };

  function readNumber(id, fallback) {
    const el = document.getElementById(id);
    const n = el ? Number(el.value) : NaN;
    return Number.isFinite(n) ? n : fallback;
  }

  App.actions.saveSettings = function () {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    const gradeCount = readNumber('settingsGradeCount', 9);
    const keepThreshold = readNumber('settingsThreshold', 0.25);
    const stepSize = readNumber('settingsStep', 0.5);
    const smallSample = readNumber('settingsSample', 8);
    const algorithmEl = document.getElementById('settingsAlgorithm');
    const algorithm = algorithmEl ? algorithmEl.value : 'standard';
    const partialEl = document.getElementById('settingsPartialAbsent');
    const excludePartialAbsent = partialEl ? partialEl.value === '1' : true;
    if (gradeCount !== 9) { UI.toast('当前预设为 9 档', 'warn'); return; }
    if (keepThreshold <= 0 || keepThreshold > 2) { UI.toast('保持阈值需在 0–2 之间', 'warn'); return; }
    if (stepSize <= 0 || stepSize > 3) { UI.toast('步长需在 0–3 之间', 'warn'); return; }
    if (smallSample < 1 || smallSample > 100) { UI.toast('小样本阈值需在 1–100 之间', 'warn'); return; }
    App.saveSettings({ gradeCount, keepThreshold, stepSize, smallSample, excludePartialAbsent, algorithm });
    UI.toast('参数已保存，新建任务将使用新默认值');
    App.render();
  };

  App.actions.resetSettings = function () {
    if (!App.canEdit()) { UI.toast('学校管理员为只读角色', 'warn'); return; }
    App.saveSettings(Object.assign({}, App.defaultSettings));
    UI.toast('已恢复默认参数');
    App.render();
  };

  App.actions.openAlgorithm = function () {
    location.href = 'algorithm.html';
  };
})();

