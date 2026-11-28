// MARK#EZVE.COM
import * as api from '../api/drawer'
import { t } from '../i18n'
import {
  basename,
  ensureMdExtension,
  isMarkdown,
  joinPath,
  osDefaultEol,
  stripExtension
} from '../paths'
import type { DocPayload, Encoding, Eol } from '../types'
import { drawer } from './drawer.svelte'

export interface Tab {
  /**
   * Absolute path with forward slashes. It is unique across roots (a drawer
   * note and a single-file tab can share a relative path) and doubles as the
   * tab id.
   */
  id: string
  /**
   * Base folder for reads and writes: the drawer root for drawer tabs, or the
   * file's own folder for single-file tabs opened from the OS.
   */
  root: string
  /** Path relative to `root`, forward slashes. */
  path: string
  title: string
  /** Markdown tabs use the rich editor; text tabs always use the source editor. */
  kind: 'markdown' | 'text'
  content: string
  mtime: number
  encoding: Encoding
  eol: Eol
  bom: boolean
  dirty: boolean
  saving: boolean
  /** Bumped when content is replaced from disk, forcing the editor to remount. */
  revision: number
}

export type SaveOutcome = 'saved' | 'conflict' | 'error' | 'noop'

/**
 * Builds the absolute tab id for a root + relative path. Scheme roots such as
 * the demo drawer (`mark-drawer://demo`) must survive untouched, so this only
 * trims a trailing slash instead of running the path through `joinPath`.
 */
export function tabId(root: string, rel: string): string {
  const base = root.replace(/\/+$/, '')
  const path = rel.replace(/^\/+/, '')
  return path ? `${base}/${path}` : base
}

/** Windows paths compare case-insensitively; POSIX ones do not. */
const CASE_INSENSITIVE =
  typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent)

function pathKey(path: string): string {
  const slashed = path.replace(/\\/g, '/')
  return CASE_INSENSITIVE ? slashed.toLowerCase() : slashed
}

class TabsStore {
  tabs = $state<Tab[]>([])
  activeId = $state<string | null>(null)
  lastSavedAt = $state<number | null>(null)
  saveError = $state<string | null>(null)
  /** Tab id whose on-disk mtime no longer matches (non-blocking banner). */
  conflict = $state<{ id: string } | null>(null)

  get active(): Tab | undefined {
    return this.tabs.find((tab) => tab.id === this.activeId)
  }

  get dirtyCount(): number {
    return this.tabs.filter((tab) => tab.dirty).length
  }

  /** Opens a file that belongs to `root` (a drawer, or the file's own folder). */
  async open(root: string, path: string): Promise<void> {
    const id = tabId(root, path)
    const existing = this.tabs.find((tab) => tab.id === id)
    if (existing) {
      this.activeId = existing.id
      return
    }
    const doc = await api.readDoc(root, path)
    this.add(root, path, doc)
  }

  /**
   * Single-file mode: reads exactly one file, without opening or scanning its
   * folder. The folder only becomes the tab's read/write base.
   */
  async openAbsolute(absPath: string): Promise<void> {
    const info = await api.openFile(absPath)
    const id = tabId(info.root, info.rel)
    const existing = this.tabs.find((tab) => tab.id === id)
    if (existing) {
      this.activeId = existing.id
      return
    }
    this.add(info.root, info.rel, info.doc, info.name)
  }

  async createAndOpen(folder: string, rawName: string, content = ''): Promise<void> {
    if (!drawer.root) return
    const name = ensureMdExtension(rawName.trim())
    const rel = joinPath(folder, name)
    await api.createEntry(drawer.root, rel, 'file')
    if (content) {
      await api.writeDoc(drawer.root, rel, content, 0, true, {
        encoding: 'utf8',
        eol: osDefaultEol(),
        bom: false
      })
    }
    await drawer.refresh()
    await this.open(drawer.root, rel)
  }

  select(id: string | null): void {
    this.activeId = id
  }

  /** Changing the target encoding marks the tab dirty; the next save converts. */
  setEncoding(id: string, encoding: Encoding, bom: boolean): void {
    const tab = this.tabs.find((item) => item.id === id)
    if (!tab) return
    if (tab.encoding === encoding && tab.bom === bom) return
    tab.encoding = encoding
    tab.bom = encoding === 'utf8' ? bom : false
    tab.dirty = true
  }

  setEol(id: string, eol: Eol): void {
    const tab = this.tabs.find((item) => item.id === id)
    if (!tab || tab.eol === eol) return
    tab.eol = eol
    tab.dirty = true
  }

  /** Resolves a save conflict from the non-blocking banner. */
  async resolveConflict(id: string, action: 'reload' | 'overwrite'): Promise<boolean> {
    const tab = this.tabs.find((item) => item.id === id)
    if (!tab) return false

    if (action === 'overwrite') {
      const outcome = await this.save(id, true)
      return outcome === 'saved'
    }

    try {
      const doc = await api.readDoc(tab.root, tab.path)
      tab.content = doc.content
      tab.mtime = doc.mtime
      tab.encoding = doc.encoding
      tab.eol = doc.eol
      tab.bom = doc.bom
      tab.dirty = false
      tab.revision += 1
      this.conflict = null
      this.saveError = null
      return true
    } catch (error) {
      this.saveError = error instanceof Error ? error.message : String(error)
      return false
    }
  }

