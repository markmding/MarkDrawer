<script lang="ts">
  // MARK#EZVE.COM
  import { onMount } from 'svelte'
  import ConflictBar from './lib/components/ConflictBar.svelte'
  import EditorPane from './lib/components/EditorPane.svelte'
  import FindBar from './lib/components/FindBar.svelte'
  import LazyExportDialog from './lib/components/LazyExportDialog.svelte'
  import NewDocDialog from './lib/components/NewDocDialog.svelte'
  import Outline from './lib/components/Outline.svelte'
  import SettingsDialog from './lib/components/SettingsDialog.svelte'
  import ShortcutsDialog from './lib/components/ShortcutsDialog.svelte'
  import Sidebar from './lib/components/Sidebar.svelte'
  import StatusBar from './lib/components/StatusBar.svelte'
  import TabBar from './lib/components/TabBar.svelte'
  import TextPane from './lib/components/TextPane.svelte'
  import Welcome from './lib/components/Welcome.svelte'
  import { getCurrentWindow } from '@tauri-apps/api/window'
  import { listenOpenFile, listenDrawerChanges, takeLaunchFile } from './lib/api/tauri'
  import { APP_VERSION, BRAND_NAME, BRAND_NAME_ZH, BRAND_SLOGAN_EN, BRAND_SLOGAN_ZH, WELCOME_DOC } from './lib/brand'
  import { runEditorAction, type EditorAction } from './lib/editor/actions'
  import { closeFind, findState, openFind } from './lib/editor/find.svelte'
  import { FRONTMATTER_EVENT } from './lib/editor/frontmatter-view'
  import { isEnglish, t } from './lib/i18n'
  import { basename, dirname } from './lib/paths'
  import {
    comboMatches,
    displayCombo,
    resolveShortcuts,
    SHORTCUT_DEFS,
    type ShortcutId
  } from './lib/shortcuts'
  import { OUTLINE_STORAGE_KEY, settings } from './lib/stores/settings.svelte'
  import { tabs } from './lib/stores/tabs.svelte'
  import { themes } from './lib/stores/themes.svelte'
  import { drawer } from './lib/stores/drawer.svelte'
  import type { ViewMode } from './lib/types'

  let viewMode = $state<ViewMode>('wysiwyg')
  // Outline visibility is a UI preference, not a document setting; keep it in
  // localStorage so it survives restarts without touching the settings file.
  let outlineVisible = $state(
    typeof localStorage !== 'undefined' && localStorage.getItem(OUTLINE_STORAGE_KEY) === '1'
  )
  let showExport = $state(false)
  let showSettings = $state(false)
  // Keyboard bindings live in their own dialog; the settings page stays a
  // plain preferences list.
  let showShortcuts = $state(false)
  let showNewDoc = $state(false)
  let showAbout = $state(false)
  let newDocFolder = $state('')
  let openMenu = $state<string | null>(null)
  let focusBeforeMenu: HTMLElement | null = null
  let lastEditorFocus: HTMLElement | null = null

  const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  const appWindow = IS_TAURI ? getCurrentWindow() : null

  const textTabActive = $derived(tabs.active?.kind === 'text')
  const markdownTabActive = $derived(tabs.active?.kind === 'markdown')
  const canFormat = $derived(markdownTabActive && viewMode !== 'source')
  /** Effective bindings: user overrides layered over the defaults. */
  const shortcuts = $derived(resolveShortcuts(settings.value.shortcuts))

  interface MenuAction {
    label: string
    shortcut?: string
    disabled?: boolean
    checked?: boolean
    run: () => void
  }
  type MenuEntry = MenuAction | { separator: true }
  interface Menu {
    id: string
    label: string
    entries: MenuEntry[]
  }

  const menus = $derived<Menu[]>([
    {
      id: 'file',
      label: t('menu.file'),
      entries: [
        {
          label: t('menu.openDrawer'),
          shortcut: displayCombo(shortcuts.openDrawer),
          run: () => void openDrawer()
        },
        {
          label: t('menu.newNote'),
          shortcut: displayCombo(shortcuts.newNote),
          run: () => void openNewDoc()
        },
        {
          label: t('menu.searchDrawer'),
          shortcut: displayCombo(shortcuts.searchDrawer),
          disabled: !drawer.isOpen,
          run: focusDrawerSearch
        },
        { separator: true },
        {
          label: t('menu.save'),
          shortcut: displayCombo(shortcuts.save),
          disabled: !tabs.active,
          run: () => void saveActive()
        },
        {
          label: t('menu.export'),
          shortcut: displayCombo(shortcuts.export),
          disabled: !markdownTabActive,
          run: () => (showExport = true)
        },
        { separator: true },
        {
          label: t('menu.closeTab'),
          shortcut: displayCombo(shortcuts.closeTab),
          disabled: !tabs.active,
          run: closeActiveTab
        }
      ]
    },
    {
      id: 'edit',
      label: t('menu.edit'),
      entries: [
        {
          label: t('menu.undo'),
          shortcut: displayCombo(shortcuts.undo),
          disabled: !tabs.active,
          run: () => editCommand('undo')
        },
        {
          label: t('menu.redo'),
          shortcut: displayCombo(shortcuts.redo),
          disabled: !tabs.active,
          run: () => editCommand('redo')
        },
        { separator: true },
        {
          label: t('menu.selectAll'),
          shortcut: displayCombo(shortcuts.selectAll),
          disabled: !tabs.active,
          run: () => editCommand('selectAll')
        },
        {
          label: t('menu.find'),
          shortcut: displayCombo(shortcuts.find),
          disabled: !tabs.active,
          run: () => openFind(false)
        },
        {
          label: t('menu.replace'),
          shortcut: displayCombo(shortcuts.replace),
          disabled: !tabs.active,
          run: () => openFind(true)
        }
      ]
    },
    {
      id: 'format',
      label: t('menu.format'),
      entries: [
        { label: t('menu.bold'), shortcut: displayCombo(shortcuts.bold), disabled: !canFormat, run: () => format('strong') },
        { label: t('menu.italic'), shortcut: displayCombo(shortcuts.italic), disabled: !canFormat, run: () => format('emphasis') },
        { label: t('menu.strikethrough'), shortcut: displayCombo(shortcuts.strikethrough), disabled: !canFormat, run: () => format('strikethrough') },
        { label: t('menu.inlineCode'), shortcut: displayCombo(shortcuts.inlineCode), disabled: !canFormat, run: () => format('inlineCode') },
        { separator: true },
        { label: t('menu.h1'), shortcut: displayCombo(shortcuts.heading1), disabled: !canFormat, run: () => format('heading1') },
        { label: t('menu.h2'), shortcut: displayCombo(shortcuts.heading2), disabled: !canFormat, run: () => format('heading2') },
        { label: t('menu.h3'), shortcut: displayCombo(shortcuts.heading3), disabled: !canFormat, run: () => format('heading3') },
        { label: t('menu.h4'), shortcut: displayCombo(shortcuts.heading4), disabled: !canFormat, run: () => format('heading4') },
        { label: t('menu.h5'), shortcut: displayCombo(shortcuts.heading5), disabled: !canFormat, run: () => format('heading5') },
        { label: t('menu.h6'), shortcut: displayCombo(shortcuts.heading6), disabled: !canFormat, run: () => format('heading6') },
        { label: t('menu.paragraph'), shortcut: displayCombo(shortcuts.paragraph), disabled: !canFormat, run: () => format('paragraph') },
        { separator: true },
        { label: t('menu.quote'), shortcut: displayCombo(shortcuts.blockquote), disabled: !canFormat, run: () => format('blockquote') },
        { label: t('menu.bulletList'), shortcut: displayCombo(shortcuts.bulletList), disabled: !canFormat, run: () => format('bulletList') },
        { label: t('menu.orderedList'), shortcut: displayCombo(shortcuts.orderedList), disabled: !canFormat, run: () => format('orderedList') },
        { separator: true },
        { label: t('menu.codeBlock'), shortcut: displayCombo(shortcuts.codeBlock), disabled: !canFormat, run: () => format('codeBlock') },
        { label: t('menu.table'), shortcut: displayCombo(shortcuts.table), disabled: !canFormat, run: () => format('table') },
        { label: t('menu.taskStatus'), shortcut: displayCombo(shortcuts.taskStatus), disabled: !canFormat, run: () => format('taskStatus') }
      ]
    },
    {
      id: 'view',
      label: t('menu.view'),
      entries: [
        {
          label: t('menu.preview'),
          checked: viewMode === 'wysiwyg',
          disabled: textTabActive,
          run: () => (viewMode = 'wysiwyg')
        },
        {
          label: t('menu.source'),
          shortcut: displayCombo(shortcuts.toggleSource),
          checked: viewMode === 'source',
          disabled: textTabActive,
          run: () => (viewMode = 'source')
        },
        {
          label: t('menu.split'),
          shortcut: displayCombo(shortcuts.split),
          checked: viewMode === 'split',
          disabled: textTabActive,
          run: () => (viewMode = 'split')
        },
        { separator: true },
        {
          label: t('menu.toggleSidebar'),
          shortcut: displayCombo(shortcuts.toggleSidebar),
          checked: settings.value.sidebarVisible,
          run: toggleSidebar
        },
        {
          label: t('menu.outline'),
          shortcut: displayCombo(shortcuts.outline),
          checked: outlineVisible,
          disabled: !markdownTabActive,
          run: toggleOutline
        }
      ]
    },
    {
      id: 'options',
      label: t('menu.options'),
      entries: [
        {
          label: t('menu.customizeShortcuts'),
          run: () => (showShortcuts = true)
        },
        {
          label: t('menu.settings'),
          shortcut: displayCombo(shortcuts.settings),
          run: () => (showSettings = true)
        }
      ]
    },
    {
      id: 'about',
      label: t('menu.about'),
      entries: [
        { label: t('menu.aboutItem'), run: () => (showAbout = true) },
        { label: t('menu.version', { version: APP_VERSION }), disabled: true, run: () => {} }
      ]
    }
  ])

  /** Ids whose action must work even when a text input has focus. */
  const APP_LEVEL_SHORTCUTS = new Set<ShortcutId>([
    'save',
    'export',
    'openDrawer',
    'newNote',
    'closeTab',
    'find',
    'replace',
    'searchDrawer',
    'settings'
  ])

  const FORMAT_SHORTCUTS: Partial<Record<ShortcutId, EditorAction>> = {
    bold: 'strong',
    italic: 'emphasis',
    strikethrough: 'strikethrough',
    inlineCode: 'inlineCode',
    heading1: 'heading1',
    heading2: 'heading2',
    heading3: 'heading3',
    heading4: 'heading4',
    heading5: 'heading5',
    heading6: 'heading6',
    paragraph: 'paragraph',
    blockquote: 'blockquote',
    bulletList: 'bulletList',
    orderedList: 'orderedList',
    codeBlock: 'codeBlock',
    table: 'table',
    taskStatus: 'taskStatus'
  }

  /**
   * Runs the action bound to an id. Returns false when the action does not
   * apply right now, so the key event keeps its native behaviour.
   */
  function runShortcut(id: ShortcutId): boolean {
    const formatAction = FORMAT_SHORTCUTS[id]
    if (formatAction) {
      if (!canFormat) return false
      format(formatAction)
      return true
    }
    switch (id) {
      case 'openDrawer':
        void openDrawer()
        return true
      case 'newNote':
        void openNewDoc()
        return true
      case 'save':
        if (!tabs.active) return false
        void saveActive()
        return true
      case 'export':
        if (!markdownTabActive) return false
        showExport = true
        return true
      case 'closeTab':
        if (!tabs.active) return false
        closeActiveTab()
        return true
      case 'undo':
      case 'redo':
      case 'selectAll':
        if (!tabs.active) return false
        editCommand(id)
        return true
      case 'find':
        if (!tabs.active) return false
        openFind(false)
        return true
      case 'replace':
        if (!tabs.active) return false
        openFind(true)
        return true
      case 'searchDrawer':
        if (!drawer.isOpen) return false
        focusDrawerSearch()
        return true
      case 'settings':
        showSettings = true
        return true
      case 'toggleSource':
        if (!markdownTabActive) return false
        viewMode = viewMode === 'wysiwyg' ? 'source' : 'wysiwyg'
        return true
      case 'split':
        if (!markdownTabActive) return false
        viewMode = 'split'
        return true
      case 'toggleSidebar':
        toggleSidebar()
        return true
      case 'outline':
        if (!markdownTabActive) return false
        toggleOutline()
        return true
      default:
        return false
    }
  }

  // Export and Markdown preview modes do not apply to plain-text files.
  $effect(() => {
    if (textTabActive) showExport = false
  })

  $effect(() => {
    settings.applyTheme()
  })

  $effect(() => {
    themes.applySelection()
  })

  // F2.8 timer autosave — independent from blur autosave.
  $effect(() => {
    const enabled = settings.value.autosaveTimer
    // Presets run from 10 s to 1 h; the ceiling only guards a corrupt value.
    const seconds = Math.min(86400, Math.max(10, settings.value.autosaveInterval))
    if (!enabled) return
    const timer = setInterval(() => void tabs.saveAll(), seconds * 1000)
    return () => clearInterval(timer)
  })

  onMount(() => {
    let watcherTimer: ReturnType<typeof setTimeout> | undefined
    let unlisten: (() => void) | undefined
    let disposed = false

    // Themes are app-level (next to the executable), so load them before a
    // drawer is even opened.
    void themes.load()

    void listenDrawerChanges((paths) => {
      const themeChanged = paths.some((path) => /[\\/]themes[\\/]/i.test(path))
      clearTimeout(watcherTimer)
      watcherTimer = setTimeout(() => {
        void drawer.refresh().then(() => {
          if (themeChanged) void themes.load()
        })
        tabs.syncFromDisk(paths)
      }, 350)
    }).then((fn) => {
      if (disposed) fn()
      else unlisten = fn
    })

    // Files opened from Explorer, "open with", or the command line. The first
    // launch path is queued in Rust until the webview is ready; later launches
    // arrive as `open-file` events via the single-instance plugin.
    let unlistenOpenFile: (() => void) | undefined
    void listenOpenFile((path) => void openExternalFile(path))
      .then(async (fn) => {
        if (disposed) {
          fn()
          return
        }
        unlistenOpenFile = fn
        const launchFile = await takeLaunchFile()
        if (launchFile && !disposed) void openExternalFile(launchFile)
      })
      .catch(() => {
        // Not running inside Tauri.
      })

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openMenu) {
        openMenu = null
        return
      }
      // Esc from the editor closes the find bar; the bar's own handler covers
      // the case where focus is already inside it.
      if (event.key === 'Escape' && findState.open && !event.defaultPrevented) {
        closeFind()
        return
      }
      if (event.defaultPrevented) return
      if (!(event.ctrlKey || event.metaKey)) return
      const resolved = resolveShortcuts(settings.value.shortcuts)
      const match = SHORTCUT_DEFS.find((def) => comboMatches(event, resolved[def.id]))
      if (!match) return
      // Let text fields keep their own editing keys (undo, select-all, …).
      const target = event.target as HTMLElement | null
      const inTextField =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          (target.isContentEditable && !target.closest('.ProseMirror, .cm-content')))
      if (inTextField && !APP_LEVEL_SHORTCUTS.has(match.id)) return
      if (runShortcut(match.id)) event.preventDefault()
    }

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest?.('.ProseMirror, .cm-content')) {
        lastEditorFocus = target
      }
    }

    // The YAML card is read-only, so editing it means switching to the source
    // view; the card lives inside the editor and only signals this event.
    const onEditFrontmatter = () => {
      if (markdownTabActive) viewMode = 'source'
    }

    window.addEventListener('keydown', onKeydown)
    window.addEventListener('focusin', onFocusIn)
    window.addEventListener(FRONTMATTER_EVENT, onEditFrontmatter)
    return () => {
      disposed = true
      clearTimeout(watcherTimer)
      unlisten?.()
      unlistenOpenFile?.()
      window.removeEventListener('keydown', onKeydown)
      window.removeEventListener('focusin', onFocusIn)
      window.removeEventListener(FRONTMATTER_EVENT, onEditFrontmatter)
    }
  })

  async function openDrawer(): Promise<boolean> {
    const opened = await drawer.choose()
    if (opened) {
      tabs.reset()
      await themes.load()
    } else if (drawer.error) {
      window.alert(drawer.error)
    }
    return opened
  }

  async function openDemo(): Promise<void> {
    await drawer.openDemo()
    tabs.reset()
    await themes.load()
    await tabs.open(WELCOME_DOC)
  }

  /**
   * Rust returns canonicalized Windows paths with the `\\?\` prefix; strip it
   * so OS-supplied paths and Drawer roots can be compared as plain strings.
   */
  function plainPath(path: string): string {
    const slashed = path.replace(/\\/g, '/')
    const unc = slashed.replace(/^\/\/\?\/unc\//i, '//')
    return unc.replace(/^\/\/\?\//, '')
  }

  /** Opens a document handed over by the OS; its folder becomes the Drawer. */
  async function openExternalFile(rawPath: string): Promise<void> {
    const target = plainPath(rawPath)
    const name = basename(target)
    let folder = dirname(target)
    // `D:` alone means "current directory on D:" for the OS — keep the root slash.
    if (/^[A-Za-z]:$/.test(folder)) folder = `${folder}/`
    if (!name || !folder) return

    const current = plainPath(drawer.root ?? '').replace(/\/+$/, '')
    const inside =
      current.length > 0 && target.toLowerCase().startsWith(`${current.toLowerCase()}/`)

    if (!inside) {
      if (tabs.dirtyCount > 0) {
        const proceed = window.confirm(t('alerts.switchDrawer', { name }))
        if (!proceed) return
      }
      const opened = await drawer.open(folder)
      if (!opened) {
        window.alert(t('alerts.openFailed', { folder }))
        return
      }
      tabs.reset()
      await themes.load()
    }

    const root = plainPath(drawer.root ?? '').replace(/\/+$/, '')
    const rel = target.slice(root.length).replace(/^\/+/, '')
    try {
      await tabs.open(rel)
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : String(cause))
    }
  }

  async function openNewDoc(folder?: string): Promise<void> {
    // Clicking "new note" before choosing a folder used to do nothing at all.
    // Ask for the Drawer first, then continue with the new-note dialog. The
    // browser preview has no folder picker, so it falls back to the demo drawer.
    if (!drawer.isOpen) {
      if (IS_TAURI) {
        const opened = await openDrawer()
        if (!opened) return
      } else {
        await openDemo()
        if (!drawer.isOpen) return
      }
    }
    newDocFolder = folder ?? (tabs.active ? dirname(tabs.active.path) : '')
    showNewDoc = true
  }

  async function createNewDoc(name: string, content: string): Promise<void> {
    await tabs.createAndOpen(newDocFolder, name, content)
  }

  async function saveActive(force = false): Promise<void> {
    const tab = tabs.active
    if (!tab) return
    const outcome = await tabs.save(tab.path, force)
    // Conflicts surface as a non-blocking banner above the editor.
    if (outcome === 'error' && tabs.saveError) {
      window.alert(tabs.saveError.replace(/^ENCODING:/, ''))
    }
  }

  function toggleSidebar(): void {
    settings.update({ sidebarVisible: !settings.value.sidebarVisible })
  }

  function toggleOutline(): void {
    outlineVisible = !outlineVisible
    try {
      localStorage.setItem(OUTLINE_STORAGE_KEY, outlineVisible ? '1' : '0')
    } catch {
      // Private/storage-disabled contexts: the panel still toggles for now.
    }
  }

  function toggleMenu(id: string): void {
    if (openMenu === id) {
      openMenu = null
      return
    }
    if (!openMenu) {
      focusBeforeMenu = document.activeElement as HTMLElement | null
    }
    openMenu = id
  }

  function hoverMenu(id: string): void {
    if (openMenu && openMenu !== id) openMenu = id
  }

  function chooseMenu(run: () => void): void {
    const previous = lastEditorFocus?.isConnected ? lastEditorFocus : focusBeforeMenu
    focusBeforeMenu = null
    openMenu = null
    if (previous?.isConnected) previous.focus()
    run()
  }

  function closeMenuOnOutsideClick(event: MouseEvent): void {
    if (!openMenu) return
    const target = event.target as Element | null
    if (!target?.closest?.('.menubar')) openMenu = null
  }

  function format(action: EditorAction): void {
    runEditorAction(action)
  }

  function editCommand(command: 'undo' | 'redo' | 'selectAll'): void {
    // ProseMirror and CodeMirror both handle the standard editing shortcuts;
    // dispatching the key event works for either editor without knowing which
    // one is mounted.
    const target = lastEditorFocus?.isConnected
      ? lastEditorFocus
      : (document.activeElement as HTMLElement | null)
    if (!target) return
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: command === 'selectAll' ? 'a' : 'z',
        ctrlKey: true,
        shiftKey: command === 'redo',
        bubbles: true,
        cancelable: true
      })
    )
  }

  function closeActiveTab(): void {
    const tab = tabs.active
    if (tab) tabs.close(tab.id)
  }

  /** File ▸ 搜索抽屉: filters the sidebar by file name and content. */
  function focusDrawerSearch(): void {
    if (!settings.value.sidebarVisible) {
      settings.update({ sidebarVisible: true })
    }
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>('.sidebar-search input')
      input?.focus()
      input?.select()
    })
  }

  async function minimizeWindow(): Promise<void> {
    try {
      await appWindow?.minimize()
    } catch {
      // Not running inside Tauri.
    }
  }

  async function toggleMaximizeWindow(): Promise<void> {
    try {
      await appWindow?.toggleMaximize()
    } catch {
      // Not running inside Tauri.
    }
  }

  async function closeWindow(): Promise<void> {
    try {
      await appWindow?.close()
    } catch {
      // Not running inside Tauri.
    }
  }
