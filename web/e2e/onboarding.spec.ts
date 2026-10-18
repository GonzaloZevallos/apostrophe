/// <reference lib="dom" />
/**
 * The Onboarding's own end-to-end runs (GH-86, "Metrics"), from a phone viewport, through the
 * built front and the real backend: a full run from accepting a new-business invitation to
 * Nueva venta opened from "Listo" (its duration is not measured, docs/adr/0038); a resume from Inicio's notice; a
 * value saved in step 3 reading the same in Configuración; and, at the end of each, the
 * browser holding only the theme.
 */

import { expect, test } from './fixtures.js'
import { watchConsole } from './console.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { expectOnlyTheThemeStored } from './helpers/storage.js'
import { expectPath } from './helpers/url.js'
import { SALE_NEW, SETTINGS_CATALOG_MESSAGE } from '../src/routes.js'

test.use({ isMobile: true, hasTouch: true, viewport: { width: 375, height: 812 } })

const NOTICE = 'Keep going with setup'

async function priceAVariety(page: import('@playwright/test').Page, name: string): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Add your first variety' })).toBeVisible()
  await page.getByLabel(/^Name/).fill(name)
  await page.getByLabel(/^Precio de lista/).fill('9000')
  await page.getByRole('button', { name: 'Save the variety' }).click()
}

test('a new business goes from the invitation to Nueva venta from "Listo", with no notice left', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  await signUpNewBusiness(page, { stayInOnboarding: true })
  await expect(page).toHaveURL(/\/onboarding\/variety$/)
  await priceAVariety(page, 'Rosa')

  await expect(page.getByRole('heading', { name: 'Add what you have today' })).toBeVisible()
  await expect(page.getByText('Rosa', { exact: true })).toBeVisible()
  await page.getByLabel('Gramos').fill('500')
  await page.getByRole('button', { name: 'Guardá la entrada' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'How your catalog looks' })).toBeVisible()
  await page.getByRole('button', { name: 'Leave as is' }).click()
  await expect(page.getByRole('heading', { name: 'Connect your Telegram bot' })).toBeVisible()
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Send the link to your partner' })).toBeVisible()
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Expense categories' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'All set' })).toBeVisible()
  await expect(page.getByText('Done · 1 variety')).toBeVisible()
  await page.getByRole('button', { name: 'Record my first sale' }).click()
  await expectPath(page, SALE_NEW)

  await page.getByRole('button', { name: 'Cerrar' }).click()
  await expect(page.locator('.encabezado__negocio')).toBeVisible()
  await expect(page.getByText(NOTICE)).toHaveCount(0)
  await expectOnlyTheThemeStored(page)
  expect(consoleMessages).toEqual([])
})

test('leaving after step 1 keeps it, and Inicio\'s notice resumes at step 2', async ({ page }) => {
  await signUpNewBusiness(page, { stayInOnboarding: true })
  await priceAVariety(page, 'Lirio')
  await expect(page.getByRole('heading', { name: 'Add what you have today' })).toBeVisible()

  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByText(NOTICE)).toBeVisible()
  await page.getByText(NOTICE).click()
  await expect(page.getByRole('heading', { name: 'Add what you have today' })).toBeVisible()
  await expect(page.getByText('Step 2 of 6')).toBeVisible()
  await expectOnlyTheThemeStored(page)
})

test('the catalog message saved in step 3 reads the same in Configuración', async ({ page }) => {
  await signUpNewBusiness(page, { stayInOnboarding: true })
  await priceAVariety(page, 'Jazmín')
  await expect(page.getByRole('heading', { name: 'Add what you have today' })).toBeVisible()
  await expect(page.getByText('Jazmín', { exact: true })).toBeVisible()
  await page.getByLabel('Gramos').fill('300')
  await page.getByRole('button', { name: 'Guardá la entrada' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'How your catalog looks' })).toBeVisible()
  await page.getByLabel('Encabezado').fill('🌸 Catálogo de Jazmín 🌸')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('heading', { name: 'Connect your Telegram bot' })).toBeVisible()

  await page.goto(SETTINGS_CATALOG_MESSAGE)
  await expect(page.getByLabel('Encabezado')).toHaveValue('🌸 Catálogo de Jazmín 🌸')
})
