// MARK#EZVE.COM
import { WELCOME_DOC } from '../brand'
import { basename, dirname, osDefaultEol } from '../paths'
// The browser demo serves the same theme files the desktop app seeds next to
// the executable, so `npm run dev` previews the real thing.
import catppuccinTheme from '../../../src-tauri/themes/Catppuccin.css?raw'
import githubTheme from '../../../src-tauri/themes/GitHub.css?raw'
import materialTheme from '../../../src-tauri/themes/Material.css?raw'
import monokaiTheme from '../../../src-tauri/themes/Monokai-Pro.css?raw'
import nordTheme from '../../../src-tauri/themes/Nord.css?raw'
// Same for the templates shipped in `templates/` next to the executable.
import noteTemplate from '../../../src-tauri/templates/note.md?raw'
import dailyTemplate from '../../../src-tauri/templates/daily.md?raw'
import todoTemplate from '../../../src-tauri/templates/todo.md?raw'
import meetingTemplate from '../../../src-tauri/templates/meeting.md?raw'
import projectTemplate from '../../../src-tauri/templates/project.md?raw'
import bookTemplate from '../../../src-tauri/templates/book.md?raw'
import type {
  AssetFile,
  DocPayload,
  Eol,
  Encoding,
  SaveAttachmentResult,
  SearchHit,
  DrawerEntry,
  DrawerInfo,
  WriteOptions,
  WriteResult
} from '../types'

/** Virtual root used by the browser-only demo drawer. */
export const DEMO_ROOT = 'mark-drawer://demo'

const WELCOME = `---
title: 欢迎使用 Mark Drawer 文屉
author: MARK#EZVE.COM
tags: 入门, Markdown
created: 2026-11-24
---

# 欢迎使用 Mark Drawer 文屉

> 随文一屉 奇思几许。

**文屉**是一个**本地优先**的 Markdown 编辑器：文件保存在你自己的文件夹里，使用标准 Markdown 存储。

## 快速上手

1. 点击「打开抽屉」选择一个本地文件夹；
2. 使用 \`Ctrl + S\` 保存，\`Ctrl + N\` 新建笔记；
3. 输入 \`/\` 唤起斜杠菜单，插入表格、公式、Mermaid 等块。

## 公式与图表

行内公式 $E = mc^2$，块级公式：

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

\`\`\`mermaid
flowchart LR
  A[打开抽屉] --> B[编辑 Markdown]
  B --> C{需要导出?}
  C -->|是| D[PDF / HTML]
  C -->|否| B
\`\`\`

## 代码块

\`\`\`ts
export function greeting(name: string): string {
  return \`你好，\${name}\`
}
\`\`\`

> [!TIP] 这是 Callout
> 编辑体验对标 Typora，文件管理对标 Obsidian。

| 能力 | 状态 |
| ---- | ---- |
| WYSIWYG 编辑 | ✅ |
| 源码视图 | ✅ |
| Mermaid | ✅ |
| 导出 PDF/HTML | ✅ |
`

const SHORTCUTS = `# 快捷键

| 快捷键 | 功能 |
| ------ | ---- |
| Ctrl + B | 加粗 |
| Ctrl + I | 斜体 |
| Ctrl + Alt + U | 删除线 |
| Ctrl + Alt + E | 行内代码 |
| Ctrl + S | 保存 |
| Ctrl + N | 新建笔记 |
| Ctrl + Alt + F | 在当前文档中查找 |
| Ctrl + H | 查找并替换 |
| Ctrl + Shift + F | 搜索抽屉（按文件名与内容） |
| Ctrl + Alt + / | 切换源码视图 |
| Ctrl + \\ | 分栏 |
| Ctrl + Alt + L | 切换侧边栏 |
| Ctrl + Alt + O | 切换大纲 |
| Ctrl + Alt + 1…6 | 标题 1–6 级 |
| Ctrl + Alt + 0 | 正文 |
| Ctrl + Alt + Q | 引用 |
| Ctrl + Alt + 8 / 7 | 无序 / 有序列表 |
| Ctrl + Alt + K | 代码块 |
| Ctrl + Alt + T | 表格 |
| Ctrl + Enter | 切换任务状态（待办 → 进行中 → 完成） |

> 格式类快捷键统一用 Ctrl + Alt：裸 Ctrl + K/L/U/Q 等会被 WebView2 的浏览器加速键截走。查找也同理（Ctrl + F 是浏览器的页内查找），因此改用 Ctrl + Alt + F。可在「选项 → 快捷键」里改回任意组合。
`

