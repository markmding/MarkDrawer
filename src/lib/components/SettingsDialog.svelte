<script lang="ts">
  // MARK#EZVE.COM
  import { t, LOCALES, type Locale, type MessageKey } from '../i18n'
  import {
    comboFromEvent,
    displayCombo,
    resolveShortcuts,
    SHORTCUT_DEFS,
    shortcutConflict,
    type ShortcutGroup,
    type ShortcutId
  } from '../shortcuts'
  import {
    settings,
    type AppTheme,
    type SettingsState
  } from '../stores/settings.svelte'
  import { themes } from '../stores/themes.svelte'

  let {
    open,
    onclose,
    section = ''
  }: { open: boolean; onclose: () => void; section?: string } = $props()

  const s = $derived(settings.value)
  const resolved = $derived(resolveShortcuts(s.shortcuts))

  const GROUPS: { id: ShortcutGroup; labelKey: MessageKey }[] = [
    { id: 'app', labelKey: 'settings.shortcutGroupApp' },
    { id: 'view', labelKey: 'settings.shortcutGroupView' },
    { id: 'format', labelKey: 'settings.shortcutGroupFormat' }
  ]

  let recording = $state<ShortcutId | null>(null)
  let conflict = $state('')

  // Closing the dialog always ends a pending recording.
  $effect(() => {
    if (!open) {
      recording = null
      conflict = ''
    }
  })

  // Captured so the app-level handler never sees the keys being recorded.
  $effect(() => {
    const id = recording
    if (!id || !open) return
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        recording = null
        conflict = ''
        return
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        settings.resetShortcut(id)
        recording = null
        conflict = ''
        return
      }
      const combo = comboFromEvent(event)
      if (!combo) return
      const clash = shortcutConflict(id, combo, resolveShortcuts(settings.value.shortcuts))
      if (clash) {
        conflict = t('settings.shortcutConflict', { name: t(clash.labelKey) })
        return
      }
      settings.setShortcut(id, combo)
      recording = null
      conflict = ''
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  // Opened from 选项 → 自定义快捷键: bring the section into view.
  $effect(() => {
    if (!open || section !== 'shortcuts') return
    const frame = requestAnimationFrame(() => {
      document.getElementById('settings-shortcuts')?.scrollIntoView({ block: 'start' })
    })
    return () => cancelAnimationFrame(frame)
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
            onchange={(event) => update('language', event.currentTarget.value as Locale)}
          >
            {#each LOCALES as locale (locale.value)}
              <option value={locale.value}>{locale.label}</option>
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
        <div class="switch-row">
          <div class="switch-label">
            <strong>{t('settings.timer')}</strong>
            <span>{t('settings.timerHint')}</span>
          </div>
          <button
            class="switch"
            class:on={s.autosaveTimer}
            role="switch"
            aria-checked={s.autosaveTimer}
            aria-label={t('settings.timer')}
            onclick={() => update('autosaveTimer', !s.autosaveTimer)}
          ></button>
        </div>
        {#if s.autosaveTimer}
          <div class="field" style="margin:6px 0 12px">
            <label for="interval">{t('settings.interval', { seconds: s.autosaveInterval })}</label>
            <input
              id="interval"
              type="range"
              min="10"
              max="300"
              step="5"
              value={s.autosaveInterval}
              oninput={(event) => update('autosaveInterval', Number(event.currentTarget.value))}
            />
          </div>
        {/if}
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

        <div class="shortcut-head" id="settings-shortcuts">
          <h3 style="font-size:13px;margin:18px 0 4px">{t('settings.shortcuts')}</h3>
          <button class="button" style="height:26px" onclick={() => settings.resetAllShortcuts()}>
            {t('settings.shortcutResetAll')}
          </button>
        </div>
        <p class="hint" style="margin:0 0 10px">{t('settings.shortcutsHint')}</p>
        {#each GROUPS as group (group.id)}
          <h4 class="shortcut-group">{t(group.labelKey)}</h4>
          <div class="shortcut-list">
            {#each SHORTCUT_DEFS.filter((def) => def.group === group.id) as def (def.id)}
              <div class="shortcut-row" class:active={recording === def.id}>
                <span class="shortcut-name">{t(def.labelKey)}</span>
                <button
                  class="shortcut-key"
                  class:recording={recording === def.id}
                  aria-label={`${t(def.labelKey)}: ${
                    recording === def.id ? t('settings.shortcutRecording') : resolved[def.id]
                  }`}
                  onclick={() => {
                    recording = def.id
                    conflict = ''
                  }}
                >
                  {recording === def.id ? t('settings.shortcutRecording') : displayCombo(resolved[def.id])}
                </button>
                <button
                  class="icon-btn shortcut-reset"
                  title={t('settings.shortcutReset')}
                  aria-label={t('settings.shortcutReset')}
                  disabled={!s.shortcuts[def.id]}
                  onclick={() => settings.resetShortcut(def.id)}
                >
                  ↺
                </button>
              </div>
            {/each}
          </div>
        {/each}
        {#if conflict}<p class="shortcut-conflict">{conflict}</p>{/if}

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
