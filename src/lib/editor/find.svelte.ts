// MARK#EZVE.COM
import type { FindEngine, FindResult, FindSurface } from './find-core'

/**
 * State and routing for the in-document find bar.
 *
 * Exactly one editor surface is registered at a time: the rich editor while
 * 预览 / 分栏 is shown, the editable source view while 源码 is shown (and for
 * plain-text tabs). Components register from an effect, so switching views
 * hands the bar over without the menu or the shortcuts knowing about it.
 */
export const findState = $state({
  open: false,
  showReplace: false,
  query: '',
  replacement: '',
  caseSensitive: false,
  /** Total hits on the active surface. */
  count: 0,
  /** Zero-based index of the highlighted hit; -1 when there is none. */
  active: -1,
  surface: 'prose' as FindSurface,
  /** Bumped by `openFind`, so a repeated Ctrl+Alt+F refocuses the input. */
  focusToken: 0
})

let engine: FindEngine | null = null

function apply(result: FindResult): void {
  findState.count = result.count
  findState.active = result.active
}

function idle(): void {
  findState.count = 0
  findState.active = -1
}

/** Recomputes the current query; used after the query, options or document change. */
export function searchFind(): void {
  if (!engine) {
    idle()
    return
  }
  findState.surface = engine.surface
  apply(engine.search(findState.query, findState.caseSensitive))
}

/**
 * Refreshes the counter without moving the caret. Called while the user keeps
 * editing under an open bar, where jumping on every keystroke would be hostile.
 */
export function refreshFind(): void {
  if (!engine) {
    idle()
    return
  }
  findState.surface = engine.surface
  apply(engine.search(findState.query, findState.caseSensitive, false))
}

export function registerFindEngine(next: FindEngine): void {
  engine = next
  findState.surface = next.surface
  if (findState.open && findState.query) {
    apply(next.search(findState.query, findState.caseSensitive))
  } else {
    idle()
  }
}

export function unregisterFindEngine(current: FindEngine): void {
  current.clear()
  if (engine !== current) return
  engine = null
  idle()
}

export function openFind(showReplace = false): void {
  findState.open = true
  if (showReplace) findState.showReplace = true
  findState.focusToken += 1
  if (findState.query) searchFind()
}

export function closeFind(): void {
  findState.open = false
  engine?.clear()
  idle()
}

export function toggleReplace(): void {
  findState.showReplace = !findState.showReplace
}

export function setFindQuery(value: string): void {
  findState.query = value
  searchFind()
}

export function setFindCaseSensitive(value: boolean): void {
  findState.caseSensitive = value
  searchFind()
}

export function findNext(): void {
  if (engine) apply(engine.step(1))
}

export function findPrevious(): void {
  if (engine) apply(engine.step(-1))
}

export function replaceFindCurrent(): void {
  if (engine) apply(engine.replace(findState.replacement))
}

export function replaceFindAll(): void {
  if (engine) apply(engine.replaceAll(findState.replacement))
}
