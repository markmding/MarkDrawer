<script lang="ts">
  // MARK#EZVE.COM
  import { createEntry, deleteEntry, renameEntry, searchDrawer } from '../api/drawer'
  import { flattenTree, filterTree } from '../filetree'
  import { t } from '../i18n'
  import { basename, dirname, isTextFile, joinPath, withDefaultExtension } from '../paths'
  import { tabs, tabId } from '../stores/tabs.svelte'
  import { drawer } from '../stores/drawer.svelte'
  import type { SearchHit } from '../types'

  let { onnew }: { onnew: (folder?: string) => void } = $props()

  let query = $state('')
  let dragPath = $state<string | null>(null)
  let dropTarget = $state<string | null>(null)
  let hits = $state<SearchHit[]>([])
  let searchBusy = $state(false)
  let searchError = $state<string | null>(null)

  const filtered = $derived(
    query.trim() ? filterTree(drawer.entries, query.trim()) : drawer.entries
  )
  const rows = $derived(flattenTree(filtered, drawer.expanded))
  const fullTextMode = $derived(query.trim().length >= 2)

  $effect(() => {
    const text = query.trim()
    const root = drawer.root
    if (!root || text.length < 2) {
      hits = []
      searchBusy = false
      searchError = null
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      searchBusy = true
      void searchDrawer(root, text, 30)
        .then((result) => {
          if (cancelled) return
          hits = result
          searchError = null
        })
        .catch((error) => {
          if (!cancelled) searchError = message(error)
        })
        .finally(() => {
          if (!cancelled) searchBusy = false
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  })

  function message(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  async function openEntry(path: string): Promise<void> {
    if (!drawer.root) return
    if (!isTextFile(path)) {
      window.alert(t('drawer.unsupported'))
      return
    }
    try {
      await tabs.open(drawer.root, path)
    } catch (error) {
      window.alert(message(error))
    }
  }

  /** Whether a drawer-relative path is the active tab. */
  function isActive(path: string): boolean {
    return drawer.root !== null && tabs.activeId === tabId(drawer.root, path)
  }

  function activeFolder(): string {
    if (!tabs.active || !drawer.root || tabs.active.root !== drawer.root) return ''
    return dirname(tabs.active.path)
  }

  async function newFolder(parent = activeFolder()): Promise<void> {
    if (!drawer.root) return
    const name = window.prompt(t('drawer.promptNewFolder'))
    if (!name?.trim()) return
    try {
      await createEntry(drawer.root, joinPath(parent, name.trim()), 'dir')
      await drawer.refresh()
    } catch (error) {
      window.alert(message(error))
    }
  }

  async function rename(entryPath: string, isDir = false): Promise<void> {
    if (!drawer.root) return
    const current = basename(entryPath)
    const next = window.prompt(t('drawer.promptRename'), current)
    if (!next?.trim() || next.trim() === current) return
    const target = joinPath(
      dirname(entryPath),
      isDir ? next.trim() : withDefaultExtension(next.trim(), entryPath)
    )
    try {
      await renameEntry(drawer.root, entryPath, target)
      tabs.renameInRoot(drawer.root, entryPath, target)
      await drawer.refresh()
    } catch (error) {
      window.alert(message(error))
    }
  }

  async function remove(entryPath: string): Promise<void> {
    if (!drawer.root) return
    if (!window.confirm(t('drawer.confirmDelete', { name: basename(entryPath) }))) return
    try {
      await deleteEntry(drawer.root, entryPath)
      tabs.closeByPath(drawer.root, entryPath, true)
      await drawer.refresh()
    } catch (error) {
      window.alert(message(error))
    }
  }

  async function moveInto(targetDir: string): Promise<void> {
    const source = dragPath
    dragPath = null
    dropTarget = null
    if (!drawer.root || !source) return
    if (dirname(source) === targetDir) return
    if (targetDir === source || targetDir.startsWith(`${source}/`)) return
    const target = joinPath(targetDir, basename(source))
    try {
      await renameEntry(drawer.root, source, target)
      tabs.renameInRoot(drawer.root, source, target)
      await drawer.refresh()
    } catch (error) {
      window.alert(message(error))
    }
  }

  function handleDrop(event: DragEvent, targetDir: string): void {
    event.preventDefault()
    event.stopPropagation()
    void moveInto(targetDir)
  }
</script>

<aside class="sidebar">
  <div class="sidebar-head">
    <span class="sidebar-title">{drawer.name || t('drawer.notOpen')}</span>
    <button class="icon-btn" title={t('drawer.newNoteTitle')} onclick={() => onnew()}>＋</button>
    <button class="icon-btn" title={t('drawer.refresh')} onclick={() => void drawer.refresh()}>↻</button>
  </div>

  <div class="sidebar-search">
    <input
      type="search"
      placeholder={t('drawer.searchPlaceholder')}
      bind:value={query}
      aria-label={t('drawer.searchAria')}
    />
  </div>

  <div
    class="file-tree"
    role="tree"
    tabindex="0"
    ondragover={(event) => {
      event.preventDefault()
      dropTarget = ''
    }}
    ondragleave={() => (dropTarget = null)}
    ondrop={(event) => handleDrop(event, '')}
    class:drop-root={dropTarget === ''}
  >
    {#if fullTextMode}
      <div class="search-section-title">
        {t('drawer.contentMatches')}{searchBusy
          ? ` · ${t('drawer.searching')}`
          : hits.length
            ? ` · ${hits.length}`
            : ''}
      </div>
      {#if searchError}
        <div class="empty">{searchError}</div>
      {:else if !searchBusy && hits.length === 0}
        <div class="empty">{t('drawer.noContentMatch')}</div>
      {/if}
      {#each hits as hit (hit.path)}
        <button
          class="search-hit"
          title={hit.path}
          onclick={() => void openEntry(hit.path)}
        >
          <span class="search-hit-title">{hit.title}</span>
          <span class="search-hit-path">{hit.path}</span>
          <span class="search-hit-snippet">{hit.snippet}</span>
        </button>
      {/each}
      <div class="search-section-title">{t('drawer.files')}</div>
    {/if}

    {#if rows.length === 0}
      <div class="empty">
        {drawer.isOpen ? t('drawer.noMatch') : t('drawer.emptyHint')}
      </div>
    {/if}

    {#each rows as row (row.entry.path)}
      {@const entry = row.entry}
      <div
        class="tree-row"
        class:selected={isActive(entry.path)}
        class:drag-over={dropTarget === entry.path}
        role="treeitem"
        tabindex="-1"
        aria-selected={isActive(entry.path)}
        aria-expanded={entry.kind === 'dir' ? drawer.isExpanded(entry.path) : undefined}
        style={`padding-left: ${6 + row.depth * 14}px`}
        draggable={entry.kind === 'file'}
        onclick={() =>
          entry.kind === 'dir' ? void drawer.toggle(entry.path) : void openEntry(entry.path)}
        onkeydown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (entry.kind === 'dir') void drawer.toggle(entry.path)
            else void openEntry(entry.path)
          }
        }}
        ondragstart={(event) => {
          dragPath = entry.path
          event.dataTransfer?.setData('text/plain', entry.path)
          if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
        }}
        ondragend={() => {
          dragPath = null
          dropTarget = null
        }}
        ondragover={(event) => {
          if (entry.kind !== 'dir') return
          event.preventDefault()
          event.stopPropagation()
          dropTarget = entry.path
        }}
        ondrop={(event) => entry.kind === 'dir' && handleDrop(event, entry.path)}
      >
        <span class="tree-caret" class:open={entry.kind === 'dir' && drawer.isExpanded(entry.path)}>
          {entry.kind === 'dir' ? '▶' : ''}
        </span>
        <span class="tree-icon">{entry.kind === 'dir' ? '📁' : '📄'}</span>
        <span class="tree-label" title={entry.path}>{entry.name}</span>
        <span class="tree-actions">
          {#if entry.kind === 'dir'}
            <button
              title={t('drawer.newNoteHere')}
              onclick={(event) => {
                event.stopPropagation()
                onnew(entry.path)
              }}>＋</button>
          {/if}
          <button
            title={t('drawer.rename')}
            onclick={(event) => {
              event.stopPropagation()
              void rename(entry.path, entry.kind === 'dir')
            }}>✎</button>
          <button
            title={t('drawer.delete')}
            onclick={(event) => {
              event.stopPropagation()
              void remove(entry.path)
            }}>✕</button>
        </span>
      </div>
    {/each}
  </div>

  <div class="sidebar-foot">
    <button class="icon-btn" title={t('drawer.newFolderTitle')} onclick={() => void newFolder()}>📁＋</button>
    <button class="icon-btn" title={t('drawer.expandAll')} onclick={() => drawer.expandAll(true)}>
      {t('drawer.expandAll')}
    </button>
    <button class="icon-btn" title={t('drawer.collapseAll')} onclick={() => drawer.expandAll(false)}>
      {t('drawer.collapseAll')}
    </button>
    <span class="spacer" style="flex:1"></span>
    {#if drawer.isDemo}
      <span class="faint" style="font-size:11px">{t('drawer.demoBadge')}</span>
    {/if}
  </div>
</aside>
