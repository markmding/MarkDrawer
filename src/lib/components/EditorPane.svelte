<script lang="ts">
  // MARK#EZVE.COM
  import { Crepe } from '@milkdown/crepe'
  import '@milkdown/crepe/theme/common/style.css'
  import '@milkdown/crepe/theme/frame.css'
  import {
    commandsCtx,
    editorViewCtx,
    nodeViewCtx,
    prosePluginsCtx
  } from '@milkdown/kit/core'
  import { TextSelection } from '@milkdown/kit/prose/state'
  import type { EditorView as ProseEditorView } from '@milkdown/kit/prose/view'
  import type { EditorView as SourceEditorView } from '@codemirror/view'
  import { upload, uploadConfig } from '@milkdown/kit/plugin/upload'
  import {
    addBlockTypeCommand,
    clearTextInCurrentBlockCommand,
    codeBlockSchema,
    toggleEmphasisCommand,
    toggleInlineCodeCommand,
    toggleStrongCommand,
    wrapInBulletListCommand,
    wrapInOrderedListCommand
  } from '@milkdown/kit/preset/commonmark'
  import { insertTableCommand, toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm'
  import { replaceAll } from '@milkdown/kit/utils'
  import { untrack } from 'svelte'
  import {
    setEditorActionHandler,
    type EditorAction
  } from '../editor/actions'
  import {
    changeListType,
    convertTextblock,
    wrapInBlockquote
  } from '../editor/block-convert'
  import {
    createUploader,
    persistAttachment,
    resolveAttachmentUrl
  } from '../editor/attachments'
  import { calloutPlugin } from '../editor/callout'
  import {
    codeBlockEditorTheme,
    codeHighlighting,
    codeLanguages
  } from '../editor/code-theme'
  import { findHighlightExtension } from '../editor/find-codemirror'
  import { findDecorationsPlugin, ProseFindEngine } from '../editor/find-prosemirror'
  import { registerFindEngine, unregisterFindEngine } from '../editor/find.svelte'
  import { frontmatterPlugin } from '../editor/frontmatter-view'
  import { nodeSchemaPatches } from '../editor/schema-patches'
  import { patchLinkSerialization } from '../editor/serializer'
  import {
    cycleTaskStatus,
    handleTaskPointerDown,
    taskDoingInputRule
  } from '../editor/task-list'
  import { normalizeEditorMarkdown } from '../markdown/normalize'
  import { GOTO_HEADING_EVENT } from '../markdown/headings'
  import {
    frontmatterBody,
    frontmatterEntries,
    splitFrontmatter
  } from '../markdown/frontmatter'
  import {
    createSplitScrollSync,
    type SplitScrollSync
  } from '../editor/split-sync'
  import {
    refreshVirtualBlocks,
    restoreVirtualBlocks,
    virtualBlockNodeViews
  } from '../editor/virtual-blocks'
  import { t } from '../i18n'
  import { renderMermaidSvg } from '../mermaid'
  import type { ViewMode } from '../types'
  import { tabs, type Tab } from '../stores/tabs.svelte'
  import { settings } from '../stores/settings.svelte'
  import { drawer } from '../stores/drawer.svelte'
  import LazySourceView from './LazySourceView.svelte'

  const MERMAID_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="6" height="5" rx="1"/><rect x="15" y="15" width="6" height="5" rx="1"/><path d="M9 6.5h4a3 3 0 0 1 3 3V15"/></svg>`

  let { tab, mode }: { tab: Tab; mode: ViewMode } = $props()
  let host = $state<HTMLDivElement>()
  let proseView = $state<ProseEditorView | null>(null)
  let sourceView = $state<SourceEditorView | null>(null)
  let splitSync: SplitScrollSync | null = null
  let crepeRef: Crepe | null = null
  /** Bumped to force a rebuild (front matter edited in 源码). */
  let editorEpoch = $state(0)
  /** Markdown the mounted editor currently represents, YAML block included. */
  let editorSnapshot = ''
  /** Raw YAML block the mounted editor was built with. */
  let editorYaml = ''
  let lastScrollTop = 0

  // The rich editor now stays mounted even while 源码 is shown; it is hidden
  // with CSS instead. Re-creating Crepe on the way back took hundreds of
  // milliseconds even for an empty document, which was the visible lag.
  const editorVisible = $derived(mode !== 'source')

  // 分块渲染 off: immediately bring back blocks that were already detached.
  // On: re-run the intersection check so far-away blocks detach again.
  $effect(() => {
    if (settings.value.chunkedRendering) refreshVirtualBlocks()
    else restoreVirtualBlocks()
  })

  // Entering/leaving 分栏 changes the pane width, so the cached remembered
  // heights of detached blocks no longer match. Restore them once, then let
  // the observer re-detach with heights measured at the new width.
  $effect(() => {
    if (!host || !editorVisible) return
    const element = host
    const frame = requestAnimationFrame(() => {
      // The host was `display: none`, which drops its scroll offset.
      if (lastScrollTop > 0) element.scrollTop = lastScrollTop
      restoreVirtualBlocks()
      refreshVirtualBlocks()
    })
    return () => cancelAnimationFrame(frame)
  })

  $effect(() => {
    if (!host) return
    const element = host
    const id = tab.id
    const initial = untrack(() => tab.content)
    // YAML front matter stays outside the ProseMirror document; see
    // frontmatter-view.ts. The body is edited, the raw block is re-attached
    // on every markdown update so saving keeps it byte for byte.
    const { frontmatter, body } = splitFrontmatter(initial)
    const yamlBody = frontmatterBody(frontmatter)
    // Baseline for the 源码 → 预览 sync below, and for the front-matter probe.
    editorSnapshot = initial
    editorYaml = yamlBody
    lastScrollTop = element.scrollTop
    // Tracked dependency: toggling the setting rebuilds the editor so existing
    // Mermaid preview panels appear/disappear immediately.
    const mermaidEnabled = settings.value.renderMermaid
    let cancelled = false
    let disposed = false
    let ready = false
    let instance: Crepe | null = null

    const uploadImage = async (file: File): Promise<string> => {
      return persistAttachment(tab.root, file)
    }

    const escapePreview = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')

    // Mermaid live preview inside the code block (Crepe preview panel).
    // Renders are queued in mermaid.ts, so applying in completion order keeps
    // the newest content last; no global sequence gate (it would starve blocks).
    const renderPreview = (
      language: string,
      content: string,
      applyPreview: (value: string | HTMLElement | null) => void
    ): void | null => {
      if (language !== 'mermaid' || !mermaidEnabled || !content.trim()) return null
      const dark = document.documentElement.dataset.theme === 'dark'
      void renderMermaidSvg(content, dark)
        .then((svg) => applyPreview(svg))
        .catch((error) => {
          applyPreview(
            `<div class="mermaid-render-error">${escapePreview(t('editor.mermaidError'))} ${escapePreview(
              String(error)
            )}</div>`
          )
        })
      return undefined
    }

    const crepe = new Crepe({
      root: element,
      defaultValue: body,
      featureConfigs: {
        [Crepe.Feature.Placeholder]: {
          text: t('editor.placeholder')
        },
        [Crepe.Feature.ImageBlock]: {
          onUpload: uploadImage,
          inlineOnUpload: uploadImage,
          blockOnUpload: uploadImage,
          proxyDomURL: (url: string) => resolveAttachmentUrl(tab.root, url)
        },
        [Crepe.Feature.CodeMirror]: {
          renderPreview,
          previewLabel: t('editor.preview'),
          previewLoading: t('editor.previewLoading'),
          previewToggleText: (previewOnlyMode: boolean) =>
            previewOnlyMode ? t('editor.edit') : t('editor.hidePreview'),
          // Fenced blocks get real syntax highlighting from the theme tokens;
          // the language list also feeds the picker in each code block.
          languages: codeLanguages,
          theme: [codeBlockEditorTheme, codeHighlighting],
          // Lets the find bar paint matches inside fenced blocks: those render
          // through their own CodeMirror, not through ProseMirror decorations.
          extensions: [findHighlightExtension]
        },
        [Crepe.Feature.BlockEdit]: {
          buildMenu: (builder) => {
            builder.getGroup('advanced').addItem('mermaid', {
              label: t('editor.mermaidItem'),
              icon: MERMAID_ICON,
              onRun: (ctx) => {
                const commands = ctx.get(commandsCtx)
                const view = ctx.get(editorViewCtx)
                const codeBlock = codeBlockSchema.type(ctx)
                commands.call(clearTextInCurrentBlockCommand.key)
                commands.call(addBlockTypeCommand.key, {
                  nodeType: codeBlock,
                  attrs: { language: 'mermaid' }
                })
                // Seed the block so users immediately see a valid diagram.
                const template = `flowchart LR\n  A[${t('editor.mermaidStart')}] --> B[${t('editor.mermaidEnd')}]`
                view.dispatch(
                  view.state.tr.insertText(template, view.state.selection.from)
                )
              }
            })
          }
        }
      }
    })

    // Paste/drag images anywhere: save into attachments/ and insert an image node.
    crepe.editor.use(upload)
    // `[~]` typed at the start of a list item becomes an in-progress task.
    crepe.editor.use(taskDoingInputRule)
    // Node schema patches (paragraph serialization, task list states) have to
    // wait for every schema to be registered; see editor/schema-patches.ts.
    crepe.editor.use(nodeSchemaPatches)
    crepe.editor.config((ctx) => {
      // Links serialize as `[text](url)`, never as the `<url>` shorthand.
      patchLinkSerialization(ctx)
      ctx.update(uploadConfig.key, (value) => ({
        ...value,
        uploader: createUploader(() => tab.root),
        enableHtmlFileUploader: false
      }))
      ctx.update(prosePluginsCtx, (plugins) => [
        ...plugins,
        calloutPlugin,
        findDecorationsPlugin,
        ...(frontmatter
          ? [
              frontmatterPlugin({
                yaml: yamlBody,
                entries: frontmatterEntries(frontmatter),
                label: t('frontmatter.label'),
                hint: t('frontmatter.hint'),
                editLabel: t('frontmatter.edit')
              })
            ]
          : [])
      ])
      // Crepe registers its node views through this slice. Assigning
      // `editorViewOptionsCtx.nodeViews` instead would be spread over the
      // EditorView options last and wipe every built-in view (code block
      // previews included), so append here rather than replacing.
      ctx.update(nodeViewCtx, (entries) => {
        const merged = new Map(entries)
        for (const [name, createView] of Object.entries(virtualBlockNodeViews)) {
          merged.set(name, createView)
        }
        return [...merged.entries()]
      })
    })

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown, previous) => {
        // Ignore the initial parse so opening a document is never "dirty".
        if (!ready) return
        // Both sides are normalized so the guard never reports a phantom edit.
        const next = normalizeEditorMarkdown(markdown).markdown
        const before = normalizeEditorMarkdown(previous).markdown
        if (next !== before) {
          // Recorded first: the 源码 sync effect compares against it and must
          // not see the tab one step ahead of the editor.
          editorSnapshot = frontmatter + next
          tabs.update(id, frontmatter + next)
        }
      })
    })

    // Capture phase: a click on a “doing” checkbox closes the item. Crepe's own
    // handler would toggle it back to todo (see task-list.ts).
    const onPointerDown = (event: PointerEvent) => {
      const view = proseView
      if (!view) return
      handleTaskPointerDown(view, event)
    }
    element.addEventListener('pointerdown', onPointerDown, true)

    // Remember the offset while the editor is on screen; `display: none` resets
    // it, and the mode effect above restores it on the way back.
    const trackScroll = () => {
      if (mode !== 'source') lastScrollTop = element.scrollTop
    }
    element.addEventListener('scroll', trackScroll, { passive: true })

    const dispose = () => {
      if (disposed) return
      disposed = true
      element.removeEventListener('pointerdown', onPointerDown, true)
      element.removeEventListener('scroll', trackScroll)
      proseView = null
      crepeRef = null
      setEditorActionHandler(null)
      const target = instance
      instance = null
      void target?.destroy()
    }

    // Block conversions go through editor/block-convert.ts: the bare
    // prosemirror commands refuse a heading or a code block inside a list item,
    // cannot swap two list types, and delete inline nodes a code block cannot
    // hold. Marks and table insertion keep using the Crepe commands.
    const runAction = (action: EditorAction): boolean => {
      // 源码 owns the document while it is on screen. Acting on the hidden
      // editor would change content the user cannot see and then overwrite
      // their source text through `markdownUpdated`.
      if (mode === 'source') return false
      try {
        const commands = crepe.editor.ctx.get(commandsCtx)
        const view = crepe.editor.ctx.get(editorViewCtx)
        view.focus()
        switch (action) {
          case 'strong':
            commands.call(toggleStrongCommand.key)
            break
          case 'emphasis':
            commands.call(toggleEmphasisCommand.key)
            break
          case 'strikethrough':
            commands.call(toggleStrikethroughCommand.key)
            break
          case 'inlineCode':
            commands.call(toggleInlineCodeCommand.key)
            break
          case 'heading1':
            return convertTextblock(view, 'heading', { level: 1 })
          case 'heading2':
            return convertTextblock(view, 'heading', { level: 2 })
          case 'heading3':
            return convertTextblock(view, 'heading', { level: 3 })
          case 'heading4':
            return convertTextblock(view, 'heading', { level: 4 })
          case 'heading5':
            return convertTextblock(view, 'heading', { level: 5 })
          case 'heading6':
            return convertTextblock(view, 'heading', { level: 6 })
          case 'paragraph':
            return convertTextblock(view, 'paragraph')
          case 'blockquote':
            return wrapInBlockquote(view)
          case 'bulletList':
            return changeListType(view, 'bullet_list') || commands.call(wrapInBulletListCommand.key)
          case 'orderedList':
            return (
              changeListType(view, 'ordered_list') || commands.call(wrapInOrderedListCommand.key)
            )
          case 'codeBlock':
            return convertTextblock(view, 'code_block', { language: '' })
          case 'table':
            commands.call(insertTableCommand.key, {})
            break
          case 'taskStatus':
            if (!cycleTaskStatus(view)) return false
            break
          default:
            return false
        }
        return true
      } catch {
        return false
      }
    }

    const installEditorActions = (): void => setEditorActionHandler(runAction)

    instance = crepe
    crepeRef = crepe
    void crepe
      .create()
      .then(() => {
        if (cancelled) {
          dispose()
          return
        }
        ready = true
        try {
          proseView = crepe.editor.ctx.get(editorViewCtx)
        } catch {
          proseView = null
        }
        installEditorActions()
        if (import.meta.env.DEV && proseView) {
          // Dev-only probe for the regression check in docs/DEV.LOG.md: it runs
          // the very handler the 格式 menu and the shortcuts call, and exposes
          // the live view plus the serialized Markdown so a script can compare
          // the document, the DOM and what actually gets saved.
          ;(
            window as Window & {
              __markDrawer?: {
                view: ProseEditorView
                runAction: (action: EditorAction) => boolean
                getMarkdown: () => string
              }
            }
          ).__markDrawer = {
            view: proseView,
            runAction,
            getMarkdown: () => crepe.getMarkdown()
          }
        }
      })
      .catch((error) => {
        console.error('[mark-drawer] editor failed to start', error)
        dispose()
      })

    return () => {
      cancelled = true
      dispose()
    }
  })

  // The find bar talks to whichever surface is on screen: 源码 hands over when
  // it mounts, so the rich editor steps aside there and takes back over for
  // 预览 / 分栏.
  $effect(() => {
    const view = proseView
    if (!view || mode === 'source') return
    const engine = new ProseFindEngine(view)
    registerFindEngine(engine)
    return () => unregisterFindEngine(engine)
  })

  // 源码 edits `tab.content` directly, while the rich editor keeps its old
  // document. Push those edits in when the rich view comes back, instead of
  // rebuilding the editor.
  $effect(() => {
    const content = tab.content
    if (mode === 'source' || !host || !proseView || !crepeRef) return
    const { frontmatter: currentFrontmatter, body } = splitFrontmatter(content)
    // The YAML block is a one-time decoration; a changed block needs a rebuilt
    // editor. Rare enough that the rebuild cost does not matter.
    if (frontmatterBody(currentFrontmatter) !== editorYaml) {
      editorEpoch += 1
      return
    }
    if (content === editorSnapshot) return
    // `flush = true` re-creates the editor state from the Markdown instead of
    // dispatching a transaction. No `markdownUpdated` fires, so the user's
    // source text is not rewritten by a serializer round-trip (which would also
    // mark the tab dirty on a pure view switch).
    crepeRef.editor.action(replaceAll(body, true))
    editorSnapshot = content
  })

  // Outline clicks: scroll the WYSIWYG editor to the nth heading. The outline
  // is built from the Markdown source, so both views count headings the same
  // way and the index stays valid in either mode.
  $effect(() => {
    const view = proseView
    if (!view || mode === 'source') return
    const onGoto = (event: Event) => {
      const index = (event as CustomEvent<{ index?: number }>).detail?.index
      if (typeof index !== 'number') return
      const positions: number[] = []
      view.state.doc.forEach((node, offset) => {
        if (node.type.name === 'heading') positions.push(offset)
      })
      const target = positions[index]
      if (target === undefined) return
      const dom = view.nodeDOM(target)
      if (dom instanceof HTMLElement) dom.scrollIntoView({ block: 'start' })
      view.dispatch(
        view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(target + 1)))
      )
      view.focus()
    }
    window.addEventListener(GOTO_HEADING_EVENT, onGoto)
    return () => window.removeEventListener(GOTO_HEADING_EVENT, onGoto)
  })

  // F8.2 split view: block-level scroll sync between the two panes.
  $effect(() => {
    if (mode !== 'split' || !proseView || !sourceView || !host) return
    const sync = createSplitScrollSync({
      prose: proseView,
      source: sourceView,
      scroller: host
    })
    splitSync = sync
    return () => {
      sync.destroy()
      if (splitSync === sync) splitSync = null
    }
  })

  function handleBlur(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null
    const current = event.currentTarget as HTMLElement
    if (next && current.contains(next)) return
    if (settings.value.autosaveBlur) void tabs.save(tab.id)
  }
</script>

<div class="editor-stage">
  {#if mode === 'source'}
    {#key `${tab.id}:${tab.revision}`}
      <LazySourceView
        value={tab.content}
        filename={tab.path}
        onchange={(next) => tabs.update(tab.id, next)}
        onblur={() => {
          if (settings.value.autosaveBlur) void tabs.save(tab.id)
        }}
      />
    {/key}
  {/if}
  <!-- Mounted in every mode: hidden (not destroyed) while 源码 is shown. -->
  <div
    class="editor-split"
    class:split={mode === 'split'}
    class:source-hidden={mode === 'source'}
  >
    {#key `${tab.id}:${tab.revision}:${editorEpoch}`}
      <div
        class="editor-host"
        class:chunked={settings.value.chunkedRendering}
        bind:this={host}
        onfocusout={handleBlur}
        spellcheck={settings.value.spellcheck}
      ></div>
    {/key}
    {#if mode === 'split'}
      <div class="split-source">
        <LazySourceView
          value={tab.content}
          filename={tab.path}
          readonly
          onready={(view) => (sourceView = view)}
          onbeforeupdate={() => splitSync?.suspend()}
        />
      </div>
    {/if}
  </div>
</div>
