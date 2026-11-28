<script lang="ts">
  // MARK#EZVE.COM
  import type { Snippet } from 'svelte'
  import { t } from '../i18n'
  import { tabs } from '../stores/tabs.svelte'

  // `leading` / `trailing` hold fixed buttons at both ends of the bar; only the
  // tab list between them scrolls.
  let {
    onnew,
    leading,
    trailing
  }: { onnew: () => void; leading?: Snippet; trailing?: Snippet } = $props()
</script>

<div class="tabbar" role="tablist" aria-label={t('tab.aria')}>
  {#if leading}
    <div class="tabbar-edge tabbar-leading">{@render leading()}</div>
  {/if}

  <div class="tabbar-scroll">
    {#each tabs.tabs as tab (tab.id)}
      <div
        class="tab"
        class:active={tabs.activeId === tab.id}
        role="tab"
        tabindex="0"
        aria-selected={tabs.activeId === tab.id}
        title={tab.id}
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

  {#if trailing}
    <div class="tabbar-edge tabbar-trailing">{@render trailing()}</div>
  {/if}
</div>
