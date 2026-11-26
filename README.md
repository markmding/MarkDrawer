# Mark Drawer 文屉

> 随文一屉 奇思几许。

本地优先、抽屉（Drawer）模式的 Markdown 编辑器：任意本地文件夹就是一个抽屉，界面支持中文 / English（默认中文）。产品需求见 [prd.md](./prd.md)。

> **当前阶段：M0 工程初始化 / 技术验证**
> 本文档描述的是已经落地的脚手架，不代表 v1 功能已全部完成。功能完成度见 [TASKS.md](./TASKS.md)。

## 品牌与国际化

| 项目 | 内容 |
| --- | --- |
| 名称 | Mark Drawer 文屉 |
| 口号 | 随文一屉 奇思几许 / A drawer for words, a wonder or two |
| 概念 | 抽屉（Drawer）取代原来的「库 / Vault」：任意本地文件夹即一个抽屉 |
| 界面语言 | 中文（默认）/ English，设置 → 界面语言即时切换，无需重启 |
| 品牌常量 | `src/lib/brand.ts`（名称、口号、版本、欢迎文档名、水印） |
| 文案字典 | `src/lib/i18n/zh-CN.ts`、`src/lib/i18n/en.ts`，类型由 `keyof typeof zhCN` 约束，漏翻即编译期报错 |
| 作者水印 | 源码注释与 `src/lib/brand.ts` 中的 `MARK#EZVE.COM`；导出的 HTML 还会写入 `<meta name="author">` 与零宽字符签名 `mark-drawer-signature`，渲染与复制均不可见 |

兼容性：旧设置键 `markup.settings.v1` 会自动迁移到 `markdrawer.settings.v1`；`.markupignore` 与旧回收站 `.markup-trash/` 仍被识别。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 桌面框架 | Tauri v2（Rust 接管文件 IO / 监听 / 搜索） |
| 前端 | Svelte 5 + Vite 7 + TypeScript |
| 编辑器 | Milkdown Crepe（ProseMirror，AST 为唯一真值） |
| 源码视图 | CodeMirror 6 |
| 公式 / 图表 | KaTeX、Mermaid（懒加载） |
| 导出 | remark / rehype + 浏览器打印 API |

## 已实现（脚手架级）

