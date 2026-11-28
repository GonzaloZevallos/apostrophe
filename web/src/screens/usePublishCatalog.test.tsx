/**
 * `usePublishCatalog` at the hook seam: the POST, the failure mapping, the toast and its
 * timer, and the refetch of every query under the `pinnedCatalog` prefix, with the API faked
 * at `fetch` so the real `ApiError` and `NetworkError` come out of the client.
 */

import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { keys } from '../api/keys'
import { readPinnedCatalog } from '../api/pinnedCatalog'
import { PINNED_CATALOG_TEXT } from '../copy/pinnedCatalog'
import { GENERIC_REFUSAL_MESSAGE } from '../copy/settings'
import { usePublishCatalog } from './usePublishCatalog'

const PINNED = { can_publish: true, publish_blocked_by: null, status: null }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type PostAnswer = () => Promise<Response>

/** Fakes `fetch`: every GET answers `PINNED`; the publish POST answers what `answer` says. */
function fakeFetch(answer: PostAnswer) {
  const mock = vi.fn((url: string, init?: RequestInit) =>
    url === '/pinned-catalog/publish' && init?.method === 'POST'
      ? answer()
      : Promise.resolve(jsonResponse(200, PINNED)),
  )
  vi.stubGlobal('fetch', mock)
  return {
    mock,
    gets: () =>
      mock.mock.calls.filter(([url, init]) => url === '/pinned-catalog' && init?.method === 'GET')
        .length,
    posts: () => mock.mock.calls.filter(([, init]) => init?.method === 'POST').length,
  }
}

const published: PostAnswer = () => Promise.resolve(jsonResponse(200, PINNED))
const refusedWith =
  (code: string): PostAnswer =>
  () =>
    Promise.resolve(jsonResponse(422, { detail: 'refused', code }))

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

/** The hook next to an active query on `queryKey`: only an active query is refetched. */
function mount(queryKey: readonly unknown[] = keys.pinnedCatalog()) {
  const client = new QueryClient()
  const view = renderHook(
    () => ({
      publish: usePublishCatalog(),
      query: useQuery({ queryKey, queryFn: readPinnedCatalog }),
    }),
    { wrapper: wrapperFor(client) },
  )
  return { client, view }
}

