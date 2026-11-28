/** `businessQueryOptions()` asks for `BUSINESS_PATH`, the path the Settings walk's count-less state fails. */

import { QueryClient } from '@tanstack/react-query'
import { afterEach, expect, test, vi } from 'vitest'
import { CARD_WITHOUT_COUNT_STATE } from '../mobile-standard/statesRecords.ts'
import { BUSINESS_PATH, businessQueryOptions } from './business.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('the business query requests BUSINESS_PATH, which the count-less state stub matches', async () => {
  const fetchStub = vi.fn(
    async () =>
      new Response(JSON.stringify({ users: [], selectable_languages: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  )
  vi.stubGlobal('fetch', fetchStub)

  await new QueryClient().fetchQuery(businessQueryOptions())

  expect(fetchStub).toHaveBeenCalledTimes(1)
  const requested = fetchStub.mock.calls[0] as unknown as [RequestInfo | URL]
  const pathname = new URL(String(requested[0]), location.origin).pathname
  expect(pathname).toBe(BUSINESS_PATH)

  const reads = CARD_WITHOUT_COUNT_STATE.reads ?? []
  expect(reads).toHaveLength(1)
  expect(reads[0]?.path.test(pathname)).toBe(true)
  expect(reads[0]?.status).toBe(500)
})

test('the count-less stub does not match a different path', () => {
  const stub = CARD_WITHOUT_COUNT_STATE.reads?.[0]
  expect(stub?.path.test('/business/other')).toBe(false)
  expect(stub?.path.test('/api/business')).toBe(false)
})
