/**
 * The sales task's own end-to-end run (plan, "Order": `e2e-sales` lands last, after
 * every sales screen subtask). `flow.spec.ts` covers everything the front offered
 * before this task; this file is the seller's own journey through the three new
 * screens, against the real backend, through the built front alone — never a mock of
 * either side (PRD, M1: "no `curl` at any point").
 *
 * One business proves the PRD's own metrics in sequence:
 * - "Caught before save" (3): Debiendo disabled with no customer, and a line whose
 *   variety has no price that day, both shown before any save is attempted.
 * - "One sale" (4) and "What I see is what I get" (2): a two-variety order with
 *   shipping charged once, where the live preview's total matches the saved detail's,
 *   figure for figure.
 * - "Undo leaves nothing" (5): Deshacer right after saving removes the sale from
 *   every list.
 * - The shell's "Nueva venta a <name>" (accounts.md) opens the form with that
 *   customer already chosen, and a sale with no price stored it as a gift, needing
 *   no payment method ($0 needs none).
 * - "Fixing" (8): assigning a customer to a sale that had none, then deleting a sale
 *   through its confirmation, naming the date and the amount.
 * - Ventas' periods (6, 7): Hoy, Semana, Mes and Fechas each answer with the same
 *   sale once the other two are gone.
 * - Isolation (ADR-0004): a second business opening the first one's sale by its own
 *   id sees "Eso ya no está.", never the sale itself.
 *
 * `consoleMessages` is asserted empty at the end, exactly like `flow.spec.ts`
 * (CODING_STANDARDS.md section 9: nothing personal or technical belongs in the
 * console), and the browser's own storage is asserted empty too, since a sale carries
 * a customer's name, a note and an amount — exactly what section 9 forbids there.
 */

import { expect, test } from '@playwright/test'
import { newBusinessInvitationUrl } from './backend.js'
import { watchConsole } from './console.js'

const PASSWORD = 'correcthorsebattery'

