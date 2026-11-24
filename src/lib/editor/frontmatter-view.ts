// MARK#EZVE.COM
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { FrontmatterEntry } from '../markdown/frontmatter'

export const FRONTMATTER_EVENT = 'mark-drawer:edit-frontmatter'

export interface FrontmatterViewOptions {
  /** Raw YAML body without the fences. */
  yaml: string
  entries: FrontmatterEntry[] | null
  /** Panel label, e.g. "YAML 属性". */
  label: string
  /** Small hint explaining how to edit it. */
  hint: string
  /** Button label that switches to the source view. */
  editLabel: string
}

function cardDom(options: FrontmatterViewOptions): HTMLElement {
  const card = document.createElement('div')
  card.className = 'mk-frontmatter'

  const head = document.createElement('div')
  head.className = 'mk-frontmatter-head'
  const title = document.createElement('span')
  title.className = 'mk-frontmatter-title'
  title.textContent = options.label
  head.appendChild(title)

  const edit = document.createElement('button')
  edit.type = 'button'
  edit.className = 'mk-frontmatter-edit'
  edit.textContent = options.editLabel
  edit.addEventListener('mousedown', (event) => event.preventDefault())
  edit.addEventListener('click', (event) => {
    event.preventDefault()
    window.dispatchEvent(new CustomEvent(FRONTMATTER_EVENT))
  })
  head.appendChild(edit)
  card.appendChild(head)

  if (options.entries) {
    const list = document.createElement('dl')
    list.className = 'mk-frontmatter-list'
    for (const entry of options.entries) {
      const key = document.createElement('dt')
      key.textContent = entry.key
      const value = document.createElement('dd')
      value.textContent = entry.value || '—'
      list.append(key, value)
    }
    card.appendChild(list)
  } else {
    const pre = document.createElement('pre')
    pre.className = 'mk-frontmatter-source'
    pre.textContent = options.yaml
    card.appendChild(pre)
  }

  const hint = document.createElement('div')
  hint.className = 'mk-frontmatter-hint'
  hint.textContent = options.hint
  card.appendChild(hint)

  card.contentEditable = 'false'
  return card
}

const key = new PluginKey('mark-drawer-frontmatter')

/**
 * Shows YAML front matter as a read-only property card at the top of the
 * document. The raw block itself never enters the ProseMirror document: the
 * editor is mounted with the body only and the caller re-attaches the YAML on
 * save, so rich-text round-trips cannot rewrite the user's metadata.
 */
export function frontmatterPlugin(options: FrontmatterViewOptions): Plugin {
  const decoration = (): Decoration =>
    Decoration.widget(0, () => cardDom(options), { side: -1 })

  const build = (doc: ProseNode): DecorationSet =>
    DecorationSet.create(doc, [decoration()])

  return new Plugin({
    key,
    state: {
      init: (_config, state) => build(state.doc),
      apply: (tr, set) => (tr.docChanged ? build(tr.doc) : set)
    },
    props: {
      decorations(state) {
        return key.getState(state)
      }
    }
  })
}
