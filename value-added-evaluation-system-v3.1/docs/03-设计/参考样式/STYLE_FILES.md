# 样式风格文件清单

将以下文件复制到新项目对应位置，即可复用本项目的完整样式风格。

## 文件列表

| # | 源文件路径 | 说明 |
|---|-----------|------|
| 1 | `.eslintrc.cjs` | 后端 ESLint 规则 |
| 2 | `.prettierrc` | 后端 Prettier 格式化配置 |
| 3 | `web/admin-spa/.eslintrc.cjs` | 前端 ESLint 规则 |
| 4 | `web/admin-spa/.prettierrc` | 前端 Prettier 格式化配置 |
| 5 | `web/admin-spa/tailwind.config.js` | Tailwind CSS 配置（含主题色、动画扩展） |
| 6 | `web/admin-spa/postcss.config.js` | PostCSS 配置 |
| 7 | `web/admin-spa/src/assets/styles/variables.css` | CSS 变量定义（颜色、表面色等） |
| 8 | `web/admin-spa/src/assets/styles/global.css` | 全局样式 + 暗黑模式覆盖 |
| 9 | `web/admin-spa/src/assets/styles/components.css` | 组件通用样式（glass、btn、card 等） |
| 10 | `web/admin-spa/src/assets/styles/main.css` | 样式入口（import 汇总） |
| 11 | `web/admin-spa/src/assets/fonts/inter/inter.css` | Inter 字体声明 |
| 12 | `web/admin-spa/src/assets/fonts/inter/Inter-Light.woff2` | Inter 字体 300 |
| 13 | `web/admin-spa/src/assets/fonts/inter/Inter-Regular.woff2` | Inter 字体 400 |
| 14 | `web/admin-spa/src/assets/fonts/inter/Inter-Medium.woff2` | Inter 字体 500 |
| 15 | `web/admin-spa/src/assets/fonts/inter/Inter-SemiBold.woff2` | Inter 字体 600 |
| 16 | `web/admin-spa/src/assets/fonts/inter/Inter-Bold.woff2` | Inter 字体 700 |

## 注意事项

### 1. 补充缺失的 RGB CSS 变量

`variables.css` 中未定义 RGB 分量变量，需在新项目的 `:root` 中手动添加，否则阴影/光晕效果失效：

```css
:root {
  --primary-rgb: 102, 126, 234;
  --secondary-rgb: 118, 75, 162;
  --accent-rgb: 240, 147, 251;
}
```

### 2. 安装 Font Awesome 图标库

`main.css` 中引用了 Font Awesome，新项目需要安装：

```bash
npm install @fortawesome/fontawesome-free
```

### 3. 安装 Tailwind CSS 相关依赖

```bash
npm install -D tailwindcss postcss autoprefixer
```

如果前端使用了 `prettier-plugin-tailwindcss`，还需要：

```bash
npm install -D prettier-plugin-tailwindcss
```

### 4. 暗黑模式配置

`tailwind.config.js` 使用 `darkMode: 'class'`，需在 `<html>` 标签上添加 `dark` class 来切换暗黑模式。

### 5. 样式引入顺序

在新项目的入口 CSS 中按以下顺序引入：

```css
@import './fonts/inter/inter.css';
@import './styles/main.css';
```
