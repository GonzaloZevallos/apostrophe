/**
 * The no-top-level-text rule (GH-379, ADR-0049 amendment) on its fixtures. Each fixture under
 * `fixtures/noTopLevelText/` is a `.txt` whose first line states what the rule must answer
 * (`// expect: rule@line[, rule@line]` or `// expect: none`, line numbers counting that line),
 * and the whole sorted `{ line, rule }[]` is compared with `toEqual`. The fixtures are `.txt`
 * so the real-tree scan and the type checker never read them as source.
 */

import { describe, expect, test } from 'vitest'
import { findTopLevelText, I18N_EXCEPTION, type TopLevelFinding } from './noTopLevelText'

const fixtures = import.meta.glob('./fixtures/noTopLevelText/*.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const RULES: readonly TopLevelFinding['rule'][] = ['t-outside-function', 'locale-import', 'resource-read']

/** Where a fixture is checked: outside `src/i18n/` and as `.ts`, unless the case needs otherwise. */
const DEFAULT_PATH = 'web/src/screens/Fixture.ts'
const CHECKED_UNDER: Readonly<Record<string, string>> = {
  // JSON reads and by-reference passing need a locale import, which only `i18n/` may hold.
  fail_json_read: 'web/src/i18n/probe.ts',
  fail_json_element_read: 'web/src/i18n/probe.ts',
  pass_bundle_by_reference: 'web/src/i18n/probe.ts',
  fail_jsx_child: 'web/src/screens/Fixture.tsx',
}

function expected(source: string): TopLevelFinding[] | undefined {
  const first = source.split('\n', 1)[0] ?? ''
  const prefix = '// expect: '
  if (!first.startsWith(prefix)) return undefined
  const body = first.slice(prefix.length).trim()
  if (body === 'none') return []
  const found: TopLevelFinding[] = []
  for (const part of body.split(',')) {
    const [rule, line] = part.trim().split('@')
    const found_rule = RULES.find((candidate) => candidate === rule)
    const number = Number(line)
    if (found_rule === undefined || !Number.isInteger(number) || number < 2) return undefined
    found.push({ line: number, rule: found_rule })
  }
  return found
}

function byLineThenRule(a: TopLevelFinding, b: TopLevelFinding): number {
  return a.line - b.line || a.rule.localeCompare(b.rule, 'en')
}

function nameOf(path: string): string {
  return (path.split('\u002F').pop() ?? path).replace('.txt', '')
}

const entries = Object.entries(fixtures).map(([path, source]) => ({ name: nameOf(path), source }))

describe('fixtures', () => {
  test('there are fixtures, named fail_ or pass_', () => {
    expect(entries.length).toBeGreaterThan(20)
    for (const { name } of entries) expect(name).toMatch(/^(fail|pass)_/)
  })

  test.each(entries)('$name states its expectation and the rule agrees', ({ name, source }) => {
    const want = expected(source)
    expect(want, `${name}: no parseable "// expect:" first line`).toBeDefined()
    const got = findTopLevelText(CHECKED_UNDER[name] ?? DEFAULT_PATH, source)
    expect(got).toEqual([...(want ?? [])].sort(byLineThenRule))
  })

  test('a fail fixture expects findings, a pass fixture expects none', () => {
    for (const { name, source } of entries) {
      const want = expected(source) ?? []
      if (name.startsWith('fail_')) expect(want.length, name).toBeGreaterThan(0)
      else expect(want, name).toEqual([])
    }
  })

  test('every rule is the expectation of at least one fail fixture, and a pass fixture exists', () => {
    const covered = new Set(
      entries.filter(({ name }) => name.startsWith('fail_')).flatMap(({ source }) => (expected(source) ?? []).map(({ rule }) => rule)),
    )
    for (const rule of RULES) expect(covered.has(rule), rule).toBe(true)
    expect(entries.some(({ name }) => name.startsWith('pass_'))).toBe(true)
  })

  test('a source whose expectation line is missing or malformed is not accepted', () => {
    expect(expected('const a = 1\n')).toBeUndefined()
    expect(expected('// expect: nothing-at-all@2\n')).toBeUndefined()
    expect(expected('// expect: locale-import\n')).toBeUndefined()
    expect(expected('// expect: none\n')).toEqual([])
  })
})

describe('src/i18n/ is the one place that imports locale files', () => {
  const imports = entries.find(({ name }) => name === 'fail_locale_import')?.source ?? ''
  const glob = entries.find(({ name }) => name === 'fail_locale_glob')?.source ?? ''

  test.each(['web/src/i18n/resources.ts', '/src/i18n/resources.ts', 'src\\i18n\\resources.ts'])(
    'a locale import and a locale glob in %s are allowed',
    (path) => {
      expect(imports).not.toBe('')
      expect(findTopLevelText(path, imports)).toEqual([])
      expect(findTopLevelText(path, glob)).toEqual([])
    },
  )

  test.each(['web/src/i18nx/resources.ts', 'web/src/api/i18n/resources.ts', 'web/src/screens/i18n.ts'])(
    'the same sources in %s are findings',
    (path) => {
      expect(findTopLevelText(path, imports)).toEqual([{ line: 2, rule: 'locale-import' }])
      expect(findTopLevelText(path, glob)).toEqual([{ line: 2, rule: 'locale-import' }])
    },
  )

  test('the other two rules still apply inside i18n/', () => {
    const read = entries.find(({ name }) => name === 'fail_resource_calls')?.source ?? ''
    expect(findTopLevelText('web/src/i18n/resources.ts', read)).toHaveLength(5)
  })
})

describe('the named exception for i18n/', () => {
  const alias = 'export const testT = i18n.t\n'

  test('it is one constant with a reason, applying only to its path', () => {
    expect(I18N_EXCEPTION.reason.length).toBeGreaterThan(20)
    expect(findTopLevelText(`web/${I18N_EXCEPTION.path}`, alias)).toEqual([])
    expect(findTopLevelText('web/src/i18n/other.ts', alias)).toEqual([{ line: 1, rule: 't-outside-function' }])
    expect(findTopLevelText('web/src/screens/testing.ts', alias)).toEqual([{ line: 1, rule: 't-outside-function' }])
  })

  test('it lets alone only the t rule: a resource read in the same file is still a finding', () => {
    expect(findTopLevelText(I18N_EXCEPTION.path, 'export const s = i18n.store\n')).toEqual([
      { line: 1, rule: 'resource-read' },
    ])
  })
})
