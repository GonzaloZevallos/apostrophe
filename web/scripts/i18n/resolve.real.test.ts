/**
 * The resolver over the real `locales/en/` folder: every plural base at count 0, 1 and 2 and
 * every other leaf equals what a fresh i18next instance answers, and so does every mapped
 * baseline row with its recorded args. The expected counts come from listings of the folders
 * with `readdirSync`, never from the glob or loader under test; a missing folder counts zero.
 */

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { parityProblems, referenceT } from '../../src/i18n/parity.ts'
import { resolveKey } from '../../src/i18n/resolve.ts'
import { parseBaseline } from './baseline.ts'
import { loadMappingFiles, mappedRows } from './baselineKeys.ts'
import { loadBundle, LOCALES_ROOT } from './loadBundle.ts'

const EN_FOLDER = join(LOCALES_ROOT, 'en')
const PLURAL = /_(zero|one|two|few|many|other)$/

/** The resolutions the files of a folder call for: one per leaf, three per plural base. */
function expectedCases(): number {
  if (!existsSync(EN_FOLDER)) return 0
  let total = 0
  const walk = (value: unknown): void => {
    if (typeof value !== 'object' || value === null) return
    const names = Object.keys(value)
    const bases = new Set(names.filter((name) => PLURAL.test(name)).map((name) => name.replace(PLURAL, '')))
    for (const [name, item] of Object.entries(value)) {
      if (typeof item === 'string') total += PLURAL.test(name) ? 0 : 1
      else walk(item)
    }
    total += bases.size * 3
  }
  for (const file of readdirSync(EN_FOLDER).filter((name) => name.endsWith('.json'))) {
    walk(JSON.parse(readFileSync(join(EN_FOLDER, file), 'utf8')))
  }
  return total
}

describe('the resolver over the real en folder', () => {
  const en = loadBundle('en')

  test('equals the i18next runtime on every leaf, as many as the files hold', () => {
    const { cases, problems } = parityProblems(en)

    expect(problems).toEqual([])
    expect(cases).toBe(expectedCases())
  })

  test('equals the i18next runtime on every mapped baseline row with its recorded args', () => {
    const committed = parseBaseline(readFileSync(join(import.meta.dirname, '../../src/copy/en.baseline.json'), 'utf8'))
    const { rows } = mappedRows(loadMappingFiles(), committed)
    const reference = referenceT(en)
    const differing = rows.filter((row) => resolveKey(en, row.key, row.args) !== reference(row.key, row.args))

    expect(differing.map((row) => `${row.source} row ${row.index}`)).toEqual([])
  })
})

/** Every string under a locales root that holds `$t(`, as `<tag>/<file>: <path>`, and how many
 * files were read. The listing is `readdirSync`, a missing root counts zero. */
function nestingIn(root: string): { files: number; problems: string[] } {
  const problems: string[] = []
  let files = 0
  if (!existsSync(root)) return { files, problems }
  const walk = (value: unknown, where: string, path: string): void => {
    if (typeof value === 'string') {
      if (value.includes('$t(')) problems.push(`${where}: ${path}`)
    } else if (typeof value === 'object' && value !== null) {
      for (const [name, item] of Object.entries(value)) walk(item, where, path === '' ? name : `${path}.${name}`)
    }
  }
  for (const tag of readdirSync(root)) {
    for (const file of readdirSync(join(root, tag)).filter((name) => name.endsWith('.json'))) {
      files += 1
      walk(JSON.parse(readFileSync(join(root, tag, file), 'utf8')), `${tag}/${file}`, '')
    }
  }
  return { files, problems }
}

describe('no locale string holds $t(', () => {
  test('over every file of every real folder, as many as the listing holds', () => {
    const { files, problems } = nestingIn(LOCALES_ROOT)
    const listed = readdirSync(LOCALES_ROOT).flatMap((tag) => readdirSync(join(LOCALES_ROOT, tag)).filter((name) => name.endsWith('.json')))

    expect(problems).toEqual([])
    expect(files).toBe(listed.length)
  })

  test('a string that nests $t( is reported with its file and path', () => {
    const root = mkdtempSync(join(tmpdir(), 'locales-'))
    mkdirSync(join(root, 'en'))
    writeFileSync(join(root, 'en', 'shapes.json'), JSON.stringify({ outer: { inner: 'See $t(shapes:other)' }, fine: 'Hello' }))

    expect(nestingIn(root)).toEqual({ files: 1, problems: ['en/shapes.json: outer.inner'] })
  })
})
