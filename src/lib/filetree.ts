// MARK#EZVE.COM
import type { DrawerEntry } from './types'

export interface TreeRow {
  entry: DrawerEntry
  depth: number
}

export function flattenTree(
  entries: DrawerEntry[],
  expanded: Record<string, boolean>
): TreeRow[] {
  const rows: TreeRow[] = []
  const walk = (list: DrawerEntry[], depth: number) => {
    for (const entry of list) {
      rows.push({ entry, depth })
      if (entry.kind === 'dir' && (expanded[entry.path] ?? true) && entry.children) {
        walk(entry.children, depth + 1)
      }
    }
  }
  walk(entries, 0)
  return rows
}

/** Keeps directories that contain a match and highlights matching names. */
export function filterTree(entries: DrawerEntry[], query: string): DrawerEntry[] {
  const needle = query.toLowerCase()
  const walk = (list: DrawerEntry[]): DrawerEntry[] => {
    const result: DrawerEntry[] = []
    for (const entry of list) {
      if (entry.kind === 'dir') {
        const children = entry.children ? walk(entry.children) : []
        if (children.length > 0 || entry.name.toLowerCase().includes(needle)) {
          result.push({ ...entry, children })
        }
      } else if (entry.name.toLowerCase().includes(needle)) {
        result.push(entry)
      }
    }
    return result
  }
  return walk(entries)
}

export function countEntries(entries: DrawerEntry[]): number {
  let count = 0
  for (const entry of entries) {
    if (entry.kind === 'file') count++
    else if (entry.children) count += countEntries(entry.children)
  }
  return count
}
