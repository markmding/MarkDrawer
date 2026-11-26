#!/usr/bin/env node
// MARK#EZVE.COM
/**
 * Version maintenance for Mark Drawer.
 *
 * package.json is the single source of truth. This script keeps the other
 * places in sync and fails the build when they drift:
 *   - src-tauri/Cargo.toml                    (crate version)
 *   - src-tauri/tauri.conf.json               (must point at ../package.json)
 *   - CHANGELOG.md                            (needs a heading per version)
 *
 * Usage:
 *   node tools/version.mjs check
 *   node tools/version.mjs dev        # 0.4.0      → 0.4.0-dev.1
 *                                     # 0.4.0-dev.1 → 0.4.0-dev.2
 *   node tools/version.mjs release    # 0.4.0-dev.2 → 0.4.0
 *   node tools/version.mjs bump major|minor|patch
 *   node tools/version.mjs set 0.5.0-dev.1   # 显式设定（同一命令写 Cargo.toml 与 CHANGELOG）
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const FILES = {
  packageJson: join(root, 'package.json'),
  tauriConf: join(root, 'src-tauri', 'tauri.conf.json'),
  cargo: join(root, 'src-tauri', 'Cargo.toml'),
  changelog: join(root, 'CHANGELOG.md')
}
const TAURI_VERSION_REF = '../package.json'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version.trim())
  if (!match) throw new Error(`不是有效的语义化版本号：${version}`)
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? ''
  }
}

function formatVersion(parsed) {
  const base = `${parsed.major}.${parsed.minor}.${parsed.patch}`
  return parsed.prerelease ? `${base}-${parsed.prerelease}` : base
}

function cargoVersions() {
  return [...readFileSync(FILES.cargo, 'utf8').matchAll(/^version = "([^"]+)"/gm)].map(
    (match) => match[1]
  )
}

// 源码包（npm run package:source）按规则不带 CHANGELOG.md，此时版本检查跳过
// 条目校验，而不是直接失败——否则解压出来的源码树连 npm run build 都跑不了。
function changelogHas(version) {
  if (!existsSync(FILES.changelog)) return true
  return readFileSync(FILES.changelog, 'utf8').includes(`## [${version}]`)
}

function insertChangelogHeading(version) {
  const file = FILES.changelog
  if (!existsSync(file)) return
  const text = readFileSync(file, 'utf8')
  if (text.includes(`## [${version}]`)) return
  const lines = text.split(/\r?\n/)
  // Insert above the newest existing release, keeping the title and the policy
  // header untouched.
  const firstSection = lines.findIndex((line) => line.startsWith('## '))
  const at = firstSection === -1 ? lines.length : firstSection
  const today = new Date().toISOString().slice(0, 10)
  lines.splice(at, 0, `## [${version}] - ${today}`, '', '- （待填写）', '')
  writeFileSync(file, `${lines.join('\n')}\n`)
}

function writeVersion(version) {
  const pkg = readJson(FILES.packageJson)
  pkg.version = version
  writeFileSync(FILES.packageJson, `${JSON.stringify(pkg, null, 2)}\n`)

  const nextCargo = readFileSync(FILES.cargo, 'utf8').replace(
    /^version = "[^"]+"/m,
    `version = "${version}"`
  )
  writeFileSync(FILES.cargo, nextCargo)

  insertChangelogHeading(version)
}

function check() {
  const problems = []
  const version = readJson(FILES.packageJson).version
  parseVersion(version)

  const tauriVersion = readJson(FILES.tauriConf).version
  if (tauriVersion !== TAURI_VERSION_REF) {
    problems.push(
      `tauri.conf.json 的 version 是 "${tauriVersion}"，应指向 "${TAURI_VERSION_REF}"`
    )
  }

  for (const cargoVersion of cargoVersions()) {
    if (cargoVersion !== version) {
      problems.push(`Cargo.toml 的 version 是 "${cargoVersion}"，package.json 是 "${version}"`)
    }
  }

  if (!existsSync(FILES.changelog)) {
    console.log('CHANGELOG.md 不存在（源码包不带变更日志），跳过版本条目检查')
  } else if (!changelogHas(version)) {
    problems.push(`CHANGELOG.md 缺少 "## [${version}]" 条目`)
  }

  if (problems.length) {
    console.error(`版本一致性检查失败（当前 ${version}）：`)
    for (const problem of problems) console.error(`  ✗ ${problem}`)
    console.error('  运行 node tools/version.mjs dev|release|bump <part> 或手动补齐后重试。')
    process.exitCode = 1
    return false
  }
  console.log(`版本一致性检查通过：${version}`)
  return true
}

function bump(part) {
  const current = parseVersion(readJson(FILES.packageJson).version)
  const next = { ...current, prerelease: '' }
  if (part === 'major') {
    next.major = current.major + 1
    next.minor = 0
    next.patch = 0
  } else if (part === 'minor') {
    next.minor = current.minor + 1
    next.patch = 0
  } else if (part === 'patch') {
    // A prerelease of X.Y.Z releases that exact version.
    if (!current.prerelease) next.patch = current.patch + 1
  } else {
    throw new Error(`未知的版本部分：${part}（可用 major | minor | patch）`)
  }
  return next
}

function main(argv) {
  const [command, arg] = argv
  if (!command || command === 'check') {
    check()
    return
  }

  const current = readJson(FILES.packageJson).version
  let next
  if (command === 'dev') {
    const parsed = parseVersion(current)
    const match = /^dev\.(\d+)$/.exec(parsed.prerelease)
    parsed.prerelease = match ? `dev.${Number(match[1]) + 1}` : 'dev.1'
    next = parsed
  } else if (command === 'release') {
    next = parseVersion(current)
    next.prerelease = ''
  } else if (command === 'bump') {
    next = bump(arg)
  } else if (command === 'set') {
    next = parseVersion(arg ?? '')
  } else {
    console.error(`未知命令：${command}`)
    console.error('用法：check | dev | release | bump major|minor|patch | set <version>')
    process.exitCode = 1
    return
  }

  const nextVersion = formatVersion(next)
  if (nextVersion === current) {
    console.log(`版本未变化：${current}`)
    return
  }
  writeVersion(nextVersion)
  console.log(`版本：${current} → ${nextVersion}`)
  check()
}

main(process.argv.slice(2))
