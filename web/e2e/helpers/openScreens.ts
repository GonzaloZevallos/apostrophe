import { ANALYSIS, CATALOG, EXPENSES, HOME, WITHDRAWAL_NEW } from '../../src/routes.js'
import { expectPath } from './url.js'
import { expect } from '../fixtures.js'
import type { Page } from '@playwright/test'

/** A phone: the entry points below (the Home | Analysis segment, the Expenses card) only exist
 * there; a computer reaches the same screens from the side rail. */
const PHONE = { width: 390, height: 844 }

/** Runs `walk` on a phone from Home, then gives the spec back the viewport it was written for.
 * The address changes before React commits the new screen (the router renders a navigation in a
 * transition), and a viewport change in between re-renders the screen still on show; so `walk`
 * ends by waiting for the destination, not only for its address. */
async function onPhone(page: Page, walk: () => Promise<void>): Promise<void> {
  const before = page.viewportSize()
  await page.setViewportSize(PHONE)
  await page.goto(HOME)
  await walk()
  if (before !== null) await page.setViewportSize(before)
}

/** The Home | Analysis segment's "Analysis" option, on Home or on Analysis. */
function analysisOption(page: Page) {
  return page.getByRole('group', { name: 'Home view' }).getByRole('link', { name: 'Analysis' })
}

/** The Expenses card on the phone's Analysis. Analysis also renders an amount row in a group
 * named "Expenses", so the group is the one holding links. */
export function expensesCard(page: Page) {
  return page.getByRole('group', { name: 'Expenses', exact: true }).filter({ has: page.getByRole('link') })
}

/** Analysis, reached the way a seller reaches it from the phone: Home's segment. */
export async function openAnalysis(page: Page): Promise<void> {
  await onPhone(page, async () => {
    await analysisOption(page).click()
    await expectPath(page, ANALYSIS)
    await expect(expensesCard(page)).toHaveCount(1)
    await expect(expensesCard(page).getByRole('link', { name: 'See expenses' })).toBeVisible()
  })
}

/** Gastos, reached the way a seller reaches it: the segment, then the Expenses card's "See expenses". */
export async function openGastos(page: Page): Promise<void> {
  await onPhone(page, async () => {
    await analysisOption(page).click()
    await expensesCard(page).getByRole('link', { name: 'See expenses' }).click()
    await expectPath(page, EXPENSES)
    await expect(page.getByRole('link', { name: 'Add expense' })).toBeVisible()
  })
}

/** The withdrawal form, reached the way a seller reaches it: the Products tab, then "Take from stock". */
export async function openTakeFromStock(page: Page): Promise<void> {
  await onPhone(page, async () => {
    await page.getByRole('link', { name: 'Products', exact: true }).click()
    await page.getByRole('link', { name: 'Take from stock' }).click()
    await expectPath(page, WITHDRAWAL_NEW)
    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible()
  })
}

/** The catalog, reached the way a seller reaches it: the Products tab, then "Send catalog". On a
 * computer Variedades would select its first variety and take the click's navigation over, so the
 * viewport only changes back once the catalog's own heading is on show. */
export async function openCatalog(page: Page): Promise<void> {
  await onPhone(page, async () => {
    await page.getByRole('link', { name: 'Products', exact: true }).click()
    await page.getByRole('link', { name: 'Send catalog' }).click()
    await expectPath(page, CATALOG)
    await expect(page.getByRole('heading', { name: 'Catalog', level: 1 })).toBeVisible()
  })
}

/** Customers' "All" segment: the screen opens on "Owed to you", and a customer who owes nothing, or has
 * credit, is only on the full list. Call it once the screen is reached; it waits for the segment to
 * be the chosen one. */
export async function openAllCustomers(page: Page): Promise<void> {
  const all = page.getByRole('radiogroup', { name: 'Customers view' }).getByRole('radio', { name: 'All', exact: true })
  await all.click()
  await expect(all).toBeChecked()
}
