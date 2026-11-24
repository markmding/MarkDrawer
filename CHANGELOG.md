# 更新日志

Mark Drawer 文屉采用语义化版本（SemVer）：

- `MAJOR`：不兼容的存储格式或行为变更
- `MINOR`：向下兼容的新功能
- `PATCH`：向下兼容的修复
- 开发中的版本带 `-dev.N` 预发布后缀，发布时用 `npm run version:release` 去掉

`package.json` 是版本号的唯一来源：`src-tauri/tauri.conf.json` 指向该文件，`src-tauri/Cargo.toml` 由 `tools/version.mjs` 同步，界面版本经 Vite 注入（`__APP_VERSION__`）。提交前跑 `npm run version:check`。

## [0.4.0] - 2026-11-25

首个正式发行版：安装包与便携版均按 0.4.0 重新构建。

### 新增

- 快捷键体系：`src/lib/shortcuts.ts` 统一登记全部可绑定动作，菜单与键盘处理读取同一张表
- 格式菜单的每一项都有默认快捷键，并在菜单右侧显示当前绑定
- 「选项 → 自定义快捷键…」：逐项录入、冲突检测、单项/全部恢复默认，设置随语言与主题一并持久化
- 版本机制：`tools/version.mjs`（check / dev / release / bump / set）、`npm run version:check|dev|release`，构建前自动校验
- `CHANGELOG.md` 按开发阶段补齐历史版本（0.1.0 → 0.4.0）

### 变更

- 全局快捷键不再硬编码，全部经由注册表匹配；焦点在输入框时只放行保存、导出、查找等应用级动作
- 界面版本号改由 `package.json` 注入，不再手写常量
- 源码梳理：内部遗留的 `markup-*` 标识统一为 Mark Drawer 命名（导出文档类名 `.mark-drawer-doc`、自定义主题 `<style>` id、Mermaid 临时 id、Callout 插件键、Rust 临时目录前缀）；`version.mjs` 的变更日志插入点改到第一条版本小节之前；便携版输出目录默认值改为相对仓库推导，可用 `MARKDRAWER_OUT` 覆盖

## [0.3.0] - 2026-11-25

### 新增

- YAML Front Matter：编辑器顶部渲染只读「YAML 属性」卡片，保存时按原字节拼回，导出为 `.doc-properties`
- 目录大纲面板：视图菜单 / 菜单栏 `≣` / `Ctrl+Shift+O`，预览、源码、分栏三种视图按标题序号跳转
- 主题代码令牌：`--tok-*` 同时驱动 WYSIWYG 代码块、源码视图、分栏镜像与导出 HTML 的高亮

### 修复

- 源码视图与分栏镜像应用主题配色（此前固定浅色）
- Mermaid 预览失效：自定义 NodeView 不再覆盖 `editorViewOptionsCtx.nodeViews`，改为并入 `nodeViewCtx`

## [0.2.0] - 2026-11-24

### 新增

- M1 MVP：抽屉式文件树（新建/重命名/删除/拖拽）、多标签页、自动保存、编码与换行切换、冲突提示、回收站
- M2：主题文件与热重载、内置模板、tantivy 全文搜索、HTML 双模式导出、自建 A4 分页 PDF、导出预览、设置面板
- 品牌化：Mark Drawer 文屉、抽屉概念、中英双语界面、作者水印 `MARK#EZVE.COM`
- 便携版打包脚本（`MarkDrawer_Portable.exe` + 7z/zip，内含 themes / templates）
- 命令行与文件关联打开、单实例复用窗口

## [0.1.0] - 2026-11-21

### 新增

- Tauri v2 + Svelte 5 + Vite 脚手架，Windows 安装包与便携版打包
- Milkdown Crepe 所见即所得编辑 + CodeMirror 6 源码视图
- IPC 文件读写、目录遍历、路径越界校验、notify 文件监听
- 导出原型、长文档分块渲染、Mermaid / KaTeX / Callout 扩展

