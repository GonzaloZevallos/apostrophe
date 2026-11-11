/**
 * Test helper: stands `fetch` in with a mock for every request but `GET /pricing-settings`,
 * which it answers with the switches given (both on by default), `GET /api/customer-types`, which
 * it answers with the list given (none by default), `GET /api/payment-methods`, which it answers with the test's opening methods, and `GET /business`, which it answers with the
 * Phone country given (none by default), and `GET /phone-countries`, which it answers with the
 * listing given (`PHONE_COUNTRIES`, eight made-up examples, by default) or, with `'fail'`, with a
 * server error (the phone field's example reads both). For the screens that read the
 * switches beside their own data and whose tests fake only their own requests: the test keeps
 * working against the returned `api` mock, and the screen runs against the real answer.
 */

import { vi, type Mock } from 'vitest'
import { METHODS_ANSWER } from '../test-payment-methods'

/** What the faked `GET /phone-countries` answers by default: the codes in the API's order with
 * examples made up for the tests, so no test restates a real country's example. */
export const PHONE_COUNTRIES = ['AR', 'UY', 'CL', 'PY', 'BR', 'MX', 'ES', 'US'].map((code) => ({
  code,
  calling_code: '0',
  national_lengths: [1],
  example: `example ${code}`,
}))

type Api = Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>

export function stubFetchWithSettings(
  vip = true,
  bulk = true,
  customerTypes: readonly unknown[] = [],
  phoneCountry: string | null = null,
  phoneCountries: readonly unknown[] | 'fail' = PHONE_COUNTRIES,
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
      : input === '/phone-countries'
        ? Promise.resolve(
            new Response(JSON.stringify(phoneCountries === 'fail' ? { detail: 'boom' } : phoneCountries), {
              status: phoneCountries === 'fail' ? 500 : 200,
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
