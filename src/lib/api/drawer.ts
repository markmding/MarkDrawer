// MARK#EZVE.COM
import type {
  AssetFile,
  DocPayload,
  DrawerEntry,
  DrawerInfo,
  ExportFile,
  OpenFileInfo,
  SaveAttachmentResult,
  SearchHit,
  WriteOptions,
  WriteResult
} from '../types'
import { downloadText } from '../export/download'
import { DEMO_ROOT, mock } from './mock'
import { invoke, isTauri } from './tauri'

export function isDemoRoot(root: string | null): boolean {
  return root === DEMO_ROOT
}

export async function openDrawer(path: string): Promise<DrawerInfo> {
  if (path === DEMO_ROOT) return mock.open()
  return invoke<DrawerInfo>('open_drawer', { path })
}

/**
 * Reads one directory level lazily, honoring the same ignore rules as the full
 * tree. `rel` is the drawer-relative directory (`''` for the top level). Demo
 * drawers keep the full tree in memory, so the mock returns that level's
 * children directly.
 */
export async function listDirLevel(
  root: string,
  rel: string
): Promise<DrawerEntry[]> {
  if (isDemoRoot(root)) return mock.listDirLevel(rel)
  return invoke<DrawerEntry[]>('list_dir_level', { drawer: root, rel })
}

/**
 * Single-file mode: reads one file and returns its folder as the read/write
 * base. Never scans or watches the folder.
 */
export async function openFile(path: string): Promise<OpenFileInfo> {
  return invoke<OpenFileInfo>('open_file', { path })
}

export async function readDoc(root: string, rel: string): Promise<DocPayload> {
  if (isDemoRoot(root)) return mock.readDoc(rel)
  return invoke<DocPayload>('read_doc', { drawer: root, rel })
}

export async function writeDoc(
  root: string,
  rel: string,
  content: string,
  mtime: number,
  force: boolean,
  options: WriteOptions
): Promise<WriteResult> {
  if (isDemoRoot(root)) return mock.writeDoc(rel, content, options)
  return invoke<WriteResult>('write_doc', {
    drawer: root,
    rel,
    content,
    mtime,
    force,
    encoding: options.encoding,
    eol: options.eol,
    bom: options.bom
  })
}

export async function createEntry(
  root: string,
  rel: string,
  kind: 'dir' | 'file'
): Promise<void> {
  if (isDemoRoot(root)) {
    mock.createEntry(rel, kind)
    return
  }
  await invoke('create_entry', { drawer: root, rel, kind })
}

export async function renameEntry(root: string, from: string, to: string): Promise<void> {
  if (isDemoRoot(root)) {
    mock.renameEntry(from, to)
    return
  }
  await invoke('rename_entry', { drawer: root, from, to })
}

export async function deleteEntry(root: string, rel: string): Promise<void> {
  if (isDemoRoot(root)) {
    mock.deleteEntry(rel)
    return
  }
  await invoke('delete_entry', { drawer: root, rel })
}

export async function saveAttachment(
  root: string,
  name: string,
  base64: string
): Promise<SaveAttachmentResult> {
  if (isDemoRoot(root)) return mock.saveAttachment(name, base64)
  return invoke<SaveAttachmentResult>('save_attachment', {
    drawer: root,
    name,
    data: base64
  })
}

/**
 * Shared themes / templates live next to the executable, not inside a drawer.
 * The demo drawer keeps them as virtual files.
 */
export async function listAppAssets(kind: 'themes' | 'templates'): Promise<AssetFile[]> {
  if (isTauri) {
    try {
      return await invoke<AssetFile[]>('list_app_assets', { kind })
    } catch {
      return []
    }
  }
  return mock.listAppAssets(kind)
}

export async function searchDrawer(
  root: string,
  query: string,
  limit = 50
): Promise<SearchHit[]> {
  if (isDemoRoot(root)) return mock.search(query)
  return invoke<SearchHit[]>('search_drawer', { drawer: root, query, limit })
}

export async function readAttachment(root: string, rel: string): Promise<string | null> {
  if (isDemoRoot(root)) return mock.readAttachment(rel)
  try {
    return await invoke<string | null>('read_attachment', { drawer: root, rel })
  } catch {
    return null
  }
}

export async function writeExportFiles(dest: string, files: ExportFile[]): Promise<number> {
  if (!isTauri) return 0
  return invoke<number>('write_export_files', { dest, files })
}

/** Writes a single UTF-8 file (used by the single-file HTML export). */
export async function writeExportFile(path: string, content: string): Promise<void> {
  if (!isTauri) {
    const filename = path.split(/[\\/]/).pop() ?? 'export.html'
    downloadText(filename, content)
    return
  }
  await invoke('write_export_file', { path, content })
}

export async function watchDrawer(root: string): Promise<void> {
  if (isDemoRoot(root) || !isTauri) return
  await invoke('watch_drawer', { root })
}

/** Watches single-file tabs: each file's own folder, non-recursively. */
export async function watchFiles(paths: string[]): Promise<void> {
  if (!isTauri) return
  await invoke('watch_files', { paths })
}

export async function unwatchFiles(): Promise<void> {
  if (!isTauri) return
  await invoke('unwatch_files')
}

export async function unwatchDrawer(): Promise<void> {
  if (!isTauri) return
  await invoke('unwatch_drawer')
}
