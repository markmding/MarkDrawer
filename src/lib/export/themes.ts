// MARK#EZVE.COM
import katexCss from 'katex/dist/katex.min.css?inline'
import { APP_VERSION, BRAND_FULL, WATERMARK, invisibleWatermark } from '../brand'

export type ExportTheme = 'light' | 'dark'

const base = `
:root {
  /* Built-in palette: One Light */
  --mk-text: #383a42;
  --mk-muted: #696c77;
  --mk-border: #dcdcdc;
  --mk-surface: #f0f0f0;
  --mk-accent: #4078f2;
  --mk-bg: #fafafa;
  --mk-code-bg: #f0f0f0;
  --mk-callout-tip: #2f7a34;
  --mk-callout-warning: #8a6100;
  --mk-callout-danger: #c0392b;
  --mk-callout-info: #0b6e99;
  --mk-callout-success: #2f7a34;
  --mk-font: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  --mk-mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  /*
   * Print contract shared with the app shell (src/app.css) and the paginator
   * (src/lib/export/pdf.ts). A theme overrides these to change printed
   * typography and page margins.
   */
  --mk-print-font: var(--mk-font);
  --mk-print-font-size: 10.5pt;
  --mk-print-line-height: 1.7;
  --mk-print-accent: #2f5fc4;
  --mk-print-muted: #555;
  --mk-print-margin-top: 18mm;
  --mk-print-margin-right: 16mm;
  --mk-print-margin-bottom: 20mm;
  --mk-print-margin-left: 16mm;
  /*
   * Syntax tokens. The app shell declares the same names in src/app.css and a
   * theme may override them; rehype-highlight output is coloured below.
   */
  --tok-comment: #a0a1a7;
  --tok-keyword: #a626a4;
  --tok-string: #50a14f;
  --tok-number: #986801;
  --tok-function: #4078f2;
  --tok-variable: #e45649;
  --tok-type: #c18401;
  --tok-operator: #0184bc;
  --tok-punctuation: #696c77;
  --tok-tag: #e45649;
  --tok-attr: #986801;
  --tok-builtin: #c18401;
  --tok-meta: #4078f2;
  --tok-invalid: #e45649;
  --tok-heading: #4078f2;
  --tok-link: #0184bc;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--mk-bg);
  color: var(--mk-text);
  font-family: var(--mk-font);
  font-size: 16px;
  line-height: 1.75;
  -webkit-font-smoothing: antialiased;
}
.mark-drawer-doc { max-width: 820px; margin: 0 auto; padding: 40px 24px 64px; }
h1, h2, h3, h4, h5, h6 { line-height: 1.3; margin: 1.6em 0 0.6em; font-weight: 650; }
h1 { font-size: 2em; padding-bottom: .3em; border-bottom: 1px solid var(--mk-border); }
h2 { font-size: 1.5em; padding-bottom: .25em; border-bottom: 1px solid var(--mk-border); }
h3 { font-size: 1.25em; }
p { margin: .9em 0; }
a { color: var(--mk-accent); text-decoration: none; }
a:hover { text-decoration: underline; }
ul, ol { padding-left: 1.6em; margin: .8em 0; }
li + li { margin-top: .25em; }
blockquote {
  margin: 1em 0;
  padding: .2em 1em;
  color: var(--mk-muted);
  border-left: 4px solid var(--mk-border);
  background: var(--mk-surface);
}
code {
  font-family: var(--mk-mono);
  font-size: .9em;
  background: var(--mk-code-bg);
  padding: .15em .4em;
  border-radius: 4px;
}
pre {
  background: var(--mk-code-bg);
  padding: 14px 16px;
  border-radius: 8px;
  overflow-x: auto;
  border: 1px solid var(--mk-border);
}
pre code { background: none; padding: 0; font-size: .875em; }
pre code.hljs { display: block; color: var(--mk-text); }
.hljs-comment, .hljs-quote { color: var(--tok-comment); font-style: italic; }
.hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-doctag { color: var(--tok-keyword); }
.hljs-string, .hljs-regexp, .hljs-addition, .hljs-template-tag { color: var(--tok-string); }
.hljs-number, .hljs-symbol, .hljs-bullet, .hljs-selector-attr { color: var(--tok-number); }
.hljs-title, .hljs-title.function_, .hljs-section, .hljs-name { color: var(--tok-function); }
.hljs-variable, .hljs-template-variable, .hljs-deletion, .hljs-params { color: var(--tok-variable); }
.hljs-type, .hljs-class .hljs-title, .hljs-title.class_, .hljs-built_in { color: var(--tok-type); }
.hljs-operator, .hljs-punctuation { color: var(--tok-operator); }
.hljs-tag { color: var(--tok-tag); }
.hljs-attr, .hljs-attribute, .hljs-property, .hljs-selector-class { color: var(--tok-attr); }
.hljs-meta, .hljs-meta .hljs-keyword { color: var(--tok-meta); }
.hljs-subst { color: var(--mk-text); }
.hljs-invalid { color: var(--tok-invalid); }
.hljs-link { color: var(--tok-link); text-decoration: underline; }

/* Front matter card (see src/lib/markdown/frontmatter.ts) */
.doc-properties {
  margin: 0 0 1.6em;
  padding: .75em 1em;
  border: 1px solid var(--mk-border);
  border-radius: 8px;
  background: var(--mk-surface);
  font-size: .92em;
}
.doc-properties-title {
  font-weight: 650;
  color: var(--mk-muted);
  font-size: .85em;
  letter-spacing: .04em;
  text-transform: uppercase;
  margin-bottom: .5em;
}
.doc-properties dl {
  display: grid;
  grid-template-columns: minmax(5em, max-content) 1fr;
  gap: .25em 1em;
  margin: 0;
}
.doc-properties dt { color: var(--mk-muted); }
.doc-properties dd { margin: 0; word-break: break-word; }
.doc-properties .fm-empty { color: var(--mk-muted); }
.doc-properties .fm-source {
  margin: 0;
  border: none;
  background: transparent;
  padding: 0;
}
table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: .95em; }
th, td { border: 1px solid var(--mk-border); padding: 8px 12px; text-align: left; }
th { background: var(--mk-surface); font-weight: 600; }
hr { border: none; border-top: 1px solid var(--mk-border); margin: 2em 0; }
img { max-width: 100%; height: auto; border-radius: 6px; }
.callout {
  margin: 1em 0;
  padding: .75em 1em;
  border-radius: 8px;
  border: 1px solid var(--mk-border);
  border-left: 4px solid var(--mk-accent);
  background: var(--mk-surface);
}
.callout-title { margin: 0 0 .35em; font-weight: 650; }
.callout-tip { border-left-color: var(--mk-callout-tip); }
.callout-tip .callout-title { color: var(--mk-callout-tip); }
.callout-warning { border-left-color: var(--mk-callout-warning); }
.callout-warning .callout-title { color: var(--mk-callout-warning); }
.callout-danger { border-left-color: var(--mk-callout-danger); }
.callout-danger .callout-title { color: var(--mk-callout-danger); }
.callout-info { border-left-color: var(--mk-callout-info); }
.callout-info .callout-title { color: var(--mk-callout-info); }
.callout-success { border-left-color: var(--mk-callout-success); }
.callout-success .callout-title { color: var(--mk-callout-success); }
/* Task lists: [ ] todo, [~] doing, [x] done */
ul.contains-task-list { padding-left: 1.35em; }
.task-list-item { list-style: none; }
.task-list-item input[type="checkbox"] {
  width: .95em;
  height: .95em;
  margin: 0 .5em 0 -1.35em;
  vertical-align: -0.08em;
  accent-color: var(--mk-accent);
}
.task-done > p { color: var(--mk-muted); text-decoration: line-through; }
/* Marker-only items ("- [ ] " with nothing after it) carry no checkbox input;
   draw the box so the empty template rows still read as task items. */
.task-empty.task-todo::before,
.task-empty.task-done::before {
  content: '☐';
  color: var(--mk-muted);
  margin-right: .5em;
  margin-left: -1.35em;
}
.task-empty.task-done::before { content: '☑'; color: var(--mk-accent); }
.task-doing::before {
  content: '◐';
  color: var(--mk-callout-warning, #d97706);
  margin-right: .5em;
  margin-left: -1.35em;
}
.mermaid-diagram { margin: 1.2em 0; text-align: center; }
.mermaid-diagram svg { max-width: 100%; height: auto; }
.mermaid-error { border-color: var(--mk-callout-danger); }
.katex-display { overflow-x: auto; overflow-y: hidden; }
`

