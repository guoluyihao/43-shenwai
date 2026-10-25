# UI 一致性改造说明（v3.2）

> 2026-10-23：首页 `prototype/index.html` 已更新为**浅色、极简、少装饰**的版本。本次改造以当前首页为唯一视觉基准，登录后的系统内部同步对齐；此前的深色/渐变方案已整体回退，不作为交付依据。

## 1. 目标与边界

- **目标**：让系统内部的壳层、页面、表格、表单、按钮、标签页、报告与公开算法页，与首页使用同一套视觉语言。
- **只改视觉层**：不改路由、数据结构、算法口径、评价流程、权限与打印逻辑。
- **保留后台效率**：不照搬营销页的大留白；表格仍保持 13px 与紧凑行高，宽表允许横向滚动。
- **首页不动**：`index.html` 作为基准，不改其样式与结构。

## 2. 设计对齐表

| 维度 | 首页（current） | 系统内部（改造后） |
|---|---|---|
| 画布 | `#f7f9fc` / 白色分节 | `#f7f9fc` 画布 + 白色卡片 |
| 顶栏 | 64px、白色、1px 下边框 | 64px、白色、1px 下边框 |
| 品牌标 | 32px、实心 `#0a66ff`、圆角 8 | 32px、实心 `#0a66ff`、圆角 8 |
| 主色 | `#0a66ff`，hover `#084fd0` | 同首页 |
| 正文 | 15px / 1.7 | 14px / 1.7（后台密度） |
| 页面标题 | h1 34–44 / 700 | h1 28 / 700 |
| 分节标题 | h2 30 / 700 | 卡片标题 15 / 600 |
| 圆角 | 8 / 10 / 12 | 8 / 10 / 12 |
| 卡片 | 1px 边框、极浅阴影 | 1px 边框、`0 1px 2px` |
| 按钮 | 实心蓝、8px 圆角、无渐变 | 同首页；表格内使用 26px 小号 |
| 标签页 | 无 | 下划线式，选中主色 + 2px 下划线 |
| 表格 | 细边框 | 表头 12px、正文 13px、hover 浅蓝 |
| 小标签 | 中文、主色 12px | 中文；不使用英文全大写眉标 |
| 9 档色带 | 无 | 浅蓝描边卡片，G1–G9 单色系 |
| 渐变/深色块 | 无 | 无 |
| 图标 | 线性 | 1.7 线宽、浅蓝方形图标底 |

## 3. 具体改动

### 3.1 设计变量
`assets/css/tokens.css`
- 色板、文字层级、边框、阴影、圆角与首页对齐；主色 `#0a66ff`，画布 `#f7f9fc`。
- 增加 `--radius-xs ~ --radius-2xl`；阴影收敛为 `0 1px 2px`、`0 8px 24px`、`0 24px 48px`。

### 3.2 壳层与页面骨架
`assets/css/app.css`
- 顶栏改为白色 64px、1px 下边框；品牌 32px 实心蓝标 + 14px 名称。
- 侧栏 236px，选中项浅蓝底 + 2px 主色竖线；帮助分组与版本说明卡保留。
- 页头统一为“面包屑 + 28px 标题 + 14px 说明”，移除英文全大写眉标。
- 表格统一 10px 圆角、12px 表头、13px 正文；宽表 `table-wide` 横向滚动。
- 表单 42px 高、8px 圆角；打印时隐藏导航、标签页、筛选与分页。

### 3.3 通用组件
`assets/css/components.css`
- 卡片 10px 圆角、1px 边框、极浅阴影，hover 只变边框色。
- 按钮 8px 圆角、实心主色，去掉渐变、胶囊与浮起阴影。
- 标签页改为下划线式；chip、badge 改为 6–8px 小圆角。
- 统计卡去掉渐变顶线与光晕，保留语义色数字。
- 9 档标尺改为浅蓝描边的 9 张小卡，权重用等宽数字。
- 报告角色栏、报告卡、图表色板同步收敛；图表使用实色，不使用渐变。
- 文档导读块由深色改为浅蓝底、1px 边框。

### 3.4 系统内页面
- `assets/js/core/ui.js`：品牌字标、顶栏范围/角色、侧栏底部说明；移除英文页头眉标逻辑。
- `assets/js/core/router.js`：不再注入页头眉标。
- `assets/js/pages/settings.js`、`assets/js/pages/algorithm.js`：9 档等级权重标尺。
- `assets/js/core/ui.js`：列数 ≥ 9 的表格自动加 `table-wide`。

### 3.5 公开算法说明
`algorithm.html`
- 顶栏 64px 白色，与首页 header 一致。
- 长文改为分节结构：白色画布 + 1px 分节线，取消卡片与阴影。
- 提示块改为左侧 2px 主色竖线；表格、FAQ、TOC 统一 8–10px 圆角。
- 标签全部中文化（“公开算法说明”“文档导读”）。

### 3.6 页面元信息
`app.html`、`algorithm.html`
- 统一 favicon（VE 蓝色方标）与 `theme-color`。
- 静态资源版本号更新至 `?v=20261023r11`，避免旧缓存。

## 4. 保留项

- 信息密度：结果表 13px、行高约 44px；不因视觉升级减少首屏行数。
- 成绩单固定列/双层表头、宽表横向滚动、分页与 CSV 导出。
- 学校管理员只读视图、只读横幅与按钮隐藏逻辑。
- 报告打印与 `@media print`；隐藏操作区、标签页和分页。
- 桌面优先；1280px 下宽表横向滚动，不压缩列宽。

## 5. 验证

- 19 个路由逐页截图，无控制台错误。
- 交互回归：学校卡片进入、结果 Tab 切换、修改密码弹窗、学校管理员只读、1280px 布局、报告打印。
- 截图目录：改造前 `_preview/before/`，改造后 `_preview/after/`。

| 页面 | 改造前 | 改造后 |
|---|---|---|
| 基础数据 | [before/basic.png](../../../_preview/before/basic.png) | [after/03-basic.png](../../../_preview/after/03-basic.png) |
| 评价结果 | [before/results.png](../../../_preview/before/results.png) | [after/10-results.png](../../../_preview/after/10-results.png) |
| 参数配置 | [before/settings.png](../../../_preview/before/settings.png) | [after/16-settings.png](../../../_preview/after/16-settings.png) |
| 公开算法说明 | [before/algorithm-public.png](../../../_preview/before/algorithm-public.png) | [after/19-algorithm-public.png](../../../_preview/after/19-algorithm-public.png) |

## 6. 回滚

- 改造前完整备份：`_backup/prototype-20261023-1847/`。
- 回滚方式：将备份中的 `index.html`、`app.html`、`algorithm.html`、`assets/` 覆盖回 `prototype/`，并清理浏览器缓存。
- 首页在改造期间更新为浅色版；若需回到更早的深色首页，请从备份中取 `index.html`，但内部样式不再与之匹配。

## 7. 后续建议

1. 将首页内联的 `:root` token 抽到 `assets/css/tokens.css`，形成单一来源。
2. 为 1280px 以下宽度补充侧栏折叠与表格滚动提示。
3. 报告图表色板继续统一为“主色 + 成功/危险”三色，减少衍生色。
