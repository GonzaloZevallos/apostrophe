/**
 * Chooses a Payment method as a person does: opens the "Payment method" field, then picks the
 * option, in the computer's dropdown (an `option`) or the phone's list (a button in the list).
 */

import type { Page } from '@playwright/test'

export async function choosePaymentMethod(page: Page, method: 'Cash' | 'Transfer'): Promise<void> {
  await page.getByRole('button', { name: /^Payment method/ }).click()
  await page.getByRole('option', { name: method }).or(page.getByRole('dialog', { name: 'Payment method options' }).getByRole('button', { name: method })).click()
}