beforeEach(() => {
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('published sets the toast, leaves outcome idle and refetches the pinned catalog', async () => {
  const api = fakeFetch(published)
  const { view } = mount()
  await waitFor(() => expect(api.gets()).toBe(1))

  let result: string | undefined
  await act(async () => {
    result = await view.result.current.publish.publish()
  })

  expect(result).toBe('published')
  expect(view.result.current.publish.toast).toBe(PINNED_CATALOG_TEXT.catalogPublished)
  expect(view.result.current.publish.outcome).toEqual({ kind: 'idle' })
  expect(api.posts()).toBe(1)
  await waitFor(() => expect(api.gets()).toBe(2))
})

test('a query under the readiness key is fetched again after a publish', async () => {
  const api = fakeFetch(published)
  const { view } = mount(keys.pinnedCatalogReadiness())
  await waitFor(() => expect(api.gets()).toBe(1))

  await act(async () => {
    await view.result.current.publish.publish()
  })

  await waitFor(() => expect(api.gets()).toBe(2))
})

test('refused with an override code gives the text of that refusal and refetches', async () => {
  const api = fakeFetch(refusedWith('pinned_catalog.bot_cannot_post'))
  const { view } = mount()
  await waitFor(() => expect(api.gets()).toBe(1))

  let result: string | undefined
  await act(async () => {
    result = await view.result.current.publish.publish()
  })

  expect(result).toBe('refused')
  expect(view.result.current.publish.outcome).toEqual({
    kind: 'refused',
    text: 'The bot cannot post in the channel',
  })
  expect(view.result.current.publish.toast).toBeNull()
  await waitFor(() => expect(api.gets()).toBe(2))
})

test('refused with an unknown code gives the generic message and refetches', async () => {
  const api = fakeFetch(refusedWith('something.nobody_mapped'))
  const { view } = mount()
  await waitFor(() => expect(api.gets()).toBe(1))

  let result: string | undefined
  await act(async () => {
    result = await view.result.current.publish.publish()
  })

  expect(result).toBe('refused')
  expect(view.result.current.publish.outcome).toEqual({
    kind: 'refused',
    text: GENERIC_REFUSAL_MESSAGE,
  })
  await waitFor(() => expect(api.gets()).toBe(2))
})

test('a network failure is offline and refetches', async () => {
  const api = fakeFetch(() => Promise.reject(new TypeError('Failed to fetch')))
  const { view } = mount()
  await waitFor(() => expect(api.gets()).toBe(1))

  let result: string | undefined
  await act(async () => {
    result = await view.result.current.publish.publish()
  })

  expect(result).toBe('offline')
  expect(view.result.current.publish.outcome).toEqual({ kind: 'offline' })
  await waitFor(() => expect(api.gets()).toBe(2))
})

test('any other error is failed with the generic message and refetches', async () => {
  // A 200 whose body is not JSON makes the client throw a SyntaxError: neither kind of error.
  const api = fakeFetch(() => Promise.resolve(new Response('not json', { status: 200 })))
  const { view } = mount()
  await waitFor(() => expect(api.gets()).toBe(1))

  let result: string | undefined
  await act(async () => {
    result = await view.result.current.publish.publish()
  })

  expect(result).toBe('failed')
  expect(view.result.current.publish.outcome).toEqual({
    kind: 'failed',
    text: GENERIC_REFUSAL_MESSAGE,
  })
  await waitFor(() => expect(api.gets()).toBe(2))
})

test('a success after a refusal returns the outcome to idle', async () => {
  let answer: PostAnswer = refusedWith('pinned_catalog.bot_cannot_post')
  fakeFetch(() => answer())
  const { view } = mount()

  await act(async () => {
    await view.result.current.publish.publish()
  })
  expect(view.result.current.publish.outcome.kind).toBe('refused')

  answer = published
  await act(async () => {
    await view.result.current.publish.publish()
  })
  expect(view.result.current.publish.outcome).toEqual({ kind: 'idle' })
})

test('outcome resets to idle as soon as a new publish starts', async () => {
  let release: (response: Response) => void = () => undefined
  let answer: PostAnswer = refusedWith('pinned_catalog.bot_cannot_post')
  fakeFetch(() => answer())
  const { view } = mount()

  await act(async () => {
    await view.result.current.publish.publish()
  })
  expect(view.result.current.publish.outcome.kind).toBe('refused')

  answer = () => new Promise<Response>((resolve) => (release = resolve))
  let pending: Promise<string> | undefined
  act(() => {
    pending = view.result.current.publish.publish()
  })
  expect(view.result.current.publish.outcome).toEqual({ kind: 'idle' })
  expect(view.result.current.publish.publishing).toBe(true)

  await act(async () => {
    release(jsonResponse(200, PINNED))
    await pending
  })
  expect(view.result.current.publish.publishing).toBe(false)
})

test('the toast clears 3000 ms after the first success even when a second lands inside', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  fakeFetch(published)
  const { view } = mount()

  await act(async () => {
    await view.result.current.publish.publish()
  })
  expect(view.result.current.publish.toast).toBe(PINNED_CATALOG_TEXT.catalogPublished)

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000)
  })
  await act(async () => {
    await view.result.current.publish.publish()
  })
  expect(view.result.current.publish.toast).toBe(PINNED_CATALOG_TEXT.catalogPublished)

  await act(async () => {
    await vi.advanceTimersByTimeAsync(999)
  })
  expect(view.result.current.publish.toast).toBe(PINNED_CATALOG_TEXT.catalogPublished)

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1)
  })
  expect(view.result.current.publish.toast).toBeNull()
})

test('publishing is false once publish resolves, on both paths', async () => {
  let answer: PostAnswer = published
  fakeFetch(() => answer())
  const { view } = mount()

  await act(async () => {
    await view.result.current.publish.publish()
  })
  expect(view.result.current.publish.publishing).toBe(false)

  answer = refusedWith('pinned_catalog.bot_cannot_post')
  await act(async () => {
    await view.result.current.publish.publish()
  })
  expect(view.result.current.publish.publishing).toBe(false)
})

test('unmounting while the POST is pending throws nothing and the refetch still happens', async () => {
  let release: (response: Response) => void = () => undefined
  const api = fakeFetch(() => new Promise<Response>((resolve) => (release = resolve)))
  const client = new QueryClient()
  const reader = renderHook(() => useQuery({ queryKey: keys.pinnedCatalog(), queryFn: readPinnedCatalog }), {
    wrapper: wrapperFor(client),
  })
  const publisher = renderHook(() => usePublishCatalog(), { wrapper: wrapperFor(client) })
  await waitFor(() => expect(api.gets()).toBe(1))

  let pending: Promise<string> | undefined
  act(() => {
    pending = publisher.result.current.publish()
  })
  publisher.unmount()

  await act(async () => {
    release(jsonResponse(200, PINNED))
    await expect(pending).resolves.toBe('published')
  })

  await waitFor(() => expect(api.gets()).toBe(2))
  reader.unmount()
})
