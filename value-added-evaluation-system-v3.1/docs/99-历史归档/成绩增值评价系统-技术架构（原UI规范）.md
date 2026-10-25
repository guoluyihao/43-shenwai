以下为“仅 UI/交互重构、不改业务”的桌面优先设计规范，适用于 Thymeleaf + Bootstrap 的现有页面结构。

## 全局（所有页面通用）

### Layout

* 桌面优先：Header（sticky）+ Sidebar（左侧固定宽度）+ Main（自适应）。

* 响应式：<=992px 时 Sidebar 改为抽屉/隐藏（保留折叠按钮）；Main 内边距从 24px 降到 16px。

### Meta Information

* 默认 Title：`成绩增值评价 - {页面名}`；Description：`成绩增值评价项目管理与结果分析`。

* OG：`og:title/og:description/og:type=website`（内网系统可选但建议保留）。

### Global Styles（设计 Token）

* 以 CSS Variables 为主（参考现有 app.css 与 TaskFlow 设计原则），不引入“style-export”交付要求。

* 色彩（示例，与现有实现对齐）：

  * 主色 `--color-primary #165DFF`；成功/警告/危险 `--color-success/#00B42A` `--color-warning/#FF7D00` `--color-danger/#F53F3F`

  * 背景 `--bg-page #F2F3F5`；卡片 `--bg-card #FFFFFF`；边框 `--border #E5E6EB`

* 字体：`PingFang SC, Microsoft YaHei, Inter, system-ui`；基础字号 14px；标题 20px。

* 组件一致性：按钮高度 44px；chip 高度 32px；卡片圆角 8px；卡片阴影 `--shadow-1/2`。

* 交互：hover 高亮（主色透明底）、focus 可见（outline/box-shadow）、提交 loading 遮罩、toast 提示、危险操作二次确认弹窗。

### Page Structure（通用组件）

* App Header：系统名/当前项目名 + 侧边栏折叠按钮 + 右侧“管理员”身份 chip。

* Sidebar：项目维度导航（返回列表、数据计算、数据评价、老师看板、学生矩阵）并突出 active。

* Breadcrumb：支持返回上级（项目列表 → 项目 → 当前页）。

* Student Detail Modal：在数据计算/学生矩阵内复用；表格按进退步状态着色。

***

## 1) 评价项目列表（/projects）

### Meta

* Title：`成绩增值评价 - 评价项目`

### Sections & Components

* Page Header：标题 + “新增评价项目”主按钮。

* 快速筛选卡片：单输入框（前端过滤），右侧“重置”。

* 项目表格：

  * 列：ID/项目名/入口/出口/状态 badge/进度/更新时间/操作。

  * 操作：未完成显示“进度”；完成显示“查看”；可删除时显示“删除（确认）”。

* 新建项目 Modal：3 个文本输入 + 1 个文件输入（xlsx）；提交后显示 loading 遮罩并跳转进度页。

***

## 2) 项目进度（/projects/{id}/progress-page）

### Meta

* Title：`成绩增值评价 - 项目进度`

### Sections & Components

* 指标卡片：项目名/入口/出口三列信息。

* 状态区：状态 chip + 进度 chip + message chip（空值时隐藏/占位）。

* 进度条：主进度条（百分比文字同步），每 1s 轮询 `/projects/{id}/progress`。

* 行为：

  * “后台运行”返回列表不终止任务；“刷新”手动刷新。

  * COMPLETED 时展示“进入详情”按钮组；失败时展示明确失败文案（不增加重试）。

***

## 3) 项目数据计算（/projects/{id}/compute）

### Meta

* Title：`成绩增值评价 - 数据计算`

### Sections & Components

* 顶部操作：导出 Excel（带当前筛选参数）+ 项目进度。

* 筛选表单：姓名/班级/科目/教师 + 每页条数（number）；“查询/重置”；结果 chip（总条数/页码/size）。

* 分页条：上一页/页码/下一页；保持筛选参数。

* 明细表格：列固定顺序与当前实现一致；表头 sticky；行 hover 高亮。

* 学生详情弹窗：点击姓名打开；首屏先展示骨架/空表，再拉取 `/projects/{id}/students/{studentId}/subjects`；按进步/退步/保持上色。

***

## 4) 项目数据评价（/projects/{id}/evaluation）

### Meta

* Title：`成绩增值评价 - 数据评价`

### Sections & Components

* 顶部操作：导出班级/老师 Excel + 项目进度。

* Tab：班级评价/老师评价；保持当前 Tab 状态（query 参数 tab）。

* 筛选区：科目 chip（默认总分）；对象 chip（班级/老师，随科目联动）+ “重置”。

* 图表区：3 张柱状图（相对进步率/综合实力/保持进步退步）；切换 Tab 时触发 resize。

* 列表区：展示两套排名；点击班级/老师名称下钻到数据计算页（带 subject、className 等参数）。

***

## 5) 老师看板（/projects/{id}/teacher-board）

### Meta

* Title：`成绩增值评价 - 老师看板`

### Sections & Components

* 老师选择 chip：横向可换行；默认选中第一位。

* 分支展示：

  * 总分老师：班级选择 chip；展示“本班总分+各科”指标表；提供“查看学生矩阵”。

  * 学科老师：科目选择 chip；展示老师个人指标卡（含两套排名）+ 任教班级指标表。

* 顶部下载：满足条件时显示“下载 PDF 报告”（teacher-subject / teacher-total）。

***

## 6) 学生明细矩阵（/projects/{id}/teacher-students）

### Meta

* Title：`成绩增值评价 - 学生明细矩阵`

### Sections & Components

* 顶部下载与返回：条件满足时显示 PDF 下载；“返回看板”。

* Matrix Form：

  * 老师/科目/班级使用 chip（JS 提交隐藏字段），避免下拉；学科老师支持“全部班级”。

  * 指标多选（checkbox inline）；“应用/恢复默认指标”。

* 矩阵表：

  * 双层表头：第一行科目分组 colSpan；第二行指标列；表头 sticky。

  * 左侧三列（学籍号/姓名/班级）sticky；单元格按 progressStatus 着色。

  * 点击姓名复用学生详情弹窗（同数据计算页）。

