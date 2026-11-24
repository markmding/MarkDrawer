# Mark Drawer 文屉 任务清单

> 依据 [prd.md](./prd.md) 拆解。状态：`[x]` 已落地 · `[~]` 骨架/部分 · `[ ]` 待做。
> 每个 Milestone 结束前需更新本文件，并在 PRD 待确认项上给出结论。

## M0 技术验证（当前）

- [x] Tauri v2 + Svelte 5 + Vite 脚手架、开发/构建脚本
- [x] Milkdown Crepe 集成（WYSIWYG）+ 源码视图（CodeMirror 6）
- [x] IPC 文件读写、目录遍历、路径越界校验
- [x] notify 文件监听 + 前端事件刷新
- [x] 导出原型：HTML 文件夹 / base64 单文件；PDF 打印入口
- [x] 占位图标（PNG/ICO/ICNS），可离线构建
- [x] **分块渲染（F2.7 阶段二）**：顶层块视口外卸载 DOM（DocumentFragment + min-height 外壳），滚动按需恢复；选区块与 ±2500px 预取带保持挂载；设置可整体关闭；undo/保存/选区跳转已验证
- [x] Mermaid 编辑器内渲染：复用 Crepe 代码块预览面板（编辑源码 + 实时预览 + 懒加载），无需自定义 NodeView
- [x] KaTeX 编辑器内验证：Crepe 行内/块级公式编辑与预览正常，导出一致
- [~] WebView 打印验证：A4 分页、页码范围、页码起始值已实现；WebView2 / WKWebView 的打印视觉回归留到 M3
- [x] Tauri 编译验证：`cargo check` 0 error / 0 warning；release 构建 + NSIS 打包通过，安装包 4.95MB，启动冒烟通过

## M1 MVP（P0）

### 抽屉 & 文件
- [x] 打开任意本地文件夹作为抽屉（Drawer，原「Vault / 库」概念）
- [x] 文件树展开/折叠、新建 md、重命名、删除
- [x] 拖拽移动文件
- [~] 新建/重命名/删除使用原生 prompt/confirm，需替换为应用内对话框
- [x] 外部修改监听自动刷新
- [x] 冲突提示：mtime 比对 + `CONFLICT` 返回 + 非阻塞提示条（重新加载 / 覆盖保存）
- [x] 附件目录固定为**程序目录（exe 同目录）的 `attachments/`**，打开抽屉时不再创建；图片粘贴/拖拽自动保存，Markdown 记录相对路径，编辑器内以 data URL 安全预览（旧库内的附件仍可读取）
- [x] `.gitignore` / `.ignore` / `.drawerignore` 忽略规则（兼容旧名 `.markupignore`；文件树与全文搜索同时生效）
- [x] 删除进回收站：移入抽屉内 `.mark-drawer-trash/`（兼容旧名 `.markup-trash/`），文件树/搜索不可见
- [x] 命令行 / 文件关联打开：`Mark Drawer.exe <文件>`、资源管理器「打开方式」均可直接打开，所在文件夹自动作为抽屉；安装包注册 `.md` / `.markdown` 默认程序（ProgID `MarkDrawer.Markdown`）；单实例复用已打开窗口

### 编辑器
- [x] WYSIWYG 主视图（Crepe）
- [x] 纯文本文件编辑：css / js / ts / json / yaml / yml / html / txt 等按扩展名高亮，默认且始终源码模式；编码 / 换行 / 自动保存 / 冲突处理复用现有流程
- [x] YAML Front Matter：顶部 `--- … ---` 不进 ProseMirror，编辑器顶端渲染只读「YAML 属性」卡片 + 「编辑源码」跳转；保存时原字节拼回，导出渲染 `.doc-properties` 卡片
- [x] 源码视图主题化：CodeMirror 外壳与语法高亮读取 `--bg` / `--text` / `--tok-*`，明暗主题与 WYSIWYG 一致（分栏镜像同样生效）
- [x] 目录大纲：视图菜单 / 菜单栏 `≣` / `Ctrl+Shift+O` 打开右侧大纲；点击标题在预览、源码、分栏三种视图下定位，按标题序号跨视图对齐
- [x] 源码视图切换
- [x] 传统菜单栏（文件 / 编辑 / 格式 / 视图 / 选项 / 关于）与全宽标签栏；文件操作收进「文件」二级菜单
- [x] 无边框窗口：自绘最小化 / 最大化 / 关闭按钮，菜单栏拖动窗口（Tauri `decorations: false`）
- [x] 源码 + 预览分栏（只读源码，250ms 内同步）；两侧独立滚动，按标题锚点双向对齐，切换分栏不再重建编辑器（保留滚动位置与撤销历史）
- [x] 基础语法 / 表格 / 图片块（Crepe 内置）
- [x] 快捷键注册表 `src/lib/shortcuts.ts`：文件 / 编辑 / 视图 / 格式菜单动作统一登记，菜单与全局按键读同一张表
- [x] 格式菜单默认快捷键齐全（删除线、行内代码、标题、正文、引用、列表、代码块、表格），菜单右侧显示当前绑定
- [x] 自定义快捷键：「选项 → 自定义快捷键…」逐项录入、冲突检测、单项/全部恢复默认，随设置持久化；输入框内只放行应用级快捷键
- [x] 斜杠菜单：Advanced 分组新增「Mermaid 图表」，插入带示例的 mermaid 代码块
- [x] 撤销/重做（ProseMirror history）
- [x] **长文档分块渲染（F2.7，P0）**：视口外顶层块 DOM 卸载，滚动恢复；万行文档 5001 块中 4954 块卸载，打开约 3.1s（浏览器 demo）
- [x] 自动保存：定时（10–300s）+ 失焦，独立开关
- [x] 多标签页
- [x] 状态栏显示/切换文件编码（UTF-8 / UTF-8 BOM / GBK / ANSI）与换行符（LF / CRLF）；自动识别、安全转换、新文件按 OS 选择换行