const dark = `
:root {
  /* Built-in palette: One Dark */
  --mk-text: #abb2bf;
  --mk-muted: #9aa2b1;
  --mk-border: #3a3f4b;
  --mk-surface: #2c313a;
  --mk-accent: #61afef;
  --mk-bg: #282c34;
  --mk-code-bg: #2c313a;
  --mk-callout-tip: #98c379;
  --mk-callout-warning: #e5c07b;
  --mk-callout-danger: #e06c75;
  --mk-callout-info: #56b6c2;
  --mk-callout-success: #98c379;
  --tok-comment: #5c6370;
  --tok-keyword: #c678dd;
  --tok-string: #98c379;
  --tok-number: #d19a66;
  --tok-function: #61afef;
  --tok-variable: #e06c75;
  --tok-type: #e5c07b;
  --tok-operator: #56b6c2;
  --tok-punctuation: #abb2bf;
  --tok-tag: #e06c75;
  --tok-attr: #d19a66;
  --tok-builtin: #e5c07b;
  --tok-meta: #61afef;
  --tok-invalid: #e06c75;
  --tok-heading: #61afef;
  --tok-link: #56b6c2;
}
`

/*
 * Print is always on white paper, whatever the screen theme is: the dark
 * palette must not leak pale text or dark code blocks onto the printed page.
 * Custom properties are declared !important so a theme's dark block (which
 * comes later in the document) cannot override them.
 */
