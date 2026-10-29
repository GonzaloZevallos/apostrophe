/**
 * The limits on always-visible copy (docs/product/icon-and-text-rule.md): every copy
 * module (a file of `web/src/copy/`) registers its fixed help lines, notices and
 * empty-state strings in `LIMITED_COPY` — the same binding the screen renders, with
 * placeholders filled from `SAMPLES`, never fixture or API data — and lists the
 * refusals it keeps over 80 characters in `LONG_REFUSALS`.
 */

import { describe, expect, test } from 'vitest'
import type { Bundle } from '../i18n/resolve'
import { copyProblems, LIMITS, measure, SAMPLES, type CopyModule, type Locales } from './limits'

/** Locale files by tag, as `resources.ts` reads them: one eager glob, namespace = file name. */
function bundlesOf(files: Readonly<Record<string, Record<string, unknown>>>): Record<string, Record<string, unknown>> {
  const locales: Record<string, Record<string, unknown>> = {}
  for (const [path, content] of Object.entries(files)) {
    const match = /\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path)
    const [, tag, ns] = match ?? []
    if (tag !== undefined && ns !== undefined) locales[tag] = { ...locales[tag], [ns]: content }
  }
  return locales
}

const real = bundlesOf(
  import.meta.glob<Record<string, unknown>>('/src/copy/locales/*/*.json', { eager: true, import: 'default' }),
)
const fixtures = bundlesOf(
  import.meta.glob<Record<string, unknown>>('/src/i18n/__fixtures__/locales/*/*.json', { eager: true, import: 'default' }),
)

/** Today's copy modules, written once. A new module is added here in the diff that
 * creates it; the glob below fails until it is. */
const KNOWN_MODULES = [
  '/src/copy/analysis.ts',
  '/src/copy/auth.ts',
  '/src/copy/catalog.ts',
  '/src/copy/common.ts',
  '/src/copy/customers.ts',
  '/src/copy/dates.ts',
  '/src/copy/expenses.ts',
  '/src/copy/inicio.ts',
  '/src/copy/onboarding.ts',
  '/src/copy/payments.ts',
  '/src/copy/pinnedCatalog.ts',
  '/src/copy/sales.ts',
  '/src/copy/settings.ts',
  '/src/copy/shell.ts',
  '/src/copy/stock.ts',
  '/src/copy/varieties.ts',
]

const found = import.meta.glob<CopyModule>(
  ['/src/copy/*.ts', '!/src/copy/limits.ts', '!/src/copy/emptyStates.ts', '!/src/copy/baselineArgs.ts', '!/src/copy/*.test.ts'],
  { eager: true },
)

describe('the copy modules', () => {
  test('are exactly the ones this list names', () => {
    expect(Object.keys(found).sort()).toEqual([...KNOWN_MODULES].sort())
  })

  test.each(Object.entries(found))('%s keeps both registries and every entry within its limit', (path, mod) => {
    expect(copyProblems(path, mod, real)).toEqual([])
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
    expect(copyProblems('m', mod, {})).toEqual([])
  })

  test('refuses a missing registry', () => {
    expect(copyProblems('m', { LONG_REFUSALS: [] }, {})).toHaveLength(1)
    expect(copyProblems('m', { LIMITED_COPY: [] }, {})).toHaveLength(1)
  })

  test.each([
    ['help', over],
    ['notice', over],
    ['moreInfo', over],
    ['emptyLine', over],
    ['emptyTitle', 'a'.repeat(41)],
  ] as const)('refuses a %s over its limit', (kind, text) => {
    const mod: CopyModule = { LIMITED_COPY: [{ kind, text }], LONG_REFUSALS: [] }
    expect(copyProblems('m', mod, {})).toHaveLength(1)
    expect(LIMITS[kind]).toBeLessThan(measure(text))
  })

  test('refuses an exported string over 80 that is not listed as a long refusal', () => {
    const mod: CopyModule = { LIMITED_COPY: [], LONG_REFUSALS: [], SOME_REFUSAL: over }
    expect(copyProblems('m', mod, {})).toHaveLength(1)
  })

  test('accepts that string once it is listed, and refuses a stale listing', () => {
    expect(
      copyProblems('m', { LIMITED_COPY: [], LONG_REFUSALS: [over], SOME_REFUSAL: over }, {}),
    ).toEqual([])
    expect(copyProblems('m', { LIMITED_COPY: [], LONG_REFUSALS: [ok], SOME_REFUSAL: ok }, {})).toHaveLength(1)
    expect(copyProblems('m', { LIMITED_COPY: [], LONG_REFUSALS: [over] }, {})).toHaveLength(1)
  })
})

