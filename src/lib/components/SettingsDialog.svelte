<script lang="ts">
  // MARK#EZVE.COM
  import { t, LOCALES, localeLabel, type Language, type MessageKey } from '../i18n'
  import {
    settings,
    type AppTheme,
    type SettingsState
  } from '../stores/settings.svelte'
  import { themes } from '../stores/themes.svelte'

  let { open, onclose }: { open: boolean; onclose: () => void } = $props()

  const s = $derived(settings.value)

  /** Autosave interval presets, in seconds: 10 s … 1 h. */
  const INTERVAL_PRESETS: { seconds: number; labelKey: MessageKey }[] = [
    { seconds: 10, labelKey: 'settings.interval10s' },
    { seconds: 30, labelKey: 'settings.interval30s' },
    { seconds: 60, labelKey: 'settings.interval1m' },
    { seconds: 300, labelKey: 'settings.interval5m' },
    { seconds: 900, labelKey: 'settings.interval15m' },
    { seconds: 1800, labelKey: 'settings.interval30m' },
    { seconds: 3600, labelKey: 'settings.interval1h' }
  ]

  // A value stored by the old slider (10–300 s, step 5) may not match a preset;
  // keep it selectable instead of silently snapping it to a neighbour.
  const intervalOptions = $derived.by(() => {
    const list = INTERVAL_PRESETS.map((preset) => ({
      seconds: preset.seconds,
      label: t(preset.labelKey)
    }))
    if (!list.some((option) => option.seconds === s.autosaveInterval)) {
      list.push({
        seconds: s.autosaveInterval,
        label: t('settings.intervalCustom', { seconds: s.autosaveInterval })
      })
      list.sort((a, b) => a.seconds - b.seconds)
    }
    return list
  })

  function update<K extends keyof SettingsState>(key: K, value: SettingsState[K]): void {
    settings.update({ [key]: value } as Partial<SettingsState>)
  }

  function changeDocTheme(value: string): void {
    settings.update({ documentTheme: value })
    if (value === 'light' || value === 'dark') settings.setTheme(value)
    themes.applySelection()
  }
</script>

