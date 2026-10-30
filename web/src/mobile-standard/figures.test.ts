import { describe, expect, test } from 'vitest'
import { formatGrams, formatMoney, formatSignedMoney } from '../format/money'
import { FIGURE_SOURCES, isFigure } from './figures.ts'

describe('isFigure', () => {
  test('money as the format module prints it, with or without a minus sign', () => {
    for (const text of [
      formatMoney(11000),
      formatMoney(0),
      formatMoney(1234567),
      formatSignedMoney(-4500),
      '− $ 4.500',
      '-$ 4.500',
      '$ 11.000',
    ]) {
      expect(isFigure(text), text).toBe(true)
    }
  })

  test('grams as the format module prints them', () => {
    for (const text of [formatGrams(3.5), formatGrams(1250), formatGrams(0), '12 g', '−3,5 g']) {
      expect(isFigure(text), text).toBe(true)
    }
  })

  test('a percentage, with or without the space', () => {
    for (const text of ['42 %', '42%', '5,5%', '−12 %']) expect(isFigure(text), text).toBe(true)
  })

  test('Days left’s figure, both texts the app prints', () => {
    for (const text of ['12 days', '1 days', '1 day']) expect(isFigure(text), text).toBe(true)
  })

  test('surrounding white space does not matter', () => {
    expect(isFigure('  $ 11.000\n')).toBe(true)
  })

  test('refuses a date, a time, a phone number and a bare count', () => {
    for (const text of ['30/10', '30/10/2026', '30 oct', '14:30', '+54 9 11 5555-1234', '11 5555-1234', '3', '2026']) {
      expect(isFigure(text), text).toBe(false)
    }
  })

  test('refuses a figure inside a sentence', () => {
    for (const text of [
      '3 customers',
      'and 3 g without cost',
      'Sold $ 11.000 today',
      'average margin 55%',
      '28 g sold',
      '12 days ago',
      '$ 11.000 · 3,5 g',
      '$',
      '',
    ]) {
      expect(isFigure(text), text).toBe(false)
    }
  })

  test('refuses a malformed amount', () => {
    for (const text of ['$ 11000.', '$ .5', '$ 1.2.3', '$ 12,5']) expect(isFigure(text), text).toBe(false)
  })
})

describe('FIGURE_SOURCES', () => {
  test('are plain RegExp sources the page can rebuild, each anchored whole', () => {
    expect(FIGURE_SOURCES.length).toBeGreaterThan(0)
    for (const source of FIGURE_SOURCES) {
      expect(source.startsWith('^')).toBe(true)
      expect(source.endsWith('$')).toBe(true)
      expect(() => new RegExp(source)).not.toThrow()
    }
  })
})