- **抽屉（Drawer）**：打开本地文件夹、递归文件树、新建/重命名/删除/拖拽移动、外部变更监听与刷新
- **编辑器**：WYSIWYG（Crepe）+ 源码视图切换，多标签页，Ctrl+S / Ctrl+N / Ctrl+Alt+/ 切换源码、Ctrl+\ 分栏
- **快捷键自定义**：文件 / 编辑 / 视图 / 格式菜单的每一项都有默认绑定，并显示在菜单右侧；「选项 → 自定义快捷键…」可逐项录入、检测冲突、单项或全部恢复默认，快捷键随设置持久化。格式项默认值：加粗 Ctrl+B、斜体 Ctrl+I、删除线 Ctrl+Alt+U、行内代码 Ctrl+Alt+E、标题 1–6 Ctrl+Alt+1…6、正文 Ctrl+Alt+0、引用 Ctrl+Alt+Q、无序/有序列表 Ctrl+Alt+8 / 7、代码块 Ctrl+Alt+K、表格 Ctrl+Alt+T、切换任务状态 Ctrl+Enter；视图项：切换源码 Ctrl+Alt+/、分栏 Ctrl+\、切换侧边栏 Ctrl+Alt+L、大纲 Ctrl+Alt+O。格式键统一走 Ctrl+Alt，因为裸 Ctrl+K/L/U/Q 等会被 WebView2 的浏览器加速键截走（桌面端实测失效）
- **任务清单三态**：`- [ ]` 待办、`- [~]` 进行中（`◐`）、`- [x]` 完成；输入 `- [~] ` 即时切换，Ctrl+Enter 循环三态，点击进行中即标记完成；空标记项（`- [ ] ` 后无内容）也能保持为任务项；导出 HTML / PDF 同样渲染三态
- **纯文本文件**：文件树可直接打开 css / js / ts / json / yaml / yml / html / txt 等常见纯文本，始终使用 CodeMirror 源码编辑器并按扩展名高亮；编码、换行符、自动保存与冲突处理与 Markdown 共用，导出/分栏对纯文本禁用
- **YAML Front Matter**：文件顶部 `--- … ---` 元数据不进入富文本模型，编辑器顶端显示只读「YAML 属性」卡片（列出键值或原文），可一键切到源码编辑；保存时按原字节拼回，富文本往返不会改写用户元数据；导出时同一份 YAML 渲染为 `.doc-properties` 属性卡片
- **代码块着色**：`--tok-*` 令牌色由主题定义，编辑器内代码块（CodeMirror）、源码视图、分栏镜像与导出 HTML 的 `.hljs-*` 共用同一套映射，切换主题即整体换色
- **源码视图主题化**：CodeMirror 外壳与语法高亮读取应用同一套变量（`--bg` / `--text` / `--tok-*`），明暗主题与 WYSIWYG 保持一致
- **目录大纲**：视图菜单「大纲」、标签栏右端 `≣` 或 `Ctrl+Alt+O` 打开右侧大纲，点击标题在预览 / 源码 / 分栏三种视图下都能定位（按标题序号跨视图对齐，跳过代码块里的 `#`）
- **自动保存**：定时 + 失焦两个独立开关，默认 30s / 开启
- **路径安全**：所有 Rust 命令限制在 抽屉 内（拒绝绝对路径与 `..` 越界）
- **保存冲突**：写入前比对 mtime，外部修改返回 `CONFLICT`；编辑器上方显示非阻塞提示条，可选择「重新加载」或「覆盖保存」
- **文本编码 / 换行符**：状态栏显示并可切换 UTF-8（含 BOM）、GBK、ANSI 与 LF / CRLF；读取时自动识别，保存时安全转换（无法表示的字符会阻止写入，避免乱码）；新文件换行符跟随操作系统
- **忽略规则**：文件树与全文搜索统一遵循 `.gitignore`、`.ignore`、`.drawerignore`（无需 抽屉 是 Git 仓库），并内置跳过 `node_modules`、`target` 等目录
- **附件粘贴 / 拖拽**：图片自动存入程序目录（exe 同目录）的 `attachments/`，Markdown 只记录相对路径；编辑器显示时经 Rust 读取并转为 data URL，无需开放文件系统 asset 协议
- **长文档优化（F2.7 阶段二）**：视口外的顶层块（段落 / 标题 / 引用 / 列表）把已渲染的 DOM 移入 DocumentFragment，只保留等高外壳；滚动到附近时按原节点恢复。选中块与视口内 ±2500px 的块始终保留，设置中可整体关闭分块渲染
- **Mermaid 渲染开关**：设置中可强制关闭 Mermaid 图表渲染，编辑器、导出预览与 HTML 中保留源码块
- **Mermaid 编辑器预览**：代码块内实时渲染（复用 Crepe 预览面板），支持编辑源码即时更新，Mermaid 仍按需懒加载。注意：分块渲染的 NodeView 必须并入 `nodeViewCtx` 切片，若改走 `editorViewOptionsCtx.nodeViews` 会覆盖 Crepe 内置 NodeView，导致预览面板整体失效
- **斜杠菜单**：Advanced 分组新增「Mermaid 图表」，插入带 `flowchart` 示例的 mermaid 代码块并立即预览
- **导出**：HTML（独立文件夹 / base64 单文件）、PDF（自建 A4 分页、整篇/页码范围、自定义页码起始值）、复制规范化 Markdown；导出前收集附件并告警
- **主题**：内置 One Light / One Dark 为默认配色，界面、编辑器与导出共用同一套变量；程序目录 `themes/*.css` 另附 Catppuccin、GitHub、Material、Monokai Pro、Nord 五套主题，首次启动自动写入且不覆盖用户改动，设置内切换、刷新，文件变更由监听自动重载
- **打印适配**：主题通过 `--mk-print-*` 声明打印字体、字号、行高与四边页边距，PDF 分页按当前主题实测排版后再切页，HTML 导出内嵌主题自己的 `@page`；深色主题打印时自动转为黑字白底
- **模板**：内置六套模板（笔记、每日笔记、任务清单、会议记录、项目笔记、读书笔记），随程序编译进 exe，首次启动写入程序目录 `templates/*.md` 且不覆盖用户改动；新建笔记时在下拉框选择，选定后内容直接填充
- **搜索**：文件树全文搜索（tantivy 内存索引、中文 2–3 gram、按 mtime 增量同步），显示标题/路径/摘要并可跳转
- **设置**：持久化到 localStorage（界面语言、自动保存、字号、外观/文档主题、Mermaid/分块开关、导出默认值）
- **Callout**：`> [!TIP]` 等标记在编辑器内渲染为提示块，Markdown 原文保持标准语法
- **分栏**：视图菜单「分栏」左右并排 WYSIWYG 与只读源码；两侧各自独立滚动，并按标题锚点双向同步（块级定位，不是字符级映射），源码随编辑自动更新
- **菜单与窗口**：文件 / 编辑 / 格式 / 视图 / 选项 / 关于 菜单，标签栏全宽置于菜单下方；应用窗口无系统标题栏，使用自绘的最小化 / 最大化 / 关闭按钮，菜单栏空白区域可拖动窗口
- **回收站**：删除文件移入 抽屉 内 `.mark-drawer-trash/`，不再直接永久删除
- **浏览器演示库**：未安装 Rust 时可用 `npm run dev` 直接体验 UI

