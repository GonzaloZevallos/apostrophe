/**
 * Payments and balances' own end-to-end run (plan, "Shape"; PRD metric 8, "No
 * curl"): the seller's whole journey through Registrar cobro, the customer's
 * account, Te deben and a sale's grams-naming delete, against the real backend,
 * through the built front alone — never a mock of either side.
 *
 * `flow.spec.ts` and `sales.spec.ts` cover everything offered before this task;
 * this file proves the PRD's own flow in sequence, one customer with two sales:
 * - record a later payment through Registrar cobro, settling the whole balance
 *   with "Todo" ("Cobro guardado", no figure left to show);
 * - record a second, partial payment ("Cobro guardado · queda debiendo $ X"),
 *   after checking its preview names the sale it reaches and what is left;
 * - delete that payment through "Borrar cobro", confirmed first, and see the
 *   debt it had settled return;
 * - open "Te deben" from the Clientes header and reach the same customer there;
 * - delete a sale from Ventas, whose confirmation names the grams returning to
 *   stock (left over from #20, sales.md).
 *
 * `consoleMessages` is asserted empty at the end, and the browser's own storage
 * too (CODING_STANDARDS.md section 9: nothing personal or technical belongs in
 * either) — a payment carries an amount and a method, exactly what section 9
 * forbids there.
 */

import { expect, test } from '@playwright/test'
import { newBusinessInvitationUrl } from './backend.js'
import { watchConsole } from './console.js'
import { fillSaleLine } from './helpers/sale.js'

const PASSWORD = 'correcthorsebattery'

