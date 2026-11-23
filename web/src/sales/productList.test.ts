import { describe, expect, test } from 'vitest'
import type { Variety } from '../screens/Variedades'
import { MOST_SOLD_ROWS, mostSoldRows } from './productList'

const product = (id: number, priced = true): Variety => ({
  id,
  name: `Product ${id}`,
  archived: false,
  current_price: priced
    ? { id, effective_from: '2026-09-01', list_price: 1000, bulk_price: null, bulk_minimum: null, vip_price: null }
    : null,
})

describe('mostSoldRows', () => {
  const IDS = [1, 2, 3, 4, 5, 6, 7, 8]
  const PRODUCTS = [1, 2, 4, 5, 6, 7, 8].map((id) => product(id))

  test('the number of Most sold rows is the server list size, 8', () => {
    expect(MOST_SOLD_ROWS).toBe(8)
  })

  test('drops unreturned ids and lines, keeps the order and slices to the cap', () => {
    expect(mostSoldRows(IDS, PRODUCTS, [2, 4, 6], 3)).toEqual([1, 5, 7])
  })

  test('with the full cap, the next real suggestions come in', () => {
    expect(mostSoldRows(IDS, PRODUCTS, [2, 4, 6], MOST_SOLD_ROWS)).toEqual([1, 5, 7, 8])
  })

  test('a repeated id keeps its first position', () => {
    expect(mostSoldRows([5, 5, 1, 5], PRODUCTS, [], 8)).toEqual([5, 1])
  })

  test('a Product with no price stays a row', () => {
    expect(mostSoldRows([9, 1], [product(9, false), product(1)], [], 8)).toEqual([9, 1])
  })

  test('nothing suggested, or nothing returned, gives no rows', () => {
    expect(mostSoldRows([], PRODUCTS, [], 8)).toEqual([])
    expect(mostSoldRows([1, 2], [], [], 8)).toEqual([])
  })
})
