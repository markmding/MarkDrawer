<script lang="ts">
  // MARK#EZVE.COM
  import { basicSetup } from 'codemirror'
  import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
  import { languages } from '@codemirror/language-data'
  import { LanguageDescription } from '@codemirror/language'
  import { Compartment, EditorState } from '@codemirror/state'
  import { EditorView } from '@codemirror/view'
  import { untrack } from 'svelte'
  import { codeHighlighting, sourceEditorTheme } from '../editor/code-theme'
  import { CodeFindEngine, findHighlightExtension } from '../editor/find-codemirror'
  import { registerFindEngine, unregisterFindEngine } from '../editor/find.svelte'
  import { extractHeadings, GOTO_HEADING_EVENT } from '../markdown/headings'

  let {
    value,
    filename = '',
    onchange = () => {},
    onblur,
    readonly = false,
    onready,
    onbeforeupdate
  }: {
    value: string
    /** Used to pick syntax highlighting (css, js, json, …). */
    filename?: string
    onchange?: (next: string) => void
    onblur?: () => void
    readonly?: boolean
    /** Exposes the CodeMirror instance for split-view scroll sync. */
    onready?: (view: EditorView | null) => void
    /** Called right before the mirror content is rewritten. */
    onbeforeupdate?: () => void
  } = $props()

  let host = $state<HTMLDivElement>()
  let view = $state<EditorView | null>(null)

  $effect(() => {
    if (!host) return
    const initial = untrack(() => value)
    const markdownFile = !filename || /\.(md|markdown)$/i.test(filename)
    const languageSlot = new Compartment()
    const instance = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: initial,
        extensions: [
          basicSetup,
          // Shell colours come from the theme variables (`--bg`, `--text`, …)
          // and code tokens from `--tok-*`, so a palette switch repaints the
          // source view along with the rest of the app.
          sourceEditorTheme,
          codeHighlighting,
          findHighlightExtension,
          languageSlot.of(
            markdownFile
              ? markdown({ base: markdownLanguage, codeLanguages: languages })
              : []
          ),
          EditorView.lineWrapping,
          EditorState.readOnly.of(readonly),
          EditorView.editable.of(!readonly),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !readonly) onchange(update.state.doc.toString())
          }),
          EditorView.domEventHandlers({
            blur: () => {
              onblur?.()
            }
          })
        ]
      })
    })
    view = instance
    onready?.(instance)
    // Only the editable instance answers the find bar; the split mirror is a
    // read-only copy of the same text.
    const finder = readonly ? null : new CodeFindEngine(instance)
    if (finder) registerFindEngine(finder)

    // Outline clicks: jump to the same heading in the source text. The line
    // numbers are recomputed from the current document, so they stay correct
    // even if the tab changed since the outline was rendered.
    const onGoto = (event: Event) => {
      const index = (event as CustomEvent<{ index?: number }>).detail?.index
      if (typeof index !== 'number') return
      const heading = extractHeadings(instance.state.doc.toString())[index]
      if (!heading) return
      const lineNo = Math.min(heading.line + 1, instance.state.doc.lines)
      const line = instance.state.doc.line(lineNo)
      instance.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: 'start' })
      })
      instance.focus()
    }
    window.addEventListener(GOTO_HEADING_EVENT, onGoto)

    let cancelled = false
    if (!markdownFile && filename) {
      const description = LanguageDescription.matchFilename(languages, filename)
      if (description) {
        void description
          .load()
          .then((language) => {
            if (!cancelled) {
              instance.dispatch({ effects: languageSlot.reconfigure(language) })
            }
          })
          .catch(() => {
            // Unknown/failed language: keep plain text.
          })
      }
    }

    return () => {
      cancelled = true
      window.removeEventListener(GOTO_HEADING_EVENT, onGoto)
      // Hand the bar back before the view goes away, so `unregister` can still
      // clear its decorations.
      if (finder) unregisterFindEngine(finder)
      instance.destroy()
      finder?.destroy()
      if (view === instance) view = null
      onready?.(null)
    }
  })

  // Keep a read-only split preview in sync with the WYSIWYG editor. Heavy
  // documents get a debounce and a minimal diff instead of a full replace.
  $effect(() => {
    const next = value
    const instance = view
    if (!instance) return
    const timer = setTimeout(() => {
      const current = instance.state.doc.toString()
      if (current === next) return

      let start = 0
      const minLength = Math.min(current.length, next.length)
      while (start < minLength && current[start] === next[start]) start += 1

      let oldEnd = current.length
      let newEnd = next.length
      while (
        oldEnd > start &&
        newEnd > start &&
        current[oldEnd - 1] === next[newEnd - 1]
      ) {
        oldEnd -= 1
        newEnd -= 1
      }

      onbeforeupdate?.()
      const scroll = instance.scrollDOM.scrollTop
      instance.dispatch({
        changes: { from: start, to: oldEnd, insert: next.slice(start, newEnd) }
      })
      instance.scrollDOM.scrollTop = scroll
    }, 250)
    return () => clearTimeout(timer)
  })
</script>

<div class="source-host" bind:this={host}></div>
