// MARK#EZVE.COM
import type { MessageKey } from './i18n/zh-CN'

/**
 * Central keyboard-shortcut registry.
 *
 * Every menu action that can be triggered by a key lives here. The menu reads
 * the same table (through `resolveShortcuts`) that the global key handler uses,
 * so a user override immediately shows up in the menu — there is no second
 * copy of the bindings to drift out of sync.
 */
export type ShortcutGroup = 'app' | 'view' | 'format'

export interface ShortcutDef {
  id: string
  /** Reuses the menu label key so the settings list and menus stay in sync. */
  labelKey: MessageKey
  group: ShortcutGroup
  /** Canonical form: Ctrl+Alt+Shift+<key>, letters upper-case. */
  defaultCombo: string
}

export const SHORTCUT_DEFS = [
  // 文件与编辑
  { id: 'openDrawer', labelKey: 'menu.openDrawer', group: 'app', defaultCombo: 'Ctrl+O' },
  { id: 'newNote', labelKey: 'menu.newNote', group: 'app', defaultCombo: 'Ctrl+N' },
  { id: 'save', labelKey: 'menu.save', group: 'app', defaultCombo: 'Ctrl+S' },
  { id: 'export', labelKey: 'menu.export', group: 'app', defaultCombo: 'Ctrl+Shift+E' },
  { id: 'closeTab', labelKey: 'menu.closeTab', group: 'app', defaultCombo: 'Ctrl+W' },
  { id: 'undo', labelKey: 'menu.undo', group: 'app', defaultCombo: 'Ctrl+Z' },
  { id: 'redo', labelKey: 'menu.redo', group: 'app', defaultCombo: 'Ctrl+Shift+Z' },
  { id: 'selectAll', labelKey: 'menu.selectAll', group: 'app', defaultCombo: 'Ctrl+A' },
  { id: 'find', labelKey: 'menu.find', group: 'app', defaultCombo: 'Ctrl+F' },
  { id: 'settings', labelKey: 'menu.settings', group: 'app', defaultCombo: 'Ctrl+,' },
  // 视图
  { id: 'toggleSource', labelKey: 'menu.source', group: 'view', defaultCombo: 'Ctrl+\\' },
  { id: 'outline', labelKey: 'menu.outline', group: 'view', defaultCombo: 'Ctrl+Shift+O' },
  // 格式
  { id: 'bold', labelKey: 'menu.bold', group: 'format', defaultCombo: 'Ctrl+B' },
  { id: 'italic', labelKey: 'menu.italic', group: 'format', defaultCombo: 'Ctrl+I' },
  { id: 'strikethrough', labelKey: 'menu.strikethrough', group: 'format', defaultCombo: 'Ctrl+Shift+X' },
  { id: 'inlineCode', labelKey: 'menu.inlineCode', group: 'format', defaultCombo: 'Ctrl+E' },
  { id: 'heading1', labelKey: 'menu.h1', group: 'format', defaultCombo: 'Ctrl+Alt+1' },
  { id: 'heading2', labelKey: 'menu.h2', group: 'format', defaultCombo: 'Ctrl+Alt+2' },
  { id: 'heading3', labelKey: 'menu.h3', group: 'format', defaultCombo: 'Ctrl+Alt+3' },
  { id: 'paragraph', labelKey: 'menu.paragraph', group: 'format', defaultCombo: 'Ctrl+Alt+0' },
  { id: 'blockquote', labelKey: 'menu.quote', group: 'format', defaultCombo: 'Ctrl+Shift+Q' },
  { id: 'bulletList', labelKey: 'menu.bulletList', group: 'format', defaultCombo: 'Ctrl+Shift+8' },
  { id: 'orderedList', labelKey: 'menu.orderedList', group: 'format', defaultCombo: 'Ctrl+Shift+7' },
  { id: 'codeBlock', labelKey: 'menu.codeBlock', group: 'format', defaultCombo: 'Ctrl+Shift+K' },
  { id: 'table', labelKey: 'menu.table', group: 'format', defaultCombo: 'Ctrl+Alt+T' }
] as const satisfies readonly ShortcutDef[]

export type ShortcutId = (typeof SHORTCUT_DEFS)[number]['id']
export type ShortcutOverrides = Record<string, string>

