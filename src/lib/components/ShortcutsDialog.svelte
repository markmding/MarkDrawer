<script lang="ts">
  // MARK#EZVE.COM
  import { t, type MessageKey } from '../i18n'
  import {
    comboFromEvent,
    displayCombo,
    resolveShortcuts,
    SHORTCUT_DEFS,
    shortcutConflict,
    type ShortcutGroup,
    type ShortcutId
  } from '../shortcuts'
  import { settings } from '../stores/settings.svelte'

  let { open, onclose }: { open: boolean; onclose: () => void } = $props()

  const s = $derived(settings.value)
  const resolved = $derived(resolveShortcuts(s.shortcuts))

  const GROUPS: { id: ShortcutGroup; labelKey: MessageKey }[] = [
    { id: 'app', labelKey: 'shortcuts.groupApp' },
    { id: 'view', labelKey: 'shortcuts.groupView' },
    { id: 'format', labelKey: 'shortcuts.groupFormat' }
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
        conflict = t('shortcuts.conflict', { name: t(clash.labelKey) })
        return
      }
      settings.setShortcut(id, combo)
      recording = null
      conflict = ''
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })
</script>

{#if open}
  <div
    class="modal-backdrop"
    role="presentation"
    onclick={(event) => {
      if (event.target === event.currentTarget) onclose()
    }}
  >
    <div class="modal" role="dialog" aria-modal="true" aria-label={t('shortcuts.title')} tabindex="-1">
      <div class="modal-head">
        <h2>{t('shortcuts.title')}</h2>
        <button class="icon-btn" title={t('common.close')} onclick={onclose}>×</button>
      </div>

      <div class="modal-body">
        <div class="shortcut-head" style="align-items:center">
          <p class="hint" style="margin:0;flex:1">{t('shortcuts.hint')}</p>
          <button class="button" style="height:26px" onclick={() => settings.resetAllShortcuts()}>
            {t('shortcuts.resetAll')}
          </button>
        </div>
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
                    recording === def.id ? t('shortcuts.recording') : resolved[def.id]
                  }`}
                  onclick={() => {
                    recording = def.id
                    conflict = ''
                  }}
                >
                  {recording === def.id ? t('shortcuts.recording') : displayCombo(resolved[def.id])}
                </button>
                <button
                  class="icon-btn shortcut-reset"
                  title={t('shortcuts.reset')}
                  aria-label={t('shortcuts.reset')}
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

        <p class="hint" style="margin-top:18px">{t('shortcuts.footnote')}</p>
      </div>

      <div class="modal-foot">
        <span class="spacer"></span>
        <button class="button primary" onclick={onclose}>{t('shortcuts.done')}</button>
      </div>
    </div>
  </div>
{/if}
