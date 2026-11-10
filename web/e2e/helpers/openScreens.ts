import { ANALYSIS, CATALOG, EXPENSES, HOME, WITHDRAWAL_NEW } from '../../src/routes.js'
import { expectPath } from './url.js'
import { expect } from '../fixtures.js'
import type { Page } from '@playwright/test'

/** A phone: the entry points below (the Today | Analysis segment, the Expenses card) only exist
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

/** The Today | Analysis segment's "Analysis" option, on Home or on Analysis. */
function analysisOption(page: Page) {
  return page.getByRole('group', { name: 'Home view' }).getByRole('link', { name: 'Analysis' })
}

/** Analysis, reached the way a seller reaches it from the phone: Home's segment. */
export async function openAnalysis(page: Page): Promise<void> {
  await onPhone(page, async () => {
    await analysisOption(page).click()
    await expectPath(page, ANALYSIS)
    await expect(page.getByRole('link', { name: 'See the expenses' })).toBeVisible()
  })
}

/** Gastos, reached the way a seller reaches it: the segment, then the Expenses card's "See the expenses". */
export async function openGastos(page: Page): Promise<void> {
  await onPhone(page, async () => {
    await analysisOption(page).click()
    await page.getByRole('link', { name: 'See the expenses' }).click()
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
