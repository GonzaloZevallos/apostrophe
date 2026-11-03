import type { Page } from '@playwright/test'

/**
 * The sale body's `payment` for the business of `page`, paid with its own method called `name`.
 * Method ids are the database's, never a literal: another business's id answers 404.
 */
export async function paidWith(page: Page, name: string): Promise<{ kind: 'method'; payment_method_id: number }> {
  const methods = (await (await page.request.get('/api/payment-methods')).json()) as { id: number; name: string }[]
  const method = methods.find((candidate) => candidate.name === name)
  if (method === undefined) throw new Error(`${name} missing from GET /api/payment-methods`)
  return { kind: 'method', payment_method_id: method.id }
}