## 尚未实现 / 下一步（P0 优先）

| 需求 | 状态 |
| --- | --- |
| 长文档分块渲染（F2.7，核心门槛） | ✅ 阶段二：视口外顶层块 DOM 卸载 + 滚动按需恢复；万行文档（5001 块）打开 3.1s，4954 块处于卸载态 |
| Mermaid / KaTeX 编辑器内渲染 | ✅ Mermaid 复用代码块预览面板实时渲染（懒加载）；设置可关闭；KaTeX 由 Crepe 自带 |
| 附件粘贴 / 拖拽插入编辑器 | ✅ 存入程序目录的 `attachments/`，Markdown 存相对路径，编辑器内 data URL 预览 |
| 斜杠命令中的 Mermaid 块 | ✅ 「Advanced → Mermaid 图表」插入带示例的 mermaid 代码块 |
| 文件冲突 UI（非阻塞提示条） | ✅ 编辑器上方提示条，可重新加载或覆盖保存 |
| 主题 / 模板管理面板、主题热重载 | ✅ 默认 One 明暗 + 五套主题文件；设置内选择与刷新、watcher 热重载；模板在新建对话框选择 |
| tantivy 全文索引 | ✅ 内存索引 + mtime 增量同步 + 中文 ngram，失败回退线性扫描 |
| PDF 页码范围 / 自定义起始页码 | ⚠️ UI 与参数已就绪，WebView 打印能力待 M0 验证（PRD R2） |
| 安装包 ≤12MB、签名 | ⚠️ NSIS 安装包 5.01MB 已验证；代码签名 / 自动更新未做 |

## 环境要求

- Node.js ≥ 20（当前使用 26）
- Rust stable ≥ 1.77.2（当前 1.100，MSVC target）
- Windows：**Visual Studio Build Tools（VCTools 工作负载 + Windows SDK）** + WebView2 Runtime
- macOS：Xcode Command Line Tools

> 本机已具备完整构建环境：Rust 1.100 + VS Build Tools 2022（MSVC 14.44 / Windows SDK 10.0.26100），可完成 release 编译与 NSIS 打包。

### 构建验证记录（2026-11-26 · 0.6.0 正式版）