const print = `
@page {
  size: A4;
  margin: 18mm 16mm 20mm;
}
@media print {
  :root, :root[data-theme='dark'] {
    --mk-text: #000 !important;
    --mk-muted: var(--mk-print-muted, #555) !important;
    --mk-border: #c9c9c9 !important;
    --mk-surface: #f4f4f4 !important;
    --mk-accent: var(--mk-print-accent, #2f5fc4) !important;
    --mk-bg: #fff !important;
    --mk-code-bg: #f4f4f4 !important;
    --mk-callout-tip: #1a5c1f !important;
    --mk-callout-warning: #7a5400 !important;
    --mk-callout-danger: #a92720 !important;
    --mk-callout-info: #0b5c80 !important;
    --mk-callout-success: #1a5c1f !important;
  }
  html, body { background: #fff; color: var(--mk-text); }
  body {
    font-family: var(--mk-print-font);
    font-size: var(--mk-print-font-size);
    line-height: var(--mk-print-line-height);
  }
  .mark-drawer-doc { max-width: none; padding: 0; }
  a { color: var(--mk-accent); text-decoration: underline; }
  h1, h2, h3, h4 { break-after: avoid; }
  pre, blockquote, table, img, .callout { break-inside: avoid; }
  pre { white-space: pre-wrap; word-break: break-word; }
  .no-print { display: none !important; }
}
`

export function exportThemeCss(theme: ExportTheme): string {
  return base + (theme === 'dark' ? dark : '') + print
}

/** KaTeX stylesheet, needed inside exported standalone HTML. */
export function katexStylesheet(): string {
  return katexCss
}

export function buildDocument(
  title: string,
  bodyHtml: string,
  theme: ExportTheme,
  customCss = ''
): string {
  return `<!doctype html>
<html lang="zh-CN" data-theme="${theme}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="generator" content="${escapeHtml(`${BRAND_FULL} ${APP_VERSION}`)}" />
<meta name="author" content="${WATERMARK}" />
<meta name="mark-drawer-signature" content="${invisibleWatermark()}" />
<title>${escapeHtml(title)}</title>
<style>${exportThemeCss(theme)}</style>
<style>${katexStylesheet()}</style>
${customCss ? `<style>\n${customCss}\n</style>` : ''}
</head>
<body>
<main class="mark-drawer-doc">${bodyHtml}</main>
</body>
</html>`
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
