import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { loadBundle } from './loadBundle.ts'

const FIXTURES = join(import.meta.dirname, '../../src/i18n/__fixtures__/locales')

describe('loadBundle', () => {
  test('reads every json file of a language folder, keyed by file name', () => {
    expect(Object.keys(loadBundle('en', FIXTURES)).sort()).toEqual(['fixture', 'shapes'])
    expect(Object.keys(loadBundle('xx', FIXTURES))).toEqual(['shapes'])
    expect(loadBundle('en', FIXTURES)['shapes']).toMatchObject({ title: 'Sample title' })
  })

  test('answers an empty bundle for a language with no folder', () => {
    expect(loadBundle('zz', FIXTURES)).toEqual({})
  })

  test('ignores a file that is not json and refuses one that is not valid json', () => {
    const root = mkdtempSync(join(tmpdir(), 'bundle-'))
    mkdirSync(join(root, 'en'))
    writeFileSync(join(root, 'en', 'notes.txt'), 'not copy')
    writeFileSync(join(root, 'en', 'a.json'), '{"k":"v"}')
    expect(loadBundle('en', root)).toEqual({ a: { k: 'v' } })

    writeFileSync(join(root, 'en', 'b.json'), '{broken')
    expect(() => loadBundle('en', root)).toThrow(/b\.json/)
  })

  test('defaults to the real locales folder, which is read without a throw', () => {
    expect(() => loadBundle('en')).not.toThrow()
  })
})