| 项目 | 结果 |
| --- | --- |
| `npm run desktop:build` | ✅ 前端 30.43s + release 编译 4m10s，退出码 0 |
| 可执行文件 | `src-tauri/target/release/mark-drawer.exe` — **9.82MB**（10,297,344 字节） |
| NSIS 安装包 | `Mark Drawer_0.6.0_x64-setup.exe` — **5.01MB**（5,251,307 字节，目标 ≤12MB ✅） |
| MSI 安装包 | `Mark Drawer_0.6.0_x64_en-US.msi` — **5.94MB**（6,230,016 字节） |
| 便携版压缩包 | `MarkDrawer_Portable_0.6.0.7z` — **4.77MB**（4,882,624 字节，含 exe + themes + templates） |
| 源码包 | `MarkDrawer_Source_0.6.0.zip` — **360KB**（112 文件，原始 977KB） |
| 启动冒烟测试 | ✅ 便携版在空目录启动正常，标题 `Mark Drawer 文屉`，自动写入 `themes/` `templates/` `attachments/` |
| 版本元数据 | ✅ exe / 便携版 / 安装包 ProductVersion 均为 `0.6.0`，ProductName `Mark Drawer`；源码包内 `package.json` 为 `0.6.0` |
| 前端验证 | `svelte-check` 793 文件 0 错误 / 0 警告、`version:check` 通过 ✅ |

### 构建验证记录（2026-11-25 · 0.4.0 正式版）

| 项目 | 结果 |
| --- | --- |
| `cargo -V` / `rustc -V` | 1.100.0 / MSVC target ✅ |
| 依赖解析与下载 | 444 个包，经 rsproxy 镜像完成 ✅（`Cargo.lock` 已生成） |
| `cargo check` | ✅ 0 error / 0 warning |
| `npm run desktop:build` | ✅ release 编译 5m00s + MSI / NSIS 双产物 |
| 可执行文件 | `src-tauri/target/release/mark-drawer.exe` — **9.82MB**（10,295,296 字节） |
| NSIS 安装包 | `bundle/nsis/Mark Drawer_0.4.0_x64-setup.exe` — **5.01MB**（目标 ≤12MB ✅） |
| MSI 安装包 | `bundle/msi/Mark Drawer_0.4.0_x64_en-US.msi` — **5.94MB** |
| 便携版压缩包 | `MarkDrawer_Portable_0.4.0.7z` — **4.76MB**（含 exe + themes + templates） |
| 启动冒烟测试 | ✅ 便携版在空目录启动正常，标题 `Mark Drawer 文屉`，自动写入 `themes/` `templates/` `attachments/` |
| 版本元数据 | ✅ exe 与安装包的 ProductVersion 均为 `0.4.0`，产品名 `Mark Drawer` |
| 前端验证 | `svelte-check` 0 错误 / 0 警告、`vite build` 33.9s 通过 ✅ |

> 首次构建曾因直连 GitHub 下载 NSIS 超时失败。若复现，可走镜像：
>
> ```powershell
> $env:TAURI_BUNDLER_TOOLS_GITHUB_MIRROR="https://gh-proxy.com/https://github.com"
> npm run tauri -- build --bundles nsis
> ```
>
> `src-tauri/.cargo/config.toml` 已配置 rsproxy 稀疏镜像；如需恢复官方源，删除该文件即可。

## 快速开始

```bash
npm install

# 纯浏览器模式（使用内置示例抽屉，不需要 Rust）
npm run dev            # http://localhost:1420

# 桌面模式（需要 Rust）
npm run tauri dev      # 等价于 npm run desktop
```

其他脚本：

