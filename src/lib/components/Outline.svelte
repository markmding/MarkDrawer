<script lang="ts">
  // MARK#EZVE.COM
  import { t } from '../i18n'
  import { extractHeadings, requestHeading } from '../markdown/headings'

  let { markdown, onclose }: { markdown: string; onclose?: () => void } = $props()

  const headings = $derived(extractHeadings(markdown))
</script>

<aside class="outline" aria-label={t('outline.title')}>
  <div class="outline-head">
    <span class="outline-title">{t('outline.title')}</span>
    {#if onclose}
      <button
        class="icon-btn outline-close"
        title={t('menu.toggleOutline')}
        aria-label={t('menu.toggleOutline')}
        onclick={onclose}>×</button
      >
    {/if}
  </div>

  {#if headings.length}
    <nav class="outline-list">
      {#each headings as heading (heading.index)}
        <button
          class="outline-item"
          class:level-1={heading.level === 1}
          style={`padding-left:${(heading.level - 1) * 12 + 10}px`}
          title={heading.text}
          onclick={() => requestHeading(heading.index)}
        >
          {heading.text}
        </button>
      {/each}
    </nav>
  {:else}
    <p class="outline-empty">{t('outline.empty')}</p>
  {/if}
</aside>
