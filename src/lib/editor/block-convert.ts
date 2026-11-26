// MARK#EZVE.COM
import {
  Fragment,
  NodeRange,
  type Attrs,
  type Node as ProseNode,
  type NodeType,
  type ResolvedPos
} from '@milkdown/kit/prose/model'
import type { EditorView } from '@milkdown/kit/prose/view'
import { TextSelection, type Transaction } from '@milkdown/kit/prose/state'
import { findWrapping } from '@milkdown/kit/prose/transform'

/**
 * Block-type conversion shared by the 格式 menu and the format shortcuts.
 *
 * The prosemirror commands we used to call (WrapInHeading / CreateCodeBlock /
 * WrapInBulletList / WrapInBlockquote) are honest about their limits, but the
 * limits show up as nothing happening at all:
 *
 * - a list item's paragraph cannot be replaced by a heading or a code block
 *   (`list_item` requires a leading paragraph), so the command returns false;
 * - two list types cannot be swapped by wrapping, so 有序 → 无序 is a no-op;
 * - `Transform.setBlockType` deletes inline nodes the target does not accept
 *   (`clearIncompatible`), so a formula or an image vanished when a paragraph
 *   became a code block.
 *
 * This module fills those gaps instead of silently giving up: unsupported
 * inline atoms are first replaced by their Markdown source, and a block that
 * sits inside a list item is lifted out of the list before it changes type.
 */

/** Placeholder used when an inline atom has no textual form of its own. */
function inlineSource(node: ProseNode): string {
  const attrs = node.attrs as Record<string, unknown>
  switch (node.type.name) {
    case 'math_inline':
      return `$${String(attrs.value ?? node.textContent)}$`
    case 'image': {
      const alt = String(attrs.alt ?? '')
      const src = String(attrs.src ?? '')
      const title = attrs.title ? ` "${String(attrs.title)}"` : ''
      return `![${alt}](${src}${title})`
    }
    case 'math_block':
      return `$$\n${String(attrs.value ?? node.textContent)}\n$$`
    case 'footnote_reference':
      return `[^${String(attrs.label ?? '')}]`
    case 'html':
      return String(attrs.value ?? node.textContent)
    case 'hardbreak':
      return '\n'
    default:
      return node.textContent
  }
}

const ListTypes = new Set(['bullet_list', 'ordered_list'])

/** Depth of the nearest enclosing list node, or 0 when there is none. */
function listDepth($pos: ResolvedPos): number {
  for (let depth = $pos.depth; depth > 0; depth--) {
    if (ListTypes.has($pos.node(depth).type.name)) return depth
  }
  return 0
}

/**
 * Replaces the list holding `$pos` with `[leading list?, the block itself,
 * trailing list?]`, so the block becomes a top-level sibling and can change
 * type. Returns the block's new position, or null when this selection is not a
 * simple single-block list item (then the caller keeps the old behaviour).
 *
 * The caret is carried over: replacing the whole list would otherwise drop it
 * to the end of the replacement.
 */
function liftOutOfList(tr: Transaction, $pos: ResolvedPos): number | null {
  const depth = listDepth($pos)
  if (!depth) return null
  // Only the item's leading textblock can be lifted on its own; anything
  // deeper (a nested list inside the item) is left to the caller.
  if ($pos.depth !== depth + 2 || !$pos.parent.isTextblock) return null
  if ($pos.index(depth + 1) !== 0) return null

  const list = $pos.node(depth)
  const itemIndex = $pos.index(depth)
  const item = list.child(itemIndex)
  const listPos = $pos.before(depth)

  const blocks: ProseNode[] = []
  const leadingItems: ProseNode[] = []
  for (let index = 0; index < itemIndex; index++) leadingItems.push(list.child(index))
  const leading = leadingItems.length
    ? list.type.create(list.attrs, Fragment.fromArray(leadingItems))
    : null
  if (leading) blocks.push(leading)
  blocks.push(item.child(0))

  // Whatever followed the leading block inside the item stays in the list, as
  // a one-item list after the lifted block.
  const restItems: ProseNode[] = []
  item.forEach((child, _offset, index) => {
    if (index > 0) restItems.push(child)
  })
  if (restItems.length) {
    // `list_item` requires a leading paragraph, so a tail without one gets an
    // empty paragraph in front of it.
    if (!restItems[0].isTextblock) {
      restItems.unshift(item.type.schema.nodes.paragraph.create())
    }
    const tailItem = item.type.create(item.attrs, Fragment.fromArray(restItems))
    blocks.push(list.type.create(list.attrs, Fragment.from(tailItem)))
  }

  const trailingItems: ProseNode[] = []
  for (let index = itemIndex + 1; index < list.childCount; index++) {
    trailingItems.push(list.child(index))
  }
  if (trailingItems.length) {
    blocks.push(list.type.create(list.attrs, Fragment.fromArray(trailingItems)))
  }

  const offsetInBlock = $pos.pos - $pos.start($pos.depth)
  tr.replaceWith(listPos, listPos + list.nodeSize, Fragment.fromArray(blocks))
  const blockPos = listPos + (leading ? leading.nodeSize : 0)
  const block = tr.doc.nodeAt(blockPos)
  if (block) {
    const caret = Math.min(blockPos + 1 + offsetInBlock, blockPos + block.nodeSize - 1)
    tr.setSelection(TextSelection.create(tr.doc, caret))
  }
  return blockPos
}

