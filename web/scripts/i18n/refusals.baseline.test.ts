/**
 * English refusals are unchanged: the real mapping walked against the real baseline and `en`
 * (stays in the gate), and the walk shown failing on each broken input.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { parseBaseline } from './baseline.ts'
import { loadMappingFiles } from './baselineKeys.ts'
import { loadBundle } from './loadBundle.ts'
import { refusalWalkProblems } from './refusalsWalk.ts'

const committed = parseBaseline(readFileSync(join(import.meta.dirname, '../../src/copy/en.baseline.json'), 'utf8'))
const en = loadBundle('en')
const refusals = loadMappingFiles().find((file) => file.file === 'refusals.json')?.mappings ?? {}

const entry = (source: string, text: string) => ({ source, args: null, text })
const fixtureEn = { refusals: { alpha: 'Alpha text', beta: 'Beta text' } }
const fixtureBaseline = [entry('refusals.ts:A', 'Alpha text'), entry('refusals.ts:B', 'Beta text')]
const fixtureMap = { 'refusals.ts:A': { key: 'refusals:alpha' }, 'refusals.ts:B': { key: 'refusals:beta' } }

describe('the real refusals mapping', () => {
  test('maps every refusals.ts source, uses every leaf and renders each byte-equal in en', () => {
    expect(Object.keys(refusals).length).toBeGreaterThan(100)
    expect(refusalWalkProblems(committed, refusals, en)).toEqual([])
  })
})

describe('the walk on fixtures', () => {
  test('accepts a complete mapping', () => {
    expect(refusalWalkProblems(fixtureBaseline, fixtureMap, fixtureEn)).toEqual([])
  })

  test('rejects a source left unmapped', () => {
    const { 'refusals.ts:B': _left, ...rest } = fixtureMap

    expect(refusalWalkProblems(fixtureBaseline, rest, fixtureEn)).toEqual([
      'refusals.ts:B: not mapped',
      'refusals:beta: no source uses it',
    ])
  })

  test('rejects a leaf no source uses', () => {
    const extra = { refusals: { ...fixtureEn.refusals, gamma: 'Gamma text' } }

    expect(refusalWalkProblems(fixtureBaseline, fixtureMap, extra)).toEqual(['refusals:gamma: no source uses it'])
  })

  test('rejects a text that is not byte-equal, naming the source and not the text', () => {
    const changed = { refusals: { alpha: 'Alpha text ', beta: 'Beta text' } }
    const problems = refusalWalkProblems(fixtureBaseline, fixtureMap, changed)

    expect(problems).toEqual(['refusals.ts:A: not byte-equal to its baseline text'])
  })

  test('rejects a key the bundle lacks', () => {
    const lacking = { ...fixtureMap, 'refusals.ts:B': { key: 'refusals:missing' } }

    expect(refusalWalkProblems(fixtureBaseline, lacking, fixtureEn)).toContain('refusals.ts:B: refusals:missing cannot be resolved')
  })
})
