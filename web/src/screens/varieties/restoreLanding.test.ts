import { describe, expect, test } from 'vitest'
import { restoreLanding } from './restoreLanding'

const v = (id: number, name: string) => ({ id, name, archived: true, current_price: null })

describe('restoreLanding', () => {
  const list = [v(5, 'Zeta'), v(4, 'Alfa'), v(6, 'Mango')]

  test('answers the next archived variety by name', () => {
    expect(restoreLanding(list, 4)).toBe(6)
  })

  test('answers the previous one when the restored is the last by name', () => {
    expect(restoreLanding(list, 5)).toBe(6)
  })

  test('answers null when it was the only one', () => {
    expect(restoreLanding([v(4, 'Alfa')], 4)).toBeNull()
  })

  test('answers unknown when the list is not cached', () => {
    expect(restoreLanding(undefined, 4)).toBe('unknown')
  })

  test('a restored id the list does not hold lands on the first by name', () => {
    expect(restoreLanding(list, 99)).toBe(4)
    expect(restoreLanding([], 99)).toBeNull()
  })
})
