// MARK#EZVE.COM
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { frontmatterHtml, splitFrontmatter } from '../markdown/frontmatter'
import { renderMermaidSvg } from '../mermaid'

const CALLOUT_LABEL: Record<string, string> = {
  note: '注意',
  tip: '提示',
  warning: '警告',
  danger: '危险',
  info: '信息',
  success: '完成'
}

/**
 * Turns GFM-style callouts (`> [!TIP] title`) into
 * `<div class="callout callout-tip">` while keeping the body as markdown.
 * Only plain-text titles are supported in this scaffold.
 */
function remarkCallout() {
  return (tree: unknown) => {
    visit(tree, 'blockquote', (node: any) => {
      const first = node.children?.[0]
      if (!first || first.type !== 'paragraph' || !first.children?.length) return
      const head = first.children[0]
      if (head.type !== 'text') return
      const match =
        /^\[!(NOTE|TIP|WARNING|DANGER|INFO|SUCCESS)\]\s*([^\n]*)\n?/i.exec(head.value)
      if (!match) return

      const kind = match[1].toLowerCase()
      const title = match[2].trim() || CALLOUT_LABEL[kind] || match[1]
      head.value = head.value.slice(match[0].length)
      if (head.value === '') first.children.shift()
      if (first.children.length === 0) node.children.shift()

      node.children.unshift({
        type: 'paragraph',
        data: { hProperties: { className: ['callout-title'] } },
        children: [{ type: 'text', value: title }]
      })
      node.data = {
        ...(node.data ?? {}),
        hName: 'div',
        hProperties: { className: ['callout', `callout-${kind}`] }
      }
    })
  }
}

/**
 * Task lists: GFM renders `[ ]` / `[x]` as a checkbox input, but `[~]` has no
 * GFM meaning and arrives as literal text. Strip the marker and tag the item so
 * the export theme can draw the in-progress state.
 */
function remarkTaskStatus() {
  return (tree: unknown) => {
    visit(tree, 'listItem', (node: any) => {
      const paragraph = node.children?.[0]
      const text = paragraph?.type === 'paragraph' ? paragraph.children?.[0] : undefined
      const classes = ['task-list-item']

      if (node.checked === true) {
        classes.push('task-done')
      } else if (node.checked === false) {
        classes.push('task-todo')
      } else if (text?.type === 'text') {
        const doing = /^\[~\]\s?/.exec(text.value)
        const empty = doing ? null : /^\[([ xX])\]\s*$/.exec(text.value)
        if (doing) {
          text.value = text.value.slice(doing[0].length)
          if (text.value === '') paragraph.children.shift()
          classes.push('task-doing')
        } else if (empty) {
          // `- [ ] ` / `- [x] ` (marker alone) is not a GFM task item, so the
          // marker arrives as plain text; see editor/task-list.ts. No checkbox
          // input is generated for these, hence the extra `task-empty` class
          // that draws the box in CSS instead.
          paragraph.children.shift()
          classes.push('task-empty')
          classes.push(empty[1].toLowerCase() === 'x' ? 'task-done' : 'task-todo')
        } else {
          return
        }
      } else {
        return
      }

      node.data = {
        ...(node.data ?? {}),
        hProperties: { className: classes }
      }
    })

    // mdast-util-to-hast only marks lists whose items carry a boolean
    // `checked`; a list made purely of rescued empty markers needs it too.
    visit(tree, 'list', (node: any) => {
      const children: any[] = node.children ?? []
      const isTask = children.some((child) =>
        (child?.data?.hProperties?.className ?? []).includes('task-list-item')
      )
      if (!isTask) return
      const current: string[] = node.data?.hProperties?.className ?? []
      if (current.includes('contains-task-list')) return
      node.data = {
        ...(node.data ?? {}),
        hProperties: {
          ...(node.data?.hProperties ?? {}),
          className: [...current, 'contains-task-list']
        }
      }
    })
  }
}

export async function renderMarkdown(markdown: string): Promise<string> {
  // YAML front matter is metadata, not document text: render it as a property
  // card instead of letting the Markdown parser turn the fences into rules.
  const { frontmatter, body } = splitFrontmatter(markdown)
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkCallout)
    .use(remarkTaskStatus)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeKatex)
    // Token classes (`hljs-*`) are coloured by the export theme's `--tok-*`
    // palette, the same one the editor uses.
    .use(rehypeHighlight, { detect: false, ignoreMissing: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(body)
  return frontmatterHtml(frontmatter) + String(file)
}

/** Replaces mermaid code blocks with rendered SVG. Browser-only. */
export async function renderMermaid(html: string, dark = false): Promise<string> {
  if (!html.includes('language-mermaid')) return html
  const container = document.createElement('div')
  container.innerHTML = html
  const blocks = [...container.querySelectorAll('code.language-mermaid')]
  if (!blocks.length) return html

  for (const block of blocks) {
    const source = block.textContent ?? ''
    if (!source.trim()) continue
    try {
      const svg = await renderMermaidSvg(source, dark)
      const wrapper = document.createElement('div')
      wrapper.className = 'mermaid-diagram'
      wrapper.innerHTML = svg
      block.closest('pre')?.replaceWith(wrapper)
    } catch {
      // Keep the original code block so the reader can still see the source.
      block.parentElement?.classList.add('mermaid-error')
    }
  }
  return container.innerHTML
}

/** Drawer-relative asset references used by images in the document. */
export function collectAssetPaths(markdown: string): string[] {
  const found = new Set<string>()
  const candidates: string[] = []

  const imageRe = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g
  for (const match of markdown.matchAll(imageRe)) candidates.push(match[1])

  const htmlImgRe = /<img[^>]+src\s*=\s*["']([^"']+)["']/gi
  for (const match of markdown.matchAll(htmlImgRe)) candidates.push(match[1])

  for (const candidate of candidates) {
    const path = candidate.replace(/^\.\//, '')
    if (/^(https?:|data:|mailto:|#)/i.test(path)) continue
    found.add(path)
  }
  return [...found]
}
