import { createInstance } from 'i18next'
import { describe, expect, test } from 'vitest'
import baselineKeys from '../copy/baselineKeys/refusals.json'
import baseline from '../copy/en.baseline.json'
import enRefusals from '../copy/locales/en/refusals.json'
import { buildRefusalKeys, isComplete, isKeyOf, isRefusalKey, refusalText, type RefusalKey } from './refusalKeys'
import { productionOptions } from './options'

const fixture = { alpha: 'Alpha', beta: 'Beta' }

describe('isKeyOf', () => {
  test('accepts an own key', () => {
    expect(isKeyOf(fixture, 'alpha')).toBe(true)
  })

  test.each(['toString', '__proto__', 'constructor', 'hasOwnProperty', 'unknown'])('rejects %s', (name) => {
    expect(isKeyOf(fixture, name)).toBe(false)
  })
})

describe('isRefusalKey', () => {
  const isKey = isRefusalKey(fixture)

  test('accepts refusals: and an own leaf', () => {
    expect(isKey('refusals:alpha')).toBe(true)
  })

  test.each([
    ['a wrong prefix', 'common:alpha'],
    ['no prefix', 'alpha'],
    ['an empty leaf', 'refusals:'],
    ['a dotted leaf', 'refusals:alpha.deep'],
    ['a leaf the bundle lacks', 'refusals:gamma'],
    ['a prototype name', 'refusals:toString'],
    ['a non-string', 42],
  ])('rejects %s', (_name, value) => {
    expect(isKey(value)).toBe(false)
  })
})

describe('isComplete', () => {
  test('is true when every code has an entry and false when one has none', () => {
    expect(isComplete({ a: 1, b: 2 }, ['a', 'b'])).toBe(true)
    expect(isComplete({ a: 1 }, ['a', 'b'])).toBe(false)
  })
})

describe('buildRefusalKeys', () => {
  test('builds the table of a complete map', () => {
    const built = buildRefusalKeys({ 'a.code': 'refusals:alpha', 'b.code': 'refusals:beta' }, fixture, ['a.code', 'b.code'])

    expect(built).toEqual({ 'a.code': 'refusals:alpha', 'b.code': 'refusals:beta' })
  })

  test('throws naming the code, and not the value, for a bad value', () => {
    const run = (): unknown => buildRefusalKeys({ 'a.code': 'refusals:leakedValue' }, fixture, ['a.code'])

    expect(run).toThrow(/a\.code/)
    expect(run).not.toThrow(/leakedValue/)
  })

  test('throws naming the code for a code with no entry', () => {
    expect(() => buildRefusalKeys({ 'a.code': 'refusals:alpha' }, fixture, ['a.code', 'b.code'])).toThrow(/b\.code/)
  })

  test('throws for an entry that is not a string', () => {
    expect(() => buildRefusalKeys({ 'a.code': { key: 'refusals:alpha' } }, fixture, ['a.code'])).toThrow(/a\.code/)
  })
})

describe('refusalText with a language that lacks the refusals', () => {
  const keys = Object.keys(enRefusals).map((leaf) => `refusals:${leaf}`)
  const isKey = isRefusalKey(enRefusals)
  const instance = createInstance()
  void instance.init({
    ...productionOptions,
    lng: 'xx',
    ns: ['refusals'],
    resources: { en: { refusals: enRefusals }, xx: { refusals: {} } },
  })
  const t = (key: RefusalKey): string => instance.t(key)
  // The expected English comes from the recorded baseline, through the mapping, never from the bundle rendered.
  const expectedOf = (wanted: string): string | undefined => {
    const source = Object.entries(baselineKeys).find(([, mapping]) => mapping['key'] === wanted)?.[0]
    return baseline.find((entry) => entry.source === source)?.text
  }

  test('has a key for every leaf', () => {
    expect(keys.length).toBeGreaterThan(20)
    expect(keys.every((key) => isKey(key))).toBe(true)
  })

  test.each(keys)('answers the English text of %s, never the key or an empty string', (key) => {
    if (!isKey(key)) throw new Error('not a refusal key')

    const text = refusalText(t, { key })

    expect(expectedOf(key)).toEqual(expect.any(String))
    expect(text).toBe(expectedOf(key))
    expect(text).not.toBe('')
    expect(text).not.toBe(key)
  })
})
