/**
 * Clientes as redesigned, phone and computer, against the real backend through the built front
 * (customers.md, "On screen (Clientes)"; payments.md, "Te deben"): the screen opens on "Te deben"
 * (count line, total, debtors oldest owing-since first with ties by name) above everyone A–Z;
 * "Cobrar a <name>" on a row opens Registrar cobro with that customer chosen, "Todo" fills the
 * whole balance in one tap, a payment is saved, and one move back returns to Clientes; the
 * customer's card offers "Nueva venta a <name>" with that customer already chosen.
 *
 * "In one move" is read from the browser's own history: a single `page.goBack()` after the
 * round trip never lands on Registrar cobro again. No test measures elapsed time (ADR-0038).
 */

import type { Page } from '@playwright/test'
import { CUSTOMER, CUSTOMER_NEW, CUSTOMER_PAYMENT, CUSTOMERS, SALE, SALE_NEW, VARIETIES } from '../src/routes.js'
import { watchConsole } from './console.js'
import { expect, test } from './fixtures.js'
import { fillSaleLine } from './helpers/sale.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { expectOnlyTheThemeStored } from './helpers/storage.js'
import { uniqueTag } from './helpers/unique.js'
import { expectPath } from './helpers/url.js'

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'computer', width: 1280, height: 800 },
]

