<script lang="ts">
  // MARK#EZVE.COM
  import {
    closeFind,
    findNext,
    findPrevious,
    findState,
    refreshFind,
    replaceFindAll,
    replaceFindCurrent,
    setFindCaseSensitive,
    setFindQuery,
    toggleReplace
  } from '../editor/find.svelte'
  import { t } from '../i18n'
  import { tabs } from '../stores/tabs.svelte'

  let queryInput = $state<HTMLInputElement>()

  const counter = $derived(
    findState.count > 0
      ? `${findState.active + 1}/${findState.count}`
      : findState.query
        ? '0/0'
        : ''
  )

  // The document can change under an open bar (typing, undo, source edits
  // pushed into the rich editor). Recount, but leave the caret where it is.
  $effect(() => {
    const content = tabs.active?.content
    if (!findState.open || !content) return
    refreshFind()
  })

  // Every Ctrl+Alt+F bumps the token: refocus and pre-select so typing replaces the
  // previous query, the way every other editor behaves.
  $effect(() => {
    const token = findState.focusToken
    if (!token || !findState.open) return
    queryInput?.focus()
    queryInput?.select()
  })

  function onQueryKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (event.shiftKey) findPrevious()
      else findNext()
    }
  }

  function onReplaceKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      replaceFindCurrent()
    }
  }

  function onBarKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return
    // Keep menus and other window-level handlers out of it.
    event.preventDefault()
    event.stopPropagation()
    closeFind()
  }
</script>

{#if findState.open && tabs.active}
  <!-- Escape is handled at the container so it works from any of the fields. -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="find-bar" role="search" onkeydown={onBarKeydown}>
    <div class="find-row">
      <input
        class="find-input"
        type="text"
        bind:this={queryInput}
        value={findState.query}
        placeholder={t('find.placeholder')}
        aria-label={t('find.placeholder')}
        oninput={(event) => setFindQuery(event.currentTarget.value)}
        onkeydown={onQueryKeydown}
      />
      <span class="find-count" aria-live="polite">{counter}</span>
      <button
        class="icon-btn find-nav"
        title={t('find.previous')}
        aria-label={t('find.previous')}
        disabled={findState.count === 0}
        onclick={findPrevious}>↑</button>
      <button
        class="icon-btn find-nav"
        title={t('find.next')}
        aria-label={t('find.next')}
        disabled={findState.count === 0}
        onclick={findNext}>↓</button>
      <button
        class="icon-btn find-case"
        class:active={findState.caseSensitive}
        title={t('find.caseSensitive')}
        aria-label={t('find.caseSensitive')}
        aria-pressed={findState.caseSensitive}
        onclick={() => setFindCaseSensitive(!findState.caseSensitive)}>Aa</button>
      <button
        class="icon-btn"
        class:active={findState.showReplace}
        title={t('find.toggleReplace')}
        aria-label={t('find.toggleReplace')}
        aria-expanded={findState.showReplace}
        onclick={toggleReplace}>⇄</button>
      <button
        class="icon-btn"
        title={t('find.close')}
        aria-label={t('find.close')}
        onclick={closeFind}>×</button>
    </div>
    {#if findState.showReplace}
      <div class="find-row">
        <input
          class="find-input"
          type="text"
          value={findState.replacement}
          placeholder={t('find.replacePlaceholder')}
          aria-label={t('find.replacePlaceholder')}
          oninput={(event) => (findState.replacement = event.currentTarget.value)}
          onkeydown={onReplaceKeydown}
        />
        <span class="find-count"></span>
        <button
          class="button find-action"
          disabled={findState.count === 0}
          onclick={replaceFindCurrent}>{t('find.replaceOne')}</button>
        <button
          class="button find-action"
          disabled={findState.count === 0}
          onclick={replaceFindAll}>{t('find.replaceAll')}</button>
      </div>
    {/if}
  </div>
{/if}
