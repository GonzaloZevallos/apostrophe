import { afterEach, describe, expect, test, vi } from 'vitest'
import { ApiError, NetworkError, del, get, getBlob, patch, post, putBody } from './client'

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

describe('getBlob', () => {
  test('returns the body as a Blob and asks for an image, never the app shell', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(new Blob(['png']), { status: 200, headers: { 'Content-Type': 'image/png' } }))
    vi.stubGlobal('fetch', fetchMock)

    const blob = await getBlob('/api/business/logo')

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/png')
    expect(fetchMock).toHaveBeenCalledWith('/api/business/logo', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'image/png, image/jpeg, application/json' },
    })
  })

  test('turns a refusal into an ApiError carrying its code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(404, { code: 'business_logo.not_found' })))

    const error = await getBlob('/api/business/logo').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, code: 'business_logo.not_found' })
  })

  test('turns a dropped connection into a NetworkError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(getBlob('/api/business/logo')).rejects.toBeInstanceOf(NetworkError)
  })
})

describe('putBody', () => {
  test('sends the very same body object with the given Content-Type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['bytes'], 'a.png', { type: 'image/png' })

    await expect(putBody('/api/business/logo', file, 'application/octet-stream')).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith('/api/business/logo', {
      method: 'PUT',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/octet-stream' },
      body: file,
    })
    const sent = fetchMock.mock.calls[0]?.[1] as { body: unknown }
    expect(sent.body).toBe(file)
  })

  test('turns a refusal into an ApiError carrying its code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(413, { code: 'business_logo.too_big' })))

    const error = await putBody('/x', new Blob(['a']), 'application/octet-stream').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 413, code: 'business_logo.too_big' })
  })

  test('turns a dropped connection into a NetworkError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(putBody('/x', new Blob(['a']), 'application/octet-stream')).rejects.toBeInstanceOf(NetworkError)
  })

  test('an unrecognised refusal body is the unknown code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })))

    const error = await putBody('/x', new Blob(['a']), 'application/octet-stream').catch((caught: unknown) => caught)

    expect(error).toMatchObject({ status: 500, code: 'unknown' })
  })
})
