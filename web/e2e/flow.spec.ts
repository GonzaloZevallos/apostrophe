/**
 * The end-to-end run (plan, "Shape"; PRD M1, "no `curl` at any point"): every step
 * a seller needs before the sales task lands, done through the built front alone,
 * against the real backend. One business, accepted from its invitation link, then
 * a customer, a variety and its price (added and deleted), an expense (recorded,
 * edited and deleted), an expense category (added and removed), the business
 * renamed, and a second user joining through a fresh invitation link.
 *
 * `consoleMessages` is asserted empty at the end (plan, "Observability": "the e2e
 * run asserts zero console messages") — nothing personal or technical belongs in the
 * browser console (CODING_STANDARDS.md section 9, in the browser too).
 */

import { expect, test } from '@playwright/test'
import { newBusinessInvitationUrl } from './backend.js'

const PASSWORD = 'correcthorsebattery'
const PHONE = '+5491155550001'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

test('a seller does everything the backend offers today, from the front alone', async ({
  page,
  browser,
}) => {
  const consoleMessages: string[] = []
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`))

  const ownerEmail = `duena-${Date.now()}@example.com`
  const businessName = `Flores del Centro ${Date.now()}`

  // Accept a new-business invitation.
  await page.goto(newBusinessInvitationUrl())
  await page.getByLabel('Nombre del negocio').fill(businessName)
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Creá el negocio' }).click()
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // Add a customer.
  await page.goto('/clientes/nuevo')
  await page.getByLabel('Teléfono').fill(PHONE)
  await page.getByLabel('Nombre').fill('Marisa Gómez')
  await page.getByRole('button', { name: 'Guardá y usá' }).click()
  await expect(page).toHaveURL(/\/clientes$/)
  await expect(page.getByText('Cliente guardado')).toBeVisible()

  // Add a variety.
  await page.goto('/variedades')
  await page.getByRole('button', { name: 'Nueva variedad' }).click()
  await page.getByLabel('Nombre').fill('Rosa')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Variedad guardada')).toBeVisible()
  await page.getByRole('link', { name: /Rosa/ }).click()
  await expect(page).toHaveURL(/\/variedades\/.+/)

  // Add a price.
  await page.getByRole('button', { name: 'Nuevo precio' }).click()
  await page.getByLabel('Rige desde').fill(today())
  await page.getByLabel('Precio de lista').fill('9000')
  await page.getByRole('button', { name: 'Guardar precio' }).click()
  await expect(page.getByText('Precio guardado')).toBeVisible()
  await expect(page.getByText('$ 9.000')).toBeVisible()

  // Delete the price entry (the only one): the variety is left with no price.
  await page.getByRole('button', { name: 'Borrar este precio' }).click();
  await page.getByRole('button', { name: 'Sí, borrala' }).click();
  await expect(page.getByText('Precio eliminado')).toBeVisible()
  await expect(page.getByText('Sin precio: no se puede vender')).toBeVisible()

  // Record an expense, with a category created inline.
  await page.goto('/gastos')
  await page.getByRole('button', { name: 'Nuevo gasto' }).click()
  await page.getByRole('button', { name: 'Crear una categoría nueva' }).click()
  await page.getByLabel('Nombre de la categoría nueva').fill('Flete')
  await page.getByRole('button', { name: 'Crear categoría' }).click()
  await page.getByLabel('Monto').fill('4500')
  await page.getByLabel('Detalle').fill('Flete al mercado')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Gasto guardado')).toBeVisible()
  await expect(page.getByText('Flete al mercado')).toBeVisible()

  // Edit it.
  await page.getByText('Flete al mercado').click()
  await page.getByLabel('Detalle').fill('Flete al mercado central')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Gasto guardado')).toBeVisible()
  await expect(page.getByText('Flete al mercado central')).toBeVisible()

  // Delete it.
  await page.getByText('Flete al mercado central').click()
  await page.getByRole('button', { name: 'Borrar gasto' }).click()
  await page.getByRole('button', { name: 'Sí, borrala' }).click()
  await expect(page.getByText('Gasto eliminado')).toBeVisible()
  await expect(page.getByText('Flete al mercado central')).toHaveCount(0)

  // Add and remove an expense category. "Insumos de cultivo", "Packaging",
  // "Envíos y traslados" and "Otros" are the four the business starts with
  // (`app/expenses/domain/category.py`'s `DEFAULT_CATEGORY_NAMES`), so this one
  // uses a name of its own.
  await page.goto('/gastos/categorias')
  await page.getByLabel('Nueva categoría').fill('Delivery en bici')
  await page.getByRole('button', { name: 'Agregar categoría' }).click()
  await expect(page.getByText('Categoría guardada')).toBeVisible()
  const newRow = page.locator('.fila', { hasText: 'Delivery en bici' })
  await newRow.getByRole('button', { name: 'Eliminar' }).click()
  await page.getByRole('button', { name: 'Sí, borrala' }).click()
  await expect(page.getByText('Categoría eliminada')).toBeVisible()
  await expect(page.getByText('Delivery en bici')).toHaveCount(0)

  // Rename the business.
  await page.goto('/negocio')
  const renamedTo = `${businessName} Renombrado`
  await page.getByLabel('Nombre del negocio').fill(renamedTo)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Negocio renombrado')).toBeVisible()

  // Create a join link and accept it as a second user, from a separate browser
  // context (its own cookie jar — a second device).
  await page.getByRole('button', { name: 'Invitá a un socio' }).click()
  const inviteUrl = await page.locator('.negocio__link').textContent()
  if (inviteUrl === null || inviteUrl === '') throw new Error('no invitation link shown')

  const partnerContext = await browser.newContext()
  const partnerPage = await partnerContext.newPage()
  partnerPage.on('console', (message) =>
    consoleMessages.push(`${message.type()}: ${message.text()}`),
  )
  await partnerPage.goto(inviteUrl)
  await expect(partnerPage.locator('.invitacion__titulo')).toHaveText(renamedTo)
  await partnerPage.getByLabel('Email').fill(`socio-${Date.now()}@example.com`)
  await partnerPage.getByLabel('Contraseña').fill(PASSWORD)
  await partnerPage.getByRole('button', { name: `Sumate a ${renamedTo}` }).click()
  await expect(partnerPage.locator('.encabezado__negocio')).toHaveText(renamedTo)
  await partnerContext.close()

  expect(consoleMessages).toEqual([])
})
