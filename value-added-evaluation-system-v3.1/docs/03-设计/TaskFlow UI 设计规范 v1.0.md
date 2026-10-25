# TaskFlow UI 设计规范 v1.0

本文档详细记录了 TaskFlow 待办事项首页所采用的 UI 设计规范。该规范基于“科技与理性”的设计原则，提供了一套完整的设计 Token 与组件样式，支持深色与浅色双模式，旨在为后续的开发与设计迭代提供标准化的参考。

## 1. 设计原则

TaskFlow 的设计遵循以下核心原则：

*   **清晰与高效**：信息层级明确，操作路径最短，确保用户能够快速定位并处理任务。
*   **科技与理性**：采用几何感、微渐变、玻璃态（毛玻璃效果）等视觉元素，传递精准与未来感。
*   **一致性**：所有组件严格遵循统一的空间、色彩、字体和动效规则。
*   **可访问性**：支持键盘导航（提供清晰的 `:focus-visible` 样式），满足对比度要求，尊重用户的减弱动效偏好（`prefers-reduced-motion`）。
*   **响应式**：优先移动端适配，通过弹性布局和断点控制，完整覆盖从移动端到宽屏桌面的显示需求。

## 2. 色彩系统 (Color System)

色彩系统通过 CSS 变量（CSS Variables）实现，默认以深色模式为主，同时提供完整的浅色模式映射。

### 2.1 品牌主色 (Primary Colors)

主色用于强调核心操作、链接和关键信息。

| Token 名称 | 深色模式 (Dark) | 浅色模式 (Light) | 用途说明 |
| :--- | :--- | :--- | :--- |
| `--primary` | `#0A66FF` | `#0A66FF` | 品牌主色，主要按钮、激活状态、进度条 |
| `--primary-hover` | `#3E8EFF` | `#0056D4` | 按钮悬浮、激活状态 |
| `--primary-light` | `rgba(10, 102, 255, 0.1)` | `rgba(10, 102, 255, 0.08)` | 背景底色、选中态背景、标签背景 |
| `--primary-glow` | `rgba(10, 102, 255, 0.25)` | `rgba(10, 102, 255, 0.15)` | 按钮发光阴影、聚焦外发光 |

### 2.2 中性色 (Neutral Colors)

中性色用于构建页面的层级结构，包括背景、卡片、边框和文本。

| Token 名称 | 深色模式 (Dark) | 浅色模式 (Light) | 用途说明 |
| :--- | :--- | :--- | :--- |
| `--bg` | `#0A0C10` | `#FFFFFF` | 全局页面背景 |
| `--surface` | `#14171C` | `#F9FAFB` | 基础卡片、面板背景 |
| `--surface-elevated` | `#1E2128` | `#FFFFFF` | 悬浮卡片、输入框、下拉菜单、移动端抽屉 |
| `--border` | `#2C2F36` | `#E5E7EB` | 边框、分割线 |
| `--text-primary` | `#FFFFFF` | `#111827` | 主要文字、标题 |
| `--text-secondary` | `#9CA3AF` | `#6B7280` | 辅助文字、次要信息、图标默认色 |
| `--text-disabled` | `#4B5563` | `#D1D5DB` | 占位符、禁用文字、弱化信息 |

### 2.3 功能色 (Semantic Colors)

功能色用于传达特定的状态信息。

| Token 名称 | 色值 | 用途说明 |
| :--- | :--- | :--- |
| `--success` | `#10B981` | 成功状态、已完成任务、低优先级指示 |
| `--warning` | `#F59E0B` | 警告状态、中优先级指示 |
| `--error` | `#EF4444` | 错误状态、高优先级指示、删除操作 |
| `--info` | `#3B82F6` | 提示信息、开发类标签 |

### 2.4 渐变与装饰 (Gradients & Decorations)

用于增强科技感和视觉层次。

| Token 名称 | 深色模式 (Dark) | 浅色模式 (Light) | 用途说明 |
| :--- | :--- | :--- | :--- |
| `--gradient-primary` | `linear-gradient(135deg, #0A66FF 0%, #8B5CF6 100%)` | 同深色模式 | Logo 文字、进度条填充、今日柱状图 |
| `--gradient-glow` | `radial-gradient(circle at 70% 20%, rgba(10, 102, 255, 0.18), transparent 60%)` | `radial-gradient(circle at 70% 20%, rgba(10, 102, 255, 0.1), transparent 60%)` | 页面背景全局辉光装饰 |

## 3. 字体与排版 (Typography)

### 3.1 字体族 (Font Family)

