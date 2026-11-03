/**
 * Test helper: stands `fetch` in with a mock for every request but `GET /pricing-settings`
 * (answered with the switches given, both on by default) and `GET /api/payment-methods` (the fixture list). For the screens that read the
 * switches beside their own data and whose tests fake only their own requests: the test keeps
 * working against the returned `api` mock, and the screen runs against the real answer.
 */

import { vi, type Mock } from 'vitest'
import methods from '../api/fixtures/payment-methods.json'

type Api = Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>

export function stubFetchWithSettings(vip = true, bulk = true): Api {
  const api: Api = vi.fn()
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    if (input === '/api/payment-methods' && (init?.method ?? 'GET') === 'GET') return Promise.resolve(
        new Response(JSON.stringify(methods), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      )
    return input === '/pricing-settings'
      ? Promise.resolve(
          new Response(JSON.stringify({ is_bulk_pricing: bulk, is_vip_customers: vip }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      : api(input, init)
  })
  return api
}
