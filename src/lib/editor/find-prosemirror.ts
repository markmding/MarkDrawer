// MARK#EZVE.COM
import { EditorView as CodeMirrorView } from '@codemirror/view'
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import { NodeSelection, Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state'
import {
  Decoration,
  DecorationSet,
  type EditorView
} from '@milkdown/kit/prose/view'
import { setFindHighlights } from './find-codemirror'
import {
  findTextMatches,
  type FindEngine,
  type FindResult,
  type TextMatch
} from './find-core'

/**
 * Find inside the rich editor.
 *
 * ProseMirror has no text buffer, so every textblock is flattened on its own
 * (`textBetween`) and matches are mapped back with `blockStart + 1 + offset`.
 * Leaf nodes (images, hard breaks) count as one placeholder character, which is
 * exactly the one position they occupy in the document.
 *
 * Code blocks are special: Crepe renders them with their own CodeMirror and no
 * `contentDOM`, so decorations inside them would never be painted. Their hits
 * are counted here and painted through that inner editor instead.
 */

interface CodeHit {
  /** Position of the code_block node itself. */
  blockPos: number
  from: number
  to: number
}

interface Hit {
  /** Document positions, used for selection and replacement. */
  from: number
  to: number
  code: CodeHit | null
}

interface FindPluginState {
  query: string
  caseSensitive: boolean
  /** Start position of the active hit; -1 when none of them is active. */
  activeFrom: number
  matches: Array<{ from: number; to: number }>
}

interface FindPluginMeta {
  query: string
  caseSensitive: boolean
  activeFrom: number
}

export const findPluginKey = new PluginKey<FindPluginState>('mark-drawer-find')

function collectHits(doc: ProseNode, query: string, caseSensitive: boolean): Hit[] {
  if (!query) return []
  const hits: Hit[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    // Leaves (images, hard breaks) become one placeholder character: exactly
    // the single document position they occupy.
    const text = node.textBetween(0, node.content.size, '\n', () => '￼')
    if (!text) return false
    const isCode = node.type.name === 'code_block'
    for (const match of findTextMatches(text, query, caseSensitive)) {
      hits.push({
        from: pos + 1 + match.start,
        to: pos + 1 + match.end,
        code: isCode ? { blockPos: pos, from: match.start, to: match.end } : null
      })
    }
    return false
  })
  return hits
}

function plainMatches(doc: ProseNode, query: string, caseSensitive: boolean) {
  return collectHits(doc, query, caseSensitive)
    .filter((hit) => !hit.code)
    .map(({ from, to }) => ({ from, to }))
}

/**
 * Registered on editor creation (see EditorPane) because ProseMirror cannot
 * gain a plugin after its state exists. Holds the match list so decorations
 * stay correct while the document changes under an open find bar.
 */
export const findDecorationsPlugin = new Plugin<FindPluginState>({
  key: findPluginKey,
  state: {
    init: () => ({ query: '', caseSensitive: false, activeFrom: -1, matches: [] }),
    apply(transaction, previous, _old, state) {
      const meta = transaction.getMeta(findPluginKey) as FindPluginMeta | undefined
      if (meta) {
        return {
          query: meta.query,
          caseSensitive: meta.caseSensitive,
          activeFrom: meta.activeFrom,
          matches: plainMatches(state.doc, meta.query, meta.caseSensitive)
        }
      }
      if (!transaction.docChanged || !previous.query) return previous
      return { ...previous, matches: plainMatches(state.doc, previous.query, previous.caseSensitive) }
    }
  },
  props: {
    decorations(state) {
      const pluginState = findPluginKey.getState(state)
      if (!pluginState || !pluginState.matches.length) return null
      return DecorationSet.create(
        state.doc,
        pluginState.matches.map((match) =>
          Decoration.inline(match.from, match.to, {
            class:
              match.from === pluginState.activeFrom
                ? 'find-hit find-hit-active'
                : 'find-hit'
          })
        )
      )
    }
  }
})

export class ProseFindEngine implements FindEngine {
  readonly surface = 'prose' as const
  private query = ''
  private caseSensitive = false
  private hits: Hit[] = []
  private active = -1
  /** Code block editors painted last time, so a new query can wipe them. */
  private painted = new Set<CodeMirrorView>()

  constructor(private readonly view: EditorView) {}

  search(query: string, caseSensitive: boolean, reveal = true): FindResult {
    this.query = query
    this.caseSensitive = caseSensitive
    this.hits = collectHits(this.view.state.doc, query, caseSensitive)
    if (reveal) {
      const caret = this.view.state.selection.from
      const next = this.hits.findIndex((hit) => hit.from >= caret)
      this.active = next >= 0 ? next : this.hits.length ? 0 : -1
    } else {
      this.active = this.clamp(this.active)
    }
    this.paint(reveal)
    return this.result()
  }

  step(direction: 1 | -1): FindResult {
    if (this.hits.length) {
      this.active = (this.active + direction + this.hits.length) % this.hits.length
      this.paint(true)
    }
    return this.result()
  }

