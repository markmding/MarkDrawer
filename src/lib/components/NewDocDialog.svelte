<script lang="ts">
  // MARK#EZVE.COM
  import * as api from '../api/drawer'
  import { t, type MessageKey } from '../i18n'
  import { stripExtension } from '../paths'

  interface TemplateItem {
    name: string
    path: string
    content: string
  }

  // Template files ship with ASCII names (see src-tauri/src/paths.rs), so the
  // picker translates the known ones and shows anything else — a user's own
  // template in templates/ — under its file name.
  const TEMPLATE_LABELS: Record<string, MessageKey> = {
    note: 'newDoc.tplNote',
    daily: 'newDoc.tplDaily',
    todo: 'newDoc.tplTodo',
    meeting: 'newDoc.tplMeeting',
    project: 'newDoc.tplProject',
    book: 'newDoc.tplBook'
  }

  function templateLabel(name: string): string {
    const key = TEMPLATE_LABELS[name]
    return key ? t(key) : name
  }

  let {
    open,
    folder = '',
    onclose,
    oncreate
  }: {
    open: boolean
    folder?: string
    onclose: () => void
    oncreate: (name: string, content: string) => Promise<void> | void
  } = $props()

  let name = $state('')
  let selected = $state('')
  let templates = $state<TemplateItem[]>([])
  let loading = $state(false)
  let busy = $state(false)
  let error = $state('')

  $effect(() => {
    if (!open) return
    name = t('newDoc.placeholder')
    selected = ''
    templates = []
    error = ''
    void loadTemplates()
  })

  async function loadTemplates(): Promise<void> {
    loading = true
    try {
      const assets = await api.listAppAssets('templates')
      templates = assets.map((file) => ({
        name: stripExtension(file.name),
        path: file.path,
        content: file.content
      }))
    } finally {
      loading = false
    }
  }

  async function submit(): Promise<void> {
    if (busy) return
    const trimmed = name.trim()
    if (!trimmed) {
      error = t('newDoc.nameRequired')
      return
    }
    const template = templates.find((item) => item.name === selected)
    error = ''
    busy = true
    try {
      await oncreate(trimmed, template?.content ?? '')
      onclose()
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause)
    } finally {
      busy = false
    }
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
    <div class="modal" role="dialog" aria-modal="true" aria-label={t('newDoc.title')} tabindex="-1">
      <div class="modal-head">
        <h2>{t('newDoc.title')}</h2>
        <button class="icon-btn" title={t('common.close')} onclick={onclose}>×</button>
      </div>

      <div class="modal-body">
        <div class="form-grid">
          <div class="field full">
            <label for="new-doc-name">{t('newDoc.name')}</label>
            <input
              id="new-doc-name"
              bind:value={name}
              placeholder={t('newDoc.placeholder')}
              oninput={() => (error = '')}
              onkeydown={(event) => {
                if (event.key === 'Enter') void submit()
              }}
            />
            <span class="hint">
              {t('newDoc.location', { folder: folder || t('newDoc.root') })}
            </span>
          </div>

          <div class="field full">
            <label for="new-doc-template">{t('newDoc.template')}</label>
            <select id="new-doc-template" bind:value={selected}>
              <option value="">{t('newDoc.blank')}</option>
              {#each templates as template (template.path)}
                <option value={template.name}>{templateLabel(template.name)}</option>
              {/each}
            </select>
            <span class="hint">
              {#if loading}
                {t('newDoc.loading')}
              {:else if templates.length === 0}
                {t('newDoc.noTemplates')}
              {:else}
                {t('newDoc.found', { count: templates.length })}
              {/if}
            </span>
          </div>
        </div>
        {#if error}
          <div class="alert danger" role="alert">{error}</div>
        {/if}
      </div>

      <div class="modal-foot">
        <span class="spacer"></span>
        <button class="button" onclick={onclose}>{t('newDoc.cancel')}</button>
        <button class="button primary" onclick={() => void submit()} disabled={busy}>
          {busy ? t('newDoc.creating') : t('newDoc.create')}
        </button>
      </div>
    </div>
  </div>
{/if}
