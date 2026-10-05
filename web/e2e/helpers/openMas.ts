import type { Page } from '@playwright/test'

/** Opens Más through the shell's own navigation, not by typing its path: the path of
 * Más is the front's to name (and the server redirects its old Spanish spelling), so a
 * spec that goes through the nav never depends on it. */
export async function openMas(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('link', { name: 'Más', exact: true }).click()
}

/** Gastos, reached the way a seller reaches it: Más, then its entry. */
export async function openGastos(page: Page): Promise<void> {
  await openMas(page)
  await page.getByRole('link', { name: /Gastos/ }).click()
}
