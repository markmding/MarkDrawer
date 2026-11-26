// MARK#EZVE.COM
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

/**
 * Token colours come from the active theme (`--tok-*` in `themes/*.css`,
 * seeded by `src/app.css` for the built-in One palette). The CodeMirror
 * editors — source view, split mirror and Crepe code blocks — all share this
 * highlight style so a theme switch repaints syntax highlighting as well.
 */
export const codeHighlightStyle = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: 'var(--tok-comment)', fontStyle: 'italic' },
  {
    tag: [
      t.keyword,
      t.controlKeyword,
      t.moduleKeyword,
      t.operatorKeyword,
      t.definitionKeyword,
      t.modifier
    ],
    color: 'var(--tok-keyword)'
  },
  {
    tag: [t.string, t.special(t.string), t.regexp, t.character, t.attributeValue, t.processingInstruction],
    color: 'var(--tok-string)'
  },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--tok-number)' },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName, t.labelName],
    color: 'var(--tok-function)'
  },
  {
    tag: [t.variableName, t.propertyName, t.definition(t.variableName), t.definition(t.propertyName)],
    color: 'var(--tok-variable)'
  },
  {
    tag: [t.typeName, t.className, t.namespace, t.standard(t.typeName)],
    color: 'var(--tok-type)'
  },
  {
    tag: [t.operator, t.derefOperator, t.arithmeticOperator, t.logicOperator, t.bitwiseOperator, t.compareOperator, t.updateOperator],
    color: 'var(--tok-operator)'
  },
  { tag: [t.punctuation, t.bracket, t.angleBracket, t.squareBracket, t.paren, t.brace, t.separator], color: 'var(--tok-punctuation)' },
  { tag: t.tagName, color: 'var(--tok-tag)' },
  { tag: [t.attributeName], color: 'var(--tok-attr)' },
  { tag: [t.self, t.standard(t.variableName), t.special(t.variableName)], color: 'var(--tok-builtin)' },
  { tag: [t.meta, t.annotation, t.documentMeta], color: 'var(--tok-meta)' },
  { tag: t.invalid, color: 'var(--tok-invalid)' },

  // Markdown structure
  { tag: [t.heading, t.heading1, t.heading2, t.heading3, t.heading4, t.heading5, t.heading6], color: 'var(--tok-heading)', fontWeight: '650' },
  { tag: [t.strong], fontWeight: '650' },
  { tag: [t.emphasis], fontStyle: 'italic' },
  { tag: [t.strikethrough], textDecoration: 'line-through' },
  { tag: [t.link, t.url], color: 'var(--tok-link)' },
  { tag: t.monospace, color: 'var(--tok-string)' },
  { tag: [t.quote], color: 'var(--text-muted)', fontStyle: 'italic' },
  { tag: [t.list], color: 'var(--tok-keyword)' },
  { tag: [t.contentSeparator], color: 'var(--tok-punctuation)' },
  { tag: [t.escape], color: 'var(--tok-number)' }
])

export const codeHighlighting = syntaxHighlighting(codeHighlightStyle)

/** Shared chrome for the source editor and the split mirror. */
export const sourceEditorTheme = EditorView.theme(
  {
    '&': {
      color: 'var(--text)',
      backgroundColor: 'var(--bg)',
      height: '100%'
    },
    '.cm-scroller': { fontFamily: 'var(--mono)' },
    '.cm-content': { caretColor: 'var(--accent)' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'var(--selection-bg, color-mix(in srgb, var(--accent) 40%, var(--bg)))',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--bg)',
      color: 'var(--text-faint)',
      border: 'none'
    },
    '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--bg-hover) 55%, transparent)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--text-muted)' },
    '.cm-foldPlaceholder': {
      backgroundColor: 'var(--bg-subtle)',
      color: 'var(--text-muted)',
      border: '1px solid var(--border)'
    },
    '.cm-panels': { backgroundColor: 'var(--bg-subtle)', color: 'var(--text)' },
    '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--border)' },
    '.cm-searchMatch': { backgroundColor: 'color-mix(in srgb, var(--warning) 30%, transparent)' },
    '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'color-mix(in srgb, var(--accent) 35%, transparent)' },
    '.cm-selectionMatch': { backgroundColor: 'color-mix(in srgb, var(--accent) 18%, transparent)' },
    '.cm-tooltip': {
      backgroundColor: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      color: 'var(--text)'
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: 'var(--accent-soft)',
      color: 'var(--text)'
    }
  },
  { dark: false }
)

/**
 * Crepe renders each code block as a CodeMirror instance inside a card. Keep
 * its background transparent so the card surface (and the theme) shows
 * through, and only paint text + selection.
 */
export const codeBlockEditorTheme = EditorView.theme(
  {
    '&': { color: 'var(--text)', backgroundColor: 'transparent' },
    '.cm-content': { caretColor: 'var(--accent)', fontFamily: 'var(--mono)' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'var(--selection-bg, color-mix(in srgb, var(--accent) 40%, var(--bg)))',
    },
    '.cm-gutters': { display: 'none' },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '.cm-scroller': { fontFamily: 'var(--mono)' }
  },
  { dark: false }
)

/** Language data for Crepe's language picker and fenced-block highlighting. */
export const codeLanguages = languages
