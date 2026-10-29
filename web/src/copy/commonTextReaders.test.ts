/**
 * `COMMON_TEXT` (and its two messages) stays while a file still reads it. Each area owns one
 * list in `commonTextReaders/<area>.json` of the files of its directories that still do, and
 * deletes its list in the diff that rewrites its last read onto keys. This test keeps the
 * lists honest: a reader that is not listed, a listed file that stopped reading, a path that
 * is gone, a file listed twice. When the last list is gone it says to delete `COMMON_TEXT`.
 *
 * A reader is a whole-word match of one of the three names in a `web/src/**` ts or tsx file,
 * tests included. Three files are left out of the match because they are the definition and
 * its own guard, not readers: `copy/common.ts`, `copy/common.deprecated.test.ts` and this file
 * (which names the identifiers in this comment and in its fixtures).
 */

import { describe, expect, test } from 'vitest'

interface Source {
  path: string
  content: string
}

type Lists = Readonly<Record<string, readonly string[]>>

const READS = /\b(COMMON_TEXT|SIN_CONEXION_MENSAJE|ERROR_GENERICO_MENSAJE)\b/

const NOT_READERS: ReadonlySet<string> = new Set([
  'web/src/copy/common.ts',
  'web/src/copy/common.deprecated.test.ts',
  'web/src/copy/commonTextReaders.test.ts',
])

const NO_READERS = 'COMMON_TEXT has no readers: delete it'

/** What is wrong between the files that read the shared texts and the lists that name them. */
function readerProblems(sources: readonly Source[], lists: Lists): string[] {
  const readers = new Set(
    sources.filter((source) => !NOT_READERS.has(source.path) && READS.test(source.content)).map((source) => source.path),
  )
  const existing = new Set(sources.map((source) => source.path))
  const where = new Map<string, string[]>()
  for (const [area, paths] of Object.entries(lists)) {
    for (const path of paths) where.set(path, [...(where.get(path) ?? []), area])
  }

  const problems: string[] = []
  if (where.size === 0) problems.push(NO_READERS)
  for (const [path, areas] of where) {
    if (areas.length > 1) problems.push(`${path}: listed ${areas.length} times (${areas.join(', ')}): list it once`)
    if (!existing.has(path)) problems.push(`${path}: does not exist: remove it from ${areas[0]}`)
    else if (!readers.has(path)) problems.push(`${path}: no longer reads COMMON_TEXT: remove it from ${areas[0]}`)
  }
  for (const path of readers) {
    if (!where.has(path)) problems.push(`${path}: reads COMMON_TEXT but is in no commonTextReaders list`)
  }
  return problems
}

const SHELL_OWNS = [
  'web/src/shell/',
  'web/src/routes.ts',
  'web/src/format/',
  'web/src/stock/detail.ts',
  'web/src/mobile-standard/',
  'web/src/screens/originLabel.ts',
  'web/src/screens/priceDeleteNotice.ts',
  'web/src/screens/onboarding/steps.ts',
  // The one shared component still reading: it re-exports ERROR_GENERICO_MENSAJE for the screens.
  'web/src/components/ErrorGenerico.tsx',
]

/** The paths of a shell list that the shell does not own. */
function shellStrays(paths: readonly string[]): string[] {
  return paths.filter((path) => !SHELL_OWNS.some((owned) => path === owned || (owned.endsWith('/') && path.startsWith(owned))))
}

describe('shellStrays over fixtures', () => {
  test('accepts what the shell owns', () => {
    expect(shellStrays(['web/src/shell/Shell.tsx', 'web/src/routes.ts', 'web/src/components/ErrorGenerico.tsx'])).toEqual([])
  })

  test('rejects a screen, another component and a lookalike prefix', () => {
    const strays = ['web/src/screens/Gastos.tsx', 'web/src/components/Loading.tsx', 'web/src/routes.ts.bak', 'web/src/shellish/X.ts']

    expect(shellStrays(['web/src/shell/Shell.tsx', ...strays])).toEqual(strays)
  })
})

