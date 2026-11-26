/**
 * On a computer the offline notice sits in the content column, above the screen's title, and
 * pushes the screen down (GH-1073). Measured in a real browser: jsdom lays nothing out.
 *
 * The notice is never put back in the toasts' fixed layer to satisfy a locator (owner rule
 * D-69509906); these checks read where it really is. The page loads online first and goes
 * offline after, so the notice appears the way a dropped connection shows it.
 */

import { expect, test } from './fixtures.js'
import type { Page } from '@playwright/test'
import { watchConsole } from './console.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { uniqueTag } from './helpers/unique.js'
import { expectPath } from './helpers/url.js'
import { LOGIN, SALE_NEW, SALES } from '../src/routes.js'

const NOTICE = '.aviso-sin-conexion'
const COLUMN = '.columna-principal'
const TOASTS = '.aviso-flotante'

const COMPUTERS = [
  { name: '900x800', width: 900, height: 800 },
  { name: '1280x900', width: 1280, height: 900 },
] as const

interface Box {
  top: number
  left: number
  right: number
  bottom: number
}

async function box(page: Page, selector: string): Promise<Box> {
  return page.locator(selector).first().evaluate((element) => {
    const { top, left, right, bottom } = element.getBoundingClientRect()
    return { top, left, right, bottom }
  })
}

for (const viewport of COMPUTERS) {
  test(`on a computer at ${viewport.name} the offline notice sits above the title, inside the column, and the rail stays tappable`, async ({
    page,
  }) => {
    const consoleMessages: string[] = []
    watchConsole(page, consoleMessages)

    await page.setViewportSize(viewport)
    await signUpNewBusiness(page, {
      businessName: `Flores sin Red ${uniqueTag()}`,
      email: `duena-sin-red-${uniqueTag()}@example.com`,
    })
    await page.goto(SALES)
    const title = page.locator('.encabezado__titulo', { hasText: 'Sales' })
    await expect(title).toBeVisible()

    await page.context().setOffline(true)
    await expect(page.locator(NOTICE)).toBeVisible()
    await expect(page.locator(NOTICE)).toHaveCount(1)

    const notice = await box(page, NOTICE)
    const header = await title.evaluate((element) => {
      // On a computer `.cabecera-fila--envoltura` dissolves (`display: contents`) and has no box
      // of its own, so the title row's top is then the title's.
      const row = element.closest('.cabecera-fila')?.getBoundingClientRect()
      return row !== undefined && row.height > 0 ? row.top : element.getBoundingClientRect().top
    })
    expect(notice.bottom, 'the notice ends at or above the title row').toBeLessThanOrEqual(header)

    const column = await box(page, COLUMN)
    expect(notice.left, 'notice left inside the column').toBeGreaterThanOrEqual(column.left)
    expect(notice.right, 'notice right inside the column').toBeLessThanOrEqual(column.right)
    expect(await page.locator(NOTICE).evaluate((element, toasts) => element.closest(toasts) === null, TOASTS)).toBe(true)

    const newSale = page.getByRole('navigation', { name: 'Navigation' }).getByRole('link', { name: 'New sale' })
    await expect(newSale).toBeVisible()
    const reached = await newSale.evaluate((link) => {
      const { left, top, width, height } = link.getBoundingClientRect()
      const hit = document.elementFromPoint(left + width / 2, top + height / 2)
      return hit !== null && link.contains(hit)
    })
    expect(reached, 'the rail New sale is not covered').toBe(true)

    await newSale.click()
    await expectPath(page, SALE_NEW)
    await expect(page.locator('.encabezado-fila')).toBeVisible()

    await page.context().setOffline(false)
    expect(consoleMessages).toEqual([])
  })
}

test('with no Shell on a computer the offline notice is a row above the sign-in column, outside the toasts', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(LOGIN)
  await expect(page.locator('.brand-mark--lockup')).toBeVisible()

  await page.context().setOffline(true)
  await expect(page.locator(NOTICE)).toBeVisible()
  await expect(page.locator(NOTICE)).toHaveCount(1)
  expect(await page.locator(NOTICE).evaluate((element, toasts) => element.closest(toasts) === null, TOASTS)).toBe(true)

  const notice = await box(page, NOTICE)
  const lockup = await box(page, '.brand-mark--lockup')
  expect(notice.bottom, 'the notice ends above the sign-in column').toBeLessThanOrEqual(lockup.top)

  await page.context().setOffline(false)
})
