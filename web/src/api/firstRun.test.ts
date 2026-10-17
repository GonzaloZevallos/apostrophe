import { QueryClient, QueryObserver, focusManager } from '@tanstack/react-query'
import { waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import fixture from './fixtures/firstRun.json'
import { firstRunQuery, getFirstRun, type FirstRunAnswer } from './firstRun'
import { keys } from './keys'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const answer: FirstRunAnswer = fixture as FirstRunAnswer

const noMoreFirstRun: FirstRunAnswer = {
  kind: 'none',
  checklist: null,
  import_notice: false,
  nothing_qualifies: false,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getFirstRun', () => {
  test('asks GET /first-run, with no parameter, and returns the answer as is', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(answer))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getFirstRun()).resolves.toEqual(answer)
    expect(fetchMock).toHaveBeenCalledWith(
      '/first-run',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    )
  })
})

describe('firstRunQuery', () => {
  test('is keyed by keys.firstRun() and is never fresh', () => {
    expect(firstRunQuery.queryKey).toEqual(keys.firstRun())
    expect(firstRunQuery.staleTime).toBe(0)
  })

  test('a mount asks again even when the cache already holds an answer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(noMoreFirstRun))
    vi.stubGlobal('fetch', fetchMock)
    const queryClient = new QueryClient()
    queryClient.setQueryData(keys.firstRun(), answer)

    const observer = new QueryObserver(queryClient, firstRunQuery)
    const unsubscribe = observer.subscribe(() => undefined)

    await waitFor(() => expect(observer.getCurrentResult().data).toEqual(noMoreFirstRun))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  test('a return of the window focus asks again', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(answer))
      .mockResolvedValueOnce(jsonResponse(noMoreFirstRun))
    vi.stubGlobal('fetch', fetchMock)
    const queryClient = new QueryClient()
    queryClient.mount() // subscribes the client to the focus manager, as the app's provider does
    const observer = new QueryObserver(queryClient, firstRunQuery)
    const unsubscribe = observer.subscribe(() => undefined)
    await waitFor(() => expect(observer.getCurrentResult().data).toEqual(answer))

    focusManager.setFocused(false)
    focusManager.setFocused(true)

    await waitFor(() => expect(observer.getCurrentResult().data).toEqual(noMoreFirstRun))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    unsubscribe()
    queryClient.unmount()
  })
})