  /** Drops all tabs (demo reset / explicit workspace replacement). */
  reset(): void {
    this.tabs = []
    this.activeId = null
    this.saveError = null
    this.conflict = null
    this.lastSavedAt = null
  }

  update(id: string, content: string): void {
    const tab = this.tabs.find((item) => item.id === id)
    if (!tab || tab.content === content) return
    tab.content = content
    tab.dirty = true
  }

  async save(id: string, force = false): Promise<SaveOutcome> {
    const tab = this.tabs.find((item) => item.id === id)
    if (!tab) return 'noop'
    // A pending conflict must be resolved explicitly; don't retry in the background.
    if (this.conflict?.id === id && !force) return 'conflict'
    if (!tab.dirty && !force) return 'noop'
    if (tab.saving) return 'noop'

    tab.saving = true
    this.saveError = null
    try {
      const result = await api.writeDoc(tab.root, tab.path, tab.content, tab.mtime, force, {
        encoding: tab.encoding,
        eol: tab.eol,
        bom: tab.bom
      })
      tab.mtime = result.mtime
      tab.dirty = false
      this.lastSavedAt = Date.now()
      if (this.conflict?.id === id) this.conflict = null
      return 'saved'
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('CONFLICT')) {
        this.conflict = { id }
        this.saveError = null
        return 'conflict'
      }
      this.saveError = message
      return 'error'
    } finally {
      tab.saving = false
    }
  }

  async saveAll(): Promise<void> {
    for (const tab of this.tabs.filter((item) => item.dirty)) {
      await this.save(tab.id)
    }
  }

  /** Keeps open drawer tabs pointing at the new location after rename/move. */
  renameInRoot(root: string, from: string, to: string): void {
    const fromId = tabId(root, from)
    const toId = tabId(root, to)
    const previousActive = this.activeId
    for (const tab of this.tabs) {
      if (tab.root !== root) continue
      if (tab.path === from) {
        tab.path = to
        tab.id = toId
        // Renaming across types (e.g. note.md → note.txt) switches editors.
        const markdown = isMarkdown(to)
        tab.kind = markdown ? 'markdown' : 'text'
        tab.title = markdown ? stripExtension(basename(to)) : basename(to)
      } else if (tab.path.startsWith(`${from}/`)) {
        const next = `${to}${tab.path.slice(from.length)}`
        tab.path = next
        tab.id = tabId(root, next)
      }
    }
    if (previousActive === fromId) this.activeId = toId
    else if (previousActive?.startsWith(`${fromId}/`)) {
      this.activeId = `${toId}${previousActive.slice(fromId.length)}`
    }
  }

  closeByPath(root: string, path: string, force = false): void {
    const id = tabId(root, path)
    const targets = this.tabs.filter((tab) => tab.id === id || tab.id.startsWith(`${id}/`))
    for (const tab of targets) this.close(tab.id, force)
  }

  /** Closes every tab based in `root`, e.g. when another drawer replaces it. */
  closeRoot(root: string): void {
    for (const tab of [...this.tabs]) {
      if (tab.root === root) this.close(tab.id, true)
    }
  }

  close(id: string, force = false): void {
    const tab = this.tabs.find((item) => item.id === id)
    if (!tab) return
    if (tab.dirty && !force) {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm(t('alerts.unsavedClose', { title: tab.title }))
          : true
      if (!confirmed) return
    }
    if (this.conflict?.id === id) this.conflict = null
    const index = this.tabs.findIndex((item) => item.id === id)
    this.tabs.splice(index, 1)
    if (this.activeId === id) {
      const next = this.tabs[index] ?? this.tabs[index - 1]
      this.activeId = next?.id ?? null
    }
  }

  /** Called when the file watcher reports external changes. */
  syncFromDisk(paths: string[]): void {
    if (paths.length === 0) return
    const changed = new Set(paths.map(pathKey))
    for (const tab of this.tabs) {
      if (changed.has(pathKey(tab.id)) && !tab.dirty) {
        void this.reload(tab)
      }
    }
  }

  private add(root: string, path: string, doc: DocPayload, name = basename(path)): void {
    const markdown = isMarkdown(path)
    const id = tabId(root, path)
    this.tabs.push({
      id,
      root,
      path,
      title: markdown ? stripExtension(name) : name,
      kind: markdown ? 'markdown' : 'text',
      content: doc.content,
      mtime: doc.mtime,
      encoding: doc.encoding,
      eol: doc.eol,
      bom: doc.bom,
      dirty: false,
      saving: false,
      revision: 0
    })
    this.activeId = id
  }

  private async reload(tab: Tab): Promise<void> {
    try {
      const doc = await api.readDoc(tab.root, tab.path)
      if (!tab.dirty) {
        if (doc.content !== tab.content) {
          tab.content = doc.content
          tab.revision += 1
        }
        // Refresh metadata even when content is unchanged, so the next save
        // does not false-positive on mtime.
        tab.mtime = doc.mtime
        tab.encoding = doc.encoding
        tab.eol = doc.eol
        tab.bom = doc.bom
      }
    } catch {
      // File may have been deleted externally; the tree refresh will reflect it.
    }
  }
}

export const tabs = new TabsStore()
