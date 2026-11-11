/**
 * Test helper: stands `fetch` in with a mock for every request but `GET /pricing-settings`,
 * which it answers with the switches given (both on by default), `GET /api/customer-types`, which
 * it answers with the list given (none by default), `GET /api/payment-methods`, which it answers with the test's opening methods, and `GET /business`, which it answers with the
 * Phone country given (none by default; the phone field's example reads it). For the screens that read the
 * switches beside their own data and whose tests fake only their own requests: the test keeps
 * working against the returned `api` mock, and the screen runs against the real answer.
 */

import { vi, type Mock } from 'vitest'
import { METHODS_ANSWER } from '../test-payment-methods'

type Api = Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>

export function stubFetchWithSettings(
  vip = true,
  bulk = true,
  customerTypes: readonly unknown[] = [],
  phoneCountry: string | null = null,
): Api {
  const api: Api = vi.fn()
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
    input === '/pricing-settings'
      ? Promise.resolve(
          new Response(JSON.stringify({ is_bulk_pricing: bulk, is_vip_customers: vip }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      : input === '/business'
        ? Promise.resolve(
            new Response(JSON.stringify({ name: 'La Huerta', phone_country: phoneCountry, phone_countries: [] }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
      : input === '/api/payment-methods'
        ? Promise.resolve(
            new Response(JSON.stringify(METHODS_ANSWER), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
      : input === '/api/customer-types'
        ? Promise.resolve(
            new Response(JSON.stringify(customerTypes), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        : api(input, init),
  )
  return api
}
