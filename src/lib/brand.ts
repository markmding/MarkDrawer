// MARK#EZVE.COM
// Author watermark. Single source of truth for the product identity; the same
// marker is embedded (invisibly) into exported documents by export/themes.ts.

export const BRAND_NAME = 'Mark Drawer'
export const BRAND_NAME_ZH = '文屉'
export const BRAND_FULL = `${BRAND_NAME} ${BRAND_NAME_ZH}`
export const BRAND_SLOGAN_ZH = '随文几屉 奇思几许'
export const BRAND_SLOGAN_EN = 'A drawer for words, a wonder or two'
export const BRAND_DESC_ZH = '本地优先的 Markdown 编辑器：文件夹即抽屉，文字与灵感各安其位。'
export const BRAND_DESC_EN =
  'A local-first Markdown workspace: every folder is a drawer, every note stays where you put it.'
/** Comes from package.json via vite.config.ts — never hard-code a version here. */
export const APP_VERSION = __APP_VERSION__

/** Path of the welcome note seeded into the demo drawer. */
export const WELCOME_DOC = '欢迎使用文屉.md'

/**
 * Invisible author watermark.
 *
 * The literal string lives in the source (comments + this constant). In
 * exported HTML it is written as zero-width characters inside a `<meta>` tag,
 * so it never shows up in rendered output or copied text but remains readable
 * by inspecting the file — the usual way to prove provenance of a build.
 */
export const WATERMARK = 'MARK#EZVE.COM'

const ZERO = '​' // zero-width space
const ONE = '‌' // zero-width non-joiner
const END = '‍' // zero-width joiner

/** Encodes a marker into zero-width characters (invisible, copy-safe). */
export function invisibleWatermark(seed: string = WATERMARK): string {
  let out = ''
  for (const char of seed) {
    const bits = char.charCodeAt(0).toString(2).padStart(8, '0')
    for (const bit of bits) out += bit === '1' ? ONE : ZERO
  }
  return out + END
}