describe('readerProblems over fixtures', () => {
  const reader = { path: 'web/src/screens/A.tsx', content: "import { COMMON_TEXT } from '../copy/common'" }
  const other = { path: 'web/src/screens/B.tsx', content: "import { SIN_CONEXION_MENSAJE } from '../copy/common'" }
  const clean = { path: 'web/src/screens/C.tsx', content: "t('common:save')" }

  test('accepts lists that name exactly the readers, whatever the three names', () => {
    expect(readerProblems([reader, other, clean], { one: [reader.path], two: [other.path] })).toEqual([])
    expect(
      readerProblems([{ path: 'web/src/x.ts', content: 'const m = ERROR_GENERICO_MENSAJE' }], { one: ['web/src/x.ts'] }),
    ).toEqual([])
  })

  test('rejects a reader that no list names', () => {
    expect(readerProblems([reader, other], { one: [reader.path] })).toEqual([
      `${other.path}: reads COMMON_TEXT but is in no commonTextReaders list`,
    ])
  })

  test('rejects a listed file that no longer reads', () => {
    expect(readerProblems([reader, clean], { one: [reader.path, clean.path] })).toEqual([
      `${clean.path}: no longer reads COMMON_TEXT: remove it from one`,
    ])
  })

  test('does not take a longer identifier for a read', () => {
    const longer = { path: 'web/src/screens/D.tsx', content: 'const MY_COMMON_TEXT_2 = COMMON_TEXTS' }

    expect(readerProblems([reader, longer], { one: [reader.path] })).toEqual([])
    expect(readerProblems([reader, longer], { one: [reader.path, longer.path] })).toEqual([
      `${longer.path}: no longer reads COMMON_TEXT: remove it from one`,
    ])
  })

  test('rejects a listed path that does not exist', () => {
    expect(readerProblems([reader], { one: [reader.path, 'web/src/screens/Gone.tsx'] })).toEqual([
      'web/src/screens/Gone.tsx: does not exist: remove it from one',
    ])
  })

  test('rejects a file listed twice, in one list or across lists', () => {
    expect(readerProblems([reader], { one: [reader.path, reader.path] })).toEqual([
      `${reader.path}: listed 2 times (one, one): list it once`,
    ])
    expect(readerProblems([reader], { one: [reader.path], two: [reader.path] })).toEqual([
      `${reader.path}: listed 2 times (one, two): list it once`,
    ])
  })

  test('says to delete COMMON_TEXT when no list holds a file', () => {
    expect(readerProblems([clean], {})).toEqual([NO_READERS])
    expect(readerProblems([clean], { one: [] })).toEqual([NO_READERS])
  })

  test('leaves out the definition, its guard and this test, which name the identifiers without reading them', () => {
    const named = NOT_READERS.has('web/src/copy/common.ts') && NOT_READERS.has('web/src/copy/commonTextReaders.test.ts')
    const sources = [...NOT_READERS].map((path) => ({ path, content: 'COMMON_TEXT' }))

    expect(named).toBe(true)
    expect(readerProblems([...sources, reader], { one: [reader.path] })).toEqual([])
  })
})

describe('the real tree', () => {
  const modules = import.meta.glob<string>('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })
  const sources = Object.entries(modules).map(([path, content]) => ({ path: `web${path}`, content }))
  const listFiles = import.meta.glob<string[]>('./commonTextReaders/*.json', { eager: true, import: 'default' })
  const lists = Object.fromEntries(
    Object.entries(listFiles).map(([path, paths]) => [path.replace(/^.*\/(.*)\.json$/, '$1'), paths]),
  )

  test('reads the whole tree and every area list', () => {
    expect(sources.length).toBeGreaterThan(50)
    expect(Object.keys(lists)).toContain('shell')
  })

  // Which area a list belongs to is the area parts' call, as they delete their own list: only
  // `shell.json` is closed, by the test below.
  test('every reader is listed once, and every listed file still reads', () => {
    expect(readerProblems(sources, lists)).toEqual([])
  })

  test('shell.json holds only the directories and files the shell owns, and the one shared component', () => {
    expect(shellStrays(lists['shell'] ?? [])).toEqual([])
  })
})
