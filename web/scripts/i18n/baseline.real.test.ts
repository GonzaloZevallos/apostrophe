/**
 * The two checks over the real copy files: the committed `src/copy/en.baseline.json` still
 * renders as recorded (the drift test), and the functions wrapped in `counted()` are exactly
 * the ones whose text depends on a count (the plural-sensitivity test).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { driftProblems, parseBaseline, type Modules } from './baseline.ts'
import { coverageProblems, loadMappingFiles, mappedRows, mappingProblems, MAPPINGS_DIR } from './baselineKeys.ts'
import { loadBundle } from './loadBundle.ts'
import { pluralProblems } from './plurals.ts'

const found = import.meta.glob<Record<string, unknown>>(
  ['../../src/copy/*.ts', '!../../src/copy/baselineArgs.ts', '!../../src/copy/*.test.ts'],
  { eager: true },
)
const modules: Modules = Object.fromEntries(Object.entries(found).map(([path, mod]) => [basename(path), mod]))
const committed = parseBaseline(readFileSync(join(import.meta.dirname, '../../src/copy/en.baseline.json'), 'utf8'))

describe('the real copy files', () => {
  test('every committed baseline entry whose export still exists renders its recorded text', () => {
    expect(driftProblems(modules, committed)).toEqual([])
  })

  test('every committed entry is exported by a .ts file or mapped exactly once, and none is missing', () => {
    // Transitional: the area copy files and `copy/emptyStates.ts` still export the empty-state
    // wordings beside their mapping until the screens subtask removes them; that subtask also
    // deletes this filter. Every other problem, for these sources too (neither exported nor
    // mapped, mapped twice, not in the baseline), still fails.
    const files = loadMappingFiles()
    const moving = new Set(files.filter((file) => file.file === 'emptyStates.json').flatMap((file) => Object.keys(file.mappings)))
    const bothWhileMoving = (problem: string): boolean =>
      problem.endsWith(': both exported and mapped') && moving.has(problem.slice(0, -': both exported and mapped'.length))
    expect(coverageProblems(modules, committed, files).filter((problem) => !bothWhileMoving(problem))).toEqual([])
  })

  test('two sources mapped to one key both render equal to their baseline text', () => {
    const owes = ['customers.ts:NOBODY_OWES', 'inicio.ts:NOBODY_OWES']
    const files = loadMappingFiles().filter((file) => file.file === 'emptyStates.json')
    const picked = files.map((file) => ({ file: file.file, mappings: Object.fromEntries(owes.flatMap((source) => (file.mappings[source] ? [[source, file.mappings[source]]] : []))) }))

    expect(picked.flatMap((file) => Object.values(file.mappings).map((mapping) => mapping.key))).toEqual(['emptyStates:nobodyOwes', 'emptyStates:nobodyOwes'])
    expect(mappedRows(picked, committed).rows.map((row) => row.text)).toEqual(['Nobody owes you', 'Nobody owes you'])
    expect(mappingProblems(picked, committed, loadBundle('en'))).toEqual([])
  })

  test('every mapped entry renders in en equal to its baseline text, and every mapping is read', () => {
    const files = loadMappingFiles()
    // The expected count comes from a listing of the folder, never from the loader under test.
    // A folder that does not exist yet counts as zero.
    const listed = (existsSync(MAPPINGS_DIR) ? readdirSync(MAPPINGS_DIR, { withFileTypes: true }) : []).filter((item) => item.isFile() && item.name.endsWith('.json'))
    const mapped = listed.flatMap((item) => {
      const parsed: unknown = JSON.parse(readFileSync(join(MAPPINGS_DIR, item.name), 'utf8'))
      return typeof parsed === 'object' && parsed !== null ? Object.keys(parsed) : []
    })
    const expectedRows = mapped.reduce((total, source) => total + committed.filter((entry) => entry.source === source).length, 0)

    expect(files).toHaveLength(listed.length)
    expect(mappedRows(files, committed).rows).toHaveLength(expectedRows)
    expect(mappingProblems(files, committed, loadBundle('en'))).toEqual([])
  })

  test('the functions wrapped in counted() are exactly the ones whose text depends on a count', () => {
    expect(pluralProblems(modules)).toEqual([])
  })

  test('baseline_exceptions.json holds only reasoned entries', () => {
    const raw: unknown = JSON.parse(readFileSync(join(import.meta.dirname, '../../src/copy/baseline_exceptions.json'), 'utf8'))
    expect(raw).toEqual([])
  })
})
