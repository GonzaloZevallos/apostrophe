/**
 * The records the navigation specs need to reach a detail by its id: one priced variety, one
 * customer owing a sale, and one stock entry, all made through the built front, never through
 * the API. `signUp` opens a fresh business; `seedRecords` returns the ids it read from the
 * address bar after each save.
 */

import { CUSTOMER, CUSTOMER_NEW, SALE, STOCK, STOCK_ENTRY, STOCK_ENTRY_NEW, VARIETIES, VARIETY } from '../../src/routes.js'
import { expect, type Page } from '@playwright/test'
import { newBusinessInvitationUrl } from '../backend.js'
import { expectPath } from './url.js'
import { fillSaleLine } from './sale.js'

export const PASSWORD = 'correcthorsebattery'

export interface Records {
  variety: number
  customer: number
  sale: number
  entry: number
  customerName: string
}

export async function signUp(page: Page, label: string): Promise<void> {
  await page.goto(newBusinessInvitationUrl())
  await page.getByLabel('Nombre del negocio').fill(`Flores de ${label} ${Date.now()}`)
  await page.getByLabel('Email').fill(`duena-${label}-${Date.now()}@example.com`)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Creá el negocio' }).click()
  await expect(page.locator('.encabezado__negocio')).toBeVisible()
}

/** The id the address bar ends in, once it matches `template`. */
async function idAt(page: Page, template: string): Promise<number> {
  await expectPath(page, template)
  const found = /\/(\d+)(?:\/[a-z]+)?$/.exec(new URL(page.url()).pathname)
  if (found?.[1] === undefined) throw new Error(`no id in ${page.url()}`)
  return Number(found[1])
}

export async function seedRecords(page: Page, customerName: string): Promise<Records> {
  await page.goto(VARIETIES)
  await page.getByRole('button', { name: 'Nueva variedad' }).click()
  await page.getByLabel('Nombre').fill('Rosa')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Variedad guardada')).toBeVisible()
  await page.getByRole('link', { name: /Rosa/ }).click()
  const variety = await idAt(page, VARIETY)
  await page.getByRole('button', { name: 'Nuevo precio' }).click()
  await page.getByLabel('Precio de lista').fill('1000')
  await page.getByRole('button', { name: 'Guardar precio' }).click()
  await expect(page.getByText('Precio guardado')).toBeVisible()

  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Nombre').fill(customerName)
  await page.getByRole('button', { name: 'Guardá y usá' }).click()
  const customer = await idAt(page, CUSTOMER)
  await page.getByRole('link', { name: `Nueva venta a ${customerName}` }).click()
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '5' })
  await page.getByRole('radio', { name: 'Debiendo' }).check()
  await page.getByRole('button', { name: 'Guardá la venta' }).click()
  const sale = await idAt(page, SALE)

  await page.goto(STOCK_ENTRY_NEW)
  await page.getByLabel('Gramos').fill('50')
  await page.getByLabel('Variedad').selectOption({ label: 'Rosa' })
  await page.getByLabel('Costo total').fill('45000')
  await page.getByRole('button', { name: 'Guardá la entrada' }).click()
  await expectPath(page, STOCK)
  await page.getByText('Rosa · 50 g').click()
  const entry = await idAt(page, STOCK_ENTRY)

  return { variety, customer, sale, entry, customerName }
}