```bash
npm run check          # svelte-check 类型检查
npm run build          # 构建前端到 dist/（先校验版本一致性）
npm run tauri build    # 打桌面安装包
npm run icons          # 重新生成占位图标（替换品牌图标后可用 npx tauri icon）
npm run package:portable  # 便携版 exe + 7z（需先 desktop:build）
npm run package:source    # 源码 zip（排除依赖与构建产物）

# 版本维护（详见下文「版本管理」）
npm run version:check     # 校验 package.json / Cargo.toml / tauri.conf.json / CHANGELOG 一致
npm run version:dev       # 0.6.0 → 0.6.0-dev.1；0.6.0-dev.1 → 0.6.0-dev.2
npm run version:release   # 0.6.0-dev.2 → 0.6.0
npm run version:bump -- minor   # 0.6.0 → 0.7.0（major / minor / patch）

node tools/version.mjs set 0.6.0-dev.1   # 显式指定版本（同样同步 Cargo.toml 与 CHANGELOG）
```

## 版本管理

`package.json` 的 `version` 是**唯一来源**，其余位置都由它派生或校验：

| 位置 | 关系 |
| --- | --- |
| `src-tauri/tauri.conf.json` | `"version": "../package.json"`，安装包与 exe 属性直接读这里 |
| `src-tauri/Cargo.toml` | 由 `tools/version.mjs` 同步，`cargo check` 时若不一致以脚本为准 |
| `src/lib/brand.ts` | 使用 Vite 注入的 `__APP_VERSION__`（来自 `package.json`），界面与「关于」跟随；`vite.config.ts` 监听 `package.json`，改版本会自动重启 dev server（`define` 只在启动时求值） |
| `CHANGELOG.md` | 每个版本必须有 `## [x.y.z]` 条目，`version:check` 会检查 |

规则：

- 开发中的功能用 `version:dev` 递增预发布号（`0.4.0-dev.1`），发版前 `version:release` 去掉后缀。
- 新增功能 → `version:bump -- minor`；只修 bug → `patch`；存储格式或行为不兼容 → `major`。
- `npm run build`、`desktop:build`、`package:portable` 都会先跑 `version:check`，版本不一致直接中断构建。
- 历史版本见 [CHANGELOG.md](./CHANGELOG.md)：0.1.0（M0 技术验证）→ 0.2.0（M1/M2 + 品牌化）→ 0.3.0（YAML / 大纲 / 主题令牌）→ 0.4.0（开发版本机制 + 便携版）→ 0.5.0（源码不再写入 HTML / 三态任务清单 / 快捷键常规化）→ 0.6.0（源码视图 Ctrl+/ 修复 / 快捷键再调 / 标签栏两端固定按钮 / 口号更正）。

## 打开文件（命令行 / 文件关联）

桌面端接受一个文件路径作为参数，双击 `.md`、右键「打开方式」和命令行都走同一条路径：

```bash
Mark Drawer.exe "D:\notes\读书笔记.md"     # 命令行 / 快捷方式
```

- 文件所在文件夹会自动作为 抽屉 打开，文件在标签页中显示；若当前 抽屉 不在该文件夹且存在未保存的标签，会先询问。
- 单实例：应用已在运行时再次双击文件，不会新开窗口，而是把文件交给现有窗口并聚焦。
- 安装包通过 Tauri `bundle.fileAssociations` 注册 `.md` / `.markdown`（ProgID `MarkDrawer.Markdown`、`shell\open\command` 带 `"%1"`），安装后出现在「打开方式」列表。Windows 10/11 的默认程序由系统 `UserChoice` 记录：若此前已把 `.md` 指定给别的编辑器，需要右键 → 打开方式 → 选择其他应用 → **始终使用此应用** 才会切换；便携版没有安装步骤，同样用「打开方式 → 选择其他应用 → 浏览」指向 exe 即可。

## 开发工作流（何时需要编译 Rust）

