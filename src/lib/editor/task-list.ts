// MARK#EZVE.COM
import { listItemBlockConfig } from '@milkdown/kit/component/list-item-block'
import { nodesCtx, remarkPluginsCtx } from '@milkdown/kit/core'
import type { Ctx } from '@milkdown/kit/ctx'
import { Fragment, type Node as ProseNode, type NodeType } from '@milkdown/kit/prose/model'
import { InputRule } from '@milkdown/kit/prose/inputrules'
import type { EditorView } from '@milkdown/kit/prose/view'
import type {
  MarkdownNode,
  NodeSchema,
  ParserState,
  SerializerState
} from '@milkdown/kit/transformer'
import { visit } from 'unist-util-visit'
import { $inputRule } from '@milkdown/kit/utils'

/**
 * Task lists carry three states: todo (`[ ]`), doing (`[~]`) and done (`[x]`).
 *
 * GFM only models a boolean checkbox, so `[~]` reaches the parser as ordinary
 * paragraph text. The list_item patch below recognises the marker on the way in
 * and writes it back on the way out; while editing the state lives in
 * `list_item.attrs.checked` as the string `'doing'`.
 */
export type TaskStatus = null | false | 'doing' | true

/** Marker plus its separating space, at the very start of the first paragraph. */
const DOING_MARKER = /^\[~\]\s?/
const DOING_PREFIX = '[~] '

/** Half-filled circle, visually between Crepe's empty and ticked boxes. */
const DOING_ICON = '<span class="mk-task-doing" aria-hidden="true">◐</span>'

/**
 * `- [ ] ` with nothing after the marker is *not* a GFM task item: micromark's
 * task-list syntax needs a non-space character after `]`. Templates use those
 * empty checkboxes as placeholders, so rescue them here — the paragraph holding
 * nothing but `[ ]` / `[x]` becomes a real checked/unchecked item.
 *
 * This runs on parse only: the serializer calls `remark.stringify` without the
 * transformer chain (`@milkdown/transformer` SerializerState.toString), so the
 * markers written back stay exactly as the reader typed them.
 */
function remarkEmptyTaskMarker() {
  return (tree: unknown) => {
    visit(tree, 'listItem', (node: any) => {
      if (node.checked != null) return
      const paragraph = node.children?.[0]
      const text = paragraph?.children?.[0]
      if (paragraph?.type !== 'paragraph' || text?.type !== 'text') return
      const match = /^\[([ xX])\]\s*$/.exec(text.value)
      if (!match) return
      node.checked = match[1].toLowerCase() === 'x'
      paragraph.children.shift()
    })
  }
}

function itemAttrs(node: MarkdownNode, checked: TaskStatus) {
  const ordered = node.label != null
  return {
    label: ordered ? `${String(node.label)}.` : '•',
    listType: ordered ? 'ordered' : 'bullet',
    spread: typeof node.spread === 'boolean' ? node.spread : true,
    checked
  }
}

/** Reads `[~] text` back into `checked: 'doing'`; everything else is GFM's. */
function parseTaskItem(
  base: NodeSchema['parseMarkdown'],
  state: ParserState,
  node: MarkdownNode,
  type: NodeType
): void {
  const children = (node.children ?? []) as MarkdownNode[]
  const paragraph = children[0]
  const text = paragraph?.children?.[0] as MarkdownNode | undefined
  if (
    node.checked != null ||
    paragraph?.type !== 'paragraph' ||
    text?.type !== 'text' ||
    typeof text.value !== 'string'
  ) {
    base.runner(state, node, type)
    return
  }
  const match = DOING_MARKER.exec(text.value)
  if (!match) {
    base.runner(state, node, type)
    return
  }
  const rest = text.value.slice(match[0].length)
  const inline = paragraph.children ?? []
  const patched: MarkdownNode = {
    ...paragraph,
    children: rest ? [{ ...text, value: rest }, ...inline.slice(1)] : inline.slice(1)
  }
  state.openNode(type, itemAttrs(node, 'doing'))
  state.next([patched, ...children.slice(1)])
  state.closeNode()
}

/** Writes `- [~] text`: the marker stays text, never a GFM checkbox. */
function serializeTaskItem(
  base: NodeSchema['toMarkdown'],
  state: SerializerState,
  node: ProseNode
): void {
  const first = node.content.firstChild
  if (node.attrs.checked !== 'doing' || !first || first.type.name !== 'paragraph') {
    base.runner(state, node)
    return
  }
  const inline: ProseNode[] = [first.type.schema.text(DOING_PREFIX)]
  first.content.forEach((child) => inline.push(child))
  const block: ProseNode[] = [
    first.type.create(first.attrs, Fragment.fromArray(inline), first.marks)
  ]
  node.content.forEach((child, _offset, index) => {
    if (index > 0) block.push(child)
  })
  // No `checked` here on purpose: GFM would print a checkbox, and `[~]` is not
  // one — the marker travels inside the paragraph text instead.
  state.openNode('listItem', void 0, {
    label: node.attrs.label,
    listType: node.attrs.listType,
    spread: node.attrs.spread
  })
  state.next(Fragment.fromArray(block))
  state.closeNode()
}

