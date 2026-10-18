/**
 * The browser's own Back on a dirty form asks the same question "Cerrar" does, at the
 * phone viewport, against the real backend: a dirty Registrar cobro asks "¿Descartás el
 * cobro?" and a dirty Nueva venta asks "¿Descartás la venta?". "No, seguí cargando" keeps
 * what was typed.
 */

import { CUSTOMER, CUSTOMER_NEW, CUSTOMERS, SALE_NEW, VARIETIES } from '../src/routes.js'
import { expectPath } from './helpers/url.js'
import { expect, test } from './fixtures.js'
import { newBusinessInvitationUrl } from './backend.js'
import { fillSaleLine } from './helpers/sale.js'
import { leaveOnboarding } from './helpers/signup.js'
import { uniqueTag } from './helpers/unique.js'

const PASSWORD = 'correcthorsebattery'

test.use({ viewport: { width: 390, height: 844 } })

test('Back on a dirty Registrar cobro and on a dirty Nueva venta asks, and "No" keeps what was typed', async ({
  page,
}) => {
  await page.goto(newBusinessInvitationUrl())
  await page.getByLabel('Nombre del negocio').fill(`Flores del Norte ${uniqueTag()}`)
  await page.getByLabel('Email').fill(`duena-volver-${uniqueTag()}@example.com`)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Creá el negocio' }).click()
  // A new business lands in the Onboarding; this spec is about something else.
  await leaveOnboarding(page)

  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'New variety' }).click()
  await page.getByLabel('Nombre').fill('Rosa')
  await page.getByRole('button', { name: 'Add variety' }).click()
  await expect(page.getByText('Variety saved')).toBeVisible()
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('link', { name: 'New price' }).click()
  await page.getByLabel(/^List price/).fill('1000')
  await page.getByRole('button', { name: 'Save price' }).click()
  await expect(page.getByText('Price saved')).toBeVisible()

  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Nombre').fill('Carla Volver')
  await page.getByRole('button', { name: 'Guardá y usá' }).click()
  await expectPath(page, CUSTOMER)
  await page.getByRole('link', { name: 'Nueva venta a Carla Volver' }).click()
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '5' })
  await page.getByRole('radio', { name: 'Owing' }).check()
  await page.getByRole('button', { name: 'Guardá la venta' }).click()
  await expect(page.getByText('Sale saved')).toBeVisible()

  // A dirty Registrar cobro, reached from Clientes' "Cobrar a".
  await page.goto(CUSTOMERS)
  await page.getByRole('link', { name: 'Cobrar a Carla Volver' }).first().click()
  await page.getByRole('radio', { name: 'Efectivo' }).check()
  await page.goBack()
  await expect(page.getByText('¿Descartás el cobro?')).toBeVisible()
  await page.getByRole('button', { name: 'No, seguí cargando' }).click()
  await expect(page.getByRole('radio', { name: 'Efectivo' })).toBeChecked()
  await page.getByRole('button', { name: 'Cerrar' }).click()
  await page.getByRole('button', { name: 'Sí, descartalo' }).click()
  await expectPath(page, CUSTOMERS)

  // A dirty Nueva venta.
  await page.goto(CUSTOMERS)
  await page.getByRole('link', { name: 'Carla Volver' }).first().click()
  await page.getByRole('link', { name: 'Nueva venta a Carla Volver' }).click()
  await expectPath(page, SALE_NEW)
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '3' })
  await page.goBack()
  await expect(page.getByText('¿Descartás la venta?')).toBeVisible()
  await page.getByRole('button', { name: 'No, seguí cargando' }).click()
  await expectPath(page, SALE_NEW)
  await expect(page.getByLabel('Gramos línea 1')).toHaveValue('3')
})
