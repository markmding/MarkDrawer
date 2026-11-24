<script lang="ts">
  // MARK#EZVE.COM
  import { t } from '../i18n'
  import { tabs } from '../stores/tabs.svelte'

  let { onnew }: { onnew: () => void } = $props()
</script>

<div class="tabbar" role="tablist" aria-label={t('tab.aria')}>
  {#each tabs.tabs as tab (tab.id)}
    <div
      class="tab"
      class:active={tabs.activeId === tab.id}
      role="tab"
      tabindex="0"
      aria-selected={tabs.activeId === tab.id}
      title={tab.path}
      onclick={() => tabs.select(tab.id)}
      onkeydown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          tabs.select(tab.id)
        }
      }}
    >
      {#if tab.dirty}
        <span class="tab-dot" title={t('tab.dirty')}></span>
      {/if}
      <span class="tab-title">{tab.title}</span>
      <button
        class="tab-close"
        title={t('tab.close')}
        aria-label={t('tab.closeAria', { title: tab.title })}
        onclick={(event) => {
          event.stopPropagation()
          tabs.close(tab.id)
        }}>×</button>
    </div>
  {/each}
  <button class="icon-btn tabbar-new" title={t('tab.newNote')} onclick={onnew}>＋</button>
</div>
