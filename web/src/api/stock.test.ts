import { describe, expect, test } from 'vitest'
import { entriesOf, type StockEntry, type StockView } from './stock'

function entry(id: number, varietyId: number): StockEntry {
  return {
    id,
    date: '2026-10-01',
    variety_id: varietyId,
    origin: 'purchase',
    grams: 10,
    total_cost: null,
    cost_per_gram: null,
    note: null,
  }
}

function view(entries: StockEntry[]): StockView {
  return { total: 0, varieties: [], entries }
}

describe('entriesOf', () => {
  test("keeps only the variety's entries, in the server's order", () => {
    const stock = view([entry(5, 1), entry(4, 2), entry(3, 1), entry(2, 2), entry(1, 1)])

    expect(entriesOf(stock, 1).map((e) => e.id)).toEqual([5, 3, 1])
    expect(entriesOf(stock, 2).map((e) => e.id)).toEqual([4, 2])
  })

  test('a variety with no entries has none', () => {
    expect(entriesOf(view([entry(1, 1)]), 9)).toEqual([])
    expect(entriesOf(view([]), 1)).toEqual([])
  })
})