/** The date a year before the one the sale form proposes: older than every sale made today. */
function aYearBefore(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${String(Number(year) - 1)}-${month}-${day}`
}

async function registerCustomer(page: Page, name: string): Promise<void> {
  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Nombre').fill(name)
  await page.getByRole('button', { name: 'Guardá y usá' }).click()
  await expectPath(page, CUSTOMER)
  await expect(page.getByText('Cliente guardado')).toBeVisible()
}

/** Sells `grams` g of Rosa ($1.000 a gram) to the customer on credit, from the customer's card,
 * optionally dated `owingSince` instead of today. */
async function sellOnCredit(page: Page, name: string, grams: string, older = false): Promise<void> {
  await page.getByRole('link', { name: `Nueva venta a ${name}` }).click()
  await expectPath(page, SALE_NEW)
  if (older) {
    const date = page.getByLabel('Fecha')
    await date.fill(aYearBefore(await date.inputValue()))
  }
  // An older date has no list price, so the older sale carries its own, $1.000 a gram too: the line's total.
  await fillSaleLine(page, 1, { variety: 'Rosa', grams, specialPrice: older ? String(Number(grams) * 1000) : undefined })
  await page.getByRole('radio', { name: 'Debiendo' }).check()
  await page.getByRole('button', { name: 'Guardá la venta' }).click()
  await expectPath(page, SALE)
  await expect(page.getByText('Venta guardada')).toBeVisible()
}

/** The names of the debtors' "Cobrar a <name>" buttons, in the order Te deben lists them. */
async function debtorOrder(page: Page): Promise<(string | null)[]> {
  const owing = page.getByRole('region', { name: 'Te deben' })
  return owing.getByRole('link', { name: /^Cobrar a / }).evaluateAll((links) => links.map((link) => link.getAttribute('aria-label')))
}

for (const viewport of VIEWPORTS) {
  test(`Clientes opens on Te deben, Cobrar collects in one tap and back returns to Clientes (${viewport.name})`, async ({
    page,
  }) => {
    test.setTimeout(160_000)
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const consoleMessages: string[] = []
    watchConsole(page, consoleMessages)

    await signUpNewBusiness(page, {
      businessName: `Flores de Clientes ${uniqueTag()}`,
      email: `duena-clientes-${uniqueTag()}@example.com`,
    })

    await page.goto(VARIETIES)
    await page.getByRole('link', { name: 'Nueva variedad' }).click()
    await page.getByLabel('Nombre').fill('Rosa')
    await page.getByRole('button', { name: 'Agregá la variedad' }).click()
    await expect(page.getByText('Variedad guardada')).toBeVisible()
    await page.getByRole('link', { name: /Rosa/ }).click()
    await page.getByRole('link', { name: 'Nuevo precio' }).click()
    await page.getByLabel(/^Precio de lista/).fill('1000')
    await page.getByRole('button', { name: 'Guardá el precio' }).click()
    await expect(page.getByText('Precio guardado')).toBeVisible()

    // Three debtors, none with a phone number, and one customer who owes nothing. Zoe is last
    // by name but owes since the oldest date; Beto and Carla owe since today, so they tie.
    await registerCustomer(page, 'Ana AlDia')
    await registerCustomer(page, 'Beto Deudor')
    await sellOnCredit(page, 'Beto Deudor', '2')
    await registerCustomer(page, 'Carla Deudora')
    await sellOnCredit(page, 'Carla Deudora', '5')
    await registerCustomer(page, 'Zoe Vieja')
    await sellOnCredit(page, 'Zoe Vieja', '3', true)

    // Te deben on top: the total, the count line and the debtors oldest first, ties by name.
    await page.goto(CUSTOMERS)
    const owing = page.getByRole('region', { name: 'Te deben' })
    await expect(owing.locator('.cifra-xl')).toHaveText('$ 10.000')
    await expect(owing.getByText('3 ventas debiendo')).toBeVisible()
    expect(await debtorOrder(page)).toEqual(['Cobrar a Zoe Vieja', 'Cobrar a Beto Deudor', 'Cobrar a Carla Deudora'])
    // Whoever owes nothing is only in the A–Z list below, with no "Cobrar".
    await expect(owing.getByRole('link', { name: /Ana AlDia/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Cobrar a Ana AlDia' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /^Ana AlDia/ })).toBeVisible()

    // One tap on "Cobrar a Carla Deudora": Registrar cobro with her chosen.
    await owing.getByRole('link', { name: 'Cobrar a Carla Deudora' }).click()
    await expectPath(page, CUSTOMER_PAYMENT)
    await expect(page.locator('.panel__titulo', { hasText: 'Registrar cobro' })).toBeVisible()
    await expect(page.locator('.cobro__cliente')).toContainText('Carla Deudora')
    await expect(page.locator('.cobro__cliente')).toContainText('te debe $ 5.000')

    // "Todo" fills the whole balance in one tap, and the payment is saved.
    await page.getByRole('button', { name: 'Todo: $ 5.000' }).click()
    await expect(page.getByLabel('Monto')).toHaveValue('5000')
    await page.getByRole('radio', { name: 'Efectivo' }).check()
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expectPath(page, CUSTOMERS)
    await expect(page.getByText('Cobro guardado', { exact: true })).toBeVisible()

    // The section is the API's new answer: she left, the total and the count follow.
    await expect(owing.locator('.cifra-xl')).toHaveText('$ 5.000')
    await expect(owing.getByText('2 ventas debiendo')).toBeVisible()
    expect(await debtorOrder(page)).toEqual(['Cobrar a Zoe Vieja', 'Cobrar a Beto Deudor'])

    // One move back from Clientes does not land on Registrar cobro again.
    await page.goBack()
    await expect(page.locator('.panel__titulo', { hasText: 'Registrar cobro' })).toHaveCount(0)
    await page.goto(CUSTOMERS)

    // "Cerrar" returns to Clientes in one move, with the balance untouched.
    await page.getByRole('region', { name: 'Te deben' }).getByRole('link', { name: 'Cobrar a Beto Deudor' }).click()
    await expectPath(page, CUSTOMER_PAYMENT)
    await page.getByRole('button', { name: 'Cerrar' }).click()
    await expectPath(page, CUSTOMERS)
    await expect(owing.locator('.cifra-xl')).toHaveText('$ 5.000')

    // The browser's own back does the same.
    await page.getByRole('region', { name: 'Te deben' }).getByRole('link', { name: 'Cobrar a Beto Deudor' }).click()
    await expectPath(page, CUSTOMER_PAYMENT)
    await page.goBack()
    await expectPath(page, CUSTOMERS)

    // The rest of a row opens the card, and "Nueva venta a <name>" opens the sale with her chosen.
    await owing.getByRole('link', { name: /^Beto Deudor/ }).click()
    await expectPath(page, CUSTOMER)
    await page.getByRole('link', { name: 'Nueva venta a Beto Deudor' }).click()
    await expectPath(page, SALE_NEW)
    await expect(page.getByRole('button', { name: /Beto Deudor/ })).toBeVisible()
    await fillSaleLine(page, 1, { variety: 'Rosa', grams: '1' })
    await page.getByRole('radio', { name: 'Debiendo' }).check()
    await page.getByRole('button', { name: 'Guardá la venta' }).click()
    await expectPath(page, SALE)
    await expect(page.getByText('Venta guardada')).toBeVisible()

    // The sale landed on the customer who was chosen: his debt grew from $ 2.000 to $ 3.000.
    await page.goto(CUSTOMERS)
    await expect(owing.locator('.cifra-xl')).toHaveText('$ 6.000')

    await expectOnlyTheThemeStored(page)
    expect(consoleMessages).toEqual([])
  })
}
