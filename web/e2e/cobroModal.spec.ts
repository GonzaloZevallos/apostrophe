/**
 * Registrar cobro's modal on a computer, in a real browser (ADR-0044): jsdom proves only that
 * the panes behind it carry `inert`; here Tab never reaches them and a click at the position of
 * a list row lands on the backdrop. Each test signs up its own business and makes its own
 * debtor (ADR-0040).
 */

import type { Page } from '@playwright/test'
import { CUSTOMER, CUSTOMER_NEW, CUSTOMERS, SALE, SALE_NEW, VARIETIES } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import { fillSaleLine } from './helpers/sale.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { expectPath } from './helpers/url.js'

test.use({ viewport: { width: 1280, height: 800 } })

/** Signs up, sells "Carla Cobrar" a rose on credit and opens "Record payment" from her card. */
async function openCobroModal(page: Page): Promise<void> {
  await signUpNewBusiness(page)
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'New variety' }).click()
  await page.getByLabel('Name').fill('Rosa')
  await page.getByRole('button', { name: 'Agregá la variedad' }).click()
  await expect(page.getByText('Variedad guardada')).toBeVisible()
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('link', { name: 'New price' }).click()
  await page.getByLabel(/^Precio de lista/).fill('1000')
  await page.getByRole('button', { name: 'Guardá el precio' }).click()
  await expect(page.getByText('Precio guardado')).toBeVisible()

  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Name').fill('Carla Cobrar')
  await page.getByRole('button', { name: 'Save and use' }).click()
  await expectPath(page, CUSTOMER)
  await page.getByRole('link', { name: 'New sale to Carla Cobrar' }).click()
  await expectPath(page, SALE_NEW)
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '5' })
  await page.getByRole('radio', { name: 'Owing' }).check()
  await page.getByRole('button', { name: 'Guardá la venta' }).click()
  await expectPath(page, SALE)
  await expect(page.getByText('Sale saved')).toBeVisible()

  await page.goto(CUSTOMERS)
  await page.getByRole('link', { name: 'Collect from Carla Cobrar' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Record payment' })).toBeVisible()
  // The host takes focus to the title once the form is there: its effects have run.
  await expect(page.locator('.cobro-modal .panel__titulo')).toBeFocused()
}

test('Tab cycled through the dialog never focuses anything in the list, the card or the side rail', async ({ page }) => {
  await openCobroModal(page)
  await expect(page.locator('nav.riel-lateral')).toHaveCount(0)

  for (let press = 0; press < 20; press++) {
    await page.keyboard.press('Tab')
    const outside = await page.evaluate(
      () => document.activeElement?.closest('.cobro-paneles__lista, .cobro-paneles__detalle, nav.riel-lateral') !== null,
    )
    expect(outside).toBe(false)
  }
})

test("a click at the position of a list row never opens that customer: it lands on the backdrop and closes", async ({ page }) => {
  await openCobroModal(page)
  const row = await page.locator('.cobro-paneles__lista a', { hasText: 'Carla Cobrar' }).first().boundingBox()
  if (row === null) throw new Error('no list row to click at')
  const x = row.x + 4
  const y = row.y + row.height / 2
  const reached = await page.evaluate(
    ([px, py]) => document.elementFromPoint(px ?? 0, py ?? 0)?.closest('.cobro-paneles__lista') !== null,
    [x, y],
  )
  expect(reached).toBe(false)

  await page.mouse.click(x, y)

  await expect(page.getByRole('dialog')).toHaveCount(0)
})
