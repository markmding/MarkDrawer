// MARK#EZVE.COM
import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'
import { findTextMatches, type FindEngine, type FindResult, type TextMatch } from './find-core'

/**
 * Source view / plain-text find.
 *
 * Works on the raw document string, so offsets are CodeMirror document
 * positions unchanged. Highlights are decorations driven by a state field that
 * is part of every editor's extension list (the source view and Crepe's code
 * blocks), which lets the rich editor paint matches inside a code block.
 */
export interface FindHighlight {
  ranges: readonly TextMatch[]
  /** Start offset of the match that should stand out, -1 for none. */
  activeFrom: number
}

export const setFindHighlights = StateEffect.define<FindHighlight | null>()

const highlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    for (const effect of transaction.effects) {
      if (!effect.is(setFindHighlights)) continue
      const payload = effect.value
      if (!payload || !payload.ranges.length) return Decoration.none
      return Decoration.set(
        payload.ranges.map((range) =>
          Decoration.mark({
            class:
              range.start === payload.activeFrom
                ? 'find-hit find-hit-active'
                : 'find-hit'
          }).range(range.start, range.end)
        ),
        true
      )
    }
    // Keep the paint alive while the user edits around it; a stale set would
    // throw as soon as a deletion moved positions past the document length.
    return transaction.docChanged ? decorations.map(transaction.changes) : decorations
  },
  provide: (field) => EditorView.decorations.from(field)
})

/** Add to every CodeMirror instance the find bar should be able to paint. */
export const findHighlightExtension = highlightField

export class CodeFindEngine implements FindEngine {
  readonly surface = 'code' as const
  private query = ''
  private caseSensitive = false
  private matches: TextMatch[] = []
  private active = -1
  private destroyed = false

  constructor(private readonly view: EditorView) {}

  search(query: string, caseSensitive: boolean, reveal = true): FindResult {
    this.query = query
    this.caseSensitive = caseSensitive
    this.matches = findTextMatches(this.view.state.doc.toString(), query, caseSensitive)
    if (reveal) {
      // Start from the caret so Ctrl+Alt+F continues where the user was typing.
      const caret = this.view.state.selection.main.from
      const next = this.matches.findIndex((match) => match.start >= caret)
      this.active = next >= 0 ? next : this.matches.length ? 0 : -1
    } else {
      this.active = this.clamp(this.active)
    }
    this.paint(reveal)
    return this.result()
  }

  step(direction: 1 | -1): FindResult {
    if (this.matches.length) {
      this.active = (this.active + direction + this.matches.length) % this.matches.length
      this.paint(true)
    }
    return this.result()
  }

  replace(replacement: string): FindResult {
    const match = this.matches[this.active]
    if (!match) return this.result()
    this.view.dispatch({
      changes: { from: match.start, to: match.end, insert: replacement }
    })
    return this.search(this.query, this.caseSensitive)
  }

  replaceAll(replacement: string): FindResult {
    if (!this.matches.length) return this.result()
    this.view.dispatch({
      changes: this.matches.map((match) => ({
        from: match.start,
        to: match.end,
        insert: replacement
      }))
    })
    return this.search(this.query, this.caseSensitive)
  }

  clear(): void {
    this.matches = []
    this.active = -1
    if (!this.destroyed) this.view.dispatch({ effects: setFindHighlights.of(null) })
  }

  destroy(): void {
    // The view is already gone by the time this runs; unregistering cleared
    // the paint while it was still alive.
    this.destroyed = true
    this.matches = []
    this.active = -1
  }

  private clamp(index: number): number {
    if (!this.matches.length) return -1
    return Math.min(Math.max(index, 0), this.matches.length - 1)
  }

  /** Paints every hit and, when asked, puts the caret on the active one. */
  private paint(reveal: boolean): void {
    if (this.destroyed) return
    const active = this.matches[this.active]
    const effect = setFindHighlights.of(
      this.matches.length
        ? { ranges: this.matches, activeFrom: active ? active.start : -1 }
        : null
    )
    this.view.dispatch({
      effects: effect,
      ...(reveal && active
        ? { selection: { anchor: active.start, head: active.end }, scrollIntoView: true }
        : {})
    })
  }

  private result(): FindResult {
    return { count: this.matches.length, active: this.active }
  }
}
