/**
 * Test helper: stands `fetch` in with a mock for every request but `GET /pricing-settings`,
 * which it answers with the switches given (both on by default), `GET /api/customer-types`, which
 * it answers with the list given (none by default), and `GET /business`, which it answers with the
 * Phone country given (none by default), and `GET /phone-countries`, which it answers with the
 * listing given (`PHONE_COUNTRIES`, eight made-up examples, by default) or, with `'fail'`, with a
 * server error (the phone field's example reads both). For the screens that read the
 * switches beside their own data and whose tests fake only their own requests: the test keeps
 * working against the returned `api` mock, and the screen runs against the real answer.
 */

import { vi, type Mock } from 'vitest'

/** What the faked `GET /phone-countries` answers by default: the codes in the API's order with
 * calling codes the stub's matching needs (the front reads them from the answer) and lengths and examples made up for the tests, so no test restates a real country's example. */
const STUBBED: readonly (readonly [string, string, readonly number[]])[] = [
  ['AR', '54', [10]],
  ['UY', '598', [8, 9]],
  ['CL', '56', [9]],
  ['PY', '595', [9]],
  ['BR', '55', [10, 11]],
  ['MX', '52', [10]],
  ['ES', '34', [8, 9, 10]],
  ['US', '1', [10]],
]

export const PHONE_COUNTRIES = STUBBED.map(([code, calling_code, national_lengths]) => ({
  code,
  calling_code,
  national_lengths,
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
