/**
 * The keyed copy-limit check over the real folders: every module of `src/copy/` that exports
 * `NAMESPACE` is checked against every real language folder on disk. The counts expected come
 * from `readdirSync` listings (the module files read as text, the locale folders), never from
 * the glob or loader under test; a folder with nothing keyed yet counts zero on both sides.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { EMPTY_STATE_KEYS, EMPTY_STATE_LIMITS } from '../../src/copy/emptyStates.ts'
import { copyProblems, LIMITS, type CopyModule } from '../../src/copy/limits.ts'
import { loadBundle, LOCALES_ROOT } from './loadBundle.ts'

const COPY = join(import.meta.dirname, '../../src/copy')

const found = import.meta.glob<CopyModule>(
  ['../../src/copy/*.ts', '!../../src/copy/limits.ts', '!../../src/copy/emptyStates.ts', '!../../src/copy/baselineArgs.ts', '!../../src/copy/*.test.ts'],
  { eager: true },
)

/** The empty-state keys as a keyed copy module, so the one checker of `copyProblems` measures them. */
const emptyStates: CopyModule = {
  NAMESPACE: 'emptyStates',
  LIMITED_COPY: Object.entries(EMPTY_STATE_KEYS).map(([name, key]) => ({ kind: EMPTY_STATE_LIMITS[name as keyof typeof EMPTY_STATE_LIMITS], key })),
  LONG_REFUSALS: [],
}

describe('the empty-state keys', () => {
  const en = loadBundle('en')

  test('are eleven, each with a limit kind, and the nobodyOwes key is one key', () => {
    expect(Object.keys(EMPTY_STATE_KEYS)).toHaveLength(11)
    expect(Object.keys(EMPTY_STATE_LIMITS).sort()).toEqual(Object.keys(EMPTY_STATE_KEYS).sort())
    expect(EMPTY_STATE_KEYS.nobodyOwes).toBe('emptyStates:nobodyOwes')
    expect(new Set(Object.values(EMPTY_STATE_KEYS)).size).toBe(11)
  })

  test('fit their limit in the en bundle, and the test locale never judges a limit', () => {
    expect(copyProblems('emptyStates', emptyStates, { en })).toEqual([])
    expect(copyProblems('emptyStates', emptyStates, { en, 'en-XA': loadBundle('en-XA') })).toEqual([])
  })

  test('a title over its limit in en is refused, and a key absent from en too', () => {
    const long = { ...en, emptyStates: { ...(en['emptyStates'] as Record<string, string>), stockTitle: 'x'.repeat(LIMITS.emptyTitle + 1) } }
    const without = { ...en, emptyStates: {} }

    expect(copyProblems('emptyStates', emptyStates, { en: long })).toEqual([
      `emptyStates: emptyStates:stockTitle (en) is a emptyTitle over ${LIMITS.emptyTitle} characters`,
    ])
    expect(copyProblems('emptyStates', emptyStates, { en: without }).some((problem) => problem.includes('is absent from en'))).toBe(true)
  })
})

describe('the keyed copy modules and the real language folders', () => {
  const tags = existsSync(LOCALES_ROOT) ? readdirSync(LOCALES_ROOT, { withFileTypes: true }).filter((item) => item.isDirectory()).map((item) => item.name) : []
  const locales = Object.fromEntries(tags.map((tag) => [tag, loadBundle(tag)]))

  test('every language folder on disk is loaded', () => {
    expect(Object.keys(locales).sort()).toEqual([...tags].sort())
  })

  test('every module that exports NAMESPACE is checked, with no problem', () => {
    const keyed = Object.entries(found).filter(([, mod]) => typeof mod.NAMESPACE === 'string')
    const listed = readdirSync(COPY).filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && /^export const NAMESPACE\b/m.test(readFileSync(join(COPY, name), 'utf8')),
    )

    expect(keyed).toHaveLength(listed.length)
    expect(keyed.flatMap(([path, mod]) => copyProblems(path, mod, locales))).toEqual([])
  })
})
