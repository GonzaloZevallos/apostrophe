import { afterEach, describe, expect, test, vi } from 'vitest'
import { entriesOf, setThreshold, type StockEntry, type StockView } from './stock'

function entry(id: number, varietyId: number): StockEntry {
  return {
    id,
    date: '2026-10-01',
    product_id: varietyId,
    origin: 'purchase',
    quantity: 10,
    total_cost: null,
    cost_per_gram: null,
    note: null,
  }
}

function view(entries: StockEntry[]): StockView {
  return { total: 0, products: [], entries }
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

describe('setThreshold', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubFetch() {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  test('puts {quantity} under the new name', async () => {
    const fetchMock = stubFetch()

    await setThreshold(3, 15.5)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/stock/products/3/threshold')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(String(init.body))).toEqual({ quantity: 15.5 })
  })

  test('turning it off always sends the key, null included, never an empty body', async () => {
    const fetchMock = stubFetch()

    await setThreshold(3, null)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(init.body)).toBe('{"quantity":null}')
  })
})
