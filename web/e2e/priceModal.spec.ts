/**
 * The price form's modal on a computer, in a real browser: jsdom proves only
 * that the panes behind it carry `inert`; here Tab never reaches them and a click at a list
 * row's position does nothing. Each test signs up its own business and makes its own
 * variety (ADR-0040).
 */

import type { Page } from '@playwright/test'
import { VARIETIES, VARIETY, pathTo } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import { expectToast } from './helpers/toast.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { expectPath } from './helpers/url.js'

test.use({ viewport: { width: 1280, height: 720 } })

async function addVariety(page: Page, name: string): Promise<void> {
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'New variety' }).click()
  await page.getByPlaceholder('Variety name').fill(name)
  await expectToast(page, 'Variety saved', () => page.getByRole('button', { name: 'Add the variety' }).click())
}

/** Signs up, makes two varieties and opens "New price" of Rosa; returns Rosa's id. */
async function openPriceModal(page: Page): Promise<number> {
  await signUpNewBusiness(page)
  await addVariety(page, 'Lirio')
  await addVariety(page, 'Rosa')
  await page.locator('.variedades-paneles__lista').getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('link', { name: 'New price' }).click()
  await expect(page.getByRole('dialog', { name: 'New price' })).toBeVisible()
  // The host takes focus to the title once the form is there: its effects have run.
  await expect(page.locator('.gasto-form__titulo')).toBeFocused()
  const found = /\/varieties\/(\d+)\/prices\/new$/.exec(new URL(page.url()).pathname)
  if (found?.[1] === undefined) throw new Error(`no variety id in ${page.url()}`)
  return Number(found[1])
}

test('Tab cycled through the dialog never focuses anything in the list, the variety page or the side rail', async ({ page }) => {
  await openPriceModal(page)
  // The form kind's chrome: no side rail is drawn at all behind the modal.
  await expect(page.locator('nav.riel-lateral')).toHaveCount(0)

  for (let press = 0; press < 20; press++) {
    await page.keyboard.press('Tab')
    const outside = await page.evaluate(
      () => document.activeElement?.closest('.variedades-paneles__lista, .variedades-paneles__detalle, nav.riel-lateral') !== null,
    )
    expect(outside).toBe(false)
  }
})

test('a click at another variety\'s list row never opens it: it lands on the backdrop and closes to the open variety', async ({ page }) => {
  const id = await openPriceModal(page)
  const row = await page.locator('.variedades-paneles__lista a', { hasText: 'Lirio' }).boundingBox()
  if (row === null) throw new Error('no list row to click at')
  const x = row.x + row.width / 2
  const y = row.y + row.height / 2
  const reached = await page.evaluate(
    ([px, py]) => document.elementFromPoint(px ?? 0, py ?? 0)?.closest('.variedades-paneles__lista') !== null,
    [x, y],
  )
  expect(reached).toBe(false)

  await page.mouse.click(x, y)

  await expectPath(page, pathTo(VARIETY, { id }))
})

test('Escape on an untouched form returns to the variety page', async ({ page }) => {
  const id = await openPriceModal(page)

  await page.keyboard.press('Escape')

  await expectPath(page, pathTo(VARIETY, { id }))
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
