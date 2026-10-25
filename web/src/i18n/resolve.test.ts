import { describe, expect, test } from 'vitest'
import { PLACEHOLDERS } from './placeholders'
import { parityCases, parityProblems } from './parity'
import { MissingKeyError, resolveKey, type Bundle } from './resolve'
import { SAMPLES } from '../copy/limits'

/** The committed fixture folders, one bundle per tag (the real `locales/` are still empty). */
const files = import.meta.glob<Record<string, unknown>>('./__fixtures__/locales/*/*.json', {
  eager: true,
  import: 'default',
})

function fixtureBundle(tag: string): Record<string, Record<string, unknown>> {
  const bundle: Record<string, Record<string, unknown>> = {}
  for (const [path, content] of Object.entries(files)) {
    const match = /\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path)
    if (match?.[1] === tag && match[2] !== undefined) bundle[match[2]] = content
  }
  return bundle
}

const en = fixtureBundle('en')

describe('resolveKey over the fixture bundle', () => {
  test('walks the namespace, then the dotted path', () => {
    expect(resolveKey(en, 'shapes:nested.deep.leaf')).toBe('Deep leaf')
    expect(resolveKey(en, 'shapes:title')).toBe('Sample title')
  })

  test('fills {{name}} and {{fromDate}}/{{toDate}} from the arguments', () => {
    expect(resolveKey(en, 'shapes:greeting', { name: 'Ana' })).toBe('Hello Ana')
    expect(resolveKey(en, 'shapes:range', { fromDate: '01/09', toDate: '28/09' })).toBe('From 01/09 to 28/09')
  })

  test('never interpolates a substituted value again and never escapes it', () => {
    expect(resolveKey(en, 'shapes:greeting', { name: '{{count}} <b> & $&' })).toBe('Hello {{count}} <b> & $&')
  })

  test('picks _zero at 0 when it exists, then the plural rule of the tag, then _other', () => {
    expect(resolveKey(en, 'shapes:inbox', { count: 0 })).toBe('No messages')
    expect(resolveKey(en, 'shapes:inbox', { count: 1 })).toBe('1 message')
    expect(resolveKey(en, 'shapes:inbox', { count: 2 })).toBe('2 messages')
    expect(resolveKey(en, 'shapes:sales', { count: 0 })).toBe('0 sales')
    expect(resolveKey(fixtureBundle('xx'), 'shapes:sales', { count: 1 })).toBe('1 xxs')
  })

  test('reads the plural rules of the tag it is given', () => {
    const bundle: Bundle = { n: { day_one: 'one {{count}}', day_few: 'few {{count}}', day_many: 'many {{count}}', day_other: 'other {{count}}' } }
    expect(resolveKey(bundle, 'n:day', { count: 3 }, 'ru')).toBe('few 3')
    expect(resolveKey(bundle, 'n:day', { count: 5 }, 'ru')).toBe('many 5')
    expect(resolveKey(bundle, 'n:day', { count: 5 }, 'en')).toBe('other 5')
  })
})

describe('resolveKey throws, naming the key and never a value', () => {
  const bundle: Bundle = { n: { text: 'Hi {{who}}', obj: { a: 'x' }, nest: 'see $t(n:text)', only_one: '{{count}} x' } }

  test.each([
    ['a missing key', 'n:absent', undefined, 'n:absent'],
    ['a missing namespace', 'zz:text', undefined, 'zz:text'],
    ['a key with no namespace', 'text', undefined, 'text'],
    ['a plural key called without count', 'n:only', undefined, 'n:only'],
    ['a plural key with neither the form nor _other', 'n:only', { count: 2 }, 'n:only'],
    ['an object where a string was expected', 'n:obj', undefined, 'n:obj'],
    ['a value holding $t(', 'n:nest', undefined, 'n:nest'],
    ['a placeholder with no argument', 'n:text', { other: 'SECRET' }, 'who'],
  ] as const)('%s', (_name, key, args, named) => {
    let message = ''
    try {
      resolveKey(bundle, key, args)
    } catch (error) {
      message = error instanceof Error ? error.message : ''
    }
    expect(message).toContain(named)
    expect(message).not.toContain('SECRET')
  })

  test('only an absent key is a MissingKeyError', () => {
    expect(() => resolveKey(bundle, 'n:absent')).toThrow(MissingKeyError)
    expect(() => resolveKey(bundle, 'n:obj')).not.toThrow(MissingKeyError)
    expect(() => resolveKey(bundle, 'n:text')).not.toThrow(MissingKeyError)
  })
})

describe('resolveKey equals a fresh i18next instance with the production options', () => {
  test('every plural base at 0, 1 and 2 and every other leaf of the en fixtures', () => {
    const { cases, problems } = parityProblems(en)

    expect(problems).toEqual([])
    // fixture.json: title, greeting, items (3) and nested.deep, nested.list (3);
    // shapes.json: title, hello, greeting, price, range, nested.bye, nested.deep.leaf,
    // inbox (3) and sales (3): 13.
    expect(cases).toBe(9 + 13)
  })

  test('a broken resolver is seen: a value that differs from the runtime is a problem', () => {
    const wrong: Bundle = { shapes: { title: 'Sample title' } }
    const { problems } = parityProblems(wrong, 'en', () => 'not the runtime')

    expect(problems).toEqual(['shapes:title: resolveKey and i18next answer differently'])
  })

  test('a placeholder outside PLACEHOLDERS is a problem, never a guess', () => {
    const { problems } = parityProblems({ shapes: { odd: 'Hi {{stranger}}' } })

    expect(problems).toEqual(['shapes:odd: the placeholder stranger is not in PLACEHOLDERS'])
  })

  test('the cases of a bundle name each plural base once, at three counts', () => {
    expect(parityCases(en).filter((item) => item.key === 'shapes:inbox').map((item) => item.args['count'])).toEqual([0, 1, 2])
    expect(SAMPLES[PLACEHOLDERS['name'] ?? 'name']).toBe(SAMPLES.name)
  })
})

describe('no locale string holds $t(', () => {
  function strings(value: unknown): string[] {
    if (typeof value === 'string') return [value]
    if (typeof value !== 'object' || value === null) return []
    return Object.values(value).flatMap(strings)
  }

  test('over every committed fixture file', () => {
    const all = Object.values(files).flatMap(strings)

    expect(all.length).toBe(30)
    expect(all.filter((text) => text.includes('$t('))).toEqual([])
  })
})
