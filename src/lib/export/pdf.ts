// MARK#EZVE.COM
export interface PageRange {
  mode: 'all' | 'range'
  from: number
  to: number
}

export interface PdfOptions {
  pageStart: number
  range: PageRange
}

export interface PaginatedDocument {
  total: number
  /** inner HTML of each A4 content page */
  pages: string[]
  /** styles collected from the exported document */
  styles: string
}

export interface PdfPrintResult {
  printed: number
  total: number
}

const PAGE_W = 794 // A4 @96dpi
const PAGE_H = 1123

/** Printed typography and page box, read from the active theme's CSS vars. */
export interface PrintLayout {
  contentWidth: number
  contentHeight: number
  fontFamily: string
  fontSize: number
  lineHeight: number
}

const FALLBACK_LAYOUT: PrintLayout = {
  contentWidth: 794 - 60 * 2,
  contentHeight: 1123 - 68 - 76,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  fontSize: 14,
  lineHeight: 28
}

function measureLength(prop: string, fallback: string): number {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:absolute;left:-99999px;top:0;height:0;visibility:hidden;pointer-events:none;' +
    `width: var(${prop}, ${fallback});`
  document.body.appendChild(probe)
  const width = probe.getBoundingClientRect().width
  probe.remove()
  return width > 0 ? width : 0
}

/**
 * Themes may change printed typography and margins (`--mk-print-*`), so the
 * page box is measured instead of hard-coded. Measurement and printing must
 * use the same font metrics, otherwise blocks land on the wrong page.
 */
export function measurePrintLayout(): PrintLayout {
  if (typeof document === 'undefined') return { ...FALLBACK_LAYOUT }

  const top = measureLength('--mk-print-margin-top', '18mm')
  const right = measureLength('--mk-print-margin-right', '16mm')
  const bottom = measureLength('--mk-print-margin-bottom', '20mm')
  const left = measureLength('--mk-print-margin-left', '16mm')

  const probe = document.createElement('div')
  probe.style.cssText =
    'position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none;white-space:nowrap;'
  probe.style.fontFamily = 'var(--mk-print-font, system-ui, sans-serif)'
  probe.style.fontSize = 'var(--mk-print-font-size, 10.5pt)'
  probe.style.lineHeight = 'var(--mk-print-line-height, 1.7)'
  probe.textContent = 'M'
  document.body.appendChild(probe)
  const computed = getComputedStyle(probe)
  const fontSize = Number.parseFloat(computed.fontSize) || FALLBACK_LAYOUT.fontSize
  const lineHeight =
    Number.parseFloat(computed.lineHeight) || fontSize * 1.7
  const fontFamily = computed.fontFamily || FALLBACK_LAYOUT.fontFamily
  probe.remove()

  const contentWidth = PAGE_W - (left || 60) - (right || 60)
  const contentHeight = PAGE_H - (top || 68) - (bottom || 76)
  if (contentWidth <= 0 || contentHeight <= 0) return { ...FALLBACK_LAYOUT }

  return { contentWidth, contentHeight, fontFamily, fontSize, lineHeight }
}

/**
 * Packs exported HTML into A4 pages by measuring real layout in a hidden
 * shadow root. Blocks are atomic (a block taller than a page is clipped),
 * which keeps the result predictable for typical notes.
 */
