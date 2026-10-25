/* v3.1 算法说明入口（公开版，不含真实数据） */
(function () {
  'use strict';
  const App = window.App;
  const UI = window.UI;

  App.pages.algorithm = function () {
    const c = window.MOCK.constants;
    const rows = c.BANDS9.map((pct, i) => {
      const prev = i === 0 ? 0 : c.BANDS9[i - 1];
      const z = i === 0 ? `Z > ${c.Z_BANDS9[0]}`
        : i === c.BANDS9.length - 1 ? `Z ≤ ${c.Z_BANDS9[c.Z_BANDS9.length - 1]}`
          : `${c.Z_BANDS9[i]} < Z ≤ ${c.Z_BANDS9[i - 1]}`;
      return {
        grade: `G${i + 1}`,
        z,
        share: `${Math.round((pct - prev) * 10) / 10}%`,
        weight: c.WEIGHTS9[i]
      };
    });
    return `<div class="page doc-page">
      <div class="page-head">
        <div><div class="breadcrumb"><span>帮助</span><span class="sep">/</span><span>算法说明</span></div><h1 class="page-title">增值评价算法说明</h1><div class="page-desc">公开版 · 不含真实学生数据 · 9 档默认</div></div>
        <div class="page-actions"><button class="btn btn-primary" data-action="openPublicAlgorithm">打开完整算法说明</button><button class="btn" data-action="openAlgorithmFaq">常见指标问题</button>${App.canEdit() ? '<button class="btn" data-action="openSettings">参数配置</button>' : ''}<button class="btn" data-action="openAlgorithmProcess" data-id="T1">查看计算过程</button></div>
      </div>
      <div class="doc-hero card mb-16"><div class="card-body"><div class="doc-hero-title">DOCUMENT</div><div class="doc-hero-text">从“为什么不能直接比分数”讲到“权重怎么用、班级指标怎么汇总”，并配有虚构学生与虚构班级的完整用例。</div><div class="doc-hero-meta"><span>公开版</span><span>无真实姓名/学号</span><span>9 档</span><span>完整示例</span></div></div></div>
      <div class="card mb-16" style="border-color:#bfdbfe;background:linear-gradient(135deg,#f5f9ff,#fff)"><div class="card-body small" style="display:flex;flex-direction:column;gap:7px">
        <div class="strong">先用业务话记住三句</div>
        <div><b>1. 入口出口比位置，位置变化看进步。</b>不看绝对分，看学生在联考全体中的相对位置。</div>
        <div><b>2. 等级换成权重，权重汇成班级和学校。</b>G1=90，G9=10；权重不是分数，是等级的位置分。</div>
        <div><b>3. 先看样本和异常，再看指标和排名。</b>小样本不排名；不同参数、不同版本不能直接比较。</div>
      </div></div>
      <div class="grid grid-2 mb-16">
        <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>文档内容</div></div></div><div class="card-body small" style="display:flex;flex-direction:column;gap:8px">
          <div><b>1. 业务问题</b>：为什么两次考试不能直接比分数。</div>
          <div><b>2. 核心概念</b>：标准分、等级、权重、贡献、四层汇总。</div>
          <div><b>3. 权重专章</b>：权重是什么、不是什么、三个用途、数字例子。</div>
          <div><b>4. 计算过程</b>：标准分、等级、判定、汇总，每个公式配文字解释。</div>
          <div><b>5. 完整用例</b>：虚构学生A + 虚构班级C01 的逐项代入。</div>
          <div><b>6. 结果解读</b>：指标怎么读、常见误读、参数与版本。</div>
        </div></div>
        <div class="card"><div class="card-head"><div><div class="card-title"><span class="dot"></span>9 档等级与权重</div><div class="card-sub">9 档对应 9 个权重；档位支持自定义配置</div></div></div>
          ${UI.table({ columns: [
            { key: 'grade', label: '等级' },
            { key: 'z', label: 'Z 区间' },
            { key: 'share', label: '理论占比', align: 'num' },
            { key: 'weight', label: '权重' },
          ], rows })}
        </div>
      </div>
      <div class="card"><div class="card-body small" style="display:flex;flex-direction:column;gap:8px">
        <div><b>公开说明</b>：本页和完整文档只使用虚构示例数据，不出现真实学生姓名、学号、学校、班级或教师。</div>
        <div><b>真实数据在哪里看</b>：登录后进入评价任务 → 结果 → 计算过程，查看本任务的真实样本与过程数据。</div>
        <div><b>9 档权重</b>：默认 9 档，权重为 90/80/70/60/50/40/30/20/10；档位支持自定义配置，新增档位时同步配置对应权重。</div>
      </div></div>
    </div>`;
  };

  function rememberAlgorithmReturn() {
    try {
      sessionStorage.setItem('ve_algorithm_return', location.pathname + location.search + location.hash);
    } catch (e) {}
  }
  App.actions.openPublicAlgorithm = function () {
    rememberAlgorithmReturn();
    location.href = 'algorithm.html';
  };
  App.actions.openAlgorithmFaq = function () {
    rememberAlgorithmReturn();
    location.href = 'algorithm.html#faq';
  };
  App.actions.openAlgorithmProcess = function (el) {
    App.navigate('/evaluations/' + (el.dataset.id || 'T1') + '/process');
  };
})();