/** Keeps `data-checked="doing"` intact when content is copied or reparsed. */
function patchParseDOM(schema: NodeSchema): NodeSchema['parseDOM'] {
  const rules = schema.parseDOM ?? []
  return rules.map((rule) => {
    if (rule.tag !== 'li[data-item-type="task"]') return rule
    return {
      ...rule,
      getAttrs: (dom: HTMLElement | string) => {
        if (!(dom instanceof HTMLElement)) return false
        const raw = dom.dataset.checked
        const checked: TaskStatus =
          raw == null || raw === ''
            ? null
            : raw === 'true'
              ? true
              : raw === 'false'
                ? false
                : 'doing'
        return {
          label: dom.dataset.label,
          listType: dom.dataset.listType,
          spread: dom.dataset.spread === 'true',
          checked
        }
      }
    }
  })
}

/**
 * Replaces the GFM list_item parse/serialize runners. Runs inside
 * `editor.config()` so it sees the schema already extended by preset-gfm.
 */
export function patchTaskList(ctx: Ctx): void {
  ctx.update(remarkPluginsCtx, (plugins) => [
    ...plugins,
    { plugin: remarkEmptyTaskMarker, options: {} }
  ])
  ctx.update(nodesCtx, (nodes) =>
    nodes.map(([id, schema]): [string, NodeSchema] => {
      if (id !== 'list_item') return [id, schema]
      const baseParse = schema.parseMarkdown
      const baseSerialize = schema.toMarkdown
      return [
        id,
        {
          ...schema,
          // preset-gfm validates `checked` as boolean|null; `'doing'` is ours.
          attrs: {
            ...schema.attrs,
            checked: {
              default: null,
              validate: (value: unknown) =>
                value === null || value === 'doing' || typeof value === 'boolean'
            }
          },
          parseDOM: patchParseDOM(schema),
          parseMarkdown: {
            match: baseParse.match,
            runner: (state, node, type) => parseTaskItem(baseParse, state, node, type)
          },
          toMarkdown: {
            match: baseSerialize.match,
            runner: (state, node) => serializeTaskItem(baseSerialize, state, node)
          }
        }
      ]
    })
  )
}

/** Draws the doing marker; todo and done keep Crepe's own icons. */
export function patchTaskListRendering(ctx: Ctx): void {
  ctx.update(listItemBlockConfig.key, (config) => ({
    ...config,
    renderLabel: (props) => {
      if ((props.checked as unknown) === 'doing') return DOING_ICON
      return config.renderLabel(props)
    }
  }))
}

/** Typing `- [~] ` switches the current list item to “doing”. */
export const taskDoingInputRule = $inputRule(
  () =>
    new InputRule(/^\[~\]\s$/, (state, _match, start, end) => {
      const $pos = state.doc.resolve(start)
      let depth = 0
      let node = $pos.node(depth)
      while (node && node.type.name !== 'list_item') {
        depth -= 1
        node = $pos.node(depth)
      }
      if (!node || node.attrs.checked != null) return null
      const tr = state.tr
      tr.deleteRange(start, end).setNodeMarkup($pos.before(depth), undefined, {
        ...node.attrs,
        checked: 'doing' as TaskStatus
      })
      return tr
    })
)

function listItemPos(view: EditorView, dom: HTMLElement): number | null {
  let pos: number
  try {
    pos = view.posAtDOM(dom, 0)
  } catch {
    return null
  }
  if (view.state.doc.nodeAt(pos)?.type.name === 'list_item') return pos
  const $pos = view.state.doc.resolve(pos)
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.name === 'list_item') return $pos.before(depth)
  }
  return null
}

/**
 * Capture-phase click on a “doing” checkbox. Crepe toggles `!checked`, which
 * would turn doing back into todo; here it means “finished” instead.
 */
export function handleTaskPointerDown(view: EditorView, event: PointerEvent): boolean {
  const target = event.target
  if (!(target instanceof Element) || !target.closest('.label-wrapper')) return false
  const block = target.closest('.milkdown-list-item-block')
  if (!(block instanceof HTMLElement)) return false
  const pos = listItemPos(view, block)
  if (pos == null) return false
  const node = view.state.doc.nodeAt(pos)
  if (!node || node.type.name !== 'list_item' || node.attrs.checked !== 'doing') return false
  event.preventDefault()
  event.stopPropagation()
  view.dispatch(view.state.tr.setNodeAttribute(pos, 'checked', true))
  return true
}

/**
 * Cycles the list item at the cursor: plain/⁠todo → doing → done → todo.
 * Returns false when the cursor is not inside a list item.
 */
export function cycleTaskStatus(view: EditorView): boolean {
  const { $from, empty } = view.state.selection
  const from = empty ? $from : view.state.selection.$to
  for (let depth = from.depth; depth > 0; depth -= 1) {
    const node = from.node(depth)
    if (node.type.name !== 'list_item') continue
    const current = node.attrs.checked as TaskStatus
    const next: TaskStatus =
      current == null ? false : current === false ? 'doing' : current === 'doing' ? true : false
    view.dispatch(view.state.tr.setNodeAttribute(from.before(depth), 'checked', next))
    return true
  }
  return false
}
