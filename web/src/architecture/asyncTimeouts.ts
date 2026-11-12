/**
 * The async-timeout guard: every wait in a web test is Testing Library's `waitFor` or
 * `findBy*`, and none sets a timeout below the ceiling in `src/test/asyncTimeout.ts`.
 * `src/test-setup.ts` is the one place that sets the ceiling (`asyncUtilTimeout`); a call
 * site may only make a wait longer than it, with a comment saying why, never shorter.
 *
 * `findShortAsyncTimeouts(files)` reads each file as whole text, never line by line, so a
 * call split across lines is judged like one on a single line. It returns a finding (path
 * and the line of the key or token) for:
 *   - a `...timeout` key whose value is not a numeric literal, or is below the ceiling;
 *   - the shorthand `{ timeout }`, which hides its value;
 *   - any mention of `asyncUtilTimeout`: only `test-setup.ts` sets it, a test file never does;
 *   - a Vitest wait, which has its own 1 000 ms default and never reads that ceiling:
 *     `vi.waitFor`, `vi.waitUntil` and `expect.poll`, with whitespace or a newline around the
 *     dot, the bracketed forms (`vi['waitFor']`) and a destructure from `vi` or `expect`
 *     (`const { waitFor } = vi`). The token alone is the finding; no call is parsed.
 * `setTimeout(fn, 10)`, `clearTimeout(id)` and a `'timeout'` string argument carry no key
 * and are left alone.
 *
 * It is a ratchet, not a proof: a Vitest wait reached through a variable or a function, a
 * per-test `test(name, fn, n)` timeout, and Playwright's `web/e2e/` are outside it.
 */

import { ASYNC_UTIL_TIMEOUT } from '../test/asyncTimeout'

export interface SourceFile {
  path: string
  content: string
}

export interface AsyncTimeoutFinding {
  path: string
  line: number
}

const KEYED = /["']?\b\w*timeout["']?\s*:\s*([^,}\s]+)/gi
const SHORTHAND = /[{,]\s*\w*timeout\s*(?=[,}])/gi
const SETS_THE_CEILING = /\basyncUtilTimeout\b/g
const VITEST_WAIT_NAME = /waitFor|waitUntil|poll/
const VITEST_WAITS = [
  /\bvi\s*\.\s*(?:waitFor|waitUntil)\b/g,
  /\bexpect\s*\.\s*poll\b/g,
  /\b(?:vi|expect)\s*\[\s*["'`](?:waitFor|waitUntil|poll)["'`]\s*\]/g,
  /\{[^{}]*\b(?:waitFor|waitUntil|poll)\b[^{}]*\}\s*=\s*(?:vi|expect)\b/g,
]

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split('\n').length
}

function isBelowCeilingOrUnreadable(value: string): boolean {
  const digits = value.replaceAll('_', '')
  return !/^\d+$/.test(digits) || Number(digits) < ASYNC_UTIL_TIMEOUT
}

export function findShortAsyncTimeouts(files: SourceFile[]): AsyncTimeoutFinding[] {
  const found: AsyncTimeoutFinding[] = []
  for (const { path, content } of files) {
    const lines = new Set<number>()
    for (const match of content.matchAll(KEYED)) {
      if (isBelowCeilingOrUnreadable(match[1] ?? '')) lines.add(lineOf(content, match.index))
    }
    for (const match of content.matchAll(SHORTHAND)) {
      // The match starts on the brace or comma; the key is on the same line or the next.
      const key = match[0].search(/\w/)
      lines.add(lineOf(content, match.index + key))
    }
    for (const match of content.matchAll(SETS_THE_CEILING)) lines.add(lineOf(content, match.index))
    for (const pattern of VITEST_WAITS) {
      for (const match of content.matchAll(pattern)) {
        lines.add(lineOf(content, match.index + match[0].search(VITEST_WAIT_NAME)))
      }
    }
    for (const line of [...lines].sort((a, b) => a - b)) found.push({ path, line })
  }
  return found
}