| 改动范围 | 推荐方式 | 是否重编译 Rust |
| --- | --- | --- |
| Svelte / CSS / 导出逻辑等纯前端 | `npm run dev` → 浏览器预览（内置示例抽屉） | 否，Vite 热更新 |
| 前端 + 真实文件系统行为 | `npm run tauri dev` | 仅首次或改了 Rust 时；debug 增量编译 |
| `src-tauri` 下的 Rust 代码 | `cargo check`（快速）→ `npm run tauri dev` | 是，增量 |
| 需要交付安装包 / 发布 | `npm run tauri -- build --bundles nsis` | 是，release 编译 + 打包 |
| 需要便携版 zip / 7z | `npm run desktop:build` → `npm run package:portable` | 是，release 编译 |

> 日常开发优先用浏览器预览：`npm run dev` 启动后修改前端代码会即时热更新，不需要重新编译 Rust、也不需要重新打包。
> 只有需要验证真实 抽屉 读写、文件监听、编码转换等 Rust 行为时，才启动 `npm run tauri dev`。

## 目录结构

```
mark-drawer/
├─ prd.md                     # 产品需求（唯一需求源）
├─ TASKS.md                   # 按 PRD 拆解的任务与完成度
├─ CHANGELOG.md               # 版本历史（每个版本必须有条目）
├─ docs/
│  └─ ipc.md                  # 前端 ↔ Rust 命令契约
├─ src/
│  ├─ App.svelte              # 应用外壳：布局、快捷键分发、自动保存、监听
│  ├─ app.css                 # 设计变量 + 布局 + 对话框样式
│  └─ lib/
│     ├─ api/                 # Tauri invoke 封装 + 浏览器演示库
│     ├─ components/          # 侧边栏、标签页、编辑器、设置、导出
│     ├─ export/              # Markdown → HTML/PDF、主题 CSS、附件收集
│     ├─ stores/              # drawer / tabs / settings（Svelte 5 runes）
│     ├─ filetree.ts          # 文件树展开与过滤
│     ├─ paths.ts             # 抽屉 相对路径工具
│     ├─ shortcuts.ts         # 快捷键注册表（默认值 + 用户覆盖 + 冲突检测）
│     └─ types.ts             # 与 Rust 对齐的数据结构
├─ src-tauri/
│  ├─ src/commands/           # drawer / export / search / watcher 命令
│  ├─ src/paths.rs            # 路径规范化、越界校验、主题/模板 seed
│  ├─ themes/*.css            # 内置主题，编译进 exe 并 seed 到程序目录
│  ├─ templates/*.md          # 内置模板，编译进 exe 并 seed 到程序目录
│  ├─ capabilities/           # Tauri 权限
│  └─ tauri.conf.json
└─ tools/
   ├─ gen-icons.mjs           # 无依赖生成 PNG/ICO/ICNS 占位图标
   ├─ version.mjs             # 版本校验 / dev / release / bump 同步脚本
   └─ package-portable.mjs    # 便携版 exe + 7z/zip 打包脚本
```

## 仓库与本地文件

### 提交到私有 Git

- 源码：`src/`、`src-tauri/src/`、`tools/`
- 配置：`package.json`、`package-lock.json`、`Cargo.toml`、`Cargo.lock`、`tauri.conf.json`、`capabilities/`、`vite.config.ts`、`tsconfig.json`、`svelte.config.js`
- 文档：`prd.md`、`README.md`、`TASKS.md`、`docs/`
- 资源：`src-tauri/icons/`

### 本地开发文件（不提交）

| 路径 | 说明 | 当前状态 |
| --- | --- | --- |
| `node_modules/` | npm 依赖（约 310MB） | 保留，供本地预览；可用 `npm ci` 重建 |
| `dist/` | 前端构建输出 | 已清理，构建时自动生成 |
| `src-tauri/target/` | Rust 编译缓存（清理前约 3.8GB） | 已清理，首次构建会重建 |
| `src-tauri/gen/schemas/` | Tauri 生成的权限 schema | 已清理，构建时自动生成 |
| `*.log` | 本地日志 | 已加入 `.gitignore` |
| `src-tauri/.cargo/config.toml` | rsproxy 镜像配置（国内构建加速） | 已提交；不需要时可删除以恢复官方源 |

### 构建产物（仓库外）

