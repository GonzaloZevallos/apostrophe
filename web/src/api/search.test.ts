import { afterEach, describe, expect, test, vi } from 'vitest'
import { search, type SearchResult } from './search'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ANSWER: SearchResult = {
  sales: [
    { id: 7, number: 12, date: '2026-11-20', customer: { id: 3, name: 'José Pérez' }, total: 15000 },
    { id: 8, number: 13, date: '2026-11-21', customer: null, total: 4000.5 },
  ],
  customers: [{ id: 3, name: 'José Pérez', balance: -250 }],
  products: [],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('search', () => {
  test.each([
    ['José #12', '/api/search?q=Jos%C3%A9%20%2312'],
    ['a&b=c', '/api/search?q=a%26b%3Dc'],
    ['', '/api/search?q='],
    ['  ana  ', '/api/search?q=%20%20ana%20%20'],
  ])('sends %j encoded exactly once, never trimmed or short-circuited', async (q, url) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(ANSWER))
    vi.stubGlobal('fetch', fetchMock)

    await search(q)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({ method: 'GET' }))
  })

  test('returns the typed answer unchanged', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(ANSWER)))

    await expect(search('jose')).resolves.toEqual(ANSWER)
  })
})
