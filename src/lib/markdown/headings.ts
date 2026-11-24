// MARK#EZVE.COM
import { splitFrontmatter } from './frontmatter'

/** A heading found in the Markdown source, in document order. */
export interface Heading {
  /** 1–6, matching `#` … `######`. */
  level: number
  text: string
  /** Zero-based line number inside the whole file (front matter included). */
  line: number
  /** Position among headings only — used to sync editor and source view. */
  index: number
}

export const GOTO_HEADING_EVENT = 'mark-drawer:goto-heading'

const ATX = /^(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/
const FENCE = /^[ \t]*(`{3,}|~{3,})/

/**
 * Collects the headings of a Markdown document for the outline panel.
 *
 * Only ATX headings (`## title`) outside fenced code blocks count, and the
 * block order matches the editor's heading order, so a heading's `index` can
 * be used to scroll either view.
 */
export function extractHeadings(markdown: string): Heading[] {
  const { frontmatter } = splitFrontmatter(markdown)
  // Front matter is skipped, but its lines still shift the line numbers of
  // everything after it, so start counting where the body starts.
  const offset = frontmatter ? frontmatter.split(/\r?\n/).length - 1 : 0
  const body = frontmatter ? markdown.slice(frontmatter.length) : markdown
  const lines = body.split(/\r?\n/)

  const headings: Heading[] = []
  let fence: string | null = null

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const marker = FENCE.exec(line)
    if (marker) {
      const token = marker[1][0]
      if (!fence) fence = token
      else if (fence === token) fence = null
      continue
    }
    if (fence) continue

    const match = ATX.exec(line)
    if (!match) continue
    const text = match[2].replace(/\s+/g, ' ').trim()
    if (!text) continue
    headings.push({
      level: match[1].length,
      text,
      line: i + offset,
      index: headings.length
    })
  }
  return headings
}

/** Asks the active editor to scroll to the heading with this index. */
export function requestHeading(index: number): void {
  window.dispatchEvent(new CustomEvent(GOTO_HEADING_EVENT, { detail: { index } }))
}
