// MARK#EZVE.COM
import type { HtmlExportMode } from '../types'

const STORAGE_KEY = 'markdrawer.settings.v1'
/** Previous product name; read once so existing installs keep their settings. */
const LEGACY_KEY = 'markup.settings.v1'
/** Outline visibility lives outside the settings object; cleared by migration. */
export const OUTLINE_STORAGE_KEY = 'markdrawer.outline'

export type AppTheme = 'light' | 'dark' | 'system'
/** Stored preference; `system` follows the operating system's UI language. */
export type Language = 'system' | 'zh' | 'en'
/** Concrete interface language, i.e. `Language` with `system` resolved. */
export type ResolvedLanguage = 'zh' | 'en'

/**
 * Picks a language from the browser/WebView preference list. Chinese variants
 * (`zh-CN`, `zh-TW`, `zh-Hans`, …) map to `zh`; everything else falls back to
 * English, which is the safer default for an unknown locale.
 */
export function detectSystemLanguage(): ResolvedLanguage {
  if (typeof navigator === 'undefined') return 'zh'
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language]
  const tag = (tags[0] ?? '').toLowerCase()
  if (!tag) return 'zh'
  return tag.startsWith('zh') ? 'zh' : 'en'
}

export interface SettingsState {
  /** Interface language; follows the system on a fresh install. */
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
  /**
   * Layout-generation marker. Bumped when the shipped panel defaults change so
   * existing installs pick up the new layout once; see `LAYOUT_REVISION`.
   */
  layoutRevision: number
  /** Shortcut id → combo. Only actions the user rebound appear here. */
  shortcuts: Record<string, string>
}

/**
 * Current layout generation. 2 = both side panels start closed (they used to
 * start open), so a saved `sidebarVisible: true` under generation 1 is the old
 * default rather than a deliberate choice.
 */
const LAYOUT_REVISION = 2

const defaults: SettingsState = {
  language: 'system',
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
  sidebarVisible: false,
  // 0 = "not migrated yet"; fresh installs are stamped in `load()`. Keeping the
  // marker out of `defaults` is what lets an old saved state be recognised.
  layoutRevision: 0,
  shortcuts: {}
}

/** Fresh install: nothing to migrate, just record the generation. */
function freshState(): SettingsState {
  return { ...defaults, layoutRevision: LAYOUT_REVISION }
}

function load(): SettingsState {
  if (typeof localStorage === 'undefined') return freshState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (!raw) return freshState()
    const parsed = JSON.parse(raw) as Partial<SettingsState>
    // Accept only known values. The Markup-era file had no `language` field at
    // all, so those installs now fall back to `system` via `defaults` instead of
    // being pinned to Chinese.
    if (parsed.language !== 'zh' && parsed.language !== 'en' && parsed.language !== 'system') {
      parsed.language = 'system'
    }
    if (typeof parsed.shortcuts !== 'object' || parsed.shortcuts === null) parsed.shortcuts = {}
    const merged = { ...defaults, ...parsed }
    // One-time layout migration: whatever the stored value, apply the current
    // panel defaults and drop the legacy outline flag. Persisting the marker
    // right away keeps this from running again on the next launch.
    if (parsed.layoutRevision !== LAYOUT_REVISION) {
      merged.sidebarVisible = defaults.sidebarVisible
      merged.layoutRevision = LAYOUT_REVISION
      try {
        localStorage.removeItem(OUTLINE_STORAGE_KEY)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
      } catch {
        // Quota / private mode: the migration simply runs again next launch.
      }
    }
    return merged
  } catch {
    return freshState()
  }
}

class SettingsStore {
  value = $state<SettingsState>(load())
  /** Detected OS language; refreshed when the system preference changes. */
  systemLanguage = $state<ResolvedLanguage>(detectSystemLanguage())
  /** Concrete interface language, used by i18n and `<html lang>`. */
  resolvedLanguage = $derived<ResolvedLanguage>(
    this.value.language === 'system' ? this.systemLanguage : this.value.language
  )

  refreshSystemLanguage(): void {
    this.systemLanguage = detectSystemLanguage()
  }

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
    root.lang = this.resolvedLanguage === 'en' ? 'en' : 'zh-CN'
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

// Chromium (and therefore the Tauri WebView) reports a changed OS language
// through this event. Harmless in browsers that never fire it.
if (typeof window !== 'undefined') {
  window.addEventListener('languagechange', () => settings.refreshSystemLanguage())
}