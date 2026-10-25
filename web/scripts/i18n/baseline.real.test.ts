/**
 * The two checks over the real copy files: the committed `src/copy/en.baseline.json` still
 * renders as recorded (the drift test), and the functions wrapped in `counted()` are exactly
 * the ones whose text depends on a count (the plural-sensitivity test).
 */

import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { collectEntries, driftProblems, parseBaseline, type Modules } from './baseline.ts'
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

  test('today every copy text is recorded: the baseline has no entry missing and none extra', () => {
    const now = collectEntries(modules).map((entry) => `${entry.source} ${JSON.stringify(entry.args)}`)
    expect(committed.map((entry) => `${entry.source} ${JSON.stringify(entry.args)}`)).toEqual(now)
  })

  test('the functions wrapped in counted() are exactly the ones whose text depends on a count', () => {
    expect(pluralProblems(modules)).toEqual([])
  })

  test('baseline_exceptions.json holds only reasoned entries', () => {
    const raw: unknown = JSON.parse(readFileSync(join(import.meta.dirname, '../../src/copy/baseline_exceptions.json'), 'utf8'))
    expect(raw).toEqual([])
  })
})
