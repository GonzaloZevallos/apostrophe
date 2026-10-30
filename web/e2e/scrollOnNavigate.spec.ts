/**
 * Where the page is scrolled when the seller changes screen (GH-480, navigation.md criterion
 * 21, ADR-0065), measured as the real `window.scrollY` of a real browser at 320, 375 and 430 px
 * and on a computer (1280x800): `test-setup.ts` stubs `scrollTo` in the unit tests, so only this
 * spec can show it.
 *   - a tab or a list row into its detail opens the new screen at the top;
 *   - Back and the app's "‹" return a list to the offset it was left at, also through a tab
 *     in between (`history.go(-2)`);
 *   - Record payment opened from a scrolled list leaves the list where it is, on Close and on Back;
 *   - on a computer, picking a row in the two panes leaves the list where it is.
 * Roles, names, text and URLs only; every wait is a condition.
 */

import type { Locator, Page } from '@playwright/test'
import { CUSTOMER, CUSTOMERS, SALE, SALES } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import { expectLongPage, seedLongLists } from './helpers/scrollSeed.js'
import { expectPath } from './helpers/url.js'

const VIEWPORTS = [
  { name: '320 px phone', width: 320, height: 640 },
  { name: '375 px phone', width: 375, height: 667 },
  { name: '430 px phone', width: 430, height: 932 },
  { name: 'computer', width: 1280, height: 800 },
] as const

const scrollY = (page: Page): Promise<number> => page.evaluate(() => window.scrollY)

/** Scrolls the page down by a real amount and returns where it really is. */
async function scrollDown(page: Page): Promise<number> {
  await expectLongPage(page)
  await page.evaluate(() => window.scrollTo(0, 800))
  await expect.poll(() => scrollY(page)).toBeGreaterThan(300)
  return scrollY(page)
}

async function expectScrolledTo(page: Page, offset: number): Promise<void> {
  await expect.poll(async () => Math.abs((await scrollY(page)) - offset)).toBeLessThanOrEqual(2)
}

async function expectAtTop(page: Page): Promise<void> {
  await expect.poll(() => scrollY(page)).toBe(0)
}

/** A click that does not scroll the page to the control first (a real click would). */
function tap(control: Locator): Promise<void> {
  return control.evaluate((element) => {
    if (element instanceof HTMLElement) element.click()
  })
}

const tab = (page: Page, name: string): Locator =>
  page.getByRole('navigation', { name: 'Navigation' }).getByRole('link', { name }).first()

const backToSales = (page: Page): Locator =>
  page.getByRole('link', { name: 'Back to Sales' }).or(page.getByRole('button', { name: 'Back to Sales' }))

for (const viewport of VIEWPORTS) {
  const computer = viewport.width >= 900

  test.describe(`Scroll on a change of screen on a ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('a tab and a list row into its detail open the new screen at the top', async ({ page }) => {
      await seedLongLists(page)

      await page.goto(CUSTOMERS)
      await expect(page.getByRole('link', { name: /Zeta 40/ }).first()).toBeVisible()
      await scrollDown(page)
      await tab(page, 'Sales').click()
      await expectPath(page, SALES)
      await expectAtTop(page)

      await expect(page.getByRole('link', { name: /Zeta 20/ }).first()).toBeVisible()
      await scrollDown(page)
      await tap(page.getByRole('link', { name: /Zeta 20/ }).first())
      await expectPath(page, SALE)
      await expectAtTop(page)
    })

    test('the browser Back and the "‹" by history return the list to its offset', async ({ page }) => {
      await seedLongLists(page)

      await page.goto(SALES)
      await expect(page.getByRole('link', { name: /Zeta 20/ }).first()).toBeVisible()
      const offset = await scrollDown(page)
      await tap(page.getByRole('link', { name: /Zeta 20/ }).first())
      await expectPath(page, SALE)
      await expectAtTop(page)

      await page.goBack()
      await expectPath(page, SALES)
      await expectScrolledTo(page, offset)

      await tap(page.getByRole('link', { name: /Zeta 20/ }).first())
      await expectPath(page, SALE)
      await backToSales(page).click()
      await expectPath(page, SALES)
      await expectScrolledTo(page, offset)
    })

    test('Customers, a detail, the Customers tab, then two steps back returns the original offset', async ({ page }) => {
      await seedLongLists(page)

      await page.goto(CUSTOMERS)
      await expect(page.getByRole('link', { name: /Zeta 40/ }).first()).toBeVisible()
      const offset = await scrollDown(page)
      await tap(page.getByRole('link', { name: /Zeta 20/ }).first())
      await expectPath(page, CUSTOMER)
      await tab(page, 'Customers').click()
      await expectPath(page, CUSTOMERS)

      await page.evaluate(() => window.history.go(-2))
      await expectPath(page, CUSTOMERS)
      await expectScrolledTo(page, offset)
    })

    test('Record payment from a scrolled list leaves the list where it is, on Close and on Back', async ({ page }) => {
      await seedLongLists(page)

      await page.goto(CUSTOMERS)
      const opener = page
        .getByRole('region', { name: 'Everyone · A–Z' })
        .getByRole('link', { name: 'Collect from Zeta 30' })
      await expect(opener).toBeVisible()
      await opener.scrollIntoViewIfNeeded()
      const offset = await scrollY(page)
      expect(offset, 'the list is scrolled').toBeGreaterThan(300)
      await opener.click()
      const dialog = page.getByRole('dialog', { name: 'Record payment' })
      await expect(dialog).toBeVisible()
      await expectScrolledTo(page, offset)

      await dialog.getByRole('button', { name: 'Close' }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expectPath(page, CUSTOMERS)
      await expectScrolledTo(page, offset)

      await opener.click()
      await expect(page.getByRole('dialog', { name: 'Record payment' })).toBeVisible()
      await page.goBack()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expectPath(page, CUSTOMERS)
      await expectScrolledTo(page, offset)
    })

    if (computer) {
      test('picking a row in the two panes leaves the list where it is', async ({ page }) => {
        await seedLongLists(page)

        await page.goto(CUSTOMERS)
        await expect(page.getByRole('link', { name: /Zeta 40/ }).first()).toBeVisible()
        const offset = await scrollDown(page)
        await tap(page.getByRole('link', { name: /Zeta 35/ }).first())
        await expectPath(page, CUSTOMER)
        await expectScrolledTo(page, offset)
      })
    }
  })
}