const EXPORT_GUIDE = `# 导出指南

- **HTML · 独立文件夹**：\`index.html\` + \`attachments/\`，适合二次编辑；
- **HTML · 单文件**：图片以 base64 内嵌，可直接离线分发；
- **PDF**：基于系统打印，支持页边距、页码起始值与页面范围。

> 导出的样式跟随当前主题，主题需要包含 \`@media print\` 规则。
`

interface DocMeta {
  encoding: Encoding
  eol: Eol
  bom: boolean
}

interface MockState {
  root: string
  name: string
  files: Map<string, string>
  mtimes: Map<string, number>
  meta: Map<string, DocMeta>
  attachments: Map<string, string>
  dirs: Set<string>
  /** Dev-only: next save for these paths fails with a CONFLICT (banner test). */
  conflictOnce: Set<string>
}

function createState(): MockState {
  const now = Date.now()
  const files = new Map<string, string>([
    [WELCOME_DOC, WELCOME],
    ['指南/快捷键.md', SHORTCUTS],
    ['指南/导出指南.md', EXPORT_GUIDE],
    ['templates/note.md', noteTemplate],
    ['templates/daily.md', dailyTemplate],
    ['templates/todo.md', todoTemplate],
    ['templates/meeting.md', meetingTemplate],
    ['templates/project.md', projectTemplate],
    ['templates/book.md', bookTemplate],
    ['themes/Catppuccin.css', catppuccinTheme],
    ['themes/GitHub.css', githubTheme],
    ['themes/Material.css', materialTheme],
    ['themes/Monokai-Pro.css', monokaiTheme],
    ['themes/Nord.css', nordTheme]
  ])
  const mtimes = new Map<string, number>()
  const meta = new Map<string, DocMeta>()
  for (const key of files.keys()) {
    mtimes.set(key, now)
    meta.set(key, { encoding: 'utf8', eol: 'lf', bom: false })
  }
  return {
    root: DEMO_ROOT,
    name: 'Mark Drawer Demo',
    files,
    mtimes,
    meta,
    attachments: new Map<string, string>(),
    dirs: new Set(['attachments', 'themes', 'templates', '指南']),
    conflictOnce: new Set<string>()
  }
}

let state = createState()

/** Rebuilds the tree from the flat file map so create/rename/delete show up. */
function buildTree(snapshot: MockState): DrawerEntry[] {
  const top: DrawerEntry[] = []
  const known = new Map<string, DrawerEntry>()

  const ensureDir = (path: string): DrawerEntry => {
    const existing = known.get(path)
    if (existing) return existing
    const entry: DrawerEntry = {
      name: basename(path),
      path,
      kind: 'dir',
      children: []
    }
    known.set(path, entry)
    const parent = dirname(path)
    if (parent) ensureDir(parent).children!.push(entry)
    else top.push(entry)
    return entry
  }

  for (const dir of snapshot.dirs) ensureDir(dir)

  for (const [path, _content] of snapshot.files) {
    if (path.endsWith('/.keep')) continue
    const parent = dirname(path)
    const entry: DrawerEntry = {
      name: basename(path),
      path,
      kind: 'file',
      mtime: snapshot.mtimes.get(path) ?? Date.now()
    }
    if (parent) ensureDir(parent).children!.push(entry)
    else top.push(entry)
  }

  const sort = (list: DrawerEntry[]): void => {
    list.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name, 'zh')
    })
    for (const item of list) if (item.children) sort(item.children)
  }
  sort(top)
  return top
}

function getFile(path: string): string {
  const content = state.files.get(path)
  if (content === undefined) throw new Error(`演示库中不存在文件：${path}`)
  return content
}

function replacePrefix(from: string, to: string): void {
  if (state.dirs.has(from)) {
    state.dirs = new Set(
      [...state.dirs].map((dir) =>
        dir === from ? to : dir.startsWith(`${from}/`) ? `${to}${dir.slice(from.length)}` : dir
      )
    )
  }
  for (const key of [...state.files.keys()]) {
    if (key !== from && !key.startsWith(`${from}/`)) continue
    const content = state.files.get(key) ?? ''
    const mtime = state.mtimes.get(key) ?? Date.now()
    const docMeta = state.meta.get(key)
    state.files.delete(key)
    state.mtimes.delete(key)
    state.meta.delete(key)
    const nextKey = key === from ? to : `${to}${key.slice(from.length)}`
    state.files.set(nextKey, content)
    state.mtimes.set(nextKey, mtime)
    if (docMeta) state.meta.set(nextKey, docMeta)
  }
}

