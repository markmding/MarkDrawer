<script lang="ts">
  // MARK#EZVE.COM
  import { APP_VERSION } from '../brand'
  import { t } from '../i18n'
  import { tabs } from '../stores/tabs.svelte'
  import { drawer } from '../stores/drawer.svelte'
  import type { Encoding, Eol } from '../types'

  const active = $derived(tabs.active)
  /** Folder of the active tab (single-file mode shows the file's own folder). */
  const rootLabel = $derived(tabs.active?.root ?? drawer.root ?? '')
  const rootIsDemo = $derived(
    drawer.isDemo && rootLabel === drawer.root
  )

  const stats = $derived.by(() => {
    if (!active) return { words: 0, lines: 0 }
    const text = active.content
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/[#>*_~|-]/g, ' ')
    const cjk = (text.match(/[㐀-鿿぀-ヿ가-힯]/g) ?? []).length
    const latin = text
      .replace(/[㐀-鿿぀-ヿ가-힯]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length
    return {
      words: cjk + latin,
      lines: active.content.split('\n').length
    }
  })

  const saveState = $derived.by(() => {
    if (!active) return { label: '', cls: '' }
    if (active.saving) return { label: t('status.saving'), cls: 'dirty' }
    if (tabs.saveError) return { label: t('status.saveFailed'), cls: 'error' }
    if (active.dirty) return { label: t('status.unsaved'), cls: 'dirty' }
    return { label: t('status.saved'), cls: '' }
  })

  const encodingValue = $derived(
    active ? (active.encoding === 'utf8' && active.bom ? 'utf8-bom' : active.encoding) : 'utf8'
  )

  function changeEncoding(event: Event): void {
    if (!active) return
    const value = (event.currentTarget as HTMLSelectElement).value
    if (value === 'utf8-bom') tabs.setEncoding(active.id, 'utf8', true)
    else tabs.setEncoding(active.id, value as Encoding, false)
  }

  function changeEol(event: Event): void {
    if (!active) return
    tabs.setEol(active.id, (event.currentTarget as HTMLSelectElement).value as Eol)
  }
</script>

<footer class="statusbar">
  <span title={rootLabel}>
    {#if rootLabel}{rootIsDemo ? t('drawer.demoBadge') : rootLabel}{/if}
  </span>
  <span class="spacer"></span>
  {#if active}
    {#if active.kind === 'text'}<span class="faint">{t('status.textFile')}</span>{/if}
    <span>{t('status.stats', { words: stats.words, lines: stats.lines })}</span>
    <select
      class="status-select"
      aria-label={t('status.encodingAria')}
      title={t('status.encodingTitle')}
      value={encodingValue}
      onchange={changeEncoding}
    >
      <option value="utf8">UTF-8</option>
      <option value="utf8-bom">UTF-8 BOM</option>
      <option value="gbk">GBK</option>
      <option value="ansi">ANSI</option>
    </select>
    <select
      class="status-select"
      aria-label={t('status.eolAria')}
      title={t('status.eolTitle')}
      value={active.eol}
      onchange={changeEol}
    >
      <option value="lf">LF</option>
      <option value="crlf">CRLF</option>
    </select>
    <span title={tabs.saveError ?? ''}>
      <span class="status-dot {saveState.cls}"></span>{saveState.label}
    </span>
  {:else}
    <span class="faint">{t('status.idle', { version: APP_VERSION })}</span>
  {/if}
</footer>
