// MARK#EZVE.COM
// Builds the portable Windows release:
//   MarkDrawer_Portable.exe              (next to its themes/ and templates/)
//   MarkDrawer_Portable_<version>.7z     (exe + themes/ + templates/)
//
// Run after `npm run desktop:build` (or `tauri build --no-bundle`):
//   npm run package:portable

import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = pkg.version
const exeName = 'MarkDrawer_Portable.exe'
const archiveName = `MarkDrawer_Portable_${version}`
// Artifacts live next to the repository (not inside it) by default; override
// with MARKDRAWER_OUT.
const outDir = process.env.MARKDRAWER_OUT ?? resolve(root, '..', 'markup-artifacts')

const builtExe = join(root, 'src-tauri', 'target', 'release', 'mark-drawer.exe')
if (!existsSync(builtExe)) {
  console.error(`缺少 release 产物：${builtExe}`)
  console.error('请先运行 npm run desktop:build（或 tauri build --no-bundle）')
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })
copyFileSync(builtExe, join(outDir, exeName))

// Everything the archive needs, staged exactly as it should appear after unzip.
const stageParent = mkdtempSync(join(tmpdir(), 'markdrawer-portable-'))
const stage = join(stageParent, 'MarkDrawer_Portable')
mkdirSync(stage, { recursive: true })
copyFileSync(builtExe, join(stage, exeName))
cpSync(join(root, 'src-tauri', 'themes'), join(stage, 'themes'), { recursive: true })
cpSync(join(root, 'src-tauri', 'templates'), join(stage, 'templates'), { recursive: true })

function findSevenZip() {
  if (process.env.SEVEN_ZIP && existsSync(process.env.SEVEN_ZIP)) return process.env.SEVEN_ZIP
  const candidates = [
    'C:\\Program Files\\7-Zip\\7z.exe',
    'C:\\Program Files (x86)\\7-Zip\\7z.exe',
    '7z'
  ]
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['i'], { stdio: 'ignore' })
      return candidate
    } catch {
      // Try the next candidate.
    }
  }
  return null
}

let archivePath
const sevenZip = findSevenZip()
try {
  if (sevenZip) {
    archivePath = join(outDir, `${archiveName}.7z`)
    rmSync(archivePath, { force: true })
    execFileSync(sevenZip, ['a', '-t7z', '-mx=9', '-y', archivePath, exeName, 'themes', 'templates'], {
      cwd: stage,
      stdio: 'inherit'
    })
  } else {
    // 7-Zip is not installed: fall back to a plain zip, same base name.
    archivePath = join(outDir, `${archiveName}.zip`)
    rmSync(archivePath, { force: true })
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
console.log(`\n便携版：${join(outDir, exeName)} (${kb(join(outDir, exeName))} KB)`)
console.log(`压缩包：${archivePath} (${kb(archivePath)} KB)`)
console.log('包含：MarkDrawer_Portable.exe、themes/、templates/')
