/**
 * The async-timeout guard: no web test sets an async-util timeout (`findBy*`, `waitFor`,
 * `asyncUtilTimeout`) below the ceiling in `src/test/asyncTimeout.ts`. `src/test-setup.ts`
 * is the one place that sets the ceiling; a call site may only make a wait longer than it,
 * with a comment saying why, never shorter.
 *
 * `findShortAsyncTimeouts(files)` reads each file as whole text, never line by line, so a
 * call split across lines is judged like one on a single line. It returns a finding (path
 * and the line of the key) for:
 *   - a `...timeout` key whose value is not a numeric literal, or is below the ceiling;
 *   - the shorthand `{ timeout }`, which hides its value;
 *   - any mention of `asyncUtilTimeout`: only `test-setup.ts` sets it, a test file never does.
 * `setTimeout(fn, 10)`, `clearTimeout(id)` and a `'timeout'` string argument carry no key
 * and are left alone.
 *
 * It is a ratchet, not a proof: positional `vi.waitFor(fn, n)` and a per-test
 * `test(name, fn, n)` are outside it, and so is Playwright's `web/e2e/`.
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
    for (const line of [...lines].sort((a, b) => a - b)) found.push({ path, line })
  }
  return found
}
