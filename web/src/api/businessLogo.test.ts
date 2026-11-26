import { afterEach, describe, expect, test, vi } from 'vitest'
import { ApiError, NetworkError } from './client'
import { deleteBusinessLogo, getBusinessLogo, putBusinessLogo } from './businessLogo'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getBusinessLogo', () => {
  test('a 200 gives the image as a Blob', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(new Blob(['png']), { status: 200, headers: { 'Content-Type': 'image/png' } }))
    vi.stubGlobal('fetch', fetchMock)

    const blob = await getBusinessLogo()

    expect(blob).toBeInstanceOf(Blob)
    expect(fetchMock).toHaveBeenCalledWith('/api/business/logo', expect.objectContaining({ method: 'GET' }))
  })

  test('a 404 is no logo, not an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(404, { code: 'business_logo.not_found' })))

    await expect(getBusinessLogo()).resolves.toBeNull()
  })

  test('a 500 rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })))

    await expect(getBusinessLogo()).rejects.toMatchObject({ status: 500 })
  })

  test('a rejected fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(getBusinessLogo()).rejects.toBeInstanceOf(NetworkError)
  })
})

describe('putBusinessLogo', () => {
  test('sends the File itself, untouched, as application/octet-stream', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['bytes'], 'mine.png', { type: 'image/png' })

    await expect(putBusinessLogo(file)).resolves.toBeUndefined()

    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(path).toBe('/api/business/logo')
    expect(init.method).toBe('PUT')
    expect(init.body).toBe(file)
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/octet-stream' })
  })

  test.each([
    [413, 'business_logo.too_big'],
    [415, 'business_logo.wrong_type'],
  ])('a %i refusal rejects with its code %s', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(status, { code })))

    const error = await putBusinessLogo(new File(['x'], 'a.png')).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status, code })
  })

  test('a 404 rejects: an upload that found nothing is a failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(404, { code: 'business_logo.not_found' })))

    await expect(putBusinessLogo(new File(['x'], 'a.png'))).rejects.toMatchObject({ status: 404 })
  })
})

describe('deleteBusinessLogo', () => {
  test('a 204 resolves', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(deleteBusinessLogo()).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith('/api/business/logo', expect.objectContaining({ method: 'DELETE' }))
  })

  test('a 404 resolves: there is no logo, so it is removed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(404, { code: 'business_logo.not_found' })))

    await expect(deleteBusinessLogo()).resolves.toBeUndefined()
  })

  test('a 500 rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })))

    await expect(deleteBusinessLogo()).rejects.toMatchObject({ status: 500 })
  })
})
