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

  async refresh(): Promise<void> {
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

  toggle(path: string): void {
    this.expanded = { ...this.expanded, [path]: !this.isExpanded(path) }
  }

  isExpanded(path: string): boolean {
    return this.expanded[path] ?? true
  }

  expandAll(value: boolean): void {
    const next: Record<string, boolean> = {}
    const walk = (entries: DrawerEntry[]) => {
      for (const entry of entries) {
        if (entry.kind === 'dir') {
          next[entry.path] = value
          if (entry.children) walk(entry.children)
        }
      }
    }
    walk(this.entries)
    this.expanded = next
  }

  private apply(info: DrawerInfo): void {
    this.root = info.root
    this.name = info.name
    this.entries = info.entries
    this.isDemo = api.isDemoRoot(info.root)
  }
}

export const drawer = new DrawerStore()