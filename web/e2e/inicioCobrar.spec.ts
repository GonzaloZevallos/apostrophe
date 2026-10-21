/**
 * Collecting from Hoy, phone and computer, against the real backend through the built front
 * (results.md, "Te deben block"): a seller taps "Cobrar a <name>" on the debtor's row, saves a
 * payment in Registrar cobro, and is back on Inicio in one move, with the block refreshed from
 * the API and the toast not naming the customer. "Close" returns in one move too.
 *
 * "In one move" is read from the browser's own history: a single `page.goBack()` from Inicio
 * after the round trip leaves the app's own history, not Registrar cobro again.
 */

import { CUSTOMER, CUSTOMER_NEW, HOME, SALE, SALE_NEW, VARIETIES } from '../src/routes.js'
import { expectPath } from './helpers/url.js'
import { expect, test } from './fixtures.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { fillSaleLine } from './helpers/sale.js'
import { watchConsole } from './console.js'
import { expectOnlyTheThemeStored } from './helpers/storage.js'
import { uniqueTag } from './helpers/unique.js'

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'computer', width: 1280, height: 800 },
]

for (const viewport of VIEWPORTS) {
  test(`from Hoy, "Cobrar a <name>" saves a payment and returns to Inicio in one move (${viewport.name})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const consoleMessages: string[] = []
    watchConsole(page, consoleMessages)

    await signUpNewBusiness(page, {
      businessName: `Flores del Cobro ${uniqueTag()}`,
      email: `duena-cobrar-${uniqueTag()}@example.com`,
    })

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
    await page.getByRole('button', { name: 'Guardá y usá' }).click()
    await expectPath(page, CUSTOMER)
    await page.getByRole('link', { name: 'Nueva venta a Carla Cobrar' }).click()
    await expectPath(page, SALE_NEW)
    await fillSaleLine(page, 1, { variety: 'Rosa', grams: '5' })
    await page.getByRole('radio', { name: 'Owing' }).check()
    await page.getByRole('button', { name: 'Guardá la venta' }).click()
    await expectPath(page, SALE)
    await expect(page.getByText('Sale saved')).toBeVisible()

    // Hoy: the debtor's row and its Cobrar.
    await page.goto(HOME)
    await expect(page.locator('.bloque-deben .cifra-xl')).toHaveText('$ 5.000')

    // "Close" returns to Inicio in one move.
    await page.getByRole('link', { name: 'Cobrar a Carla Cobrar' }).click()
    await expect(page.locator('.panel__titulo', { hasText: 'Record payment' })).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()
    await expectPath(page, HOME)
    await expect(page.locator('.bloque-deben .cifra-xl')).toHaveText('$ 5.000')

    // A partial payment: back on Inicio, the row keeps its new balance.
    await page.getByRole('link', { name: 'Cobrar a Carla Cobrar' }).click()
    await page.getByLabel('Amount').fill('2000')
    await page.getByRole('radio', { name: 'Cash' }).check()
    await page.getByRole('button', { name: 'Save' }).click()
    await expectPath(page, HOME)
    const toast = page.getByText('Cobro guardado · queda debiendo $ 3.000')
    await expect(toast).toBeVisible()
    await expect(toast).not.toContainText('Carla')
    await expect(page.locator('.bloque-deben .cifra-xl')).toHaveText('$ 3.000')

    // The rest, with "Todo": the row leaves and the block reads "Nadie te debe".
    await page.getByRole('link', { name: 'Cobrar a Carla Cobrar' }).click()
    await page.getByRole('button', { name: 'Todo: $ 3.000' }).click()
    await page.getByRole('radio', { name: 'Transfer' }).check()
    await page.getByRole('button', { name: 'Save' }).click()
    await expectPath(page, HOME)
    await expect(page.getByText('Cobro guardado', { exact: true })).toBeVisible()
    await expect(page.getByText('Nadie te debe')).toBeVisible()
    await expect(page.getByRole('link', { name: /^Cobrar a / })).toHaveCount(0)

    // One move: Back from Inicio does not land on Registrar cobro again.
    await page.goBack()
    await expect(page.locator('.panel__titulo', { hasText: 'Record payment' })).toHaveCount(0)

    await expectOnlyTheThemeStored(page)
    expect(consoleMessages).toEqual([])
  })
}
