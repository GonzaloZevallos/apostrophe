import { describe, expect, test } from 'vitest'
import { foldForSearch, matchRange, matchesQuery } from './selectorSearch'

test('folds case and accents so ñ matches n and ü matches u', () => {
  expect(foldForSearch('Ñandú ÜBER')).toBe('nandu uber')
  expect(matchesQuery('Piña colada', 'pina')).toBe(true)
  expect(matchesQuery('Pingüino', 'PINGUINO')).toBe(true)
  expect(matchesQuery('Pinguino', 'pingüi')).toBe(true)
})

test('an empty or blank query matches every label', () => {
  expect(matchesQuery('Anything', '')).toBe(true)
  expect(matchesQuery('Anything', '   ')).toBe(true)
})

test('a label that does not contain the query is rejected', () => {
  expect(matchesQuery('Tomate', 'papa')).toBe(false)
})

test('the query is text, never a pattern', () => {
  expect(matchesQuery('Sale (.*+?[])', '(.*+?[])')).toBe(true)
  expect(matchesQuery('Sale', '.*')).toBe(false)
  expect(matchesQuery('Sale', '(')).toBe(false)
  expect(matchesQuery('Sale', '[')).toBe(false)
})

describe('matchRange', () => {
  test('finds the query ignoring case, in the original label', () => {
    expect(matchRange('Tomate Cherry', 'CHERRY')).toEqual([7, 13])
    expect(matchRange('Tomate Cherry', 'tom')).toEqual([0, 3])
  })

  test('an accented label is found by the plain query: cafe in Café rosa', () => {
    expect(matchRange('Café rosa', 'cafe')).toEqual([0, 4])
    expect(matchRange('Piña colada', 'PINA')).toEqual([0, 4])
  })

  test('the query is trimmed, as matchesQuery trims it', () => {
    expect(matchRange('Café rosa', '  cafe ')).toEqual([0, 4])
  })

  test('a decomposed accent stays inside the range: the end is after U+0301', () => {
    const decomposed = 'Café rosa'
    expect(matchRange(decomposed, 'cafe')).toEqual([0, 5])
    expect(decomposed.slice(...(matchRange(decomposed, 'cafe') ?? [0, 0]))).toBe('Café')
    expect(matchRange(decomposed, 'e')).toEqual([3, 5])
    expect(matchRange('Café rosa', 'é')).toEqual([3, 4])
  })

  test('a query holding regex characters means those characters and nothing else', () => {
    expect(matchRange('Sale (.*+?[])', '(.*+?[])')).toEqual([5, 13])
    expect(matchRange('Sale', '.*')).toBeNull()
    expect(matchRange('Sale', '(')).toBeNull()
    expect(matchRange('Sale', '[')).toBeNull()
  })

  test('no match, an empty query and a blank query give null', () => {
    expect(matchRange('Tomate', 'papa')).toBeNull()
    expect(matchRange('Tomate', '')).toBeNull()
    expect(matchRange('Tomate', '   ')).toBeNull()
  })

  test('a label whose lower case depends on context falls back to the whole label when it matches', () => {
    // the final sigma: `ΟΔΟΣ` lower-cases to `οδος`, but code point by code point to `οδοσ`
    expect(matchRange('ΟΔΟΣ', 'οδο')).toEqual([0, 4])
    expect(matchRange('ΟΔΟΣ', 'xyz')).toBeNull()
  })

  const LABELS = [
    'Café rosa',
    'Café rosa',
    'ΟΔΟΣ ΜΑΣ',
    'İstanbul',
    'Piña ñandú',
    'Dulce 🍰 de leche',
    'Familia 👨‍👩‍👧 mesa',
    '🍓 fresa',
    'Sale (.*+?[])',
    'ẹ́ doble',
    '́ suelto',
    '',
  ]
  const QUERIES = ['', ' ', 'cafe', ' cafe ', 'e', 'é', 'é', 'ο', 'οδο', 'i', 'istanbul', 'n', 'ñ', '🍰', '👨', '🍓 f', '.*', '(.*+?[])', '́', 'x', 'dulce 🍰']

  test.each(LABELS.flatMap((label) => QUERIES.map((query) => [label, query] as const)))(
    'for %j and %j: agrees with matchesQuery, and the range cuts neither a pair nor a mark',
    (label, query) => {
      const range = matchRange(label, query)
      // a query that folds to nothing (blank, or only a combining mark) has nothing to highlight
      expect(range !== null).toBe(foldForSearch(query.trim()) !== '' && matchesQuery(label, query))
      if (range === null) return
      const [start, end] = range
      expect(start).toBeGreaterThanOrEqual(0)
      expect(end).toBeGreaterThan(start)
      expect(end).toBeLessThanOrEqual(label.length)
      const isLow = (index: number) => {
        const unit = label.charCodeAt(index)
        return unit >= 0xdc00 && unit <= 0xdfff
      }
      expect(start < label.length && isLow(start)).toBe(false)
      expect(end < label.length && isLow(end)).toBe(false)
      const after = label.slice(end).codePointAt(0)
      expect(after !== undefined && /\p{M}/u.test(String.fromCodePoint(after))).toBe(false)
      const first = label.slice(start).codePointAt(0)
      expect(first !== undefined && /\p{M}/u.test(String.fromCodePoint(first))).toBe(false)
    },
  )
})