安装包与便携版已从 `src-tauri/target` 移出，避免再次进入源码目录：

- `D:\AIDEV\markup-artifacts\Mark Drawer_0.6.0_x64-setup.exe`（NSIS 安装包）
- `D:\AIDEV\markup-artifacts\Mark Drawer_0.6.0_x64_en-US.msi`（MSI 安装包）
- `D:\AIDEV\markup-artifacts\MarkDrawer_Portable.exe`（便携版裸 exe）
- `D:\AIDEV\markup-artifacts\MarkDrawer_Portable_0.6.0.7z`（发布用压缩包）
- `D:\AIDEV\markup-artifacts\MarkDrawer_Source_0.6.0.zip`（源码包，`npm run package:source` 生成）

#### 便携版命名规则

固定规则，版本号跟随 `package.json` 的 `version`：

| 项目 | 规则 | 示例 |
| --- | --- | --- |
| 可执行文件 | `MarkDrawer_Portable.exe` | `MarkDrawer_Portable.exe` |
| 压缩包 | `MarkDrawer_Portable_<version>.7z` | `MarkDrawer_Portable_0.4.0.7z` |
| 压缩包内容 | exe + `themes/` + `templates/` | 解压即用，无需安装 |

`npm run package:portable` 会依次：把 release exe 复制并改名为 `MarkDrawer_Portable.exe`；在临时目录按「解压后应有的样子」装配 exe、`themes/`、`templates/`；用 7-Zip 以最高压缩比打成 `MarkDrawer_Portable_<version>.7z`。若本机没有 7-Zip（可用环境变量 `SEVEN_ZIP` 指定路径），自动退化为同名 `.zip`。输出目录默认取仓库同级目录 `markup-artifacts/`（本机即 `D:\AIDEV\markup-artifacts`），可用 `MARKDRAWER_OUT` 覆盖。

**为什么带上 `themes/` 和 `templates/`**：程序启动时会在这两个目录里补写缺失的内置文件（已存在的文件一律不覆盖）。压缩包里预先放好，用户解压后就是完整的主题与模板集合，也可以直接改 CSS 或在 `templates/` 里放自己的模板。

### 源码包

| 文件 | 说明 |
| --- | --- |
| `D:\AIDEV\markup-artifacts\MarkDrawer_Source_0.6.0.zip` | 0.6.0 正式版源码（112 个文件，360KB，由 `npm run package:source` 生成） |
| `D:\AIDEV\markup-artifacts\MarkDrawer_Source_0.5.0.zip` | 0.5.0 源码（112 个文件，357KB） |
| `D:\AIDEV\MarkDrawer_Source_0.4.0.zip` | 0.4.0 源码（105 个文件，344KB） |
| `D:\AIDEV\markup-source-2026-11-21.zip` / `-11-22.zip` | 早期快照，仅作留存 |

包含 `src/`、`src-tauri/`（含 `themes/` `templates/` `icons/` `windows/`）、`tools/`、`docs/`、`design/` 与全部配置文件（`package.json`、`package-lock.json`、`Cargo.toml`、`Cargo.lock`、`tsconfig.json`、`vite.config.ts` 等）。不含 `.git`、`node_modules`、`dist/`、`src-tauri/target/`、`src-tauri/gen/`、日志与构建产物；解压后目录结构即仓库结构，`npm ci` 后可直接构建。

重新生成（版号自动取自 `package.json`，输出到 `MARKDRAWER_OUT`，默认 `markup-artifacts/`）：

```bash
npm run package:source
```

上传私有仓库：

```bash
git add .
git commit -m "chore: initial Mark Drawer scaffold"
git remote add origin <your-private-repo-url>
git push -u origin main
```

## 关键设计约定