function shortDate(iso: string): string {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

test('a seller records, settles, undoes and traces payments, from the front alone', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  const ownerEmail = `duena-pagos-${Date.now()}@example.com`
  const businessName = `Flores del Sur ${Date.now()}`

  // Accept a new-business invitation.
  await page.goto(newBusinessInvitationUrl())
  await page.getByLabel('Nombre del negocio').fill(businessName)
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Creá el negocio' }).click()
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // One priced variety, $1.000/g — round figures for every assertion below.
  await page.goto('/variedades')
  await page.getByRole('button', { name: 'Nueva variedad' }).click()
  await page.getByLabel('Nombre').fill('Rosa')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Variedad guardada')).toBeVisible()
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('button', { name: 'Nuevo precio' }).click()
  await page.getByLabel('Precio de lista').fill('1000')
  await page.getByRole('button', { name: 'Guardar precio' }).click()
  await expect(page.getByText('Precio guardado')).toBeVisible()

  // A customer, left owing on its first sale.
  await page.goto('/clientes/nuevo')
  await page.getByLabel('Teléfono').fill('+5491155550099')
  await page.getByLabel('Nombre').fill('Carla Pérez')
  await page.getByRole('button', { name: 'Guardá y usá' }).click()
  await expect(page).toHaveURL(/\/clientes$/)
  await expect(page.getByText('Cliente guardado')).toBeVisible()

  await page.getByRole('link', { name: 'Carla Pérez' }).click()
  await expect(page).toHaveURL(/\/clientes\/\d+$/)

  // Sale 1: 5 g of Rosa, left owing — $5.000.
  await page.getByRole('link', { name: 'Nueva venta a Carla Pérez' }).click()
  await expect(page).toHaveURL(/\/ventas\/nueva$/)
  const todayIso = await page.getByLabel('Fecha').inputValue()
  const today = shortDate(todayIso)
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '5' })
  await page.getByRole('radio', { name: 'Debiendo' }).check()
  await page.getByRole('button', { name: 'Guardá la venta' }).click()
  await expect(page).toHaveURL(/\/ventas\/\d+$/)
  await expect(page.getByText('Venta guardada')).toBeVisible()

  // The card shows the debt, straight from the API.
  await page.goto('/clientes')
  await page.getByRole('link', { name: 'Carla Pérez' }).click()
  await expect(page.getByText('Te debe $ 5.000')).toBeVisible()
  await expect(page.getByText(`desde el ${today}`)).toBeVisible()
  // Clientes' own header already counts her (checked again, with the figure, below).

  // --- Registrar cobro: "Todo" fills and settles the whole balance. ---
  await page.getByRole('button', { name: 'Registrar cobro' }).click()
  await page.getByRole('button', { name: 'Todo: $ 5.000' }).click()
  await page.getByRole('radio', { name: 'Efectivo' }).check()
  await expect(page.getByText('Se descuenta de la deuda más vieja')).toBeVisible()
  await expect(page.getByText(`$ 5.000 a la venta del ${today}`)).toBeVisible()
  await expect(page.getByText(/Le queda debiendo/)).toHaveCount(0) // nothing left.
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Cobro guardado', { exact: true })).toBeVisible()

  // Settled: no more "Te debe", no more "Registrar cobro", and the account names
  // how it was paid and the sale as "Quedó debiendo" no more — it reads the cash
  // cobro reaching that sale instead.
  await expect(page.getByText('Te debe', { exact: false })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Registrar cobro' })).toHaveCount(0)
  await expect(
    page.getByText(`Cobro · efectivo · A cuenta de la venta del ${today}`),
  ).toBeVisible()

  // Sale 2: 8 g of Rosa, also left owing — $8.000.
  await page.getByRole('link', { name: 'Nueva venta a Carla Pérez' }).click()
  await expect(page).toHaveURL(/\/ventas\/nueva$/)
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '8' })
  await page.getByRole('radio', { name: 'Debiendo' }).check()
  await page.getByRole('button', { name: 'Guardá la venta' }).click()
  await expect(page).toHaveURL(/\/ventas\/\d+$/)
  await expect(page.getByText('Venta guardada')).toBeVisible()

  await page.goto('/clientes')
  await page.getByRole('link', { name: 'Carla Pérez' }).click()
  await expect(page.getByText('Te debe $ 8.000')).toBeVisible()

  // --- A partial payment, by transfer: the preview names what is left before
  // saving, and the toast after saving carries the same figure (PRD metric 2). ---
  await page.getByRole('button', { name: 'Registrar cobro' }).click()
  await page.getByLabel('Monto').fill('3000')
  await page.getByRole('radio', { name: 'Transferencia' }).check()
  await expect(page.getByText(`$ 3.000 a la venta del ${today}`)).toBeVisible()
  await expect(page.getByText('Le queda debiendo $ 5.000')).toBeVisible()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Cobro guardado · queda debiendo $ 5.000')).toBeVisible()
  await expect(page.getByText('Te debe $ 5.000')).toBeVisible()

  // --- Borrar cobro: confirmed first, then the debt it had settled returns. ---
  const transferRow = page.locator('.cuenta-cliente__fila').filter({ hasText: 'transferencia' })
  await expect(transferRow).toContainText('$ 3.000')
  await transferRow.getByRole('button', { name: 'Borrar cobro' }).click()
  await expect(
    page.getByText(`¿Borrás el cobro de $ 3.000 (transferencia) del ${today}?`),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Sí, borralo' }).click()
  await expect(page.getByText('Cobro eliminado')).toBeVisible()
  await expect(page.getByText('Te debe $ 8.000')).toBeVisible()

  // --- Te deben: opened from the Clientes header, lists her with the same figure,
  // and the total/count head the view. ---
  await page.goto('/clientes')
  await expect(page.getByRole('link', { name: /te deben \$ 8\.000/ })).toBeVisible()
  await page.getByRole('link', { name: /te deben \$ 8\.000/ }).click()
  await expect(page).toHaveURL(/\/clientes\/deben$/)
  await expect(page.locator('.cifra-xl')).toHaveText('$ 8.000')
  await expect(page.getByText('1 venta debiendo')).toBeVisible()
  await page.getByRole('link', { name: 'Carla Pérez' }).click()
  await expect(page).toHaveURL(/\/clientes\/\d+$/)
  await expect(page.getByText('Te debe $ 8.000')).toBeVisible()

  // --- Deleting a sale names the grams returning to stock (sales.md, left over
  // from #20), never the debt or the credit it leaves. ---
  await page.goto('/ventas')
  const saleTwoRow = page.locator('.fila-venta').filter({ hasText: '$ 8.000' })
  await expect(saleTwoRow.getByText('te debe')).toBeVisible()
  await saleTwoRow.click()
  await page.getByRole('button', { name: 'Borrar venta' }).click()
  await expect(
    page.getByRole('alertdialog', {
      name: `¿Borrás la venta de $ 8.000 del ${today}? Vuelven 8 g al stock.`,
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Sí, borrala' }).click()
  await expect(page).toHaveURL(/\/ventas$/)
  await expect(page.getByText('Venta eliminada')).toBeVisible()

  // Nothing left owing: the debt that sale carried is gone with it, never a
  // credit (recording never creates one, and this sale took no payment with it).
  await page.goto('/clientes')
  await page.getByRole('link', { name: 'Carla Pérez' }).click()
  await expect(page.getByText('Te debe', { exact: false })).toHaveCount(0)
  await expect(page.getByText('A favor', { exact: false })).toHaveCount(0)

  // Nothing personal or technical reaches the console or the browser's own storage.
  const storage = await page.evaluate(() => ({
    local: Object.keys(localStorage).length,
    session: Object.keys(sessionStorage).length,
  }))
  expect(storage).toEqual({ local: 0, session: 0 })
  expect(consoleMessages).toEqual([])

  // --- The plural form: two more sales left owing bring the count to "2 ventas
  // debiendo", and Te deben's header total is their sum (payments.md, Metrics
  // "Who-owes totals" and "No curl"). ---
  await page.goto('/clientes')
  await page.getByRole('link', { name: 'Carla Pérez' }).click()
  await page.getByRole('link', { name: 'Nueva venta a Carla Pérez' }).click()
  await expect(page).toHaveURL(/\/ventas\/nueva$/)
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '2' })
  await page.getByRole('radio', { name: 'Debiendo' }).check()
  await page.getByRole('button', { name: 'Guardá la venta' }).click()
  await expect(page).toHaveURL(/\/ventas\/\d+$/)
  await expect(page.getByText('Venta guardada')).toBeVisible()

  await page.goto('/clientes')
  await page.getByRole('link', { name: 'Carla Pérez' }).click()
  await page.getByRole('link', { name: 'Nueva venta a Carla Pérez' }).click()
  await expect(page).toHaveURL(/\/ventas\/nueva$/)
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '3' })
  await page.getByRole('radio', { name: 'Debiendo' }).check()
  await page.getByRole('button', { name: 'Guardá la venta' }).click()
  await expect(page).toHaveURL(/\/ventas\/\d+$/)
  await expect(page.getByText('Venta guardada')).toBeVisible()

  await page.goto('/clientes')
  await page.getByRole('link', { name: /te deben \$ 5\.000/ }).click()
  await expect(page).toHaveURL(/\/clientes\/deben$/)
  await expect(page.locator('.cifra-xl')).toHaveText('$ 5.000')
  await expect(page.getByText('2 ventas debiendo')).toBeVisible()
})
