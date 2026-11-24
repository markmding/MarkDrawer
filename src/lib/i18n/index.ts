// MARK#EZVE.COM
import { settings, type Language } from '../stores/settings.svelte'
import { en } from './en'
import { zhCN, type MessageKey } from './zh-CN'

export type { MessageKey }
export type Locale = Language

export const LOCALES: { value: Locale; label: string }[] = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' }
]

export function currentLocale(): Locale {
  return settings.value.language
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
