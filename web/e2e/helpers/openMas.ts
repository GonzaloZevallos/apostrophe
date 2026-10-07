import { HOME } from '../../src/routes.js'
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
  await page.getByRole('link', { name: 'Más', exact: true }).click()
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
  await page.getByRole('link', { name: 'Variedades', exact: true }).click()
  await page.getByRole('link', { name: 'Mandar catálogo' }).click()
  if (before !== null) await page.setViewportSize(before)
}