  replace(replacement: string): FindResult {
    const hit = this.hits[this.active]
    if (!hit) return this.result()
    this.view.dispatch(this.view.state.tr.insertText(replacement, hit.from, hit.to))
    this.rebuild()
    return this.result()
  }

  replaceAll(replacement: string): FindResult {
    if (!this.hits.length) return this.result()
    const transaction = this.view.state.tr
    // Back to front: earlier replacements shift nothing that still has to be
    // applied, so the original offsets stay valid for the whole transaction.
    for (let index = this.hits.length - 1; index >= 0; index -= 1) {
      const hit = this.hits[index]
      transaction.insertText(replacement, hit.from, hit.to)
    }
    this.view.dispatch(transaction)
    this.rebuild()
    return this.result()
  }

  clear(): void {
    this.hits = []
    this.active = -1
    this.clearCodeBlocks()
    if (!this.view.isDestroyed) {
      this.view.dispatch(
        this.view.state.tr
          .setMeta(findPluginKey, {
            query: '',
            caseSensitive: this.caseSensitive,
            activeFrom: -1
          })
          .setMeta('addToHistory', false)
      )
    }
  }

  destroy(): void {
    this.clear()
  }

  private clamp(index: number): number {
    if (!this.hits.length) return -1
    return Math.min(Math.max(index, 0), this.hits.length - 1)
  }

  private rebuild(): void {
    this.hits = collectHits(this.view.state.doc, this.query, this.caseSensitive)
    // Keep the same ordinal position, clamped: the next hit slides into place.
    this.active = this.clamp(this.active)
    this.paint(true)
  }

  private paint(reveal: boolean): void {
    const active = this.hits[this.active]
    const activeFrom = active && !active.code ? active.from : -1
    const transaction = this.view.state.tr
      .setMeta(findPluginKey, {
        query: this.query,
        caseSensitive: this.caseSensitive,
        activeFrom
      })
      .setMeta('addToHistory', false)
    if (active && !active.code) {
      transaction.setSelection(
        TextSelection.create(this.view.state.doc, active.from, active.to)
      )
      if (reveal) transaction.scrollIntoView()
    }
    this.view.dispatch(transaction)

    this.paintCodeBlocks()
    if (!reveal || !active?.code) return
    const inner = this.codeView(active.code.blockPos)
    const dom = this.view.nodeDOM(active.code.blockPos)
    if (dom instanceof HTMLElement) dom.scrollIntoView({ block: 'center' })
    if (inner) {
      this.dispatchInner(inner, {
        selection: { anchor: active.code.from, head: active.code.to },
        scrollIntoView: true
      })
    } else {
      // The block's editor is still lazy (offscreen); selecting the node is the
      // closest we can get without mounting it.
      this.view.dispatch(
        this.view.state.tr
          .setSelection(NodeSelection.create(this.view.state.doc, active.code.blockPos))
          .scrollIntoView()
      )
    }
  }

  /** Paints (or clears) highlights inside every code block that has a hit. */
  private paintCodeBlocks(): void {
    const groups = new Map<number, TextMatch[]>()
    const active = this.hits[this.active]
    for (const hit of this.hits) {
      if (!hit.code) continue
      const list = groups.get(hit.code.blockPos) ?? []
      // The code block's CodeMirror uses plain document offsets, same numbering.
      list.push({ start: hit.code.from, end: hit.code.to })
      groups.set(hit.code.blockPos, list)
    }

    const painted = new Set<CodeMirrorView>()
    for (const [blockPos, ranges] of groups) {
      const inner = this.codeView(blockPos)
      if (!inner) continue
      painted.add(inner)
      const activeFrom =
        active?.code && active.code.blockPos === blockPos ? active.code.from : -1
      this.dispatchInner(inner, { effects: setFindHighlights.of({ ranges, activeFrom }) })
    }
    for (const previous of this.painted) {
      if (!painted.has(previous)) this.dispatchInner(previous, { effects: setFindHighlights.of(null) })
    }
    this.painted = painted
  }

  private clearCodeBlocks(): void {
    for (const view of this.painted) {
      this.dispatchInner(view, { effects: setFindHighlights.of(null) })
    }
    this.painted = new Set()
  }

  /**
   * Code block editors tear down when they scroll far offscreen, and the view
   * we remembered may already be gone by the time a new query arrives.
   */
  private dispatchInner(view: CodeMirrorView, spec: Parameters<CodeMirrorView['dispatch']>[0]): void {
    try {
      view.dispatch(spec)
    } catch {
      // Detached editor: nothing left to paint.
    }
  }

  /** The CodeMirror instance Crepe mounted for a code block, if it is awake. */
  private codeView(blockPos: number): CodeMirrorView | null {
    const dom = this.view.nodeDOM(blockPos)
    if (!(dom instanceof HTMLElement)) return null
    return CodeMirrorView.findFromDOM(dom)
  }

  private result(): FindResult {
    return { count: this.hits.length, active: this.active }
  }
}