{#if open}
  <div
    class="modal-backdrop"
    role="presentation"
    onclick={(event) => {
      if (event.target === event.currentTarget) onclose()
    }}
  >
    <div class="modal" role="dialog" aria-modal="true" aria-label={t('settings.title')} tabindex="-1">
      <div class="modal-head">
        <h2>{t('settings.title')}</h2>
        <button class="icon-btn" title={t('common.close')} onclick={onclose}>×</button>
      </div>

      <div class="modal-body">
        <div class="field" style="margin-bottom:12px">
          <label for="language">{t('settings.language')}</label>
          <select
            id="language"
            value={s.language}
            onchange={(event) => update('language', event.currentTarget.value as Language)}
          >
            {#each LOCALES as locale (locale)}
              <option value={locale}>{localeLabel(locale)}</option>
            {/each}
          </select>
          <span class="hint">{t('settings.languageHint')}</span>
        </div>

        <div class="field" style="margin-bottom:12px">
          <label for="theme">{t('settings.appearance')}</label>
          <select
            id="theme"
            value={s.theme}
            onchange={(event) => settings.setTheme(event.currentTarget.value as AppTheme)}
          >
            <option value="light">{t('settings.light')}</option>
            <option value="dark">{t('settings.dark')}</option>
            <option value="system">{t('settings.system')}</option>
          </select>
        </div>

        <div class="field" style="margin-bottom:12px">
          <label for="doc-theme">{t('settings.palette')}</label>
          <select
            id="doc-theme"
            value={s.documentTheme}
            onchange={(event) => changeDocTheme(event.currentTarget.value)}
          >
            <option value="light">{t('settings.oneLight')}</option>
            <option value="dark">{t('settings.oneDark')}</option>
            {#each themes.items as theme (theme.path)}
              <option value={`theme:${theme.path}`}>{theme.name}</option>
            {/each}
          </select>
          <span class="hint">
            {#if themes.loading}
              {t('settings.paletteLoading')}
            {:else if themes.items.length === 0}
              {t('settings.paletteEmpty')}
            {:else}
              {t('settings.paletteLoaded', { count: themes.items.length })}
            {/if}
          </span>
          <button
            class="button"
            style="align-self:flex-start;margin-top:6px;height:28px"
            onclick={() => void themes.load()}
          >
            {t('settings.refreshThemes')}
          </button>
        </div>

        <div class="field" style="margin-bottom:12px">
          <label for="font-size">{t('settings.fontSize', { size: s.editorFontSize })}</label>
          <input
            id="font-size"
            type="range"
            min="13"
            max="22"
            step="1"
            value={s.editorFontSize}
            oninput={(event) => update('editorFontSize', Number(event.currentTarget.value))}
          />
        </div>

        <h3 style="font-size:13px;margin:18px 0 4px">{t('settings.autosave')}</h3>
        <!-- Interval on the left, switch on the right: one row, no layout jump. -->
        <div class="switch-row">
          <div class="switch-label">
            <strong>{t('settings.intervalLabel')}</strong>
            <select
              id="interval"
              value={String(s.autosaveInterval)}
              disabled={!s.autosaveTimer}
              aria-label={t('settings.intervalLabel')}
              style="margin-top:6px;max-width:220px"
              onchange={(event) => update('autosaveInterval', Number(event.currentTarget.value))}
            >
              {#each intervalOptions as option (option.seconds)}
                <option value={String(option.seconds)}>{option.label}</option>
              {/each}
            </select>
          </div>
          <button
            class="switch"
            class:on={s.autosaveTimer}
            role="switch"
            aria-checked={s.autosaveTimer}
            aria-label={t('settings.timer')}
            title={t('settings.timerHint')}
            onclick={() => update('autosaveTimer', !s.autosaveTimer)}
          ></button>
        </div>
        <div class="switch-row">
          <div class="switch-label">
            <strong>{t('settings.blur')}</strong>
            <span>{t('settings.blurHint')}</span>
          </div>
          <button
            class="switch"
            class:on={s.autosaveBlur}
            role="switch"
            aria-checked={s.autosaveBlur}
            aria-label={t('settings.blur')}
            onclick={() => update('autosaveBlur', !s.autosaveBlur)}
          ></button>
        </div>
        <div class="switch-row">
          <div class="switch-label">
            <strong>{t('settings.spellcheck')}</strong>
            <span>{t('settings.spellcheckHint')}</span>
          </div>
          <button
            class="switch"
            class:on={s.spellcheck}
            role="switch"
            aria-checked={s.spellcheck}
            aria-label={t('settings.spellcheck')}
            onclick={() => update('spellcheck', !s.spellcheck)}
          ></button>
        </div>

        <h3 style="font-size:13px;margin:18px 0 4px">{t('settings.editor')}</h3>
        <div class="switch-row">
          <div class="switch-label">
            <strong>{t('settings.mermaid')}</strong>
            <span>{t('settings.mermaidHint')}</span>
          </div>
          <button
            class="switch"
            class:on={s.renderMermaid}
            role="switch"
            aria-checked={s.renderMermaid}
            aria-label={t('settings.mermaid')}
            onclick={() => update('renderMermaid', !s.renderMermaid)}
          ></button>
        </div>
        <div class="switch-row">
          <div class="switch-label">
            <strong>{t('settings.chunked')}</strong>
            <span>{t('settings.chunkedHint')}</span>
          </div>
          <button
            class="switch"
            class:on={s.chunkedRendering}
            role="switch"
            aria-checked={s.chunkedRendering}
            aria-label={t('settings.chunked')}
            onclick={() => update('chunkedRendering', !s.chunkedRendering)}
          ></button>
        </div>

        <h3 style="font-size:13px;margin:18px 0 4px">{t('settings.exportDefaults')}</h3>
        <div class="form-grid">
          <div class="field">
            <label for="html-mode">{t('settings.htmlMode')}</label>
            <select
              id="html-mode"
              value={s.defaultHtmlMode}
              onchange={(event) =>
                update('defaultHtmlMode', event.currentTarget.value as 'folder' | 'single')}
            >
              <option value="folder">{t('export.folder')}</option>
              <option value="single">{t('export.single')}</option>
            </select>
          </div>
          <div class="field">
            <label for="page-start">{t('settings.pageStart')}</label>
            <input
              id="page-start"
              type="number"
              min="1"
              value={s.defaultPageStart}
              onchange={(event) =>
                update('defaultPageStart', Math.max(1, Number(event.currentTarget.value) || 1))}
            />
          </div>
        </div>

        <p class="hint" style="margin-top:18px">
          {t('settings.footnote')}
        </p>
      </div>

      <div class="modal-foot">
        <span class="spacer"></span>
        <button class="button primary" onclick={onclose}>{t('settings.done')}</button>
      </div>
    </div>
  </div>
{/if}
