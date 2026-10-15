/**
 * The web wall-clock guard (ADR-0043, amendment web-wall-clock): no vitest or e2e test
 * file reads the real clock, so the gate gives the same verdict on any date.
 *
 * `findWallClockReads(text)` reads one file as text and returns every `Date.now(`, bare
 * `new Date()` (no arguments) and `Date(` called without `new`, with its line. Comments
 * are blanked first (newlines kept), so a comment that names `Date.now()` is not a read.
 * A whole file is exempt only when it pins a literal fake instant:
 * `useFakeTimers({ now: <literal> })` or `vi.setSystemTime(<literal>)`. A bare
 * `useFakeTimers()`, or one with only `shouldAdvanceTime`, exempts nothing.
 * `performance.now()` is monotonic and measures no date, so it is not flagged.
 *
 * It is a ratchet, not a proof: it reads text. A `//` inside a string hides the rest of
 * its line, and an aliased `const n = Date.now` is not caught.
 */

export interface WallClockRead {
  line: number
  pattern: string
}

const READS: { pattern: string; regex: RegExp }[] = [
  { pattern: 'Date.now', regex: /\bDate\s*\.\s*now\s*\(/g },
  { pattern: 'new Date', regex: /\bnew\s+Date\s*\(\s*\)/g },
  { pattern: 'Date call', regex: /(?<![\w$.])(?<!\bnew\s+)Date\s*\(/g },
]

// A literal instant: a number, a string, or `new Date(<number or string>)`.
const LITERAL = String.raw`(?:\d[\d_]*|'[^']*'|"[^"]*"|new\s+Date\s*\(\s*(?:\d[\d_]*|'[^']*'|"[^"]*")\s*\))`
const PINNED: RegExp[] = [
  new RegExp(String.raw`\buseFakeTimers\s*\(\s*\{[^}]*\bnow\s*:\s*${LITERAL}\s*[,}]`),
  new RegExp(String.raw`\bsetSystemTime\s*\(\s*${LITERAL}\s*\)`),
]

/** Comments become spaces (newlines kept), so line numbers stay the same. */
function blankComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (comment) => ' '.repeat(comment.length))
}

/** True when the file pins a literal fake instant, which exempts the whole file. */
export function pinsFakeInstant(text: string): boolean {
  const code = blankComments(text)
  return PINNED.some((pinned) => pinned.test(code))
}

export function findWallClockReads(text: string): WallClockRead[] {
  const code = blankComments(text)
  if (pinsFakeInstant(text)) return []
  const found: WallClockRead[] = []
  for (const { pattern, regex } of READS) {
    for (const match of code.matchAll(regex)) {
      const line = code.slice(0, match.index).split('\n').length
      found.push({ line, pattern })
    }
  }
  return found.sort((a, b) => a.line - b.line)
}
