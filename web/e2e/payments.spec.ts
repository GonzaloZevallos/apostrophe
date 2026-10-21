/**
 * Payments and balances' own end-to-end run (plan, "Shape"; PRD metric 8, "No
 * curl"): the seller's whole journey through Registrar cobro, the customer's
 * account, Te deben and a sale's grams-naming delete, against the real backend,
 * through the built front alone — never a mock of either side.
 *
 * `flow.spec.ts` and `sales.spec.ts` cover everything offered before this task;
 * this file proves the PRD's own flow in sequence, one customer with two sales:
 * - record a later payment through Registrar cobro, settling the whole balance
 *   with "All" ("Payment saved", no figure left to show);
 * - record a second, partial payment ("Payment saved · still owing $ X"),
 *   after checking its preview names the sale it reaches and what is left;
 * - delete that payment through "Delete payment", confirmed first, and see the
 *   debt it had settled return;
 * - open "Owed to you" from the Clientes header and reach the same customer there;
 * - delete a sale from Ventas, whose confirmation names the grams returning to
 *   stock (left over from #20, sales.md).
 *
 * `consoleMessages` is asserted empty at the end, and the browser's own storage
 * too (CODING_STANDARDS.md section 9: nothing personal or technical belongs in
 * either) — a payment carries an amount and a method, exactly what section 9
 * forbids there.
 */

import { CUSTOMER, CUSTOMERS, CUSTOMER_NEW, SALE, SALES, SALE_NEW, VARIETIES } from '../src/routes.js'
import type { Page } from '@playwright/test'
import { expectPath } from './helpers/url.js'
import { expect, test } from './fixtures.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { watchConsole } from './console.js'
import { fillSaleLine } from './helpers/sale.js'
import { expectOnlyTheThemeStored } from './helpers/storage.js'
import { uniqueTag } from './helpers/unique.js'

