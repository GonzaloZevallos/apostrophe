import { afterEach, describe, expect, test, vi } from 'vitest'
import { ApiError, NetworkError, del, get, patch, post } from './client'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('get', () => {
  test('returns the parsed body of an ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { name: 'La Esquina' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(get('/business')).resolves.toEqual({ name: 'La Esquina' })
    expect(fetchMock).toHaveBeenCalledWith(
      '/business',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    )
  })

  test('turns a refused response into an ApiError carrying its code', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(404, { detail: 'gone', code: 'customer.not_found' }))
    vi.stubGlobal('fetch', fetchMock)

    const error = await get('/customers/1').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, code: 'customer.not_found' })
  })

  test('turns a dropped connection into a NetworkError, never an ApiError', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    const error = await get('/business').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(NetworkError)
  })

  test('an unrecognised refusal body still becomes an ApiError, not a crash', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('not json', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    const error = await get('/business').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 500, code: 'unknown' })
  })
})

describe('post, patch and del', () => {
  test('post sends a JSON body and credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await post('/customers', { name: 'Ana' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/customers',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ name: 'Ana' }),
      }),
    )
  })

  test('patch sends its body with the PATCH method', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await patch('/business', { name: 'Flores SRL' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/business',
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  test('del returns nothing for a 204', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(del('/api/products/1/prices/2')).resolves.toBeUndefined()
  })
})

describe('the Accept header', () => {
  test.each([
    ['get', () => get('/expenses'), undefined],
    ['post', () => post('/expenses', { amount: 1 }), { 'Content-Type': 'application/json' }],
    ['patch', () => patch('/expenses/1', { amount: 1 }), { 'Content-Type': 'application/json' }],
    ['del', () => del('/expenses/1'), undefined],
  ])('%s asks for JSON, so the server never mistakes it for a navigation', async (_name, call, extra) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}))
    vi.stubGlobal('fetch', fetchMock)

    await call()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: { Accept: 'application/json', ...extra } }),
    )
  })
})
