/**
 * Registrar cobro as the seller sees it, at a phone and at a computer viewport, from each of
 * its three entry points: "Collect" on Customers, "Collect" on Home and the card's "Record
 * payment" (ADR-0044). On both it is a modal dialog over the screen it was opened from, which
 * stays in the page behind it; on the phone it is a sheet with "Close" on top and no bar or
 * "New sale" over it. Close and a save land back on the origin, the save with the balance
 * already lower; with something typed, Close asks first. Roles, names, text and URLs only.
 */

import type { Page } from '@playwright/test'
import { CUSTOMER, CUSTOMER_NEW, CUSTOMERS, HOME, SALE, SALE_NEW, VARIETIES } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import { fillSaleLine } from './helpers/sale.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { expectPath } from './helpers/url.js'

type Origin = 'customers' | 'home' | 'card'

const ORIGINS: readonly Origin[] = ['customers', 'home', 'card']

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'computer', width: 1280, height: 800 },
] as const

/** The control on the origin that opens Record payment. */
const OPENER = {
  customers: 'Collect from Carla Cobrar',
  home: 'Collect from Carla Cobrar',
  card: 'Record payment',
} as const

const ORIGIN_PATH = { customers: CUSTOMERS, home: HOME, card: CUSTOMER } as const

/** Signs up and sells "Carla Cobrar" five thousand pesos of roses on credit. */
async function makeDebtor(page: Page): Promise<void> {
  await signUpNewBusiness(page)
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'New variety' }).click()
  await page.getByLabel('Name').fill('Rosa')
  await page.getByRole('button', { name: 'Add the variety' }).click()
  await expect(page.getByText('Variety saved')).toBeVisible()
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('link', { name: 'New price' }).click()
  await page.getByLabel(/^List price/).fill('1000')
  await page.getByRole('button', { name: 'Save the price' }).click()
  await expect(page.getByText('Price saved')).toBeVisible()

  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Name').fill('Carla Cobrar')
  await page.getByRole('button', { name: 'Save and use' }).click()
  await expectPath(page, CUSTOMER)
  await page.getByRole('link', { name: 'New sale to Carla Cobrar' }).click()
  await expectPath(page, SALE_NEW)
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '5' })
  await page.getByRole('radio', { name: 'Owing' }).check()
  await page.getByRole('button', { name: 'Save sale' }).click()
  await expectPath(page, SALE)
  await expect(page.getByText('Sale saved')).toBeVisible()
}

/** Goes to the origin and taps the control that opens Record payment. */
async function openFrom(page: Page, origin: Origin): Promise<void> {
  if (origin === 'card') {
    await page.goto(CUSTOMERS)
    await page.getByRole('link', { name: /Carla Cobrar/ }).first().click()
    await expectPath(page, CUSTOMER)
  } else {
    await page.goto(ORIGIN_PATH[origin])
  }
  await page.getByRole('link', { name: OPENER[origin] }).first().click()
  await expect(page.getByRole('dialog', { name: 'Record payment' })).toBeVisible()
}

for (const viewport of VIEWPORTS) {
  test.describe(`Record payment on a ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    for (const origin of ORIGINS) {
      test(`opened from ${origin}: a modal dialog over that screen, which stays in the page`, async ({ page }) => {
        await makeDebtor(page)
        await openFrom(page, origin)

        const dialog = page.getByRole('dialog', { name: 'Record payment' })
        await expect(dialog).toHaveAttribute('aria-modal', 'true')
        await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible()
        // The origin is still mounted behind it, out of reach of a seller and a screen reader.
        await expect(page.getByRole('link', { name: OPENER[origin], includeHidden: true }).first()).toBeAttached()
        await expect(page.getByRole('link', { name: OPENER[origin] })).toHaveCount(0)
        if (viewport.name === 'phone') {
          await expect(page.getByRole('navigation')).toHaveCount(0)
          await expect(page.getByRole('link', { name: 'New sale' })).toHaveCount(0)
        }
      })

      test(`opened from ${origin}: Close returns to that screen`, async ({ page }) => {
        await makeDebtor(page)
        await openFrom(page, origin)

        await page.getByRole('button', { name: 'Close' }).click()

        await expectPath(page, ORIGIN_PATH[origin])
        await expect(page.getByRole('dialog')).toHaveCount(0)
        await expect(page.getByRole('link', { name: OPENER[origin] }).first()).toBeVisible()
      })

      test(`opened from ${origin}: a save returns to that screen with the balance lower`, async ({ page }) => {
        await makeDebtor(page)
        await openFrom(page, origin)

        await page.getByLabel('Amount').fill('2000')
        await page.getByRole('radio', { name: 'Cash' }).check()
        await page.getByRole('button', { name: 'Save' }).click()

        await expectPath(page, ORIGIN_PATH[origin])
        await expect(page.getByText('Payment saved · still owing $ 3.000')).toBeVisible()
        await expect(page.getByText(/^(Owes you )?\$ 3\.000/).first()).toBeVisible()
      })

      test(`opened from ${origin}: paying the whole debt with "All" saves and returns to that screen`, async ({ page }) => {
        await makeDebtor(page)
        await openFrom(page, origin)

        await page.getByRole('button', { name: 'All: $ 5.000' }).click()
        await page.getByRole('radio', { name: 'Transfer' }).check()
        await page.getByRole('button', { name: 'Save' }).click()

        await expectPath(page, ORIGIN_PATH[origin])
        await expect(page.getByText('Payment saved', { exact: true })).toBeVisible()
        await expect(page.getByRole('dialog')).toHaveCount(0)
      })

      test(`opened from ${origin}: with something typed, Close asks before it leaves`, async ({ page }) => {
        await makeDebtor(page)
        await openFrom(page, origin)

        await page.getByRole('radio', { name: 'Cash' }).check()
        await page.getByRole('button', { name: 'Close' }).click()
        await expect(page.getByText('Discard the payment?')).toBeVisible()
        await page.getByRole('button', { name: 'No, keep entering' }).click()
        await expect(page.getByRole('dialog', { name: 'Record payment' })).toBeVisible()

        await page.getByRole('button', { name: 'Close' }).click()
        await page.getByRole('button', { name: 'Yes, discard it' }).click()
        await expectPath(page, ORIGIN_PATH[origin])
      })
    }
  })
}