### 扩展渲染
- [x] Mermaid：编辑器代码块内实时预览、导出预览/HTML 渲染；设置中提供渲染总开关（关闭后保留源码块）
- [x] Mermaid 渲染独立开关（设置 → 编辑器与渲染）
- [x] KaTeX：Crepe 公式 + 导出行内/块级渲染
- [x] Callout：编辑器内按 `> [!TIP]` 渲染为提示块（隐藏标记、显示类型标签），导出一致
- [x] 代码块语法高亮 / 行号 / 复制（Crepe 内置）；高亮色改由主题 `--tok-*` 提供，与源码视图、分栏镜像、导出 HTML 的 `.hljs-*` 共用一套令牌
- [x] Mermaid 失效修复：分块渲染的 NodeView 改并入 `nodeViewCtx` 切片（原先覆盖 `editorViewOptionsCtx.nodeViews`，把 Crepe 内置 NodeView 全部清空，代码块预览面板随之消失）

## M2 v1 正式版（P1）

- [x] 默认配色 One（Light / Dark）内置为应用主题，界面、编辑器与导出共用同一套变量
- [x] 主题文件：Catppuccin / GitHub / Material / Monokai Pro / Nord 五套随程序分发，首次启动写入 exe 同目录 `themes/`（不覆盖用户修改）；设置内选择即重绘外壳、编辑器与导出
- [x] 读取程序目录 `themes/*.css` + 热重载（watcher）+ 设置内主题面板；导出自动附带
- [x] 打印适配：主题用 `--mk-print-*` 声明打印字体/字号/行高/四边页边距，PDF 分页运行时测量；各主题自带 `@page`，深色主题打印转黑字白底
- [x] 模板：读取程序目录 `templates/*.md`，新建对话框中选择并填充
- [x] 内置模板六套（笔记 / 每日笔记 / 任务清单 / 会议记录 / 项目笔记 / 读书笔记），`include_str!` 编入 exe，首次启动 seed 到 exe 同目录 `templates/` 且不覆盖用户改动；浏览器演示库同步展示
- [x] tantivy 全文索引：内存索引、按 mtime 增量同步、2–3 gram 中文分词；失败时回退线性扫描
- [x] 搜索面板：关键词全文搜索、标题/路径/摘要、点击跳转；输入时同步按文件名过滤
- [x] HTML 导出两种模式 + 主题 CSS + 附件收集 + 缺失告警
- [x] PDF：自建 A4 分页（块级测量）、整篇 / 指定页码范围、自定义页码起始值、页边距；通过系统打印对话框输出
- [x] 复制规范化 Markdown
- [x] 导出预览面板（iframe 同源预览，参数可调）
- [x] 设置面板：自动保存、字号、外观/文档主题、主题刷新、Mermaid 渲染开关、分块渲染开关、导出默认值
- [x] 导出偏好：v1 采用全局默认（设置页），暂不按文档记忆（PRD 待确认项 3 决策）

## M3 稳定优化

