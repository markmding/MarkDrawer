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
    createCodeBlockCommand,
    toggleEmphasisCommand,
    toggleInlineCodeCommand,
    toggleStrongCommand,
    wrapInBlockquoteCommand,
    wrapInBulletListCommand,
    wrapInHeadingCommand,
    wrapInOrderedListCommand
  } from '@milkdown/kit/preset/commonmark'
  import { insertTableCommand, toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm'
  import { untrack } from 'svelte'
  import {
    setEditorActionHandler,
    type EditorAction
  } from '../editor/actions'
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
  import { frontmatterPlugin } from '../editor/frontmatter-view'
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

  // Keep the WYSIWYG editor mounted when switching between 预览 and 分栏;
  // rebuilding it would reset the scroll position and the undo history.
  const editorEnabled = $derived(mode !== 'source')

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
    if (!host || !editorEnabled) return
    const frame = requestAnimationFrame(() => {
      restoreVirtualBlocks()
      refreshVirtualBlocks()
    })
    return () => cancelAnimationFrame(frame)
  })

  $effect(() => {
    if (!editorEnabled || !host) return
    const element = host
    const path = tab.path
    const initial = untrack(() => tab.content)
    // YAML front matter stays outside the ProseMirror document; see
    // frontmatter-view.ts. The body is edited, the raw block is re-attached
    // on every markdown update so saving keeps it byte for byte.
    const { frontmatter, body } = splitFrontmatter(initial)
    const yamlBody = frontmatterBody(frontmatter)
    // Tracked dependency: toggling the setting rebuilds the editor so existing
    // Mermaid preview panels appear/disappear immediately.
    const mermaidEnabled = settings.value.renderMermaid
    let cancelled = false
    let disposed = false
    let ready = false
    let instance: Crepe | null = null

    const uploadImage = async (file: File): Promise<string> => {
      if (!drawer.root) throw new Error(t('editor.needDrawer'))
      return persistAttachment(drawer.root, file)
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
          proxyDomURL: (url: string) => resolveAttachmentUrl(drawer.root, url)
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
          theme: [codeBlockEditorTheme, codeHighlighting]
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
    crepe.editor.config((ctx) => {
      ctx.update(uploadConfig.key, (value) => ({
        ...value,
        uploader: createUploader(() => drawer.root),
        enableHtmlFileUploader: false
      }))
      ctx.update(prosePluginsCtx, (plugins) => [
        ...plugins,
        calloutPlugin,
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
        ;(window as Window & { __markupNodeViews?: string[] }).__markupNodeViews = [
          ...merged.keys()
        ]
        return [...merged.entries()]
      })
    })

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown, previous) => {
        // Ignore the initial parse so opening a document is never "dirty".
        if (!ready) return
        if (markdown !== previous) tabs.update(path, frontmatter + markdown)
      })
    })

    const dispose = () => {
      if (disposed) return
      disposed = true
      proseView = null
      setEditorActionHandler(null)
      const target = instance
      instance = null
      void target?.destroy()
    }

    const installEditorActions = (): void => {
      setEditorActionHandler((action: EditorAction) => {
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
              commands.call(wrapInHeadingCommand.key, 1)
              break
            case 'heading2':
              commands.call(wrapInHeadingCommand.key, 2)
              break
            case 'heading3':
              commands.call(wrapInHeadingCommand.key, 3)
              break
            case 'paragraph':
              commands.call(wrapInHeadingCommand.key, 0)
              break
            case 'blockquote':
              commands.call(wrapInBlockquoteCommand.key)
              break
            case 'bulletList':
              commands.call(wrapInBulletListCommand.key)
              break
            case 'orderedList':
              commands.call(wrapInOrderedListCommand.key)
              break
            case 'codeBlock':
              commands.call(createCodeBlockCommand.key)
              break
            case 'table':
              commands.call(insertTableCommand.key, {})
              break
            default:
              return false
          }
          return true
        } catch {
          return false
        }
      })
    }

    instance = crepe
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

  // Outline clicks: scroll the WYSIWYG editor to the nth heading. The outline
  // is built from the Markdown source, so both views count headings the same
  // way and the index stays valid in either mode.
  $effect(() => {
    const view = proseView
    if (!view) return
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
    if (settings.value.autosaveBlur) void tabs.save(tab.path)
  }
</script>

{#if mode === 'source'}
  {#key `${tab.path}:${tab.revision}`}
    <LazySourceView
      value={tab.content}
      filename={tab.path}
      onchange={(next) => tabs.update(tab.path, next)}
      onblur={() => {
        if (settings.value.autosaveBlur) void tabs.save(tab.path)
      }}
    />
  {/key}
{:else}
  <div class="editor-split" class:split={mode === 'split'}>
    {#key `${tab.path}:${tab.revision}`}
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
{/if}
