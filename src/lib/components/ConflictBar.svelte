<script lang="ts">
  // MARK#EZVE.COM
  import { t } from '../i18n'
  import { tabs } from '../stores/tabs.svelte'

  const active = $derived(tabs.active)
  const visible = $derived(
    Boolean(active && tabs.conflict && tabs.conflict.id === active.id)
  )

  async function resolve(action: 'reload' | 'overwrite'): Promise<void> {
    if (!active) return
    const ok = await tabs.resolveConflict(active.id, action)
    if (!ok && tabs.saveError) window.alert(tabs.saveError)
  }
</script>

{#if visible && active}
  <div class="conflict-bar" role="alert">
    <span>{t('conflict.changed', { title: active.title })}</span>
    <span class="conflict-hint">{t('conflict.hint')}</span>
    <span class="spacer"></span>
    <button class="button ghost" onclick={() => void resolve('reload')}>
      {t('conflict.reload')}
    </button>
    <button class="button primary" onclick={() => void resolve('overwrite')}>
      {t('conflict.overwrite')}
    </button>
  </div>
{/if}
