/**
 * The limits on always-visible copy (docs/product/icon-and-text-rule.md): every section of
 * `web/src/copy/` registers its fixed help lines, notices and
 * empty-state strings in `LIMITED_COPY` — the same binding the screen renders, with
 * placeholders filled from `SAMPLES`, never fixture or API data — and lists the
 * refusals it keeps over 80 characters in `LONG_REFUSALS`.
 */

import { describe, expect, test } from 'vitest'
import { copyProblems, LIMITS, measure, SAMPLES, type CopyModule } from './limits'

/** The sections of `web/src/copy/`, written once. A new section is added here in the diff
 * that creates it; the glob below fails until it is. `index.ts` re-exports them and
 * `limits.ts` is the checker, so neither is a section. */
const KNOWN_MODULES = [
  'analysis',
  'auth',
  'catalog',
  'common',
  'customers',
  'expenses',
  'format',
  'home',
  'onboarding',
  'refusals',
  'sales',
  'settings',
  'shell',
  'states',
  'stock',
  'varieties',
].map((section) => `/src/copy/${section}.ts`)

const found = import.meta.glob<CopyModule>(
  ['/src/copy/*.ts', '!/src/copy/{index,limits}.ts', '!/src/copy/*.test.ts'],
  { eager: true },
)

describe('the copy sections', () => {
  test('are exactly the ones this list names', () => {
    expect(Object.keys(found).sort()).toEqual([...KNOWN_MODULES].sort())
  })

  test.each(Object.entries(found))('%s keeps both registries and every entry within its limit', (path, mod) => {
    expect(copyProblems(path, mod)).toEqual([])
  })
})

describe('measure', () => {
  test('counts code points after NFC, not UTF-16 units or decomposed marks', () => {
    expect(measure('á')).toBe(1)
    expect(measure('á')).toBe(1)
    expect(measure('😀')).toBe(1)
  })

  test('SAMPLES are the worst cases the limits are measured with', () => {
    expect(SAMPLES.date).toBe('28/09')
    expect(SAMPLES.amount).toBe('$ 999.999')
    expect(SAMPLES.negativeAmount).toBe('−$ 999.999')
    expect(SAMPLES.grams).toBe('999,99 g')
    expect(measure(SAMPLES.name)).toBe(24)
    expect(SAMPLES.count).toBe('99')
  })
})

describe('copyProblems rejects what it must', () => {
  const ok = 'a'.repeat(80)
  const over = 'a'.repeat(81)

  test('accepts a module whose entries fit and whose registries exist', () => {
    const mod: CopyModule = { LIMITED_COPY: [{ kind: 'help', text: ok }], LONG_REFUSALS: [] }
    expect(copyProblems('m', mod)).toEqual([])
  })

  test('refuses a missing registry', () => {
    expect(copyProblems('m', { LONG_REFUSALS: [] })).toHaveLength(1)
    expect(copyProblems('m', { LIMITED_COPY: [] })).toHaveLength(1)
  })

  test.each([
    ['help', over],
    ['notice', over],
    ['moreInfo', over],
    ['emptyLine', over],
    ['emptyTitle', 'a'.repeat(41)],
  ] as const)('refuses a %s over its limit', (kind, text) => {
    const mod: CopyModule = { LIMITED_COPY: [{ kind, text }], LONG_REFUSALS: [] }
    expect(copyProblems('m', mod)).toHaveLength(1)
    expect(LIMITS[kind]).toBeLessThan(measure(text))
  })

  test('refuses an exported string over 80 that is not listed as a long refusal', () => {
    const mod: CopyModule = { LIMITED_COPY: [], LONG_REFUSALS: [], SOME_REFUSAL: over }
    expect(copyProblems('m', mod)).toHaveLength(1)
  })

  test('accepts that string once it is listed, and refuses a stale listing', () => {
    expect(
      copyProblems('m', { LIMITED_COPY: [], LONG_REFUSALS: [over], SOME_REFUSAL: over }),
    ).toEqual([])
    expect(copyProblems('m', { LIMITED_COPY: [], LONG_REFUSALS: [ok], SOME_REFUSAL: ok })).toHaveLength(1)
    expect(copyProblems('m', { LIMITED_COPY: [], LONG_REFUSALS: [over] })).toHaveLength(1)
  })
})
