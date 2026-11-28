// MARK#EZVE.COM
import { t } from '../i18n'
import type { ChangedPath } from '../types'

export const isTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Thin wrapper so the whole app can run in a plain browser for UI work. */
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: rawInvoke } = await import('@tauri-apps/api/core')
  return rawInvoke<T>(cmd, args)
}

export async function pickDrawerFolder(): Promise<string | null> {
  if (!isTauri) return null
  const { open } = await import('@tauri-apps/plugin-dialog')
  const selected = await open({
    directory: true,
    multiple: false,
    title: t('picker.drawer')
  })
  return typeof selected === 'string' ? selected : null
}

export async function pickExportFile(
  defaultPath: string,
  filters: { name: string; extensions: string[] }[]
): Promise<string | null> {
  if (!isTauri) return null
  const { save } = await import('@tauri-apps/plugin-dialog')
  const selected = await save({
    defaultPath,
    title: t('picker.exportFile'),
    filters
  })
  return typeof selected === 'string' ? selected : null
}

export async function pickExportFolder(): Promise<string | null> {
  if (!isTauri) return null
  const { open } = await import('@tauri-apps/plugin-dialog')
  const selected = await open({
    directory: true,
    multiple: false,
    title: t('picker.exportFolder')
  })
  return typeof selected === 'string' ? selected : null
}

/** Document path passed on the command line, if the app was launched with one. */
export async function takeLaunchFile(): Promise<string | null> {
  if (!isTauri) return null
  try {
    return await invoke<string | null>('take_launch_file')
  } catch {
    return null
  }
}

export async function listenOpenFile(handler: (path: string) => void): Promise<() => void> {
  if (!isTauri) return () => {}
  const { listen } = await import('@tauri-apps/api/event')
  return listen<string>('open-file', (event) => handler(event.payload))
}

export async function listenDrawerChanges(
  handler: (events: ChangedPath[]) => void
): Promise<() => void> {
  if (!isTauri) return () => {}
  const { listen } = await import('@tauri-apps/api/event')
  const unlisten = await listen<ChangedPath[]>('drawer:changed', (event) =>
    handler(event.payload)
  )
  return unlisten
}

/** External changes to single-file tabs (non-recursive, one folder per file). */
export async function listenFileChanges(
  handler: (events: ChangedPath[]) => void
): Promise<() => void> {
  if (!isTauri) return () => {}
  const { listen } = await import('@tauri-apps/api/event')
  const unlisten = await listen<ChangedPath[]>('files:changed', (event) => handler(event.payload))
  return unlisten
}
