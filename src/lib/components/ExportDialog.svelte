<script lang="ts">
  // MARK#EZVE.COM
  import { writeExportFile, writeExportFiles } from '../api/drawer'
  import { isTauri, pickExportFile, pickExportFolder } from '../api/tauri'
  import { downloadBase64, downloadText } from '../export/download'
  import { buildHtmlExport } from '../export/html'
  import { paginateHtml, printHtml } from '../export/pdf'
  import { t } from '../i18n'
  import { settings } from '../stores/settings.svelte'
  import { themes } from '../stores/themes.svelte'
  import type { Tab } from '../stores/tabs.svelte'
  import { drawer } from '../stores/drawer.svelte'
  import type { ExportFile, HtmlExportMode } from '../types'

  let {
    open,
    tab,
    onclose
  }: { open: boolean; tab: Tab | undefined; onclose: () => void } = $props()

  let format = $state<'html' | 'pdf' | 'md'>('html')
  let htmlMode = $state<HtmlExportMode>('folder')
  let theme = $state<'light' | 'dark'>('light')
  let rangeMode = $state<'all' | 'range'>('all')
  let from = $state(1)
  let to = $state(1)
  let pageStart = $state(1)
  let preview = $state('')
  let missing = $state<string[]>([])
  let pageCount = $state(0)
  let pageBusy = $state(false)
  let busy = $state(false)
  let message = $state<{ kind: 'info' | 'warning' | 'danger'; text: string } | null>(null)

  const resolvedTheme = $derived(settings.value.theme === 'dark' ? 'dark' : 'light')

  $effect(() => {
    if (!open) return
    htmlMode = settings.value.defaultHtmlMode
    pageStart = settings.value.defaultPageStart
    rangeMode = settings.value.defaultPageRange
    theme = resolvedTheme
  })

  $effect(() => {
    if (!open || !tab || format === 'md') return
    const markdown = tab.content
    const title = tab.title
    const mode = theme
    const root = drawer.root
    let cancelled = false

    const timer = setTimeout(() => {
      void buildHtmlExport({
        root,
        markdown,
        title,
        mode: 'single',
        theme: mode,
        renderDiagrams: settings.value.renderMermaid,
        customCss: themes.customCss
      })
        .then((result) => {
          if (cancelled) return
          preview = result.html
          missing = result.missing
          if (result.missing.length) {
            message = {
              kind: 'warning',
              text: t('export.missingWarning', { count: result.missing.length, list: result.missing.join('、') })
            }
          }
          if (format === 'pdf') {
            pageBusy = true
            pageCount = 0
            void paginateHtml(result.html)
              .then((paginated) => {
                if (!cancelled) pageCount = paginated.total
              })
              .catch(() => {
                if (!cancelled) pageCount = 0
              })
              .finally(() => {
                if (!cancelled) pageBusy = false
              })
          } else {
            pageCount = 0
          }
        })
        .catch((error) => {
          if (!cancelled) {
            message = { kind: 'danger', text: t('export.previewFailed', { error: String(error) }) }
          }
        })
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  })

  async function exportHtml(): Promise<void> {
    if (!tab) return
    busy = true
    message = null
    try {
      const result = await buildHtmlExport({
        root: drawer.root,
        markdown: tab.content,
        title: tab.title,
        mode: htmlMode,
        theme,
        renderDiagrams: settings.value.renderMermaid,
        customCss: themes.customCss
      })
      if (result.missing.length) {
        missing = result.missing
        message = {
          kind: 'warning',
          text: t('export.missingSkipped', { count: result.missing.length, list: result.missing.join('、') })
        }
      }

      if (htmlMode === 'single') {
        if (isTauri) {
          const target = await pickExportFile(`${tab.title}.html`, [
            { name: 'HTML', extensions: ['html'] }
          ])
          if (!target) return
          await writeExportFile(target, result.html)
          message = { kind: 'info', text: t('export.doneFile', { path: target }) }
        } else {
          downloadText(`${tab.title}.html`, result.html)
          message = { kind: 'info', text: t('export.doneDownload') }
        }
        return
      }

      if (isTauri) {
        const dest = await pickExportFolder()
        if (!dest) return
        const count = await writeExportFiles(dest, result.files)
        message = { kind: 'info', text: t('export.doneFiles', { count, dest }) }
      } else {
        browserWriteFiles(result.files)
        message = { kind: 'info', text: t('export.doneFolderDownload') }
      }
    } catch (error) {
      message = { kind: 'danger', text: t('export.failed', { error: String(error) }) }
    } finally {
      busy = false
    }
  }

  async function exportPdf(): Promise<void> {
    if (!tab) return
    busy = true
    message = null
    try {
      if (rangeMode === 'range' && from > to) {
        message = { kind: 'danger', text: t('export.rangeInvalid') }
        return
      }
      const result = await buildHtmlExport({
        root: drawer.root,
        markdown: tab.content,
        title: tab.title,
        mode: 'single',
        theme,
        renderDiagrams: settings.value.renderMermaid,
        customCss: themes.customCss
      })
      const printed = await printHtml(result.html, {
        pageStart,
        range: { mode: rangeMode, from, to }
      })
      message = {
        kind: 'info',
        text: t('export.printChosen', { printed: printed.printed, total: printed.total })
      }
    } catch (error) {
      message = { kind: 'danger', text: t('export.printFailed', { error: String(error) }) }
    } finally {
      busy = false
    }
  }

  async function copyMarkdown(): Promise<void> {
    if (!tab) return
    try {
      await navigator.clipboard.writeText(tab.content)
      message = { kind: 'info', text: t('export.doneCopy') }
    } catch (error) {
      message = { kind: 'danger', text: t('export.copyFailed', { error: String(error) }) }
    }
  }

  function browserWriteFiles(files: ExportFile[]): void {
    for (const file of files) {
      const name = file.path.split('/').pop() ?? 'file'
      if (file.encoding === 'base64') {
        downloadBase64(name, file.content, mimeOf(file.path))
      } else {
        downloadText(name, file.content)
      }
    }
  }

  function mimeOf(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase()
    const map: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml'
    }
    return (ext && map[ext]) || 'application/octet-stream'
  }

  function run(): void {
    if (format === 'html') void exportHtml()
    else if (format === 'pdf') void exportPdf()
    else void copyMarkdown()
  }
</script>

{#if open && tab}
  <div
    class="modal-backdrop"
    role="presentation"
    onclick={(event) => {
      if (event.target === event.currentTarget) onclose()
    }}
  >
    <div class="modal wide" role="dialog" aria-modal="true" aria-label={t('export.title', { title: tab.title })} tabindex="-1">
      <div class="modal-head">
        <h2>{t('export.title', { title: tab.title })}</h2>
        <button class="icon-btn" title={t('common.close')} onclick={onclose}>×</button>
      </div>

      <div class="modal-body">
        <div class="form-grid" style="margin-bottom:14px">
          <div class="field full">
            <span class="field-label">{t('export.format')}</span>
            <div class="segmented">
              <button class:active={format === 'html'} onclick={() => (format = 'html')}>HTML</button>
              <button class:active={format === 'pdf'} onclick={() => (format = 'pdf')}>PDF</button>
              <button class:active={format === 'md'} onclick={() => (format = 'md')}>
                Markdown
              </button>
            </div>
          </div>

          {#if format === 'html'}
            <div class="field full">
              <span class="field-label">{t('export.packMode')}</span>
              <div class="segmented">
                <button
                  class:active={htmlMode === 'folder'}
                  onclick={() => (htmlMode = 'folder')}>{t('export.folder')}</button>
                <button
                  class:active={htmlMode === 'single'}
                  onclick={() => (htmlMode = 'single')}>{t('export.single')}</button>
              </div>
              <span class="hint">
                {htmlMode === 'folder' ? t('export.folderHint') : t('export.singleHint')}
              </span>
            </div>
            <div class="field">
              <label for="export-theme">{t('export.theme')}</label>
              <select id="export-theme" bind:value={theme}>
                <option value="light">{t('export.light')}</option>
                <option value="dark">{t('export.dark')}</option>
              </select>
            </div>
          {:else if format === 'pdf'}
            <div class="field">
              <label for="page-start">{t('export.pageStart')}</label>
              <input id="page-start" type="number" min="1" bind:value={pageStart} />
            </div>
            <div class="field">
              <span class="field-label">{t('export.range')}</span>
              <div class="segmented">
                <button
                  class:active={rangeMode === 'all'}
                  onclick={() => (rangeMode = 'all')}>{t('export.whole')}</button>
                <button
                  class:active={rangeMode === 'range'}
                  onclick={() => (rangeMode = 'range')}>{t('export.custom')}</button>
              </div>
            </div>
            {#if rangeMode === 'range'}
              <div class="field full">
                <span class="field-label">{t('export.rangeLabel')}</span>
                <div class="range-row">
                  <input type="number" min="1" bind:value={from} aria-label={t('export.startPage')} />
                  <span class="muted">{t('export.to')}</span>
                  <input type="number" min="1" bind:value={to} aria-label={t('export.endPage')} />
                </div>
              </div>
            {/if}
            <div class="field full">
              <span class="hint">
                {#if pageBusy}
                  {t('export.calculating')}
                {:else if pageCount > 0}
                  {t('export.pageCount', { count: pageCount, start: pageStart })}
                {:else}
                  {t('export.pageHint')}
                {/if}
              </span>
            </div>
          {:else}
            <div class="field full">
              <span class="hint">
                {t('export.copyHint')}
              </span>
            </div>
          {/if}
        </div>

        {#if message}
          <div class="alert {message.kind}" style="margin-bottom:12px">{message.text}</div>
        {/if}

        {#if missing.length}
          <div class="alert warning" style="margin-bottom:12px">
            {t('export.missing', { list: missing.join('、') })}
          </div>
        {/if}

        {#if format !== 'md'}
          <div class="field">
            <span class="field-label">{t('export.preview')}</span>
            <iframe
              class="preview-frame"
              title={t('export.preview')}
              sandbox="allow-same-origin"
              srcdoc={preview}
            ></iframe>
          </div>
        {/if}
      </div>

      <div class="modal-foot">
        <span class="faint" style="font-size:11px">
          {t('export.footnote')}
        </span>
        <span class="spacer"></span>
        <button class="button" onclick={onclose}>{t('export.cancel')}</button>
        <button class="button primary" onclick={run} disabled={busy}>
          {busy
            ? t('export.processing')
            : format === 'html'
              ? t('export.exportHtml')
              : format === 'pdf'
                ? t('export.printPdf')
                : t('export.copyMd')}
        </button>
      </div>
    </div>
  </div>
{/if}
