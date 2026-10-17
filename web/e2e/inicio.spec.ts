/**
 * Inicio redesigned, end to end (plan, subtask `inicio-screen`), against the real
 * backend and the built front alone:
 * - an empty business is taken through the checklist (a priced variety, then stock)
 *   with no visit to Más, and the checklist disappears;
 * - the bot notice that follows is dismissed, and stays gone;
 * - from a phone viewport, "Cobrar a <name>" with "Todo" ends back on Inicio in
 *   under 60 s, the paid debtor gone;
 * - Te deben, a customer, a sold-out variety and all three tabs are opened, the
 *   avatar on each;
 * - the console and the browser's storage hold no figure or name.
 */

import { expect, test } from '@playwright/test'
import { newBusinessInvitationUrl } from './backend.js'
import { watchConsole } from './console.js'
import { fillSaleLine } from './helpers/sale.js'

const PASSWORD = 'correcthorsebattery'

test('a new business sets up from the checklist, collects from Hoy and opens what Hoy links to', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)
  await page.setViewportSize({ width: 390, height: 844 })

  const businessName = `Zinnias ${Date.now()}`
  await page.goto(newBusinessInvitationUrl())
  await page.getByLabel('Nombre del negocio').fill(businessName)
  await page.getByLabel('Email').fill(`duena-inicio-${Date.now()}@example.com`)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Creá el negocio' }).click()
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // The checklist, with nothing done; the avatar is the business's initial.
  const checklist = page.getByRole('region', { name: 'Para empezar a vender' })
  await expect(checklist).toBeVisible()
  await expect(checklist.getByText('Hecho')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Configuración' })).toHaveText('Z')

  // Step 1: a variety with its price, from the checklist.
  await checklist.getByRole('link', { name: /variedad con su precio/ }).click()
  await expect(page).toHaveURL(/\/variedades$/)
  await page.getByRole('button', { name: 'Nueva variedad' }).click()
  await page.getByLabel('Nombre').fill('Rosa')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Variedad guardada')).toBeVisible()
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('button', { name: 'Nuevo precio' }).click()
  await page.getByLabel('Precio de lista').fill('1000')
  await page.getByRole('button', { name: 'Guardar precio' }).click()
  await expect(page.getByText('Precio guardado')).toBeVisible()

  await page.goto('/')
  await expect(checklist.getByText('Hecho')).toHaveCount(1)

  // Step 2: the stock, from the checklist.
  await checklist.getByRole('link', { name: /stock inicial/ }).click()
  await expect(page).toHaveURL(/\/mi-stock\/nueva-entrada$/)
  await page.getByLabel('Gramos').fill('5')
  await page.getByLabel('Variedad').selectOption({ label: 'Rosa' })
  await page.getByLabel('Costo total').fill('3000')
  await page.getByRole('button', { name: 'Guardá la entrada' }).click()
  await expect(page.getByText('Entrada guardada')).toBeVisible()

  // Both required steps are done: the checklist is gone, and the bot notice replaces it.
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Conectar el bot' })).toBeVisible()
  await expect(checklist).toHaveCount(0)

  // Dismissed: it goes, with no toast, and stays gone after a reload.
  await page.getByRole('button', { name: 'No mostrar más' }).click()
  await expect(page.getByRole('link', { name: 'Conectar el bot' })).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('Vendiste hoy')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Conectar el bot' })).toHaveCount(0)

  // A customer who owes: one sale of all the grams, so Rosa also runs out.
  await page.goto('/clientes/nuevo')
  await page.getByLabel('Teléfono').fill('+5491155550123')
  await page.getByLabel('Nombre').fill('Carla Pérez')
  await page.getByRole('button', { name: 'Guardá y usá' }).click()
  await expect(page.getByText('Cliente guardado')).toBeVisible()
  await page.getByRole('link', { name: 'Carla Pérez' }).click()
  await page.getByRole('link', { name: 'Nueva venta a Carla Pérez' }).click()
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '5' })
  await page.getByRole('radio', { name: 'Debiendo' }).check()
  await page.getByRole('button', { name: 'Guardá la venta' }).click()
  await expect(page.getByText('Venta guardada')).toBeVisible()

  // The three tabs, each with the avatar.
  await page.goto('/')
  for (const tab of ['Semana', 'Mes', 'Hoy']) {
    await page.getByRole('button', { name: tab, exact: true }).click()
    await expect(page.getByRole('link', { name: 'Configuración' })).toBeVisible()
  }

  // Te deben, then the customer's card, then the sold-out variety.
  await page.getByRole('link', { name: 'Te deben', exact: true }).click()
  await expect(page).toHaveURL(/\/clientes\/deben$/)
  await page.goBack()
  await page.getByRole('link', { name: /Carla Pérez/ }).click()
  await expect(page).toHaveURL(/\/clientes\/\d+$/)
  await page.goBack()
  await page.getByRole('link', { name: /Rosa/ }).click()
  await expect(page).toHaveURL(/\/variedades\/\d+$/)
  await page.goBack()

  // Cobrar from Hoy, under a minute: the sheet opens on that customer, "Todo" takes
  // the balance as it stands, and Inicio is back with nobody owing.
  const started = Date.now()
  await page.getByRole('button', { name: 'Cobrar a Carla Pérez' }).click()
  await page.getByRole('button', { name: 'Todo: $ 5.000' }).click()
  await page.getByRole('radio', { name: 'Efectivo' }).check()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Cobro guardado', { exact: true })).toBeVisible()
  await expect(page.getByText('Nadie te debe')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cobrar a Carla Pérez' })).toHaveCount(0)
  expect(Date.now() - started).toBeLessThan(60_000)
  await expect(page).toHaveURL(/\/$/)

  const storage = await page.evaluate(() => ({
    local: Object.keys(localStorage).length,
    session: Object.keys(sessionStorage).length,
  }))
  expect(storage).toEqual({ local: 0, session: 0 })
  expect(consoleMessages).toEqual([])
})
