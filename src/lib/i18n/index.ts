// MARK#EZVE.COM
import { settings, type Language } from '../stores/settings.svelte'
import { en } from './en'
import { zhCN, type MessageKey } from './zh-CN'

export type { MessageKey }
export type { Language }
/** Concrete locale after `system` has been resolved. */
export type Locale = 'zh' | 'en'

/**
 * Language choices, in display order. `system` comes first because it is the
 * default for a fresh install; concrete choices stay available for anyone who
 * wants the interface in a specific language regardless of the OS.
 */
export const LOCALES: Language[] = ['system', 'zh', 'en']

export function currentLocale(): Locale {
  return settings.resolvedLanguage
}

/** Endonyms for concrete languages; `system` is shown translated. */
export function localeLabel(language: Language): string {
  if (language === 'system') return t('settings.languageSystem')
  return language === 'en' ? 'English' : '中文'
}

/**
 * Translates a UI string. Reads the language from the settings store, so any
 * template or `$derived` that calls `t()` re-renders when the language changes.
 */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const table = currentLocale() === 'en' ? en : zhCN
  let text: string = table[key] ?? zhCN[key] ?? key
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value))
    }
  }
  return text
}

/** Whether the interface is currently in English. */
export function isEnglish(): boolean {
  return currentLocale() === 'en'
}
