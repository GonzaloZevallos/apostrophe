/**
 * Nueva venta's open line on a real phone viewport (320, 375 and 430 px, and 246 px, which
 * is 320 px at 130 % text): no field of the line, nor "Agregar otra variedad" or the
 * shipping field, leaves the screen; every control of them is at least 44 px tall and every
 * input at least 16 px, so iOS never zooms. The header, footer and date belong to the
 * shell's own spec, not to this one.
 */

import { expect, test, type Locator, type Page } from '@playwright/test'
import { newBusinessInvitationUrl } from './backend.js'
import { fillSaleLine } from './helpers/sale.js'

const PASSWORD = 'correcthorsebattery'
const WIDTHS = [320, 375, 430, 246] as const
const TOUCH_TARGET = 44
const MIN_INPUT_FONT = 16

async function signUpWithAVariety(page: Page): Promise<void> {
  await page.goto(newBusinessInvitationUrl())
  await page.getByLabel('Nombre del negocio').fill(`Vivero Línea ${Date.now()}`)
  await page.getByLabel('Email').fill(`duena-linea-${Date.now()}@example.com`)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Creá el negocio' }).click()
  await expect(page.locator('.encabezado__negocio')).toBeVisible()
  await page.goto('/variedades')
  await page.getByRole('button', { name: 'Nueva variedad' }).click()
  await page.getByLabel('Nombre').fill('Jazmín con un nombre bastante largo')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Variedad guardada')).toBeVisible()
  await page.getByRole('link', { name: /Jazmín/ }).click()
  await page.getByRole('button', { name: 'Nuevo precio' }).click()
  await page.getByLabel('Precio de lista').fill('500')
  await page.getByRole('button', { name: 'Guardar precio' }).click()
  await expect(page.getByText('Precio guardado')).toBeVisible()
}

async function box(target: Locator): Promise<{ x: number; width: number; height: number }> {
  const rect = await target.boundingBox()
  if (rect === null) throw new Error('not rendered')
  return rect
}

test('the open line fits and is thumb-sized at 320, 375, 430 and at 130 % text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signUpWithAVariety(page)

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 760 })
    await page.goto('/ventas/nueva')
    await fillSaleLine(page, 1, {
      variety: 'Jazmín con un nombre bastante largo',
      grams: '12,5',
      specialPrice: '450',
    })

    const line = page.locator('.nueva-venta__linea--abierta')
    const controls = [
      page.getByLabel('Variedad línea 1'),
      page.getByLabel('Gramos línea 1'),
      page.getByLabel('Precio especial línea 1'),
      line.locator('.opcion-interruptor'),
      page.getByRole('button', { name: 'Agregar otra variedad' }),
      page.getByLabel('Envío'),
    ]
    for (const control of controls) {
      const rect = await box(control)
      expect(rect.x, `left edge at ${width}`).toBeGreaterThanOrEqual(0)
      expect(rect.x + rect.width, `right edge at ${width}`).toBeLessThanOrEqual(width)
      expect(rect.height, `height at ${width}`).toBeGreaterThanOrEqual(TOUCH_TARGET)
    }
    for (const input of [
      page.getByLabel('Variedad línea 1'),
      page.getByLabel('Gramos línea 1'),
      page.getByLabel('Precio especial línea 1'),
      page.getByLabel('Envío'),
    ]) {
      const size = await input.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))
      expect(size, `font size at ${width}`).toBeGreaterThanOrEqual(MIN_INPUT_FONT)
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `horizontal overflow at ${width}`).toBeLessThanOrEqual(0)
  }
})
