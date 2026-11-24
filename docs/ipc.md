# 前端 ↔ Rust 命令契约

所有命令通过 `invoke` 调用，参数均为**单词**（避免 Tauri v1/v2 参数命名差异）。
成功返回 JSON（字段 `camelCase`），失败返回字符串错误；冲突保存返回以 `CONFLICT:` 开头的错误。

## 抽屉（Drawer）

| 命令 | 参数 | 返回 | 说明 |
| --- | --- | --- | --- |
| `open_drawer` | `path` | `DrawerInfo` | 校验目录并返回完整树；不会在抽屉内创建任何文件夹（应用资源目录在 exe 同目录） |
| `read_doc` | `drawer`, `rel` | `{ content, mtime, encoding, eol, bom }` | 自动识别 UTF-8 / GBK / ANSI 与 LF / CRLF；`content` 已统一为 LF，BOM 已剥离 |
| `write_doc` | `drawer`, `rel`, `content`, `mtime`, `force`, `encoding`, `eol`, `bom` | `{ mtime }` | `mtime` 为 0 或 `force` 时跳过冲突检查；冲突返回 `CONFLICT:<current>`；`encoding` 无法表示内容时返回 `ENCODING:` 错误且不写文件 |
| `create_entry` | `drawer`, `rel`, `kind` | `void` | `kind`: `dir` / `file` |
| `rename_entry` | `drawer`, `from`, `to` | `void` | 同时用于移动 |
| `delete_entry` | `drawer`, `rel` | `void` | 删除目录时递归 |
| `save_attachment` | `drawer`, `name`, `data` | `{ path, name }` | `data` 为 base64；写入 exe 同目录的 `attachments/` 并自动去重命名（该目录不可写时回退到抽屉） |
| `read_attachment` | `drawer`, `rel` | `string \| null` | 返回 base64；先查抽屉（兼容旧文档），再查 exe 同目录；>100MB 或缺省返回 `null` |
| `list_app_assets` | `kind` | `AssetFile[]` | `kind`: `themes` / `templates`；读取 exe 同目录的 `themes/*.css` 或 `templates/*.md`，返回 `{ name, path, content }` |

> `ensure_app_dirs`（启动时执行一次）会创建 `attachments/`、`themes/`、`templates/`，并把内置的五套主题（Catppuccin、GitHub、Material、Monokai-Pro、Nord，`include_str!` 编入二进制）写入 `themes/`。已存在的同名文件一律跳过，因此用户改过或删掉的主题不会被还原。

> `open_drawer` 的文件树与 `search_drawer` 使用同一套忽略规则：`.gitignore`、`.ignore`、`.drawerignore`（仍兼容旧名 `.markupignore`），抽屉无需是 Git 仓库，并内置跳过 `node_modules`、`target`、`.git` 等目录。

## 搜索

| 命令 | 参数 | 返回 |
| --- | --- | --- |
| `search_drawer` | `drawer`, `query`, `limit?` | `SearchHit[]`：`{ path, title, snippet, score }` |

## 监听

| 命令 | 参数 | 说明 |
| --- | --- | --- |
| `watch_drawer` | `root` | 递归监听，事件 `drawer:changed`，payload 为路径数组 |
| `unwatch_drawer` | — | 停止监听 |

## 启动参数

| 命令 / 事件 | 参数 | 说明 |
| --- | --- | --- |
| `take_launch_file` | — | 取出启动时由命令行传入、尚未处理的文件路径（取走后清空）；无则返回 `null` |
| 事件 `open-file` | `path` | 第二次启动（单实例）时转发给已运行窗口的文件路径 |

启动流程：`launch::file_from_args` 从 argv 里取第一个存在的普通文件（相对路径按 `cwd` 解析，跳过 `-` 开头的参数）；首次启动在 `setup` 里入队，二次启动由 `tauri-plugin-single-instance` 回调入队并聚焦窗口。前端先订阅事件再调用 `take_launch_file`，避免漏事件。

## 导出

| 命令 | 参数 | 说明 |
| --- | --- | --- |
| `write_export_files` | `dest`, `files` | `files: { path, encoding: 'utf8'\|'base64', content }[]`；`dest` 为绝对目录，`path` 必须为安全的相对路径 |
| `write_export_file` | `path`, `content` | 单文件导出（绝对路径，由保存对话框选择） |

## 文本编码与换行符

读取顺序（`src-tauri/src/encoding.rs`）：

1. UTF-16 BOM → 报错（暂不支持，避免误解码）；
2. UTF-8 BOM → UTF-8，`bom = true`；
3. 含 NUL 字节 → 报错（二进制）；
4. 合法 UTF-8 → UTF-8；
5. GBK 解码无错误且包含 CJK 字符 → GBK；
6. 其余 → ANSI（Windows-1252）。

写入规则：

- 编辑器内容统一使用 LF；保存时按 `eol` 转换为 LF 或 CRLF。
- `utf8` 可选保留 BOM；`gbk` / `ansi` 不写 BOM。
- GBK / ANSI 编码后做反向解码校验；存在无法表示的字符时返回错误，**不写入文件**，避免产生乱码或 `?`。
- 新文件为空时，换行符由 Rust 侧按操作系统决定：Windows → `crlf`，其他 → `lf`。

## 安全规则

- 所有 `drawer` + `rel` 组合经 `paths::resolve_in_drawer` 规范化；拒绝绝对路径、`..` 越界。
- 导出相对路径经 `paths::is_safe_relative`，并再次校验落在 `dest` 内。
- 前端不持有任意文件系统权限，只通过上述命令操作。
