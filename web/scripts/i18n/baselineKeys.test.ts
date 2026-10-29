/**
 * The keyed baseline check over a committed fixture: `__fixtures__/sample.ts` is the copy
 * before a move, `__fixtures__/baselineKeys/shapes.json` its mapping, and the `shapes`
 * namespace of `src/i18n/__fixtures__/locales/en` the English it must render. Each rule is
 * shown failing on a deliberately broken input.
 */

import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { collectEntries, type Entry, type Modules } from './baseline.ts'
import {
  coverageProblems,
  loadMappingFiles,
  mappedRows,
  parseMappings,
  mappingProblems,
  type MappingFile,
} from './baselineKeys.ts'
import * as Sample from './__fixtures__/sample.ts'
import { loadBundle } from './loadBundle.ts'

const HERE = import.meta.dirname
const en = loadBundle('en', join(HERE, '../../src/i18n/__fixtures__/locales'))
const BEFORE: Modules = { 'sample.ts': Sample }
/** The sample after the move: what the mapping covers is no longer exported. */
const AFTER: Modules = {
  'sample.ts': {
    LANGUAGE: Sample.LANGUAGE,
    LIST: Sample.LIST,
    statusOf: Sample.statusOf,
    LIMITED_COPY: Sample.LIMITED_COPY,
    LONG_REFUSALS: Sample.LONG_REFUSALS,
    BASELINE_ARGS: { statusOf: Sample.BASELINE_ARGS.statusOf },
  },
}
const committed = collectEntries(BEFORE)
const [fixture] = loadMappingFiles(join(HERE, '__fixtures__/baselineKeys'))

/** The fixture mapping with one source changed, as a one-file list. */
function changed(source: string, mapping: MappingFile['mappings'][string] | undefined): MappingFile[] {
  const mappings = { ...fixture?.mappings }
  if (mapping === undefined) delete mappings[source]
  else mappings[source] = mapping
  return [{ file: 'shapes.json', mappings }]
}

describe('the fixture mapping', () => {
  test('is one file of five sources, seven baseline rows', () => {
    expect(loadMappingFiles(join(HERE, '__fixtures__/baselineKeys')).map((file) => file.file)).toEqual(['shapes.json'])
    expect(Object.keys(fixture?.mappings ?? {})).toHaveLength(5)
    expect(mappedRows(fixture ? [fixture] : [], committed).rows).toHaveLength(7)
  })

  test('renders every mapped row equal to its baseline text in en', () => {
    expect(mappingProblems(fixture ? [fixture] : [], committed, en)).toEqual([])
  })

  test('covers the baseline: each entry is exported or mapped exactly once', () => {
    expect(coverageProblems(AFTER, committed, fixture ? [fixture] : [])).toEqual([])
  })
})

describe('mapping problems', () => {
  test('a wrong value: the key renders another text', () => {
    const files = changed('sample.ts:TITLE', { key: 'shapes:hello' })

    expect(mappingProblems(files, committed, en)).toEqual(['sample.ts:TITLE row 0: renders another text in en'])
  })

  test('a key absent from en', () => {
    const files = changed('sample.ts:TITLE', { key: 'shapes:absent' })

    expect(mappingProblems(files, committed, en)).toEqual(['sample.ts:TITLE row 0: shapes:absent: no such key'])
  })

  test('an args row whose length differs from params', () => {
    const files = changed('sample.ts:GROUP.greet', { key: 'shapes:greeting', params: [] })

    expect(mappingProblems(files, committed, en)).toEqual(['sample.ts:GROUP.greet row 0: 1 args against 0 params'])
  })

  test('params on a key with no args', () => {
    const files = changed('sample.ts:TITLE', { key: 'shapes:title', params: ['name'] })

    expect(mappingProblems(files, committed, en)).toEqual(['sample.ts:TITLE: params on a key with no args'])
  })

  test('a param not in PLACEHOLDERS', () => {
    const files = changed('sample.ts:GROUP.greet', { key: 'shapes:greeting', params: ['stranger'] })

    expect(mappingProblems(files, committed, en)).toEqual(['sample.ts:GROUP.greet: the param stranger is not in PLACEHOLDERS'])
  })

  test('an argument that is not a string or a number (a branching function stays in .ts)', () => {
    const files = changed('sample.ts:statusOf', { key: 'shapes:title', params: ['name', 'date'] })

    expect(mappingProblems(files, committed, en)).toEqual([
      'sample.ts:statusOf row 0: renders another text in en',
      'sample.ts:statusOf row 1: argument 1 is not a string or a number',
    ])
  })

  test('a mapping for a source the baseline does not hold', () => {
    const files = changed('sample.ts:NOPE', { key: 'shapes:title' })

    expect(mappingProblems(files, committed, en)).toEqual(['sample.ts:NOPE: not in the baseline'])
  })

  test('a plural base called without count is not mappable', () => {
    const files = changed('sample.ts:salesCount', { key: 'shapes:sales', params: ['name'] })

    expect(mappingProblems(files, committed, en)[0]).toBe('sample.ts:salesCount row 0: shapes:sales: no such key')
  })
})

