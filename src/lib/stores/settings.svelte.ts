// MARK#EZVE.COM
import type { HtmlExportMode } from '../types'

const STORAGE_KEY = 'markdrawer.settings.v1'
/** Previous product name; read once so existing installs keep their settings. */
const LEGACY_KEY = 'markup.settings.v1'

export type AppTheme = 'light' | 'dark' | 'system'
export type Language = 'zh' | 'en'

export interface SettingsState {
  /** Interface language; Chinese is the default. */
  language: Language
  theme: AppTheme
  /** `light` | `dark` | `theme:<app-relative-path>` */
  documentTheme: string
  editorFontSize: number
  /** F2.8 timer autosave (independent switch) */
  autosaveTimer: boolean
  autosaveInterval: number
  /** F2.8 blur autosave (independent switch) */
  autosaveBlur: boolean
  spellcheck: boolean
  /** Render Mermaid diagrams in export preview / exported HTML */
  renderMermaid: boolean
  /** Skip rendering off-screen blocks in long documents (F2.7 stage 1) */
  chunkedRendering: boolean
  /** F7.4 export defaults */
  defaultHtmlMode: HtmlExportMode
  defaultPageStart: number
  defaultPageRange: 'all' | 'range'
  sidebarVisible: boolean
  /** Shortcut id → combo. Only actions the user rebound appear here. */
  shortcuts: Record<string, string>
}

const defaults: SettingsState = {
  language: 'zh',
  theme: 'light',
  documentTheme: 'light',
  editorFontSize: 16,
  autosaveTimer: true,
  autosaveInterval: 30,
  autosaveBlur: true,
  spellcheck: false,
  renderMermaid: true,
  chunkedRendering: true,
  defaultHtmlMode: 'folder',
  defaultPageStart: 1,
  defaultPageRange: 'all',
  sidebarVisible: true,
  shortcuts: {}
}

function load(): SettingsState {
  if (typeof localStorage === 'undefined') return { ...defaults }
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (!raw) return { ...defaults }
    const parsed = JSON.parse(raw) as Partial<SettingsState>
    // A migration from the Markup-era settings must still default to Chinese.
    if (parsed.language !== 'en') parsed.language = 'zh'
    if (typeof parsed.shortcuts !== 'object' || parsed.shortcuts === null) parsed.shortcuts = {}
    return { ...defaults, ...parsed }
  } catch {
    return { ...defaults }
  }
}

class SettingsStore {
  value = $state<SettingsState>(load())

  update(patch: Partial<SettingsState>): void {
    this.value = { ...this.value, ...patch }
    this.persist()
  }

  setTheme(theme: AppTheme): void {
    this.update({ theme })
    this.applyTheme()
  }

  /** Binds `id` to `combo`; an empty combo removes the override (back to default). */
  setShortcut(id: string, combo: string): void {
    const next = { ...this.value.shortcuts }
    if (combo) next[id] = combo
    else delete next[id]
    this.update({ shortcuts: next })
  }

  resetShortcut(id: string): void {
    this.setShortcut(id, '')
  }

  resetAllShortcuts(): void {
    this.update({ shortcuts: {} })
  }

  /** Applies theme + typography to the document root. */
  applyTheme(): void {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const resolved =
      this.value.theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : this.value.theme
    root.dataset.theme = resolved
    root.lang = this.value.language === 'en' ? 'en' : 'zh-CN'
    root.style.setProperty('--editor-font-size', `${this.value.editorFontSize}px`)
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.value))
    } catch {
      // Quota / private mode: settings stay in memory for this session.
    }
  }
}

export const settings = new SettingsStore()