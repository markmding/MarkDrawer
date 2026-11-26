// MARK#EZVE.COM
// Packages a source snapshot for archiving / sharing:
//   MarkDrawer_Source_<version>.zip   (repo tree without deps and build output)
//
//   npm run package:source
//
// The archive mirrors the repository layout (no wrapper folder), so unzipping it
// into an empty directory gives a buildable tree: npm ci && npm run desktop:build.

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const outDir = process.env.MARKDRAWER_OUT ?? resolve(root, '..', 'markup-artifacts')
const archivePath = join(outDir, `MarkDrawer_Source_${version}.zip`)

// Directories that are either generated, huge, belong to the machine, or carry
// design / development notes that a buildable source drop does not need.
// `gen` only matches src-tauri/gen (Tauri capability schemas).
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'target',
  'gen',
  'markup-artifacts',
  '.claude',
  '.idea',
  '.vscode',
  // 设计与开发文档：源码包只保留「能编译」所需的东西。
  'docs',
  'design'
])
const EXCLUDED_FILES = [
  /\.log$/i,
  /\.zip$/i,
  /\.7z$/i,
  /^\.DS_Store$/i,
  // 需求 / 变更 / 任务 / 开发日志
  /^prd\.md$/i,
  /^CHANGELOG\.md$/i,
  /^TASKS\.md$/i,
  /^TODOS\.md$/i
]

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue
      yield* walk(full)
      continue
    }
    if (EXCLUDED_FILES.some((pattern) => pattern.test(entry.name))) continue
    yield full
  }
}

mkdirSync(outDir, { recursive: true })
const stageParent = mkdtempSync(join(tmpdir(), 'markdrawer-source-'))
const stage = join(stageParent, 'src')
mkdirSync(stage, { recursive: true })

let files = 0
let bytes = 0
for (const full of walk(root)) {
  const rel = relative(root, full)
  const target = join(stage, rel)
  mkdirSync(join(target, '..'), { recursive: true })
  copyFileSync(full, target)
  files += 1
  bytes += statSync(full).size
}

function findSevenZip() {
  if (process.env.SEVEN_ZIP && existsSync(process.env.SEVEN_ZIP)) return process.env.SEVEN_ZIP
  for (const candidate of [
    'C:\\Program Files\\7-Zip\\7z.exe',
    'C:\\Program Files (x86)\\7-Zip\\7z.exe',
    '7z'
  ]) {
    try {
      execFileSync(candidate, ['i'], { stdio: 'ignore' })
      return candidate
    } catch {
      // Try the next candidate.
    }
  }
  return null
}

const sevenZip = findSevenZip()
rmSync(archivePath, { force: true })
try {
  if (sevenZip) {
    // `-tzip` keeps the format predictable across machines (no 7z reader needed).
    execFileSync(sevenZip, ['a', '-tzip', '-mx=9', '-y', archivePath, '.'], {
      cwd: stage,
      stdio: 'inherit'
    })
  } else {
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path '${join(stage, '*')}' -DestinationPath '${archivePath}' -Force`
      ],
      { stdio: 'inherit' }
    )
  }
} finally {
  rmSync(stageParent, { recursive: true, force: true })
}

const kb = (path) => (statSync(path).size / 1024).toFixed(0)
console.log(`\n源码包：${archivePath} (${kb(archivePath)} KB)`)
console.log(`包含：${files} 个文件，原始 ${(bytes / 1024).toFixed(0)} KB`)
console.log(
  '已排除：node_modules、.git、dist、src-tauri/target、src-tauri/gen、*.log、*.zip、*.7z、prd.md、CHANGELOG.md、TASKS.md、TODOS.md、docs/、design/'
)
