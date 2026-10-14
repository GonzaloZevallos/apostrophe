import { describe, expect, test } from 'vitest'
import { pendingFigure } from './pendingFigure'

describe('pendingFigure', () => {
  test('entirely pending reads grams only, never a peso amount', () => {
    expect(pendingFigure({ amount: 0, pendingGrams: 2.5, allPending: true })).toBe('2,5 g sin costo')
  })

  test('entirely pending ignores whatever amount came with it', () => {
    expect(pendingFigure({ amount: 4000, pendingGrams: 1, allPending: true })).toBe('1 g sin costo')
  })

  test('part pending reads the amount, then the grams', () => {
    expect(pendingFigure({ amount: 9000, pendingGrams: 2.5, allPending: false })).toBe(
      '$ 9.000 y 2,5 g sin costo',
    )
  })

  test('a $0 figure that is not entirely pending still reads $ 0 and the grams', () => {
    expect(pendingFigure({ amount: 0, pendingGrams: 3, allPending: false })).toBe('$ 0 y 3 g sin costo')
  })

  test('nothing pending reads the amount alone', () => {
    expect(pendingFigure({ amount: 20000, pendingGrams: 0, allPending: false })).toBe('$ 20.000')
  })

  test('a $0 figure with nothing pending reads $ 0', () => {
    expect(pendingFigure({ amount: 0, pendingGrams: 0, allPending: false })).toBe('$ 0')
  })
})
