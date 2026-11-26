// MARK#EZVE.COM

/**
 * Keeps the Markdown source clean of WYSIWYG artefacts.
 *
 * The editor serializes its document to Markdown on every change. Older builds
 * wrote empty paragraphs as `<br />` (a Milkdown placeholder), which polluted
 * `.md` files with HTML. The serializer patch in `editor/serializer.ts` stops
 * that at the source; this pass cleans documents saved by older builds and
 * reports anything else that looks editor-generated so a new path cannot slip
 * through unnoticed.
 */

/** A block that only holds the empty-paragraph placeholder. */
const PLACEHOLDER_LINE = /^[ \t]*<br\s*\/?>[ \t]*\r?$/i

/** Wrappers a WYSIWYG editor might emit around ordinary text. */
const EDITOR_WRAPPER = /^[ \t]*<\/?(?:p|div|span|section|article)\b/i

export interface NormalizedMarkdown {
  markdown: string
  /** Human-readable `line: text` entries for unexpected editor HTML. */
  warnings: string[]
}

export function normalizeEditorMarkdown(markdown: string): NormalizedMarkdown {
  if (!markdown.includes('<')) return { markdown, warnings: [] }

  const lines = markdown.split('\n')
  const kept: string[] = []
  const warnings: string[] = []
  let changed = false

  lines.forEach((line, index) => {
    if (PLACEHOLDER_LINE.test(line)) {
      changed = true
      return
    }
    if (EDITOR_WRAPPER.test(line)) warnings.push(`${index + 1}: ${line.trim()}`)
    kept.push(line)
  })

  if (warnings.length > 0 && import.meta.env.DEV) {
    console.warn(
      '[mark-drawer] 编辑器在 Markdown 源码中产生了 HTML，请检查序列化：',
      warnings.slice(0, 10)
    )
  }

  return { markdown: changed ? kept.join('\n') : markdown, warnings }
}