describe('a keyed module, over the committed fixture locales', () => {
  const long = 'a'.repeat(81)
  /** The fixture bundles with one text added to one language: a deliberately broken folder. */
  function broken(tag: string, key: string, text: string): Locales {
    const bundle: Record<string, unknown> = { ...fixtures[tag], shapes: { ...(fixtures[tag]?.['shapes'] as Bundle), [key]: text } }
    return { ...fixtures, [tag]: bundle }
  }
  const keyed = (limited: CopyModule['LIMITED_COPY'], refusals: readonly string[] = []): CopyModule => ({
    NAMESPACE: 'shapes',
    LIMITED_COPY: limited,
    LONG_REFUSALS: refusals,
  })

  test('the fixture folders are exactly en, xx and en-XA', () => {
    expect(Object.keys(fixtures).sort()).toEqual(['en', 'en-XA', 'xx'])
  })

  test('accepts keys that fit, skips a key missing only in xx and never reads en-XA', () => {
    // en-XA holds 120-character values for `shapes:title` and `shapes:hello`; xx has no `hello`.
    const mod = keyed([
      { kind: 'emptyTitle', key: 'shapes:title' },
      { kind: 'help', key: 'shapes:hello' },
      { kind: 'notice', key: 'shapes:inbox', args: { count: 2 } },
      { kind: 'help', key: 'shapes:range' },
    ])

    expect(copyProblems('m', mod, fixtures)).toEqual([])
  })

  test('refuses an over-long key, naming it and the language', () => {
    const mod = keyed([{ kind: 'help', key: 'shapes:long' }])

    expect(copyProblems('m', mod, broken('en', 'long', long))).toEqual([
      'm: shapes:long (en) is a help over 80 characters',
      'm: shapes:long (en) is over 80 characters and not in LONG_REFUSALS',
    ])
    expect(copyProblems('m', keyed([{ kind: 'help', key: 'shapes:title' }]), broken('xx', 'title', long))).toEqual([
      'm: shapes:title (xx) is a help over 80 characters',
      'm: shapes:title (xx) is over 80 characters and not in LONG_REFUSALS',
    ])
  })

  test('refuses a key absent from en, even when another language has it', () => {
    const mod = keyed([{ kind: 'help', key: 'shapes:absent' }])

    expect(copyProblems('m', mod, fixtures)).toEqual(['m: shapes:absent is absent from en'])
    expect(copyProblems('m', mod, broken('xx', 'absent', 'present only in xx'))).toEqual(['m: shapes:absent is absent from en'])
  })

  test('refuses a key outside NAMESPACE, in LIMITED_COPY and in LONG_REFUSALS', () => {
    const mod = keyed([{ kind: 'help', key: 'fixture:title' }], ['fixture:greeting'])

    expect(copyProblems('m', mod, fixtures)).toEqual([
      'm: fixture:title is outside the namespace shapes',
      'm: LONG_REFUSALS lists fixture:greeting, outside the namespace shapes',
    ])
  })

  test('refuses a placeholder that is not in PLACEHOLDERS', () => {
    const mod = keyed([{ kind: 'help', key: 'shapes:stranger' }])

    expect(copyProblems('m', mod, broken('en', 'stranger', 'Hi {{stranger}}'))).toEqual([
      'm: shapes:stranger (en) holds the placeholder stranger, which is not in PLACEHOLDERS',
    ])
  })

  test('refuses keyed copy in a module that exports no NAMESPACE', () => {
    expect(copyProblems('m', { LIMITED_COPY: [{ kind: 'help', key: 'shapes:title' }], LONG_REFUSALS: [] }, fixtures)).toEqual([
      'm: NAMESPACE is not exported',
    ])
  })

  test('walks the namespace leaves: over 80 must be listed, and a stale listing is refused', () => {
    const locales = broken('en', 'long', long)

    expect(copyProblems('m', keyed([]), locales)).toEqual(['m: shapes:long (en) is over 80 characters and not in LONG_REFUSALS'])
    expect(copyProblems('m', keyed([], ['shapes:long']), locales)).toEqual([])
    expect(copyProblems('m', keyed([], ['shapes:title']), fixtures)).toEqual(['m: LONG_REFUSALS lists shapes:title, which fits 80'])
    expect(copyProblems('m', keyed([], ['shapes:nope']), fixtures)).toEqual(['m: LONG_REFUSALS lists shapes:nope, which en does not hold'])
  })

  test('a plural base listed in LONG_REFUSALS covers its forms', () => {
    const locales = broken('en', 'inbox_other', `{{count}} ${long}`)

    expect(copyProblems('m', keyed([], ['shapes:inbox']), locales)).toEqual([])
    expect(copyProblems('m', keyed([]), locales)).toEqual(['m: shapes:inbox_other (en) is over 80 characters and not in LONG_REFUSALS'])
  })

  test('a language with no folder is simply not checked, but en is always required', () => {
    expect(copyProblems('m', keyed([{ kind: 'help', key: 'shapes:title' }]), {})).toEqual(['m: shapes:title is absent from en'])
  })
})
