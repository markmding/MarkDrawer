// MARK#EZVE.COM

/** Result of splitting a document's leading YAML front matter from its body. */
export interface FrontmatterSplit {
  /** Raw block including both `---` fences and the trailing newline, or ''. */
  frontmatter: string
  body: string
}

export interface FrontmatterEntry {
  key: string
  value: string
}

const FENCE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

/**
 * Splits leading YAML front matter from the Markdown body.
 *
 * Only a fence at the very start of the file counts, which keeps a horizontal
 * rule in the middle of a document from being mistaken for metadata. The
 * frontmatter half is returned verbatim so saving can restore it byte for byte
 * (line endings included).
 */
export function splitFrontmatter(markdown: string): FrontmatterSplit {
  const match = FENCE.exec(markdown)
  if (!match) return { frontmatter: '', body: markdown }
  return {
    frontmatter: markdown.slice(0, match[0].length),
    body: markdown.slice(match[0].length)
  }
}

/** True when the document opens with a YAML front matter block. */
export function hasFrontmatter(markdown: string): boolean {
  return FENCE.test(markdown)
}

/** Raw YAML body of a front matter block, without the `---` fences. */
export function frontmatterBody(frontmatter: string): string {
  const match = FENCE.exec(frontmatter)
  return match ? match[1] : ''
}

/**
 * Parses simple `key: value` front matter into rows for display.
 *
 * Returns null when the block uses nesting, lists or multi-line scalars —
 * callers then fall back to showing the raw YAML, which is always accurate.
 */
export function frontmatterEntries(frontmatter: string): FrontmatterEntry[] | null {
  const match = FENCE.exec(frontmatter)
  if (!match) return null
  const lines = match[1].split(/\r?\n/)
  const entries: FrontmatterEntry[] = []

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    if (/^\s/.test(line)) return null // nested mapping
    const pair = /^([^:#][^:]*?):(?:\s+(.*))?$/.exec(line)
    if (!pair) return null
    const value = (pair[2] ?? '').trim()
    if (!value || value === '|' || value === '>' || value === '[]' || value === '{}') {
      if (!value) entries.push({ key: pair[1].trim(), value: '' })
      else return null
      continue
    }
    entries.push({ key: pair[1].trim(), value: stripQuotes(value) })
  }
  return entries.length ? entries : null
}

function stripQuotes(value: string): string {
  if (value.length < 2) return value
  const first = value[0]
  const last = value[value.length - 1]
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1)
  }
  return value
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Renders front matter as a document property card for HTML/PDF export.
 * Complex YAML is shown verbatim in a code block instead of being guessed at.
 */
export function frontmatterHtml(frontmatter: string, label = 'YAML'): string {
  const match = FENCE.exec(frontmatter)
  if (!match) return ''
  const raw = match[1].trim()
  if (!raw) return ''

  const entries = frontmatterEntries(frontmatter)
  const body = entries
    ? `<dl>${entries
        .map(
          (entry) =>
            `<dt>${escapeHtml(entry.key)}</dt><dd>${
              entry.value ? escapeHtml(entry.value) : '<span class="fm-empty">—</span>'
            }</dd>`
        )
        .join('')}</dl>`
    : `<pre class="fm-source"><code>${escapeHtml(raw)}</code></pre>`

  return `<section class="doc-properties"><div class="doc-properties-title">${escapeHtml(
    label
  )}</div>${body}</section>`
}