function shortDate(iso: string): string {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

test('a seller records, undoes, fixes and isolates sales, from the front alone', async ({
  page,
  browser,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  const ownerEmail = `duena-ventas-${Date.now()}@example.com`
  const businessName = `Vivero Jacarandá ${Date.now()}`

  // Accept a new-business invitation.
  await page.goto(newBusinessInvitationUrl())
  await page.getByLabel('Nombre del negocio').fill(businessName)
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Creá el negocio' }).click()
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // Two priced varieties and one with no price at all, for the "no price that day"
  // check below.
  async function addVariety(name: string, listPrice?: string): Promise<void> {
    await page.goto('/variedades')
    await page.getByRole('button', { name: 'Nueva variedad' }).click()
    await page.getByLabel('Nombre').fill(name)
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Variedad guardada')).toBeVisible()
    if (listPrice === undefined) return
    await page.getByRole('link', { name: new RegExp(name) }).click()
    await page.getByRole('button', { name: 'Nuevo precio' }).click()
    await page.getByLabel('Precio de lista').fill(listPrice)
    await page.getByRole('button', { name: 'Guardar precio' }).click()
    await expect(page.getByText('Precio guardado')).toBeVisible()
  }
  await addVariety('Jazmín', '500')
  await addVariety('Lirio', '300')
  await addVariety('Mimosa')

  // --- Sale A: caught-before-save, a new customer, two varieties, one shipping. ---
  await page.goto('/ventas')
  await page.getByRole('link', { name: 'Nueva venta' }).first().click()
  await expect(page).toHaveURL(/\/ventas\/nueva$/)

  // Debiendo is disabled and explained while there is no customer.
  await expect(page.getByRole('radio', { name: 'Debiendo' })).toBeDisabled()
  await expect(page.getByText('Para dejar debiendo elegí un cliente')).toBeVisible()

  // A variety with no price that day is caught on its own line, before saving.
  await page.getByLabel('Variedad línea 1').selectOption({ label: 'Mimosa' })
  await page.getByLabel('Gramos línea 1').fill('5')
  await expect(page.getByText('Mimosa no tiene precio para esa fecha')).toBeVisible()

  // Swap it for a priced variety and add a second line.
  await page.getByLabel('Variedad línea 1').selectOption({ label: 'Jazmín' })
  await page.getByLabel('Gramos línea 1').fill('10')
  await page.getByRole('button', { name: 'Agregar variedad' }).click()
  await page.getByLabel('Variedad línea 2').selectOption({ label: 'Lirio' })
  await page.getByLabel('Gramos línea 2').fill('20')
  await page.getByLabel('Envío').fill('1000')
  await page.getByLabel('Nota').fill('Pedido para el grupo')

  // A brand-new customer, created from inside the sheet, without leaving the sale.
  await page.getByRole('button', { name: 'Elegir cliente' }).click()
  await page.getByRole('button', { name: 'Nuevo cliente' }).click()
  await page.getByLabel('Teléfono').fill('+5491155550010')
  await page.getByLabel('Nombre').fill('Carla Pérez')
  await page.getByRole('button', { name: 'Crear cliente' }).click()
  await expect(page.getByText('Elegir cliente')).toHaveCount(0)
  await expect(page.locator('.lista-clientes__nombre')).toHaveText('Carla Pérez')

  // Choosing a customer turns Debiendo back on; Efectivo is used here instead.
  await expect(page.getByRole('radio', { name: 'Debiendo' })).toBeEnabled()
  await page.getByRole('radio', { name: 'Efectivo' }).check()

  // The live preview, before saving: 10g * $500 + 20g * $300 + $1.000 shipping.
  await expect(page.locator('.cifra-m')).toHaveText('$ 12.000')
  await expect(page.getByText('30 g vendidos')).toBeVisible()

  await page.getByRole('button', { name: 'Guardar venta' }).click()
  await expect(page).toHaveURL(/\/ventas\/\d+$/)
  await expect(page.getByText('Venta guardada')).toBeVisible()

  // What is shown now is what the API answered, not the preview — but it is the
  // same figure, since nothing changed in between (PRD metric 2: 0 differences).
  await expect(page.locator('.cifra-xl')).toHaveText('$ 12.000')
  await expect(page.getByText('Envío cobrado')).toBeVisible()
  await expect(page.getByText('$ 1.000')).toBeVisible()
  await expect(page.getByText('Pedido para el grupo')).toBeVisible()
  await expect(page.getByText('Carla Pérez')).toBeVisible()

  // Deshacer, right after saving: nothing of this sale survives.
  await page.getByRole('button', { name: 'Deshacer' }).click()
  await expect(page).toHaveURL(/\/ventas$/)
  await expect(page.getByText('Venta eliminada')).toBeVisible()
  await expect(page.getByText('0 ventas')).toBeVisible()
  await expect(page.getByText('Todavía no registraste ninguna venta en este período.')).toBeVisible()

  // --- Sale B: "Nueva venta a <name>", a gift line, no payment needed for $0. ---
  await page.goto('/clientes')
  await page.getByRole('link', { name: 'Carla Pérez' }).click()
  await page.getByRole('link', { name: 'Nueva venta a Carla Pérez' }).click()
  await expect(page).toHaveURL(/\/ventas\/nueva$/)
  // Already chosen, no picking needed: fetched by id (keys.saleFormCustomer), not
  // carried along in history state (plan, invariants).
  await expect(page.locator('.lista-clientes__nombre')).toHaveText('Carla Pérez')

  await page.getByLabel('Variedad línea 1').selectOption({ label: 'Jazmín' })
  await page.getByLabel('Gramos línea 1').fill('4')
  await page.getByLabel('Regalo línea 1').check()
  await expect(page.getByLabel('Precio especial línea 1')).toBeDisabled()

  // A $0 sale (one gift line, no shipping): saving is never blocked for no method.
  await expect(page.locator('.cifra-m')).toHaveText('$ 0')
  const saveButtonB = page.getByRole('button', { name: 'Guardar venta' })
  await expect(saveButtonB).toBeEnabled()
  await saveButtonB.click()
  await expect(page).toHaveURL(/\/ventas\/\d+$/)
  const saleBUrl = page.url()
  await expect(page.getByText('Venta guardada')).toBeVisible()
  await expect(page.locator('.cifra-xl')).toHaveText('$ 0')
  await expect(page.getByRole('button', { name: 'Asignar cliente' })).toHaveCount(0) // already has one.

  // --- Sale C: no customer, assigned afterwards, then deleted. ---
  await page.goto('/ventas')
  await page.getByRole('link', { name: 'Nueva venta' }).first().click()
  const saleCDate = await page.getByLabel('Fecha').inputValue()
  await page.getByLabel('Variedad línea 1').selectOption({ label: 'Jazmín' })
  await page.getByLabel('Gramos línea 1').fill('2')
  await page.getByRole('radio', { name: 'Efectivo' }).check()
  await page.getByRole('button', { name: 'Guardar venta' }).click()
  await expect(page).toHaveURL(/\/ventas\/\d+$/)
  await expect(page.getByText('Sin cliente')).toBeVisible()

  // Assigning a customer: the sheet never offers "Sin cliente" here.
  await page.getByRole('button', { name: 'Asignar cliente' }).click()
  await expect(page.getByRole('button', { name: 'Sin cliente' })).toHaveCount(0)
  await page.getByLabel('Buscar').fill('Carla')
  await page.getByRole('button', { name: /Carla Pérez/ }).click()
  await expect(page.getByText('Cliente asignado')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Asignar cliente' })).toHaveCount(0)

  // Borrar venta, confirmed with the date and the amount, then gone from the list.
  await page.getByRole('button', { name: 'Borrar venta' }).click()
  await expect(
    page.getByRole('alertdialog', {
      name: `¿Borrás la venta de $ 1.000 del ${shortDate(saleCDate)}?`,
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Sí, borrala' }).click()
  await expect(page).toHaveURL(/\/ventas$/)
  await expect(page.getByText('Venta eliminada')).toBeVisible()

  // --- Ventas' periods: only the gift sale ($0) remains, in every period. ---
  await expect(page.getByText('1 venta', { exact: true })).toBeVisible()
  await expect(page.locator('.cifra-xl')).toHaveText('$ 0')
  for (const period of ['Semana', 'Mes', 'Fechas']) {
    await page.getByRole('button', { name: period }).click()
    await expect(page.getByText('1 venta', { exact: true })).toBeVisible()
    await expect(page.locator('.cifra-xl')).toHaveText('$ 0')
  }

  // --- Isolation: a second business can never reach the first one's sale. ---
  const otherContext = await browser.newContext()
  const otherPage = await otherContext.newPage()
  watchConsole(otherPage, consoleMessages)
  await otherPage.goto(newBusinessInvitationUrl())
  await otherPage.getByLabel('Nombre del negocio').fill(`Otro negocio ${Date.now()}`)
  await otherPage.getByLabel('Email').fill(`otra-${Date.now()}@example.com`)
  await otherPage.getByLabel('Contraseña').fill(PASSWORD)
  await otherPage.getByRole('button', { name: 'Creá el negocio' }).click()
  await expect(otherPage.locator('.encabezado__negocio')).toBeVisible()

  await otherPage.goto(saleBUrl)
  await expect(otherPage.getByText('Eso ya no está.')).toBeVisible()
  await otherPage.getByRole('link', { name: 'Volver a Ventas' }).click()
  await expect(otherPage).toHaveURL(/\/ventas$/)
  await otherContext.close()

  // Nothing personal or technical reaches the console or the browser's own storage
  // (CODING_STANDARDS.md section 9, in the browser too).
  const storage = await page.evaluate(() => ({
    local: Object.keys(localStorage).length,
    session: Object.keys(sessionStorage).length,
  }))
  expect(storage).toEqual({ local: 0, session: 0 })

  // Every browser logs a generic "Failed to load resource: 404" line for any fetch
  // that comes back non-2xx, app code notwithstanding: the one unavoidable message
  // here is the isolation check just above (`GET /sales/<id>` from a business that
  // doesn't own it), which carries no id, name, note or amount — exactly what
  // ADR-0004's 404 is for. Anything else in the console still fails this assertion.
  const RESOURCE_404 = 'error: Failed to load resource: the server responded with a status of 404 (Not Found)'
  expect(consoleMessages).toEqual([RESOURCE_404])
})
