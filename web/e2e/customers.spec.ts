/**
 * GH-54's own end-to-end run (plan, "Subtasks: front"): a customer without a phone
 * number is a normal customer, proven against the real backend, through the built
 * front alone — never a mock of either side.
 *
 * Depends on `customers-backend`: this branch is rebased onto it (plan, "Order":
 * "Merge only after `customers-backend` is approved: rebase onto it, with the
 * end-to-end spec below green against the real backend"), so this spec runs
 * against the real optional-phone domain, API and migration. What proves it
 * green is `web-e2e`'s own run, not a claim in this comment.
 *
 * Covers the PRD's own lifecycle for a customer with no number: registered, edited,
 * found by name, chosen for a sale left owing, paid through Registrar cobro, and
 * shown in Te deben — plus the under-60-s metric for a new no-number customer
 * created from Elegir cliente, and that nothing personal reaches the console or the
 * browser's own storage.
 */

import { expect, test } from '@playwright/test'
import { newBusinessInvitationUrl } from './backend.js'
import { watchConsole } from './console.js'
import { fillSaleLine } from './helpers/sale.js'
import { expectOnlyTheThemeStored } from './helpers/storage.js'

const PASSWORD = 'correcthorsebattery'

test('a customer with no phone number is registered, edited, sold to, paid and shown in Te deben', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  const ownerEmail = `duena-sin-telefono-${Date.now()}@example.com`
  const businessName = `Flores Sin Telefono ${Date.now()}`

  await page.goto(newBusinessInvitationUrl())
  await page.getByLabel('Nombre del negocio').fill(businessName)
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Creá el negocio' }).click()
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // One priced variety, $1.000/g — round figures for every assertion below.
  await page.goto('/varieties')
  await page.getByRole('button', { name: 'Nueva variedad' }).click()
  await page.getByLabel('Nombre').fill('Jazmín')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Variedad guardada')).toBeVisible()
  await page.getByRole('link', { name: /Jazmín/ }).click()
  await page.getByRole('link', { name: 'Nuevo precio' }).click()
  await page.getByLabel(/^Precio de lista/).fill('1000')
  await page.getByRole('button', { name: 'Guardá el precio' }).click()
  await expect(page.getByText('Precio guardado')).toBeVisible()

  // Registered with no phone number at all.
  await page.goto('/clientes/nuevo')
  await page.getByLabel('Nombre').fill('Noe Sinnumero')
  await page.getByRole('button', { name: 'Guardá y usá' }).click()
  await expect(page).toHaveURL(/\/clientes$/)
  await expect(page.getByText('Cliente guardado')).toBeVisible()

  // Found by name, in the list: no phone line, no dash, no placeholder.
  const row = page.getByRole('link', { name: /Noe Sinnumero/ })
  await expect(row).toBeVisible()
  await expect(row.locator('.lista-clientes__telefono')).toHaveCount(0)
  await expect(row).not.toContainText('-')
  await expect(row).not.toContainText('Sin teléfono')

  // The card shows no phone field either.
  await row.click()
  await expect(page).toHaveURL(/\/clientes\/\d+$/)
  await expect(page.getByText('Teléfono')).toHaveCount(0)

  // Edited: still no phone number, and the edit form shows no required marker on
  // the phone field while it stays usable.
  await page.getByRole('link', { name: 'Editar' }).click()
  await expect(page.getByLabel('Teléfono')).toHaveValue('')
  await page.getByRole('button', { name: 'Guardá y usá' }).click()
  await expect(page.getByText('Cliente guardado')).toBeVisible()
  await expect(page.getByText('Teléfono')).toHaveCount(0)

  // Chosen for a sale, left owing — $4.000.
  const todayStart = Date.now()
  await page.getByRole('link', { name: 'Nueva venta a Noe Sinnumero' }).click()
  await expect(page).toHaveURL(/\/ventas\/nueva$/)
  await fillSaleLine(page, 1, { variety: 'Jazmín', grams: '4' })
  await page.getByRole('radio', { name: 'Debiendo' }).check()
  await page.getByRole('button', { name: 'Guardá la venta' }).click()
  await expect(page).toHaveURL(/\/ventas\/\d+$/)
  await expect(page.getByText('Venta guardada')).toBeVisible()
  expect(Date.now() - todayStart).toBeLessThan(60_000)

  await page.goto('/clientes')
  await page.getByRole('link', { name: 'Noe Sinnumero' }).click()
  await expect(page.getByText('Te debe $ 4.000')).toBeVisible()

  // Paid in full through Registrar cobro.
  await page.getByRole('button', { name: 'Registrar cobro' }).click()
  await page.getByRole('button', { name: 'Todo: $ 4.000' }).click()
  await page.getByRole('radio', { name: 'Efectivo' }).check()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Cobro guardado', { exact: true })).toBeVisible()
  await expect(page.getByText('Te debe', { exact: false })).toHaveCount(0)

  // A second customer, also without a phone number, created straight from Elegir
  // cliente inside a new sale, chosen and sold to in one timed run (PRD metric 1).
  const sheetStart = Date.now()
  await page.goto('/ventas/nueva')
  await page.getByRole('button', { name: 'Elegir cliente' }).click()
  await page.getByRole('button', { name: 'Nuevo cliente' }).click()
  await page.getByLabel('Nombre').fill('Sol Sinnumero')
  await page.getByRole('button', { name: 'Crear cliente' }).click()
  await expect(page.getByRole('button', { name: /Sol Sinnumero/ })).toBeVisible()
  // The chosen chip carries no phone element either.
  const chip = page.getByRole('button', { name: /Sol Sinnumero/ })
  await expect(chip.locator('.nueva-venta__cliente-telefono')).toHaveCount(0)
  await fillSaleLine(page, 1, { variety: 'Jazmín', grams: '2' })
  await page.getByRole('radio', { name: 'Debiendo' }).check()
  await page.getByRole('button', { name: 'Guardá la venta' }).click()
  await expect(page).toHaveURL(/\/ventas\/\d+$/)
  await expect(page.getByText('Venta guardada')).toBeVisible()
  expect(Date.now() - sheetStart).toBeLessThan(60_000)

  // Te deben lists the second, no-number customer's own fresh debt — the first
  // customer's debt is already settled, so she never named here.
  await page.goto('/clientes')
  await page.getByRole('link', { name: /te deben \$ 2\.000/ }).click()
  await expect(page).toHaveURL(/\/clientes\/deben$/)
  const debtorRow = page.getByRole('link', { name: 'Sol Sinnumero' })
  await expect(debtorRow).toBeVisible()
  await expect(debtorRow).toContainText('$ 2.000')
  await expect(page.getByRole('link', { name: 'Noe Sinnumero' })).toHaveCount(0)

  // Nothing personal or technical reaches the console or the browser's own storage.
  await expectOnlyTheThemeStored(page)
  expect(consoleMessages).toEqual([])
})
