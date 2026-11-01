/**
 * The owner-facing word sweep: the screen word is always Product / Products (ADR-0070),
 * so no resolved copy text says variety or variedad. It reads values, never keys, and
 * never source files: the texts `en.baseline.json` records and every value of
 * `locales/<lang>/*.json`, for each language folder on disk except the test locale.
 */

import { describe, expect, test } from 'vitest'
import baseline from './en.baseline.json'

const FORBIDDEN = /variet|variedad/i

/** The texts the sweep allows to say the word. Quoted spreadsheet text and seller data only, never product copy. */
const EXCEPTIONS: readonly string[] = []

type Json = string | number | boolean | null | Json[] | { [key: string]: Json }
type Text = { where: string; text: string }

/** Every string value of a JSON tree with the path that reaches it; keys are never read as text. */
function leaves(value: Json, path: string): Text[] {
  if (typeof value === 'string') return [{ where: path, text: value }]
  if (value === null || typeof value !== 'object') return []
  const children = Array.isArray(value) ? value.map((item, index) => [String(index), item] as const) : Object.entries(value)
  return children.flatMap(([key, child]) => leaves(child, `${path}.${key}`))
}

/** The places where a text says the word and is not on the exceptions list. */
function wordProblems(texts: readonly Text[], allowed: readonly string[]): string[] {
  return texts.filter(({ text }) => FORBIDDEN.test(text) && !allowed.includes(text)).map(({ where, text }) => `${where}: "${text}"`)
}

const localeFiles = import.meta.glob<Json>('/src/copy/locales/*/*.json', { eager: true, import: 'default' })

/** The language folders of `src/copy/locales`, read from the file system, minus en-XA (generated from English). */
const languages = [
  ...new Set(
    Object.keys(localeFiles).flatMap((path) => {
      const tag = /\/locales\/([^/]+)\//.exec(path)?.[1]
      return tag === undefined || tag === 'en-XA' ? [] : [tag]
    }),
  ),
].sort()

describe('the word sweep over resolved copy values', () => {
  test('scans English and every language folder but en-XA', () => {
    expect(languages).toContain('en')
    expect(languages).not.toContain('en-XA')
  })

  test('no text of en.baseline.json says variety or variedad', () => {
    const texts = (baseline as { source: string; text: string }[]).map(({ source, text }) => ({ where: source, text }))
    expect(texts.length).toBeGreaterThan(0)
    expect(wordProblems(texts, EXCEPTIONS)).toEqual([])
  })

  test.each(languages)('no value of locales/%s/*.json says variety or variedad', (tag) => {
    const texts = Object.entries(localeFiles)
      .filter(([path]) => path.startsWith(`/src/copy/locales/${tag}/`))
      .flatMap(([path, content]) => leaves(content, path))
    expect(texts.length).toBeGreaterThan(0)
    expect(wordProblems(texts, EXCEPTIONS)).toEqual([])
  })

  test('the exceptions list is empty', () => {
    expect(EXCEPTIONS).toEqual([])
  })
})

describe('the sweep itself', () => {
  test('fails on a planted value, in any case and in Spanish', () => {
    const planted = leaves({ ns: { fine: 'Products', bad: 'Add a Variety', worse: 'Nueva variedad', nested: ['ok', 'varieties'] } }, 'f.json')
    expect(wordProblems(planted, [])).toEqual([
      'f.json.ns.bad: "Add a Variety"',
      'f.json.ns.worse: "Nueva variedad"',
      'f.json.ns.nested.1: "varieties"',
    ])
  })

  test('passes on a key named variety, because keys are not text', () => {
    const planted = leaves({ variety: 'Product', varieties: 'Products', newVariety: 'New product' }, 'f.json')
    expect(wordProblems(planted, [])).toEqual([])
  })

  test('lets through only a text that is on the exceptions list', () => {
    const planted = [
      { where: 'a', text: 'Variedad' },
      { where: 'b', text: 'Variedad extra' },
    ]
    expect(wordProblems(planted, ['Variedad'])).toEqual(['b: "Variedad extra"'])
  })
})