function removePrefix(path: string): void {
  state.dirs = new Set(
    [...state.dirs].filter((dir) => dir !== path && !dir.startsWith(`${path}/`))
  )
  for (const key of [...state.files.keys()]) {
    if (key === path || key.startsWith(`${path}/`)) {
      state.files.delete(key)
      state.mtimes.delete(key)
      state.meta.delete(key)
    }
  }
}

export const mock = {
  open(): DrawerInfo {
    return { root: state.root, name: state.name, entries: buildTree(state) }
  },

  readDoc(path: string): DocPayload {
    const docMeta = state.meta.get(path) ?? {
      encoding: 'utf8' as Encoding,
      eol: osDefaultEol(),
      bom: false
    }
    return {
      content: getFile(path),
      mtime: state.mtimes.get(path) ?? Date.now(),
      encoding: docMeta.encoding,
      eol: docMeta.eol,
      bom: docMeta.bom
    }
  },

  writeDoc(path: string, content: string, options: WriteOptions): WriteResult {
    if (state.conflictOnce.has(path)) {
      state.conflictOnce.delete(path)
      throw new Error(`CONFLICT:${Date.now()}`)
    }
    state.files.set(path, content)
    const mtime = Date.now()
    state.mtimes.set(path, mtime)
    state.meta.set(path, {
      encoding: options.encoding,
      eol: options.eol,
      bom: options.encoding === 'utf8' ? options.bom : false
    })
    return { mtime }
  },

  createEntry(path: string, kind: 'dir' | 'file'): void {
    if (kind === 'dir') {
      state.dirs.add(path)
      return
    }
    state.files.set(path, '')
    state.mtimes.set(path, Date.now())
    state.meta.set(path, { encoding: 'utf8', eol: osDefaultEol(), bom: false })
  },

  renameEntry(from: string, to: string): void {
    replacePrefix(from, to)
  },

  deleteEntry(path: string): void {
    removePrefix(path)
  },

  saveAttachment(name: string, base64: string): SaveAttachmentResult {
    let stored = name
    let path = `attachments/${stored}`
    let index = 1
    while (state.attachments.has(path)) {
      const dot = name.lastIndexOf('.')
      stored =
        dot > 0
          ? `${name.slice(0, dot)}-${index}${name.slice(dot)}`
          : `${name}-${index}`
      path = `attachments/${stored}`
      index += 1
    }
    state.attachments.set(path, base64)
    return { path, name: stored }
  },

  readAttachment(path: string): string | null {
    return state.attachments.get(path) ?? null
  },

  /** Demo equivalent of the app-level `themes/` and `templates/` folders. */
  listAppAssets(kind: 'themes' | 'templates'): AssetFile[] {
    const prefix = `${kind}/`
    const extension = kind === 'themes' ? /\.css$/i : /\.md$/i
    const items: AssetFile[] = []
    for (const [path, content] of state.files) {
      if (!path.startsWith(prefix) || !extension.test(path)) continue
      items.push({ name: basename(path), path, content })
    }
    return items.sort((a, b) => a.name.localeCompare(b.name))
  },

  search(query: string): SearchHit[] {
    const needle = query.toLowerCase()
    const hits: SearchHit[] = []
    for (const [path, content] of state.files) {
      if (!path.endsWith('.md')) continue
      const index = content.toLowerCase().indexOf(needle)
      if (index === -1) continue
      const title = content.match(/^#\s+(.+)$/m)?.[1] ?? path
      const start = Math.max(0, index - 40)
      hits.push({
        path,
        title,
        snippet: content.slice(start, index + needle.length + 80).replace(/\n/g, ' '),
        score: 1
      })
    }
    return hits
  },

  /** Dev-only helper used by Settings/automation to exercise the conflict banner. */
  markExternalChange(path: string): void {
    const current = state.files.get(path) ?? ''
    state.files.set(path, `${current}\n\n> 来自外部的修改\n`)
    state.mtimes.set(path, Date.now())
    state.conflictOnce.add(path)
  },

  reset(): void {
    state = createState()
  }
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as Window & { __markupMock?: typeof mock }).__markupMock = mock
}