</script>

<svelte:window onclick={closeMenuOnOutsideClick} />

<div class="app" class:sidebar-hidden={!drawer.isOpen || !settings.value.sidebarVisible}>
  <header class="menubar" data-tauri-drag-region>
    <div class="app-mark" data-tauri-drag-region aria-hidden="true">文</div>

    <div class="menus" role="menubar" aria-label={t('app.menuAria')}>
      {#each menus as menu (menu.id)}
        <div class="menu-root" role="none" onmouseenter={() => hoverMenu(menu.id)}>
          <button
            class="menu-trigger"
            class:open={openMenu === menu.id}
            aria-haspopup="menu"
            aria-expanded={openMenu === menu.id}
            onclick={() => toggleMenu(menu.id)}>
            {menu.label}
          </button>
          {#if openMenu === menu.id}
            <div class="menu-pop" role="menu" aria-label={menu.label}>
              {#each menu.entries as item}
                {#if 'separator' in item}
                  <div class="menu-sep" role="separator"></div>
                {:else}
                  <button
                    class="menu-item"
                    role="menuitem"
                    disabled={item.disabled}
                    onclick={() => chooseMenu(item.run)}>
                    <span class="menu-check">{item.checked ? '✓' : ''}</span>
                    <span class="menu-label">{item.label}</span>
                    {#if item.shortcut}
                      <span class="menu-shortcut">{item.shortcut}</span>
                    {/if}
                  </button>
                {/if}
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <div class="menubar-spacer" data-tauri-drag-region></div>

    {#if IS_TAURI}
      <div class="window-controls">
        <button
          class="window-btn"
          title={t('app.minimize')}
          aria-label={t('app.minimize')}
          onclick={() => void minimizeWindow()}>–</button>
        <button
          class="window-btn"
          title={t('app.maximize')}
          aria-label={t('app.maximizeAria')}
          onclick={() => void toggleMaximizeWindow()}>□</button>
        <button
          class="window-btn close"
          title={t('common.close')}
          aria-label={t('app.closeWindow')}
          onclick={() => void closeWindow()}>×</button>
      </div>
    {/if}
  </header>

  <TabBar onnew={() => void openNewDoc()}>
    {#snippet leading()}
      <button
        class="icon-btn tabbar-edge-btn"
        class:active={settings.value.sidebarVisible}
        title={t('app.sidebarToggle')}
        aria-label={t('app.sidebarToggle')}
        onclick={toggleSidebar}>☰</button>
    {/snippet}
    {#snippet trailing()}
      <button
        class="icon-btn tabbar-edge-btn"
        class:active={outlineVisible}
        title={t('menu.toggleOutline')}
        aria-label={t('menu.toggleOutline')}
        disabled={!markdownTabActive}
        onclick={toggleOutline}>≣</button>
    {/snippet}
  </TabBar>

  {#if drawer.isOpen}
    <Sidebar onnew={openNewDoc} />
  {:else}
    <div></div>
  {/if}

  <main class="main">
    <ConflictBar />
    <FindBar />
    <div class="editor-area">
      <div class="editor-main">
        {#if tabs.active}
          {#if tabs.active.kind === 'text'}
            <TextPane tab={tabs.active} />
          {:else}
            <EditorPane tab={tabs.active} mode={viewMode} />
          {/if}
        {:else if !drawer.isOpen}
          <Welcome onopen={() => void openDrawer()} ondemo={() => void openDemo()} busy={drawer.loading} />
        {:else}
          <div class="welcome">
            <div class="welcome-card">
              <h1 style="font-size:22px">{t('app.startWriting')}</h1>
              <p>{t('app.startDesc')}</p>
              <div class="welcome-actions">
                <button class="button primary" onclick={() => void openNewDoc()}>{t('app.newNote')}</button>
                <button class="button" onclick={() => (showSettings = true)}>{t('app.openSettings')}</button>
              </div>
            </div>
          </div>
        {/if}
      </div>
      {#if outlineVisible && tabs.active?.kind === 'markdown'}
        <Outline markdown={tabs.active.content} onclose={toggleOutline} />
      {/if}
    </div>
  </main>

  <StatusBar />
</div>

{#if tabs.active && tabs.active.kind === 'markdown'}
  <LazyExportDialog open={showExport} tab={tabs.active} onclose={() => (showExport = false)} />
{/if}
<NewDocDialog
  open={showNewDoc}
  folder={newDocFolder}
  onclose={() => (showNewDoc = false)}
  oncreate={createNewDoc}
/>
<SettingsDialog open={showSettings} onclose={() => (showSettings = false)} />
<ShortcutsDialog open={showShortcuts} onclose={() => (showShortcuts = false)} />

{#if showAbout}
  <div
    class="modal-backdrop"
    role="presentation"
    onclick={(event) => {
      if (event.target === event.currentTarget) showAbout = false
    }}
  >
    <div class="modal" role="dialog" aria-modal="true" aria-label={t('about.title')} tabindex="-1">
      <div class="modal-head">
        <h2>{t('about.title')}</h2>
      </div>
      <div class="modal-body">
        <p><strong>{BRAND_NAME} {BRAND_NAME_ZH}</strong> {APP_VERSION}</p>
        <p class="hint about-slogan">{isEnglish() ? BRAND_SLOGAN_EN : BRAND_SLOGAN_ZH}</p>
        <p class="hint">{t('about.desc')}</p>
        <p class="hint">Tauri 2 · Svelte 5 · Milkdown / ProseMirror · CodeMirror 6</p>
      </div>
      <div class="modal-foot">
        <span class="spacer"></span>
        <button class="button primary" onclick={() => (showAbout = false)}>{t('common.close')}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .about-slogan {
    letter-spacing: 0.18em;
    color: var(--accent);
  }
</style>
