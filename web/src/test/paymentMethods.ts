/**
 * Test helper: the fixture list of payment methods (`api/fixtures/payment-methods.json`:
 * Cash, Transfer and a custom Mercado Pago) as the `Response` `GET /payment-methods` answers,
 * for the tests that fake `fetch` themselves and open a screen with the method chips.
 */

import methods from '../api/fixtures/payment-methods.json'

export const PAYMENT_METHODS_FIXTURE = methods

export function paymentMethodsResponse(list: unknown = methods): Response {
  return new Response(JSON.stringify(list), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
