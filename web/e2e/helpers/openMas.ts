import { CATALOG, HOME } from '../../src/routes.js'
import { expectPath } from './url.js'
import { expect } from '../fixtures.js'
import type { Page } from '@playwright/test'

/** A phone: the bar, and so Más, only exists there; a computer's sidebar has no Más. */
const PHONE = { width: 390, height: 844 }

/** Opens Más through the shell's own navigation, not by typing its path: the path of
 * Más is the front's to name (and the server redirects its old Spanish spelling), so a
 * spec that goes through the nav never depends on it. */
export async function openMas(page: Page): Promise<void> {
  const before = page.viewportSize()
  await page.setViewportSize(PHONE)
  await page.goto(HOME)
  await page.getByRole('link', { name: 'More', exact: true }).click()
  // The rest of the spec keeps the viewport it was written for.
  if (before !== null) await page.setViewportSize(before)
}

/** Gastos, reached the way a seller reaches it: Más, then its entry. */
export async function openGastos(page: Page): Promise<void> {
  await openMas(page)
  await page.getByRole('navigation', { name: 'Más' }).getByRole('link', { name: /^Gastos/ }).click()
}

/** The catalog, reached the way a seller reaches it: the Variedades tab, then "Mandar
 * catálogo". Más no lists it. */
export async function openCatalog(page: Page): Promise<void> {
  const before = page.viewportSize()
  await page.setViewportSize(PHONE)
  await page.goto(HOME)
  await page.getByRole('link', { name: 'Varieties', exact: true }).click()
  await page.getByRole('link', { name: 'Send catalog' }).click()
  // Wait for the move before the viewport changes back: on a computer Variedades would select its
  // first variety and take the click's navigation over. The address changes before React commits
  // the new screen (the router renders a navigation in a transition), and a viewport change in
  // between re-renders the screen still on show: Variedades, which on a computer selects its first
  // variety. So wait for the catalog's own heading too, not only the address.
  await expectPath(page, CATALOG)
  await expect(page.getByRole('heading', { name: 'Catalog', level: 1 })).toBeVisible()
  if (before !== null) await page.setViewportSize(before)
}