1. **AST 是唯一真值**：编辑器内存模型是 ProseMirror Doc；Markdown 仅用于持久化与导出。保存走「AST → 规范化 Markdown」，不做原文增量 patch。
2. **Rust 负责一切磁盘操作**：前端不直接使用 fs 插件；附件、导出、搜索、监听都经命令层，并在 Rust 侧做路径越界校验。
3. **应用目录固定**：`attachments/`、`themes/`、`templates/` 位于 exe 同目录，启动时自动创建；打开任意 抽屉 都不会往笔记文件夹里写这三个目录。
4. **导出与预览同源**：导出对话框中的预览与最终导出使用同一套 `buildHtmlExport` 与主题 CSS，避免“预览好看、导出走样”。
5. **重活懒加载**：Mermaid、源码视图（CodeMirror）、导出面板（remark/rehype）均按需动态导入。
6. **文本格式安全**：读取自动识别 UTF-8 / GBK / ANSI，编辑器内存统一 LF；保存时按用户选择的编码与换行写回。GBK / ANSI 无法表示的字符直接拒绝保存，绝不写入替代字符。
7. **打印排版与主题同源**：主题用 `--mk-print-font`、`--mk-print-font-size`、`--mk-print-line-height`、`--mk-print-margin-top|right|bottom|left` 声明打印样式；PDF 分页在导出时实测这些变量（页边距用宽度探针、字号行高用计算样式探针），页面盒子与分页测量共用一套数值，不会出现「预览两页、打印三页」。主题另写 `@page` 规则，供直接打印导出的 HTML 使用。
8. **主题即变量**：主题文件以 `:root` 与 `:root[data-theme='dark']` 覆盖应用变量（`--bg` / `--text` / `--accent` … 与 `--mk-*`），因此一套主题能同时改变应用外壳、编辑器与导出文档；只想改文档时再用 `.milkdown .ProseMirror` / `.markup-doc` 限定选择器。

## 已知限制

- 浏览器演示模式下，文件夹导出会退化为逐个下载文件，附件相对路径无法保持；真实导出请使用桌面端。
- PDF 使用前端 A4 分页（按块测量），支持整篇 / 页码区间 / 页码起始值。块被视为不可拆分单元，超过一页的单个块会被裁切；最终分页仍会经过系统打印对话框，需在 WebView2 / WKWebView 上做视觉回归。
- 长文档分块渲染会卸载视口外顶层块的 DOM：这些块暂时无法被浏览器「页内查找」命中，滚动回视口后恢复。代码块、表格、图片等专用块仍全部挂载。仅在桌面 WebView2 上做了功能验证，滚动/输入延迟的正式指标需在目标机器上复测。
- 分栏滚动同步是块级（按标题锚点插值），不是字符级映射：标题之间因块高不同可能有几十像素误差；没有标题的文档退化为按滚动比例同步。
- 纯文本编辑覆盖常见文本扩展名与 Dockerfile / LICENSE 等无扩展名文件；其他类型（图片、PDF、压缩包等）会被拒绝打开，避免二进制内容被当作文本写回。
- 无边框窗口不提供 Windows 11 悬停最大化按钮的 Snap Layout 面板；仍可通过拖动窗口到屏幕边缘分屏，或使用自绘最大化按钮。
- Mermaid 在编辑器代码块、导出预览与导出 HTML 中渲染；设置里提供「渲染 Mermaid 图表」总开关，关闭后都保留源码块。Mermaid 渲染采用串行队列 + 内容缓存，避免多图并发导致卡顿。
- 主题文件（`themes/*.css`）以变量覆盖方式同时作用于应用外壳、编辑器与导出文档，这是有意为之；若只想改文档局部，请把选择器限定在 `.milkdown .ProseMirror` / `.markup-doc` 内。主题热重载依赖 Rust 文件监听，浏览器演示库需手动「刷新主题」。
- 打印设置的粒度是整篇文档：主题无法为单篇文档单独指定字体或页边距，需要不同排版时请切换主题或复制一份主题文件。
- tantivy 索引保存在内存中，重启后首次搜索会重建；索引同步发生在搜索请求时（按 mtime 增量），不是独立后台线程。