function shortDate(iso: string): string {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

/** The customer's card, never the list beside it on a computer (the list holds the search box):
 * its "Te debe" and "Credit" are what these specs read. */
function cardOf(page: Page) {
  return page.locator('main').filter({ hasNot: page.getByLabel('Search customer') })
}

test('a seller records, settles, undoes and traces payments, from the front alone', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  const ownerEmail = `duena-pagos-${uniqueTag()}@example.com`
  const businessName = `Flores del Sur ${uniqueTag()}`

  // Accept a new-business invitation.
  await signUpNewBusiness(page, { businessName, email: ownerEmail })
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // One priced variety, $1.000/g — round figures for every assertion below.
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

  // A customer, left owing on its first sale.
  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Phone').fill('+5491155550099')
  await page.getByLabel('Name').fill('Carla Pérez')
  await page.getByRole('button', { name: 'Save and use' }).click()
  await expectPath(page, CUSTOMER)
  await expect(page.getByText('Customer saved')).toBeVisible()

  // Sale 1: 5 g of Rosa, left owing — $5.000.
  await page.getByRole('link', { name: 'New sale to Carla Pérez' }).click()
  await expectPath(page, SALE_NEW)
  const todayIso = await page.getByLabel('Date').inputValue()
  const today = shortDate(todayIso)
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '5' })
  await page.getByRole('radio', { name: 'Owing' }).check()
  await page.getByRole('button', { name: 'Save sale' }).click()
  await expectPath(page, SALE)
  await expect(page.getByText('Sale saved')).toBeVisible()

  // The card shows the debt, straight from the API.
  await page.goto(CUSTOMERS)
  await page.getByRole('link', { name: 'Carla Pérez' }).first().click()
  await expect(page.getByText('Owes you $ 5.000')).toBeVisible()
  await expect(page.getByText(`since ${today}`, { exact: true })).toBeVisible()
  // Clientes' own header already counts her (checked again, with the figure, below).

  // --- Registrar cobro: "All" fills and settles the whole balance. ---
  await page.getByRole('link', { name: 'Record payment' }).click()
  await page.getByRole('button', { name: 'All: $ 5.000' }).click()
  await page.getByRole('radio', { name: 'Cash' }).check()
  await expect(page.getByText('Taken from the oldest debt')).toBeVisible()
  await expect(page.getByText(`$ 5.000 to the sale of ${today}`)).toBeVisible()
  await expect(page.getByText(/They still owe/)).toHaveCount(0) // nothing left.
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Payment saved', { exact: true })).toBeVisible()

  // Settled: no more "Te debe", no more "Record payment", and the account names
  // how it was paid and the sale as "Left owing" no more — it reads the cash
  // cobro reaching that sale instead.
  await expect(cardOf(page).getByText('Owes you', { exact: false })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Record payment' })).toHaveCount(0)
  await expect(
    page.getByText(`Payment · cash · On account of the sale of ${today}`),
  ).toBeVisible()

  // Sale 2: 8 g of Rosa, also left owing — $8.000.
  await page.getByRole('link', { name: 'New sale to Carla Pérez' }).click()
  await expectPath(page, SALE_NEW)
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '8' })
  await page.getByRole('radio', { name: 'Owing' }).check()
  await page.getByRole('button', { name: 'Save sale' }).click()
  await expectPath(page, SALE)
  await expect(page.getByText('Sale saved')).toBeVisible()

  await page.goto(CUSTOMERS)
  await page.getByRole('link', { name: 'Carla Pérez' }).first().click()
  await expect(page.getByText('Owes you $ 8.000')).toBeVisible()

  // --- A partial payment, by transfer: the preview names what is left before
  // saving, and the toast after saving carries the same figure (PRD metric 2). ---
  await page.getByRole('link', { name: 'Record payment' }).click()
  await page.getByLabel('Amount').fill('3000')
  await page.getByRole('radio', { name: 'Transfer' }).check()
  await expect(page.getByText(`$ 3.000 to the sale of ${today}`)).toBeVisible()
  await expect(page.getByText('They still owe $ 5.000')).toBeVisible()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Payment saved · still owing $ 5.000')).toBeVisible()
  await expect(page.getByText('Owes you $ 5.000')).toBeVisible()

  // --- Delete payment: confirmed first, then the debt it had settled returns. ---
  const transferRow = page.locator('.cuenta-cliente__fila').filter({ hasText: 'transfer' })
  await expect(transferRow).toContainText('$ 3.000')
  await transferRow.getByRole('button', { name: 'Delete payment' }).click()
  await expect(
    page.getByText(`Delete the payment of $ 3.000 (transfer) from ${today}?`),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Yes, delete it' }).click()
  await expect(page.getByText('Payment deleted')).toBeVisible()
  await expect(page.getByText('Owes you $ 8.000')).toBeVisible()

  // --- Te deben: opened from the Clientes header, lists her with the same figure,
  // and the total/count head the view. ---
  await page.goto(CUSTOMERS)
  const owing = page.getByRole('region', { name: 'Owed to you' })
  await expect(owing.locator('.cifra-xl')).toHaveText('$ 8.000')
  await expect(owing.getByText('1 venta debiendo')).toBeVisible()
  await owing.getByRole('link', { name: 'Carla Pérez' }).first().click()
  await expectPath(page, CUSTOMER)
  await expect(page.getByText('Owes you $ 8.000')).toBeVisible()

  // --- Deleting a sale names the grams returning to stock (sales.md, left over
  // from #20), never the debt or the credit it leaves. ---
  await page.goto(SALES)
  const saleTwoRow = page.locator('.fila-venta').filter({ hasText: '$ 8.000' })
  await expect(saleTwoRow.getByText('owes you')).toBeVisible()
  await saleTwoRow.click()
  await page.getByRole('button', { name: 'Delete sale' }).click()
  await expect(
    page.getByRole('alertdialog', {
      name: `Delete the sale of $ 8.000 from ${today}? 8 g go back to stock.`,
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Yes, delete it' }).click()
  await expectPath(page, SALES)
  await expect(page.getByText('Sale deleted')).toBeVisible()

  // Nothing left owing: the debt that sale carried is gone with it, never a
  // credit (recording never creates one, and this sale took no payment with it).
  await page.goto(CUSTOMERS)
  await page.getByRole('link', { name: 'Carla Pérez' }).first().click()
  await expect(cardOf(page).getByText('Owes you', { exact: false })).toHaveCount(0)
  await expect(cardOf(page).getByText('Credit', { exact: false })).toHaveCount(0)

  // --- A payment that is only "Credit" can still be deleted: sell on credit,
  // collect it later, delete the sale (the cobro becomes a credit), then delete
  // that cobro (payments.md: a credit that should not exist is fixed by deleting
  // the mistaken payment). The card still holds the first sale and its cobro. ---
  await page.getByRole('link', { name: 'New sale to Carla Pérez' }).click()
  await expectPath(page, SALE_NEW)
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '5' })
  await page.getByRole('radio', { name: 'Owing' }).check()
  await page.getByRole('button', { name: 'Save sale' }).click()
  await expectPath(page, SALE)
  await expect(page.getByText('Sale saved')).toBeVisible()
  const creditSaleUrl = page.url()

  await page.goto(CUSTOMERS)
  await page.getByRole('link', { name: 'Carla Pérez' }).first().click()
  await page.getByRole('link', { name: 'Record payment' }).click()
  await page.getByRole('button', { name: 'All: $ 5.000' }).click()
  await page.getByRole('radio', { name: 'Cash' }).check()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Payment saved', { exact: true })).toBeVisible()

  await page.goto(creditSaleUrl)
  await page.getByRole('button', { name: 'Delete sale' }).click()
  await page.getByRole('button', { name: 'Yes, delete it' }).click()
  await expectPath(page, SALES)
  await expect(page.getByText('Sale deleted')).toBeVisible()

  await page.goto(CUSTOMERS)
  await page.getByRole('link', { name: 'Carla Pérez' }).first().click()
  // Three rows: the first sale, its cobro, and the new cobro left as a credit.
  await expect(page.locator('.cuenta-cliente__fila')).toHaveCount(3)
  const creditRow = page.locator('.cuenta-cliente__fila').filter({ hasText: 'Credit' })
  await expect(creditRow).toHaveCount(1)
  // Every cobro offers "Delete payment" once: the first's, and the credit's.
  await expect(page.getByRole('button', { name: 'Delete payment' })).toHaveCount(2)
  await expect(creditRow.getByRole('button', { name: 'Delete payment' })).toHaveCount(1)
  await creditRow.getByRole('button', { name: 'Delete payment' }).click()
  await expect(
    page.getByText(`Delete the payment of $ 5.000 (cash) from ${today}?`),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Yes, delete it' }).click()
  await expect(page.getByText('Payment deleted')).toBeVisible()
  await expect(cardOf(page).getByText('Owes you', { exact: false })).toHaveCount(0)
  await expect(cardOf(page).getByText('Credit', { exact: false })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delete payment' })).toHaveCount(1)

  // Nothing personal or technical reaches the console or the browser's own storage.
  await expectOnlyTheThemeStored(page)
  expect(consoleMessages).toEqual([])

  // --- The plural form: two more sales left owing bring the count to "2 ventas
  // debiendo", and Te deben's header total is their sum (payments.md, Metrics
  // "Who-owes totals" and "No curl"). ---
  await page.goto(CUSTOMERS)
  await page.getByRole('link', { name: 'Carla Pérez' }).first().click()
  await page.getByRole('link', { name: 'New sale to Carla Pérez' }).click()
  await expectPath(page, SALE_NEW)
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '2' })
  await page.getByRole('radio', { name: 'Owing' }).check()
  await page.getByRole('button', { name: 'Save sale' }).click()
  await expectPath(page, SALE)
  await expect(page.getByText('Sale saved')).toBeVisible()

  await page.goto(CUSTOMERS)
  await page.getByRole('link', { name: 'Carla Pérez' }).first().click()
  await page.getByRole('link', { name: 'New sale to Carla Pérez' }).click()
  await expectPath(page, SALE_NEW)
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '3' })
  await page.getByRole('radio', { name: 'Owing' }).check()
  await page.getByRole('button', { name: 'Save sale' }).click()
  await expectPath(page, SALE)
  await expect(page.getByText('Sale saved')).toBeVisible()

  await page.goto(CUSTOMERS)
  await expect(page.getByRole('region', { name: 'Owed to you' }).locator('.cifra-xl')).toHaveText('$ 5.000')
  await expect(page.getByText('2 ventas debiendo')).toBeVisible()
})