全局采用无衬线字体族，优先使用 `Inter`，并提供系统默认字体作为后备。

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
```

### 3.2 字号与行高 (Sizes & Line Heights)

基础字号为 `16px`，全局行高基准为 `1.5`。

| 层级 | 字号 (Font Size) | 字重 (Font Weight) | 行高 (Line Height) | 用途示例 |
| :--- | :--- | :--- | :--- | :--- |
| **Hero Title** | `36px` | `600` (Semi-bold) | `1.25` | 首页欢迎大标题 |
| **Stat Value** | `30px` | `600` (Semi-bold) | `1.2` | 统计卡片数字 |
| **Panel Title** | `18px` | `600` (Semi-bold) | `1.5` | 任务列表标题、弹窗标题 |
| **Body Large** | `16px` | `400` (Regular) | `1.5` | Hero 副标题 |
| **Body** | `15px` | `500` (Medium) | `1.5` | 任务标题、抽屉链接 |
| **Body Small** | `14px` | `400` / `500` | `1.5` | 按钮文字、输入框文字、导航链接 |
| **Caption** | `13px` | `500` (Medium) | `1.5` | 过滤标签、表单 Label、项目名称 |
| **Micro** | `12px` | `400` (Regular) | `1.5` | 任务时间、统计标签、周概览星期 |
| **Badge** | `11px` | `500` (Medium) | `1.5` | 任务分类标签、周概览数字 |

## 4. 布局与间距 (Layout & Spacing)

### 4.1 容器与网格 (Container & Grid)

*   **最大宽度**：`1280px` 居中显示。
*   **页面内边距**：桌面端左右 `24px`，移动端左右 `16px`。
*   **内容双栏布局**：桌面端采用 CSS Grid 布局，左侧自适应（`1fr`），右侧固定 `360px`，栏间距 `gap: 24px`。

### 4.2 断点系统 (Breakpoints)

*   **桌面端**：`> 1024px`（双栏布局，完整导航）。
*   **平板端**：`<= 1024px`（单栏布局，侧边栏内容变为两列网格）。
*   **移动端**：`<= 768px`（单栏布局，隐藏顶部导航链接，启用汉堡菜单和抽屉导航，统计卡片平铺）。
*   **小屏移动端**：`<= 480px`（优化 Toast 通知宽度，调整 Hero 间距）。

### 4.3 圆角系统 (Border Radius)

| Token 名称 | 尺寸 | 用途说明 |
| :--- | :--- | :--- |
| `--radius-sm` | `8px` | 输入框、小按钮、过滤标签、图标按钮 |
| `--radius-md` | `12px` | 主要按钮、Toast 通知、移动端抽屉链接 |
| `--radius-lg` | `16px` | 数据卡片、任务面板、弹窗容器 |
| `--radius-full` | `32px` / `50%` | 状态标签、进度条、头像、圆形指示器 |

### 4.4 阴影系统 (Shadows)

| Token 名称 | 深色模式 (Dark) | 浅色模式 (Light) | 用途说明 |
| :--- | :--- | :--- | :--- |
| `--shadow-card` | `0 8px 20px rgba(0,0,0,0.25)` | `0 2px 8px rgba(0,0,0,0.06)` | 基础卡片、任务面板静止状态 |
| `--shadow-card-hover` | `0 16px 32px rgba(0,0,0,0.4)` | `0 8px 20px rgba(0,0,0,0.12)` | 卡片悬浮状态（配合 `translateY(-2px)`） |
| `--shadow-elevated` | `0 16px 40px rgba(0,0,0,0.4)` | `0 8px 24px rgba(0,0,0,0.1)` | 弹窗、Toast 通知、下拉菜单等悬浮层 |

## 5. 组件规范 (Components)

### 5.1 按钮 (Buttons)

所有按钮高度统一为 `44px`（小按钮/图标按钮为 `40px`），文字字号 `14px`，字重 `500`。

*   **Primary (主按钮)**：背景 `--primary`，文字白色。悬浮时背景变为 `--primary-hover`，上浮 `1px`，并带有 `--primary-glow` 发光阴影。
*   **Secondary (次按钮)**：透明背景，边框 `1.5px solid var(--primary)`，文字 `--primary`。悬浮时背景变为 `--primary-light`，上浮 `1px`。
*   **Ghost (幽灵按钮)**：透明背景，无边框，文字 `--text-secondary`。悬浮时背景变为 `--primary-light`，文字变为 `--text-primary`。常用于图标按钮和关闭按钮。
*   **交互反馈**：所有按钮在 `:focus-visible` 状态下均有 `2px solid var(--primary)` 的外发光轮廓（`outline-offset: 2px`）。

### 5.2 输入框与表单 (Inputs & Forms)

*   **基础样式**：高度 `44px`，背景 `--surface-elevated`，边框 `1px solid var(--border)`，圆角 `8px`，内边距 `0 12px`。
*   **文本样式**：输入文字 `--text-primary`，占位符 `--text-disabled`，字号 `14px`。
*   **聚焦状态 (Focus)**：边框变为 `--primary`，并带有 `0 0 0 3px rgba(10, 102, 255, 0.2)` 的外发光阴影。
*   **多行文本 (Textarea)**：最小高度 `88px`，支持垂直拉伸。
*   **搜索框**：左侧带有绝对定位的搜索图标，左内边距增加至 `40px`。

### 5.3 卡片与面板 (Cards & Panels)

*   **基础样式**：背景 `--surface`，边框 `1px solid var(--border)`，圆角 `16px`，内边距 `20px`。
*   **悬浮动效**：鼠标悬浮时触发 `transform: translateY(-2px)`，阴影加深为 `--shadow-card-hover`。
*   **标题区域**：卡片标题字号 `15px`，字重 `600`，带有 `--primary` 颜色的前置图标。

### 5.4 导航栏 (Navbar)

*   **高度**：`72px`，固定在顶部（`position: sticky`）。
*   **背景**：深色模式 `rgba(10, 12, 16, 0.8)`，浅色模式 `rgba(255, 255, 255, 0.85)`。
*   **毛玻璃效果**：`backdrop-filter: blur(12px)`。
*   **底部边框**：`1px solid var(--border)`。

### 5.5 标签与徽章 (Tags & Badges)

*   **尺寸**：高度 `22px`，内边距 `0 10px`，圆角 `32px`，字号 `11px`。
*   **填充型 (Filled)**：背景 `--primary-light`，文字 `--primary`（如“工作”、“新建”）。成功类标签背景为浅绿色，文字为 `--success`。
*   **描边型 (Outline)**：透明背景，边框 `1px solid var(--border)`，文字 `--text-secondary`（如“文档”）。信息类标签边框为浅蓝色，文字为 `--info`。

### 5.6 任务列表项 (Task Items)

*   **布局**：Flex 布局，内边距 `14px 24px`，包含复选框、内容区、优先级圆点和更多操作按钮。
*   **悬浮状态**：背景变为 `--primary-light`，右侧“更多”按钮透明度从 `0` 变为 `1`。
*   **复选框**：`22x22px`，圆角 `6px`，边框 `2px solid var(--border)`。选中后背景和边框变为 `--success`，内部显示白色对勾。
*   **已完成状态**：整体透明度降低至 `0.55`，标题增加删除线，颜色变暗。

### 5.7 进度条 (Progress Bars)

*   **轨道**：高度 `8px`（迷你进度条 `6px`），背景 `--surface-elevated`，圆角 `32px`。
*   **填充**：背景使用 `--gradient-primary`，带有 `600ms` 的宽度过渡动画。主进度条末端带有一个发光的白色指示点。

## 6. 动效规范 (Animation & Motion)

全局动效追求流畅、自然、不拖沓，采用弹簧缓动曲线。

*   **全局缓动曲线**：`--ease-spring: cubic-bezier(0.2, 0.9, 0.4, 1.1)`。
*   **基础过渡时间**：`--transition: 200ms var(--ease-spring)`。
*   **微交互**：
    *   按钮悬浮：`transform: translateY(-1px)`。
    *   卡片悬浮：`transform: translateY(-2px)`。
    *   复选框点击：缩放至 `1.1` 倍后恢复。
*   **入场与状态切换**：
    *   新建任务：从透明度 `0`、`translateY(-8px)` 滑入，耗时 `300ms`。
    *   完成任务：透明度降低，向右位移 `4px`，耗时 `300ms`。
    *   Toast 通知：从右侧 `translateX(24px)` 滑入，耗时 `300ms`。
    *   弹窗：从 `translateY(16px) scale(0.97)` 放大滑入。
*   **持续动画**：
    *   Hero 区域挥手 Emoji：`2.5s` 周期旋转摇摆。
    *   今日任务指示点：`2s` 周期脉冲缩放（`pulse-dot`）。
*   **无障碍支持**：通过 `@media (prefers-reduced-motion: reduce)` 禁用所有动画和过渡效果。

## 7. 交付与复用建议

1.  **CSS 变量优先**：在开发新组件时，必须使用 `:root` 中定义的 CSS 变量（如 `var(--primary)`、`var(--surface)`），严禁硬编码颜色值，以确保深浅色模式的完美切换。
2.  **语义化 HTML**：保持使用 `<nav>`、`<main>`、`<aside>`、`<section>` 等语义化标签，列表使用 `role="list"` 和 `role="listitem"`。
3.  **可访问性测试**：确保所有交互元素（按钮、输入框、链接）在 Tab 键导航时都能显示清晰的 `:focus-visible` 轮廓。
4.  **图标规范**：推荐使用 `20x20px` 或 `24x24px` 的线性图标（如 Lucide 或 Feather Icons），线条宽度保持 `2px`，使用 `currentColor` 继承文本颜色。
