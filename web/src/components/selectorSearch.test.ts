import { expect, test } from 'vitest'
import { foldForSearch, matchesQuery } from './selectorSearch'

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