- [~] 10000 行混合文档压测：5001 块的万行文档可正常打开/滚动/编辑并保存（打开约 3.1s，输入派发约 2.7ms，浏览器 demo）；桌面端滚动与输入延迟的正式指标仍待实测
- [ ] 1000 篇文档检索 ≤1s
- [x] 安装包 ≤12MB（0.4.0：NSIS 5.01MB / MSI 5.94MB，release exe 9.82MB）
- [~] 冷启动 ≤3s：窗口出现 0.20s；编辑器就绪需单独计时
- [ ] Windows / macOS 兼容性回归（IME、粘贴、打印）
- [x] 便携版打包脚本 `npm run package:portable`：输出 `MarkDrawer_Portable.exe` 与 `MarkDrawer_Portable_<version>.7z`（无 7-Zip 时退化为 `.zip`），压缩包内含 exe + `themes/` + `templates/`
- [ ] 代码签名、安装脚本自动化

## 开发版本机制（0.4.0 增补）

- [x] `package.json` 作为版本唯一来源；`src-tauri/tauri.conf.json` 的 `version` 改为 `"../package.json"`
- [x] Vite 注入 `__APP_VERSION__`，`src/lib/brand.ts` 不再手写版本，界面 / 关于 / 导出元数据同步
- [x] `tools/version.mjs`：`check` / `dev` / `release` / `bump`，同步 `Cargo.toml` 与 CHANGELOG 条目
- [x] npm 脚本 `version:check|dev|release|bump`；`build` / `desktop:build` / `package:portable` 前自动校验
- [x] 补齐 `CHANGELOG.md`：0.1.0 M0 → 0.2.0 M1/M2 + 品牌化 → 0.3.0 YAML/大纲/令牌 → 0.4.0 正式版
- [x] 当前版本 `0.4.0`（package.json / Cargo.toml / CHANGELOG / 界面一致）
- [x] `npm run version:release` 去掉预发布后缀，重打安装包与便携版
- [x] 源码梳理：内部 `markup-*` 标识全部改为 Mark Drawer 命名；`version.mjs` 的 CHANGELOG 插入位置修正；便携版输出目录改为相对推导

## 品牌化 & 国际化（v0.5 增补）

- [x] 品牌常量 `src/lib/brand.ts`：名称 Mark Drawer / 文屉、口号「随文几屉 奇思几许 / A drawer for words, a wonder or two」、版本、欢迎文档名、作者水印
- [x] 欢迎页、关于对话框、窗口标题、菜单、侧栏、状态栏、各对话框统一品牌与口号
- [x] 「Vault / 库」全面改为「抽屉（Drawer）」：前端类型与 store、IPC 命令（`open_drawer` / `search_drawer` / `watch_drawer`）、Rust 内部标识、文档
- [x] 中英双语（默认中文）：`src/lib/i18n/zh-CN.ts` + `en.ts`，`t(key)` 读取设置即时切换；`en.ts` 类型约束保证不漏译
- [x] 设置面板新增「界面语言」（简体中文 / English），切换后无需重启
- [x] 作者数字水印：核心源码首行 `MARK#EZVE.COM`；导出 HTML 含 `<meta name="author">` 与零宽字符签名 `mark-drawer-signature`
- [x] 工程品牌化：`package.json`、`Cargo.toml`（crate `mark-drawer`）、`tauri.conf.json`（identifier `com.ezve.markdrawer`）、`index.html`、NSIS 关联 ProgID、README / PRD / 本文档
- [x] 重新编译桌面端与安装包，使产品名、图标、内置主题与新欢迎文档进入产物（0.4.0 已完成）
- [ ] 中英文界面逐屏回归（设置、导出、搜索、冲突、新建文档）

## 发布记录

### 0.4.0（2026-11-25）

- `npm run version:release`：0.4.0-dev.1 → 0.4.0，package.json / Cargo.toml / CHANGELOG 同步
- `npm run desktop:build`：release 编译 5m00s，MSI 5.94MB + NSIS 5.01MB，退出码 0
- `npm run package:portable`：`MarkDrawer_Portable.exe`（10,054KB）+ `MarkDrawer_Portable_0.4.0.7z`（4,764KB）
- 产物目录 `D:\AIDEV\markup-artifacts\`：`Mark Drawer_0.4.0_x64-setup.exe`、`MarkDrawer_Portable.exe`、`MarkDrawer_Portable_0.4.0.7z`
- 校验：exe / 安装包 ProductVersion = `0.4.0`；便携版在空目录启动正常并自动生成 `themes/` `templates/` `attachments/`
- 遗留：`markup-artifacts` 中 0.1.0 的旧产物仍保留，待确认后清理

## PRD 待确认项（当前实现假设）

1. **页码范围**：暂按“打印分页后的页码”建模，UI 已如此标注。
2. **base64 单文件体积告警**：暂未设置阈值，下一步在导出对话框增加 >10MB 提示。
3. **导出参数作用域**：暂为全局默认偏好（设置页），每文档独立参数待定。
