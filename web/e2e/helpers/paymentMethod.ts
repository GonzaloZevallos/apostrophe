/**
 * Chooses a Payment method as a person does: opens the "Payment method" field, then picks the
 * option, in the computer's dropdown (an `option`) or the phone's list (a button in the list).
 */

import type { Page } from '@playwright/test'

export async function choosePaymentMethod(page: Page, method: 'Cash' | 'Transfer'): Promise<void> {
  await page.getByRole('button', { name: /^Payment method/ }).click()
  await page.getByRole('option', { name: method }).or(page.getByRole('dialog', { name: 'Payment method options' }).getByRole('button', { name: method })).click()
}

/** The `payment` of a sale body seeded through the session's own requests: owing. */
export const OWING = { kind: 'owing' } as const

/** The `payment` of a seeded sale paid in the business's "Cash" method, read from `GET /api/payment-methods`. */
export async function paidInCash(page: Page): Promise<{ kind: 'paid'; payment_method_id: number }> {
  const methods: { id: number; name: string }[] = await (await page.request.get('/api/payment-methods')).json()
  const cash = methods.find((method) => method.name === 'Cash')
  if (cash === undefined) throw new Error('Cash missing from GET /api/payment-methods')
  return { kind: 'paid', payment_method_id: cash.id }
}