/**
 * Replaces inline nodes the target type cannot hold with their Markdown text.
 * Without this, `setBlockType` deletes them (a paragraph with `$E=mc^2$` turned
 * into a code block lost the formula).
 */
function preserveInline(tr: Transaction, blockPos: number, type: NodeType): void {
  const block = tr.doc.nodeAt(blockPos)
  if (!block) return
  const edits: Array<{ from: number; to: number; text: string }> = []
  let offset = blockPos + 1
  block.forEach((child) => {
    const accepted = child.isText || type.contentMatch.matchType(child.type)
    if (!accepted) {
      edits.push({ from: offset, to: offset + child.nodeSize, text: inlineSource(child) })
    }
    offset += child.nodeSize
  })
  // Back to front so the earlier offsets stay valid.
  for (let index = edits.length - 1; index >= 0; index--) {
    const edit = edits[index]
    const textNode = edit.text ? tr.doc.type.schema.text(edit.text) : null
    if (textNode) tr.replaceWith(edit.from, edit.to, textNode)
    else tr.delete(edit.from, edit.to)
  }
}

/**
 * 段落 / 标题 1–6 / 代码块: applies `attrs` to the block under the caret.
 *
 * Inside a list item the item is lifted out of the list first, so the text
 * follows the conversion instead of the command silently failing.
 */
export function convertTextblock(
  view: EditorView,
  typeName: 'paragraph' | 'heading' | 'code_block',
  attrs: Attrs | null = null
): boolean {
  const { state } = view
  const type = state.schema.nodes[typeName]
  if (!type) return false
  const { $from } = state.selection
  if (!$from.parent.isTextblock) return false

  const tr = state.tr
  const blockPos = liftOutOfList(tr, $from) ?? ($from.depth ? $from.before($from.depth) : null)
  if (blockPos == null) return false

  preserveInline(tr, blockPos, type)

  const block = tr.doc.nodeAt(blockPos)
  if (!block || !block.isTextblock) return false
  if (!block.hasMarkup(type, attrs)) {
    // `Transform.setBlockType` ignores the node when the parent refuses the
    // type; then `docChanged` stays false and we report "not handled".
    tr.setBlockType(blockPos, blockPos + block.nodeSize, type, attrs)
  }
  if (!tr.docChanged) return false
  view.dispatch(tr.scrollIntoView())
  return true
}

/**
 * 无序列表 / 有序列表: changes the list that holds the caret, keeping its
 * items. Outside a list this does nothing — the caller wraps a paragraph into a
 * fresh list instead.
 *
 * Swapping only the list node is not enough. `list_item` carries its own
 * `listType` + `label`, and Milkdown's `syncListOrderPlugin` runs after every
 * transaction and turns a `bullet_list` whose first item still says
 * `listType: 'ordered'` back into an `ordered_list`. That is why the previous
 * `setNodeMarkup` swap reported success while the document stayed unchanged.
 * The items are therefore rebuilt with matching attrs in the same transaction.
 */
export function changeListType(view: EditorView, typeName: 'bullet_list' | 'ordered_list'): boolean {
  const { state } = view
  const type = state.schema.nodes[typeName]
  if (!type) return false
  const { $from } = state.selection
  const depth = listDepth($from)
  if (!depth) return false
  const list = $from.node(depth)
  if (list.type === type) return false

  const ordered = typeName === 'ordered_list'
  const items: ProseNode[] = []
  for (let index = 0; index < list.childCount; index++) {
    const item = list.child(index)
    if (item.type.name !== 'list_item') return false
    items.push(
      item.type.create(
        {
          ...item.attrs,
          listType: ordered ? 'ordered' : 'bullet',
          label: ordered ? `${index + (Number(list.attrs.order) || 1)}.` : '•'
        },
        item.content
      )
    )
  }
  if (!items.length) return false

  const pos = $from.before(depth)
  const offsetInList = $from.pos - pos
  const replacement = type.create(
    ordered ? { order: Number(list.attrs.order) || 1, spread: list.attrs.spread } : { spread: list.attrs.spread },
    Fragment.fromArray(items)
  )
  try {
    const tr = state.tr.replaceWith(pos, pos + list.nodeSize, replacement)
    if (!tr.docChanged) return false
    // Same shape, same size: the caret keeps its offset inside the list.
    const caret = Math.min(pos + offsetInList, pos + replacement.nodeSize - 1)
    tr.setSelection(TextSelection.near(tr.doc.resolve(caret)))
    view.dispatch(tr.scrollIntoView())
    return true
  } catch {
    // Content the new type cannot hold; the caller falls back to wrapping.
    return false
  }
}

/** 引用: wraps the block(s) under the selection, lifting a list item first. */
export function wrapInBlockquote(view: EditorView): boolean {
  const { state } = view
  const type = state.schema.nodes.blockquote
  if (!type) return false
  const { $from, $to } = state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type === type) return false
  }

  const tr = state.tr
  const lifted = liftOutOfList(tr, $from)
  if (lifted == null && listDepth($from)) return false

  let range: NodeRange | null
  if (lifted != null) {
    const block = tr.doc.nodeAt(lifted)
    if (!block) return false
    range = new NodeRange(
      tr.doc.resolve(lifted + 1),
      tr.doc.resolve(lifted + block.nodeSize - 1),
      0
    )
  } else {
    range = $from.blockRange($to)
  }
  if (!range) return false
  const wrapping = findWrapping(range, type)
  if (!wrapping) return false
  tr.wrap(range, wrapping)
  if (!tr.docChanged) return false
  view.dispatch(tr.scrollIntoView())
  return true
}
