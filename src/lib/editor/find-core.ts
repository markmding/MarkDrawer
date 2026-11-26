// MARK#EZVE.COM
/**
 * Shared vocabulary for the in-document find bar.
 *
 * The rich editor and the source view each build their own text model, but the
 * matching rules live here so a query returns the same hits in both — the
 * counter in the find bar would otherwise jump when the user switches views.
 */
export type FindSurface = 'prose' | 'code'

export interface TextMatch {
  /** Offset of the first character, inclusive. */
  start: number
  /** Offset one past the last character. */
  end: number
}

export interface FindResult {
  /** Total number of matches; 0 hides the counter. */
  count: number
  /** Zero-based index of the highlighted match, -1 when there is none. */
  active: number
}

export interface FindEngine {
  readonly surface: FindSurface
  /**
   * Recomputes the match list. `reveal` also moves the caret onto the active
   * match and scrolls it into view; background refreshes pass `false` so typing
   * in the editor does not yank the view around.
   */
  search(query: string, caseSensitive: boolean, reveal?: boolean): FindResult
  step(direction: 1 | -1): FindResult
  replace(replacement: string): FindResult
  replaceAll(replacement: string): FindResult
  /** Removes every highlight without dropping the query. */
  clear(): void
  destroy(): void
}

/** Hard ceiling so a one-letter query cannot mint a decoration per character. */
const MAX_MATCHES = 5000

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function findTextMatches(
  text: string,
  query: string,
  caseSensitive: boolean
): TextMatch[] {
  if (!query) return []
  const matches: TextMatch[] = []

  // Lower-casing is length-stable for every character we care about, but a few
  // (e.g. 'İ') expand to two code units. When that happens the offsets would
  // drift, so fall back to a regular expression over the original text.
  const haystack = caseSensitive ? text : text.toLowerCase()
  const needle = caseSensitive ? query : query.toLowerCase()
  if (haystack.length !== text.length || needle.length !== query.length) {
    const pattern = new RegExp(escapeRegExp(query), caseSensitive ? 'g' : 'gi')
    for (const match of text.matchAll(pattern)) {
      if (matches.length >= MAX_MATCHES) break
      matches.push({ start: match.index ?? 0, end: (match.index ?? 0) + match[0].length })
    }
    return matches
  }

  let index = haystack.indexOf(needle)
  while (index !== -1 && matches.length < MAX_MATCHES) {
    matches.push({ start: index, end: index + needle.length })
    // Advance past the whole hit: matches never overlap, same as a browser.
    index = haystack.indexOf(needle, index + needle.length)
  }
  return matches
}