describe('coverage problems', () => {
  const files = fixture ? [fixture] : []

  test('an entry both exported and mapped', () => {
    expect(coverageProblems(BEFORE, committed, files)).toEqual([
      'sample.ts:GROUP.greet: both exported and mapped',
      'sample.ts:GROUP.hello: both exported and mapped',
      'sample.ts:GROUP.nested.bye: both exported and mapped',
      'sample.ts:TITLE: both exported and mapped',
      'sample.ts:salesCount: both exported and mapped',
    ])
  })

  test('an entry neither exported nor mapped', () => {
    const ghost: Entry = { source: 'sample.ts:GONE', args: null, text: 'gone' }

    expect(coverageProblems(AFTER, [...committed, ghost], files)).toEqual(['sample.ts:GONE: neither exported nor mapped'])
  })

  test('an entry mapped twice', () => {
    const twice = [...files, { file: 'again.json', mappings: { 'sample.ts:TITLE': { key: 'shapes:title' } } }]

    expect(coverageProblems(AFTER, committed, twice)).toEqual(['sample.ts:TITLE: mapped 2 times'])
  })

  test('an entry the copy has now that the committed baseline lacks', () => {
    const lacking = committed.filter((entry) => entry.source !== 'sample.ts:LANGUAGE')

    expect(coverageProblems(AFTER, lacking, files)).toEqual(['sample.ts:LANGUAGE: not in the committed baseline'])
  })
})

describe('fill: the placeholders of a fragment, which has no args', () => {
  const fragment: Entry = { source: 'a.ts:backTo', args: null, text: 'Back to ' }
  const withArgs: Entry = { source: 'a.ts:f', args: ['Ana'], text: 'Hi Ana' }
  const bundle = { x: { back: 'Back to {{parent}}', hi: 'Hi {{name}}' } }
  const file = (mappings: MappingFile['mappings']): MappingFile[] => [{ file: 'x.json', mappings }]

  test('is parsed with the mapping', () => {
    const parsed = parseMappings('x.json', '{"a.ts:backTo":{"key":"x:back","fill":{"parent":""}}}')

    expect(parsed.mappings['a.ts:backTo']).toEqual({ key: 'x:back', fill: { parent: '' } })
  })

  test.each([
    ['a list', '[]'],
    ['a value that is not a string', '{"parent":3}'],
  ])('is refused when it is %s', (_name, fill) => {
    expect(() => parseMappings('x.json', `{"a.ts:backTo":{"key":"x:back","fill":${fill}}}`)).toThrow('a.ts:backTo fill is not a record of texts')
  })

  test('fills the placeholder, so the fragment equals its baseline text', () => {
    const files = file({ 'a.ts:backTo': { key: 'x:back', fill: { parent: '' } } })

    expect(mappingProblems(files, [fragment], bundle)).toEqual([])
  })

  test('a fragment mapped without its fill cannot be rendered', () => {
    const files = file({ 'a.ts:backTo': { key: 'x:back' } })

    expect(mappingProblems(files, [fragment], bundle)).toEqual(['a.ts:backTo row 0: x:back: no argument for the placeholder parent'])
  })

  test('a fill that renders another text in en', () => {
    const files = file({ 'a.ts:backTo': { key: 'x:back', fill: { parent: 'home' } } })

    expect(mappingProblems(files, [fragment], bundle)).toEqual(['a.ts:backTo row 0: renders another text in en'])
  })

  test('a fill name not in PLACEHOLDERS', () => {
    const files = file({ 'a.ts:backTo': { key: 'x:back', fill: { stranger: '' } } })

    expect(mappingProblems(files, [fragment], bundle)).toEqual(['a.ts:backTo: the fill stranger is not in PLACEHOLDERS'])
  })

  test('a fill on an entry that has args', () => {
    const files = file({ 'a.ts:f': { key: 'x:hi', params: ['name'], fill: { name: 'Ana' } } })

    expect(mappingProblems(files, [withArgs], bundle)).toEqual(['a.ts:f: fill on a key with args'])
  })
})
