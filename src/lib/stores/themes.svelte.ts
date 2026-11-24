// MARK#EZVE.COM
import * as api from '../api/drawer'
import { settings } from './settings.svelte'

export interface ThemeItem {
  name: string
  path: string
  css: string
}

class ThemeStore {
  items = $state<ThemeItem[]>([])
  customCss = $state('')
  loading = $state(false)

  /** Reads themes/*.css from the folder next to the executable. */
  async load(): Promise<void> {
    this.loading = true
    try {
      const assets = await api.listAppAssets('themes')
      this.items = assets.map((file) => ({
        name: file.name.replace(/\.css$/i, ''),
        path: file.path,
        css: file.content
      }))
    } finally {
      this.loading = false
    }
    this.applySelection()
  }

  /** Applies the selected theme CSS to the app (editor + preview share it). */
  applySelection(): void {
    const id = settings.value.documentTheme
    const path = id.startsWith('theme:') ? id.slice('theme:'.length) : ''
    const item = path ? this.items.find((theme) => theme.path === path) : undefined
    this.customCss = item?.css ?? ''
    if (typeof document === 'undefined') return

    let style = document.getElementById('mark-drawer-custom-theme') as HTMLStyleElement | null
    if (!style) {
      style = document.createElement('style')
      style.id = 'mark-drawer-custom-theme'
      document.head.appendChild(style)
    }
    style.textContent = this.customCss
  }
}

export const themes = new ThemeStore()