export async function paginateHtml(html: string): Promise<PaginatedDocument> {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const styles = [...parsed.querySelectorAll('style')]
    .map((style) => style.textContent ?? '')
    .join('\n')
  const source = parsed.querySelector('.mark-drawer-doc')
  const content = source ? source.innerHTML : parsed.body.innerHTML
  const layout = measurePrintLayout()

  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${layout.contentWidth}px;visibility:hidden;font-size:${layout.fontSize}px;line-height:${layout.lineHeight}px;color:#1f2328;`
  const shadow = host.attachShadow({ mode: 'closed' })
  // Guards the inline <style> against a malformed custom font stack.
  const safeFamily = layout.fontFamily.replace(/[\\{};<>]/g, '')
  shadow.innerHTML = `<style>${styles}
.mark-drawer-doc.stage, .mark-drawer-doc.page-measure {
  max-width: none; margin: 0; padding: 0; width: ${layout.contentWidth}px;
  font-size: ${layout.fontSize}px; line-height: ${layout.lineHeight}px;
  font-family: ${safeFamily};
}</style><div class="mark-drawer-doc stage"></div>`
  document.body.appendChild(host)

  try {
    const stage = shadow.querySelector('.stage') as HTMLElement
    stage.innerHTML = content

    const images = [...shadow.querySelectorAll('img')]
    await Promise.all(
      images.map(
        (image) =>
          new Promise<void>((resolve) => {
            if (image.complete) return resolve()
            image.addEventListener('load', () => resolve(), { once: true })
            image.addEventListener('error', () => resolve(), { once: true })
          })
      )
    )
    await document.fonts?.ready

    const pages: HTMLElement[] = []
    const newPage = (): HTMLElement => {
      const page = document.createElement('div')
      page.className = 'mark-drawer-doc page-measure'
      shadow.appendChild(page)
      pages.push(page)
      return page
    }

    let current = newPage()
    for (const child of Array.from(stage.children)) {
      current.appendChild(child)
      if (current.scrollHeight > layout.contentHeight && current.children.length > 1) {
        current.removeChild(child)
        current = newPage()
        current.appendChild(child)
      }
    }
    if (current.children.length === 0 && pages.length > 1) {
      current.remove()
      pages.pop()
    }

    return {
      total: pages.length,
      pages: pages.map((page) => page.innerHTML),
      styles
    }
  } finally {
    host.remove()
  }
}

export function buildPrintHtml(
  paginated: PaginatedDocument,
  options: PdfOptions
): { html: string; printed: number } {
  const total = paginated.total
  if (total === 0) throw new Error('文档没有可打印的内容')

  let from = 1
  let to = total
  if (options.range.mode === 'range') {
    from = Math.max(1, Math.min(options.range.from, total))
    to = Math.max(1, Math.min(options.range.to, total))
    if (from > to) throw new Error('页码范围无效：起始页不能大于结束页')
  }

  const start = Math.max(1, options.pageStart)
  const pages: string[] = []
  for (let index = from - 1; index < to; index += 1) {
    const number = start + index
    pages.push(
      `<section class="mark-drawer-doc print-page">${paginated.pages[index]}` +
        `<footer class="print-footer">${number}</footer></section>`
    )
  }

  const printCss = `
@page { size: A4; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
.print-page {
  width: 210mm; height: 297mm; box-sizing: border-box;
  padding: var(--mk-print-margin-top, 18mm) var(--mk-print-margin-right, 16mm)
    var(--mk-print-margin-bottom, 20mm) var(--mk-print-margin-left, 16mm);
  position: relative; overflow: hidden; background: #fff;
  font-family: var(--mk-print-font, system-ui, sans-serif);
  font-size: var(--mk-print-font-size, 10.5pt);
  line-height: var(--mk-print-line-height, 1.7);
  break-after: page; page-break-after: always;
}
.print-page:last-child { break-after: auto; page-break-after: auto; }
.print-page.mark-drawer-doc { max-width: none; margin: 0; }
.print-footer {
  position: absolute; left: 0; right: 0; bottom: 8mm;
  text-align: center; font-size: 9.5pt; color: var(--mk-print-muted, #666);
}
`

  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" />
<style>${paginated.styles}</style><style>${printCss}</style></head>
<body>${pages.join('')}</body></html>`
  return { html, printed: to - from + 1 }
}

/** Prints the selected A4 pages through the WebView print dialog. */
export async function printHtml(
  html: string,
  options: PdfOptions
): Promise<PdfPrintResult> {
  const paginated = await paginateHtml(html)
  const { html: printHtmlSource, printed } = buildPrintHtml(paginated, options)

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  iframe.srcdoc = printHtmlSource

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve()
    document.body.appendChild(iframe)
  })

  try {
    const target = iframe.contentWindow
    if (!target) throw new Error('无法创建打印窗口')
    target.focus()
    target.print()
  } finally {
    setTimeout(() => iframe.remove(), 2000)
  }

  return { printed, total: paginated.total }
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as Window & { __markupPaginate?: typeof paginateHtml }).__markupPaginate =
    paginateHtml
}