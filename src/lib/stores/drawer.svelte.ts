// MARK#EZVE.COM
import * as api from '../api/drawer'
import { DEMO_ROOT } from '../api/mock'
import { pickDrawerFolder } from '../api/tauri'
import type { DrawerEntry, DrawerInfo } from '../types'

/**
 * A drawer is one folder of notes: the product's name for what used to be the
 * drawer. Opening a drawer never writes into it until the user edits something.
 */
class DrawerStore {
  root = $state<string | null>(null)
  name = $state('')
  entries = $state<DrawerEntry[]>([])
  expanded = $state<Record<string, boolean>>({})
  loading = $state(false)
  error = $state<string | null>(null)
  isDemo = $state(false)

  get isOpen(): boolean {
    return this.root !== null
  }

  async choose(): Promise<boolean> {
    const path = await pickDrawerFolder()
    if (!path) return false
    return this.open(path)
  }

  async open(path: string): Promise<boolean> {
    this.loading = true
    this.error = null
    try {
      const info = await api.openDrawer(path)
      this.apply(info)
      if (!this.isDemo) await api.watchDrawer(info.root)
      return true
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      return false
    } finally {
      this.loading = false
    }
  }

  async openDemo(): Promise<void> {
    this.loading = true
    this.error = null
    try {
      const info = await api.openDrawer(DEMO_ROOT)
      this.apply(info)
      this.isDemo = true
      // Stop watching any real drawer that was open before switching to demo.
      await api.unwatchDrawer()
    } finally {
      this.loading = false
    }
  }

  /** Directories whose level has already been fetched (lazy loading). */
  private loadedLevels = new Set<string>()
  private levelInFlight: Map<string, Promise<void>> = new Map()

  private refreshInFlight: Promise<void> | null = null

  async refresh(): Promise<void> {
    if (!this.root) return
    if (this.refreshInFlight) return this.refreshInFlight
    this.refreshInFlight = this.doRefresh().finally(() => {
      this.refreshInFlight = null
    })
    return this.refreshInFlight
  }

  private async doRefresh(): Promise<void> {
    if (!this.root) return
    try {
      const info = await api.openDrawer(this.root)
      const expanded = this.expanded
      this.apply(info)
      this.expanded = expanded
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
    }
  }

  /**
   * Toggles a directory. When expanding a directory whose level has not been
   * loaded yet (its `children` is `undefined`), the one level is fetched
   * lazily first; collapsing is always zero-IO.
   */
  async toggle(path: string): Promise<void> {
    const expanding = !this.isExpanded(path)
    const entry = this.findEntry(path)
    if (expanding && entry?.kind === 'dir' && entry.children === undefined) {
      await this.loadLevel(path)
    }
    this.expanded = { ...this.expanded, [path]: expanding }
  }

  isExpanded(path: string): boolean {
    return this.expanded[path] ?? true
  }

  expandAll(value: boolean): void {
    // Collapsing is zero-IO (already-loaded children stay in memory).
    // Expanding everything needs the full tree, so it is a refresh first.
    if (value) {
      void this.refresh().then(() => {
        this.expanded = this.collapsedToExpanded(this.entries, true)
      })
      return
    }
    this.expanded = this.collapsedToExpanded(this.entries, false)
  }

  /**
   * Finds an entry by its drawer-relative path. The search only descends into
   * already-loaded levels; unexpanded lazy directories are still found by
   * their own path.
   */
  findEntry(path: string): DrawerEntry | undefined {
    const walk = (list: DrawerEntry[]): DrawerEntry | undefined => {
      for (const entry of list) {
        if (entry.path === path) return entry
        if (entry.children) {
          const found = walk(entry.children)
          if (found) return found
        }
      }
      return undefined
    }
    return walk(this.entries)
  }

  private async loadLevel(path: string): Promise<void> {
    if (this.loadedLevels.has(path) || !this.root) return
    const existing = this.levelInFlight.get(path)
    if (existing) {
      await existing
      return
    }
    const task = (async () => {
      try {
        const children = await api.listDirLevel(this.root!, path)
        this.loadedLevels.add(path)
        this.attachLevel(path, children)
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error)
      } finally {
        this.levelInFlight.delete(path)
      }
    })()
    this.levelInFlight.set(path, task)
    await task
  }

  /** Splices freshly-loaded children into the matching directory node. */
  private attachLevel(dirPath: string, children: DrawerEntry[]): void {
    this.entries = this.replaceChildren(this.entries, dirPath, children)
  }

  private replaceChildren(
    list: DrawerEntry[],
    dirPath: string,
    children: DrawerEntry[]
  ): DrawerEntry[] {
    return list.map((entry) => {
      if (entry.kind === 'dir' && entry.path === dirPath) {
        return { ...entry, children }
      }
      if (entry.kind === 'dir' && entry.children) {
        return { ...entry, children: this.replaceChildren(entry.children, dirPath, children) }
      }
      return entry
    })
  }

  private collapsedToExpanded(entries: DrawerEntry[], value: boolean): Record<string, boolean> {
    const next: Record<string, boolean> = {}
    const walk = (list: DrawerEntry[]) => {
      for (const entry of list) {
        if (entry.kind === 'dir') {
          next[entry.path] = value
          if (entry.children) walk(entry.children)
        }
      }
    }
    walk(entries)
    return next
  }

  private apply(info: DrawerInfo): void {
    this.root = info.root
    this.name = info.name
    this.entries = info.entries
    this.isDemo = api.isDemoRoot(info.root)
    // A fresh full tree reloaded the levels we had fetched lazily.
    this.loadedLevels.clear()
    this.levelInFlight.clear()
  }
}

export const drawer = new DrawerStore()