/**
 * The resolver over the real `locales/en/` folder: every plural base at count 0, 1 and 2 and
 * every other leaf equals what a fresh i18next instance answers, and so does every mapped
 * baseline row with its recorded args. The expected counts come from listings of the folders
 * with `readdirSync`, never from the glob or loader under test; a missing folder counts zero.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import i18next from 'i18next'
import { describe, expect, test } from 'vitest'
import { productionOptions } from '../../src/i18n/options.ts'
import { parityProblems } from '../../src/i18n/parity.ts'
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
    const instance = i18next.createInstance()
    void instance.init({ ...productionOptions, ns: Object.keys(en), resources: { en } })
    const differing = rows.filter((row) => resolveKey(en, row.key, row.args) !== instance.t(row.key as never, row.args as never))

    expect(differing.map((row) => `${row.source} row ${row.index}`)).toEqual([])
  })
})