export const DEFAULT_SHORTCUTS: Record<ShortcutId, string> = Object.fromEntries(
  SHORTCUT_DEFS.map((def) => [def.id, def.defaultCombo])
) as Record<ShortcutId, string>

export interface ParsedCombo {
  ctrl: boolean
  alt: boolean
  shift: boolean
  key: string
}

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '')

/** Parses `Ctrl+Alt+Shift+1` into modifiers plus a lower-case key. */
export function parseCombo(combo: string): ParsedCombo | null {
  if (!combo) return null
  const parts = combo.split('+').map((part) => part.trim())
  const key = parts.pop()
  if (!key) return null
  const mods = new Set(parts.map((part) => part.toLowerCase()))
  return {
    ctrl: mods.has('ctrl'),
    alt: mods.has('alt'),
    shift: mods.has('shift'),
    key: key.toLowerCase()
  }
}

/** Stable, comparable form (`ctrl+shift+k`). */
export function normalizeCombo(combo: string): string {
  const parsed = parseCombo(combo)
  if (!parsed) return ''
  return `${parsed.ctrl ? 'ctrl+' : ''}${parsed.alt ? 'alt+' : ''}${
    parsed.shift ? 'shift+' : ''
  }${parsed.key}`
}

/**
 * Reads a combo from a keyboard event. `event.code` is used instead of
 * `event.key` so Ctrl+Shift+8 still reads as "8" on layouts where the shift
 * level produces `*`.
 */
function keyFromEvent(event: KeyboardEvent): string | null {
  const code = event.code
  if (code.startsWith('Key')) return code.slice(3).toLowerCase()
  if (code.startsWith('Digit')) return code.slice(5)
  const named: Record<string, string> = {
    Backslash: '\\',
    Comma: ',',
    Slash: '/',
    Period: '.',
    Semicolon: ';',
    Quote: "'",
    BracketLeft: '[',
    BracketRight: ']',
    Minus: '-',
    Equal: '=',
    Backquote: '`'
  }
  return named[code] ?? null
}

/**
 * Returns a canonical combo for recording, or null for keys we refuse to bind
 * (bare letters, modifiers only, F-keys and navigation keys).
 */
export function comboFromEvent(event: KeyboardEvent): string | null {
  const key = keyFromEvent(event)
  if (!key) return null
  const ctrl = event.ctrlKey || event.metaKey
  if (!ctrl && !event.altKey) return null
  const parts: string[] = []
  if (ctrl) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  parts.push(key.length === 1 ? key.toUpperCase() : key)
  return parts.join('+')
}

export function comboMatches(event: KeyboardEvent, combo: string): boolean {
  const target = parseCombo(combo)
  if (!target) return false
  const key = keyFromEvent(event)
  if (!key || key !== target.key) return false
  // Cmd on macOS maps to Ctrl so the same bindings work on both platforms.
  const ctrl = event.ctrlKey || event.metaKey
  return ctrl === target.ctrl && event.altKey === target.alt && event.shiftKey === target.shift
}

/** Applies user overrides on top of the defaults. */
export function resolveShortcuts(
  overrides: ShortcutOverrides | undefined
): Record<ShortcutId, string> {
  const resolved = { ...DEFAULT_SHORTCUTS }
  if (!overrides) return resolved
  for (const def of SHORTCUT_DEFS) {
    const custom = overrides[def.id]
    if (custom && parseCombo(custom)) resolved[def.id] = custom
  }
  return resolved
}

/** Returns the other action already using `combo`, if any. */
export function shortcutConflict(
  id: ShortcutId,
  combo: string,
  resolved: Record<ShortcutId, string>
): ShortcutDef | null {
  const target = normalizeCombo(combo)
  if (!target) return null
  for (const def of SHORTCUT_DEFS) {
    if (def.id === id) continue
    if (normalizeCombo(resolved[def.id]) === target) return def
  }
  return null
}

/** Platform-aware label: ⌘ / ⌥ / ⇧ on macOS, the stored text elsewhere. */
export function displayCombo(combo: string): string {
  if (!isMac) return combo
  return combo.replace(/Ctrl/g, '⌘').replace(/Alt/g, '⌥').replace(/Shift/g, '⇧')
}
