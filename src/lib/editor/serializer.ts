// MARK#EZVE.COM
import type { Ctx } from '@milkdown/kit/ctx'
import { nodesCtx, remarkStringifyOptionsCtx } from '@milkdown/kit/core'
import { Fragment, type Node as ProseNode } from '@milkdown/kit/prose/model'
import type { SerializerState } from '@milkdown/transformer'

/**
 * Keeps editor-only placeholders out of the Markdown source.
 *
 * Milkdown's `preset-commonmark` enables `remarkPreserveEmptyLinePlugin` by
 * default, and its paragraph serializer then writes an empty paragraph as the
 * raw HTML node `<br />` (models the empty line for the next parse). A Markdown
 * file must not gain HTML because the user pressed Enter — or because Crepe's
 * trailing plugin appended its empty paragraph — so the paragraph serializer is
 * replaced here: an empty paragraph now serializes as an empty paragraph, i.e.
 * a blank line, which is exactly what Markdown can express.
 */

/** Drops the trailing hardbreak, which only marks the paragraph end. */
function withoutTrailingHardbreak(content: Fragment): Fragment {
  if (content.childCount === 0) return content
  if (content.lastChild?.type.name !== 'hardbreak') return content
  const kept: ProseNode[] = []
  content.forEach((child, _offset, index) => {
    if (index < content.childCount - 1) kept.push(child)
  })
  return Fragment.fromArray(kept)
}

function serializeParagraph(state: SerializerState, node: ProseNode): void {
  const content = withoutTrailingHardbreak(node.content)
  if (content.size === 0) {
    // `openNode` + `closeNode` without children yields an mdast paragraph with
    // no `children` field at all, and mdast-util-gfm-task-list-item reads
    // `node.children.length` on the first paragraph of a checked item — that
    // throws and the whole editor fails to start. Pass an explicit empty array.
    state.addNode('paragraph', [], void 0)
    return
  }
  state.openNode('paragraph')
  state.next(content)
  state.closeNode()
}

/** Installs the paragraph serializer; call inside `editor.config()` before create. */
export function patchParagraphSerialization(ctx: Ctx): void {
  ctx.update(nodesCtx, (nodes) =>
    nodes.map(([id, schema]) => {
      if (id !== 'paragraph') return [id, schema]
      return [
        id,
        {
          ...schema,
          toMarkdown: { ...schema.toMarkdown, runner: serializeParagraph }
        }
      ]
    })
  )
}

/**
 * Writes links as `[text](url)` instead of the `<url>` autolink shorthand.
 *
 * A bare URL typed into the editor parses into a GFM autolink literal: a link
 * node whose text equals its href. `mdast-util-to-markdown` then prints it as
 * `<https://…>` (see its `formatLinkAsAutolink`), which polls the Markdown
 * source and surprises anyone who typed a plain URL. Turning off that shorthand
 * with `resourceLink: true` keeps the same link semantics but writes the
 * standard form, and it also normalises documents that already contain `<…>`.
 *
 * Must run inside `editor.config()`, i.e. before InitReady reads the slice.
 */
export function patchLinkSerialization(ctx: Ctx): void {
  ctx.update(remarkStringifyOptionsCtx, (options) => ({ ...options, resourceLink: true }))
}
