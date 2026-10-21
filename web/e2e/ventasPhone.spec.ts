/**
 * Ventas and a sale's detail on the phone (GH-78, subtask "ventas-and-detail"), in a real
 * browser against the real front: layout cannot be read from jsdom. At 320 and 430 px and at
 * 130 % text (the same widths divided by 1.3, which is what the browser's text zoom does to the
 * CSS viewport), the period tabs sit in two or four equal columns (never three), are at least
 * 44 px tall and are not clipped; Fechas' date inputs are at least 16 px, 44 px tall and inside
 * the screen; the detail's "Delete sale" and its dialog's buttons are at least 44 px tall; and
 * nothing overflows the page sideways. On a computer the tabs keep the plain list.
 */

import { SALES, VARIETIES } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import type { Locator, Page } from '@playwright/test'
import { signUpNewBusiness } from './helpers/signup.js'
import { setPriceDate } from './helpers/priceDate.js'
import { uniqueTag } from './helpers/unique.js'

const TOUCH_TARGET = 44
const MIN_INPUT_FONT = 16

const PHONES = [
  { name: '320', width: 320, height: 700 },
  { name: '430', width: 430, height: 900 },
  { name: '320 at 130 %', width: 246, height: 700 },
  { name: '430 at 130 %', width: 331, height: 900 },
]

async function box(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const found = await locator.boundingBox()
  if (found === null) throw new Error('element has no box')
  return found
}

async function expectNoSidewaysOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

async function expectInsideTheScreen(page: Page, locator: Locator): Promise<void> {
  const found = await box(locator)
  const width = page.viewportSize()?.width ?? 0
  expect(found.x).toBeGreaterThanOrEqual(0)
  expect(found.x + found.width).toBeLessThanOrEqual(width)
}

test('Ventas and a sale detail fit, and are thumb-sized, at 320, 430 and 130 % on the phone', async ({
  page,
}) => {
  await signUpNewBusiness(page, { businessName: `Vivero Telefono ${uniqueTag()}`, email: `duena-telefono-${uniqueTag()}@example.com` })

  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'New variety' }).click()
  await page.getByLabel('Name').fill('Jazmín')
  await page.getByRole('button', { name: 'Agregá la variedad' }).click()
  await expect(page.getByText('Variedad guardada')).toBeVisible()
  await page.getByRole('link', { name: /Jazmín/ }).click()
  await page.getByRole('link', { name: 'New price' }).click()
  await setPriceDate(page, '2000-01-01')
  await page.getByLabel(/^Precio de lista/).fill('500')
  await page.getByRole('button', { name: 'Guardá el precio' }).click()
  await expect(page.getByText('Precio guardado')).toBeVisible()

  await page.goto(SALES)
  // The backend's own business day, as the app shows it: the spec reads no clock.
  const me: { today: string } = await (await page.request.get('/auth/me')).json()
  const today = me.today
  const varieties: { id: number; name: string }[] = await (
    await page.request.get(`/varieties?on=${today}`)
  ).json()
  const jazmin = varieties.find((variety) => variety.name === 'Jazmín')
  if (jazmin === undefined) throw new Error('Jazmín missing from GET /varieties?on=')
  const saved = await page.request.post('/sales', {
    data: {
      date: today,
      customer_id: null,
      shipping_charged: 0,
      note: null,
      payment: 'cash',
      lines: [{ variety_id: jazmin.id, grams: '10', gift: false, special_price: null }],
    },
  })
  expect(saved.ok()).toBe(true)

  for (const phone of PHONES) {
    await page.setViewportSize({ width: phone.width, height: phone.height })
    await page.goto(SALES)
    const tabs = page.getByRole('group', { name: 'Period' })
    await expect(tabs.getByRole('button')).toHaveCount(4)

    const columns = await tabs
      .locator('.pestanas__celdas')
      .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length)
    expect([2, 4], `${phone.name}: tab columns`).toContain(columns)

    for (const tab of await tabs.getByRole('button').all()) {
      const found = await box(tab)
      expect(found.height, `${phone.name}: tab height`).toBeGreaterThanOrEqual(TOUCH_TARGET)
      const clipped = await tab.evaluate((element) => element.scrollWidth > element.clientWidth)
      expect(clipped, `${phone.name}: tab clipped`).toBe(false)
      await expectInsideTheScreen(page, tab)
    }
    await expectNoSidewaysOverflow(page)

    await tabs.getByRole('button', { name: 'Dates' }).click()
    for (const label of ['From', 'To']) {
      const input = page.getByLabel(label, { exact: true })
      const found = await box(input)
      expect(found.height, `${phone.name}: ${label} height`).toBeGreaterThanOrEqual(TOUCH_TARGET)
      const fontSize = await input.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))
      expect(fontSize, `${phone.name}: ${label} font`).toBeGreaterThanOrEqual(MIN_INPUT_FONT)
      await expectInsideTheScreen(page, input)
    }
    await expectNoSidewaysOverflow(page)

    await tabs.getByRole('button', { name: 'Today' }).click()
    await page.locator('.fila-venta').first().click()
    await expect(page.getByRole('button', { name: 'Delete sale' })).toBeVisible()
    await expectNoSidewaysOverflow(page)
    const borrar = await box(page.getByRole('button', { name: 'Delete sale' }))
    expect(borrar.height, `${phone.name}: Delete sale`).toBeGreaterThanOrEqual(TOUCH_TARGET)

    await page.getByRole('button', { name: 'Delete sale' }).click()
    for (const name of ['Yes, delete it', 'No, keep it']) {
      const found = await box(page.getByRole('button', { name }))
      expect(found.height, `${phone.name}: ${name}`).toBeGreaterThanOrEqual(TOUCH_TARGET)
    }
    await page.getByRole('button', { name: 'No, keep it' }).click()
  }

  // The computer keeps the plain tab list, never the phone's grid.
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(SALES)
  await expect(page.getByRole('group', { name: 'Period' }).getByRole('button')).toHaveCount(4)
  await expect(page.locator('.pestanas__celdas')).toHaveCount(0)
})
