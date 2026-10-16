/**
 * The back guard (GH-166, `docs/product/icon-and-text-rule.md`, "back is exactly one"): only
 * `shell/BackArrow.tsx` draws a back. `findOwnBacks` returns one line per offence, empty when
 * the tree is clean, and is fed input it must reject in `backGuards.test.ts` before
 * `backGuards.real.test.ts` runs it over the real tree.
 *
 * It rejects, outside `BackArrow.tsx`: a `variant="back"` and a '‹' (or its escape or entity)
 * in JSX text or in a string literal. A '‹' in a comment is fine; the comments are blanked
 * before the scan. Test-side files are not scanned (`isTestSide`).
 */

import { isTestSide, type SourceFile } from './closingGuards'

const SEP = String.fromCharCode(47)
const AUTHOR = `${SEP}src${SEP}shell${SEP}BackArrow.tsx`

export interface Exempt {
  path: string
  reason: string
}

/** The source with its comments blanked (newlines kept), skipping over string literals so a
 * `//` inside one is not read as a comment. A quote that never closes ends at its line. */
export function withoutComments(source: string): string {
  let out = ''
  let index = 0
  while (index < source.length) {
    const char = source.charAt(index)
    const next = source.charAt(index + 1)
    if (char === SEP && next === SEP) {
      while (index < source.length && source.charAt(index) !== '\n') index += 1
    } else if (char === SEP && next === '*') {
      const end = source.indexOf('*/', index + 2)
      const stop = end === -1 ? source.length : end + 2
      out += source.slice(index, stop).replace(/[^\n]/g, ' ')
      index = stop
    } else if (char === '"' || char === "'" || char === '`') {
      let stop = index + 1
      while (stop < source.length && source.charAt(stop) !== char && (char === '`' || source.charAt(stop) !== '\n')) {
        stop += source.charAt(stop) === '\\' ? 2 : 1
      }
      out += source.slice(index, stop + 1)
      index = stop + 1
    } else {
      out += char
      index += 1
    }
  }
  return out
}

const CHEVRON = /‹|\\u2039|\\u\{2039\}|&lsaquo;|&#8249;|&#x2039;/i
const BACK_VARIANT = /variant\s*=\s*(?:"back"|'back'|\{\s*['"]back['"]\s*\})/

function exempted(path: string, list: readonly Exempt[]): boolean {
  return list.some((entry) => entry.path === path)
}

export function findOwnBacks(
  files: readonly SourceFile[],
  exemptChevron: readonly Exempt[] = [],
  exemptVariant: readonly Exempt[] = [],
): string[] {
  const found: string[] = []
  for (const { path: raw, content } of files) {
    const path = raw.startsWith(SEP) ? raw : `${SEP}${raw}`
    if (!/\.tsx?$/.test(path) || isTestSide(path) || path === AUTHOR) continue
    const lines = withoutComments(content).split('\n')
    lines.forEach((line, index) => {
      if (BACK_VARIANT.test(line) && !exempted(path, exemptVariant)) {
        found.push(`${path}:${index + 1}: draws a back (variant="back"); only the shell's BackArrow does`)
      }
      if (CHEVRON.test(line) && !exempted(path, exemptChevron)) {
        found.push(`${path}:${index + 1}: writes a '‹' itself; only the shell's BackArrow does`)
      }
    })
  }
  return found
}
