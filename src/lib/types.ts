// MARK#EZVE.COM
export type EntryKind = 'dir' | 'file'

export interface DrawerEntry {
  /** Display name, e.g. `指南` or `note.md` */
  name: string
  /** Drawer-relative path with forward slashes, e.g. `指南/入门.md` */
  path: string
  kind: EntryKind
  /** Modification time in ms since epoch (files only) */
  mtime?: number
  children?: DrawerEntry[]
}

export interface DrawerInfo {
  /** Absolute drawer root. In demo mode this is a virtual URI. */
  root: string
  name: string
  entries: DrawerEntry[]
}

export type Encoding = 'utf8' | 'gbk' | 'ansi'
export type Eol = 'lf' | 'crlf'

export interface DocPayload {
  content: string
  mtime: number
  /** Detected on-disk encoding */
  encoding: Encoding
  /** Detected on-disk line ending */
  eol: Eol
  /** UTF-8 BOM present (only meaningful for utf8) */
  bom: boolean
}

/** Target format used when saving a document. */
export interface WriteOptions {
  encoding: Encoding
  eol: Eol
  bom: boolean
}

export interface WriteResult {
  mtime: number
}

export interface SearchHit {
  path: string
  title: string
  snippet: string
  score: number
}

export interface ExportFile {
  /** Destination-relative path, forward slashes */
  path: string
  encoding: 'utf8' | 'base64'
  content: string
}

export interface SaveAttachmentResult {
  /** Path used in Markdown, e.g. `attachments/pasted-1.png` */
  path: string
  name: string
}

/** Read-only resource stored next to the executable (theme or template). */
export interface AssetFile {
  name: string
  /** App-relative path, e.g. `themes/Nord.css` */
  path: string
  content: string
}

export type ViewMode = 'wysiwyg' | 'source' | 'split'
export type HtmlExportMode = 'folder' | 'single'
