/**
 * The phone's Products screen shows Stock-only controls (the summary, + Stock entry, Take from
 * stock, All entries, Archived) behind the Catalog | Stock segment. A seller reaches them with
 * one tap on "Stock"; this is that tap, so a spec never reaches a Stock control without it.
 */

import { expect } from '../fixtures.js'
import type { Page } from '@playwright/test'

/** The width from which Products is the computer layout, which has no segment. */
const COMPUTER_MIN_WIDTH = 900

/** On a phone: a real click on "Stock" in the "Products view" group, then waits for it to be
 * the pressed one. On a computer there is no segment, so it does nothing. */
export async function openStockSegment(page: Page): Promise<void> {
  const size = page.viewportSize()
  if (size !== null && size.width >= COMPUTER_MIN_WIDTH) return
  const stock = page.getByRole('group', { name: 'Products view' }).getByRole('button', { name: 'Stock', exact: true })
  await stock.click()
  await expect(stock).toHaveAttribute('aria-pressed', 'true')
}
