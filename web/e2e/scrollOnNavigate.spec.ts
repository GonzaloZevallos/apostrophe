/**
 * Where the page is scrolled when the seller changes screen (GH-480, navigation.md criteria
 * 21-23, ADR-0063), measured as the real `window.scrollY` of a real browser at 320, 375 and 430
 * px and on a computer (1280x800); `test-setup.ts` stubs `scrollTo` in the unit tests, so only
 * this spec can show it.
 *   - 21: a tab or a row into a detail opens the new screen at the top.
 *   - 22: Back, "‹" by history and Forward return a screen to the offset it was left at, also
 *     when its content arrives late; a reload forgets the offsets, and later ones are recorded
 *     again.
 *   - 23: opening and closing a sheet, an overlay or a dialog never moves the page under it;
 *     neither does a re-tap of the active tab, or picking a row in the computer's two panes.
 * Roles, names, text and URLs only.
 */

import type { Locator, Page } from '@playwright/test'
import {
  CUSTOMER,
  CUSTOMERS,
  EXPENSES,
  HOME,
  SALE,
  SALES,
  SALE_NEW,
  SETTINGS_ACCOUNT,
  SETTINGS_APPEARANCE,
  SETTINGS_BUSINESS,
  SETTINGS_USERS,
  VARIETIES,
  VARIETY,
  pathTo,
} from '../src/routes.js'
import { expect, test } from './fixtures.js'
import { seedLongExpenses, seedLongHistory, seedLongLists, seedLongVarieties } from './helpers/scrollSeed.js'
import { expectPath } from './helpers/url.js'

const VIEWPORTS = [
  { name: '320 px phone', width: 320, height: 640 },
  { name: '375 px phone', width: 375, height: 667 },
  { name: '430 px phone', width: 430, height: 932 },
  { name: 'computer', width: 1280, height: 800 },
] as const

/** How far a page is scrolled for a case: well past the first screen of every viewport above. */
const FAR = 800

const scrollY = (page: Page): Promise<number> => page.evaluate(() => window.scrollY)

/** Scrolls the page down, and returns where it really is (a page that cannot scroll fails here). */
async function scrollDown(page: Page): Promise<number> {
  await page.evaluate((top) => window.scrollTo(0, top), FAR)
  const reached = await scrollY(page)
  expect(reached, 'the list is long enough to scroll').toBeGreaterThan(300)
  return reached
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

/** Two animation frames: whatever a frame callback was going to do has been done. */
function twoFrames(page: Page): Promise<void> {
  return page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  )
}

/** Holds the list's own request (not the page's) until `release` is called. */
async function holdSalesRequest(page: Page): Promise<() => void> {
  let release: () => void = () => undefined
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(
    (url) => url.pathname === SALES,
    async (route) => {
      if (route.request().resourceType() === 'fetch') await released
      await route.continue()
    },
  )
  return release
}

for (const viewport of VIEWPORTS) {
  const computer = viewport.width >= 900

  test.describe(`Scroll on a change of screen on a ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('a tab and a list row open the new screen at the top', async ({ page }) => {
      await seedLongLists(page)

      await page.goto(CUSTOMERS)
      await expect(page.getByRole('link', { name: /Zeta 40/ }).first()).toBeVisible()
      await scrollDown(page)
      await tab(page, 'Sales').click()
      await expectPath(page, SALES)
      await expectAtTop(page)

      await expect(page.getByRole('link', { name: /Zeta 20/ }).first()).toBeVisible()
      await scrollDown(page)
      await page.getByRole('link', { name: /Zeta 20/ }).first().click()
      await expectPath(page, SALE)
      await expectAtTop(page)
    })

    test('Back and "‹" by history return the list to its offset, and Forward opens the detail where it was', async ({
      page,
    }) => {
      await seedLongLists(page)

      await page.goto(SALES)
      await expect(page.getByRole('link', { name: /Zeta 20/ }).first()).toBeVisible()
      const listOffset = await scrollDown(page)
      await tap(page.getByRole('link', { name: /Zeta 20/ }).first())
      await expectPath(page, SALE)
      await expectAtTop(page)

      await page.goBack()
      await expectPath(page, SALES)
      await expectScrolledTo(page, listOffset)

      await page.goForward()
      await expectPath(page, SALE)
      await expectAtTop(page)

      await backToSales(page).click()
      await expectPath(page, SALES)
      await expectScrolledTo(page, listOffset)
    })

    test('Back returns Home to its offset', async ({ page }) => {
      await seedLongLists(page)

      await page.goto(HOME)
      await expect(page.getByRole('link', { name: /Collect from Zeta 40/ })).toBeVisible()
      const homeOffset = await scrollDown(page)
      await tab(page, 'Sales').click()
      await expectPath(page, SALES)
      await expectAtTop(page)

      await page.goBack()
      await expectPath(page, HOME)
      await expectScrolledTo(page, homeOffset)

      await page.goForward()
      await expectPath(page, SALES)
      await expectAtTop(page)
    })

    test('Back and Forward return a scrolled customer card and a scrolled list to where each was left', async ({
      page,
    }) => {
      await seedLongLists(page)
      const historia = await seedLongHistory(page)

      await page.goto(pathTo(CUSTOMER, { id: historia }))
      await expect(page.getByText('Historia').first()).toBeVisible()
      const cardOffset = await scrollDown(page)
      await tab(page, 'Sales').click()
      await expectPath(page, SALES)
      await expectAtTop(page)
      await expect(page.getByRole('link', { name: /Zeta 20/ }).first()).toBeVisible()
      const listOffset = await scrollDown(page)

      await page.goBack()
      await expectPath(page, CUSTOMER)
      await expectScrolledTo(page, cardOffset)

      await page.goForward()
      await expectPath(page, SALES)
      await expectScrolledTo(page, listOffset)
    })

    test('tapping the active tab again leaves the page where it is', async ({ page }) => {
      await seedLongLists(page)

      await page.goto(SALES)
      await expect(page.getByRole('link', { name: /Zeta 20/ }).first()).toBeVisible()
      const offset = await scrollDown(page)
      await tab(page, 'Sales').click()
      await expectPath(page, SALES)
      await twoFrames(page)
      await expectScrolledTo(page, offset)
    })

    test('Back with the list still loading ends at the saved offset; a move made meanwhile is not dragged', async ({
      page,
    }) => {
      await seedLongLists(page)

      await page.goto(SALES)
      await expect(page.getByRole('link', { name: /Zeta 20/ }).first()).toBeVisible()
      const offset = await scrollDown(page)
      await tap(page.getByRole('link', { name: /Zeta 20/ }).first())
      await expectPath(page, SALE)

      const release = await holdSalesRequest(page)
      await page.goBack()
      await expectPath(page, SALES)
      release()
      await expectScrolledTo(page, offset)

      // The same Back, but the seller moves on before the list arrives: the late content does not
      // drag the new screen to the old offset.
      await tap(page.getByRole('link', { name: /Zeta 20/ }).first())
      await expectPath(page, SALE)
      const releaseAgain = await holdSalesRequest(page)
      await page.goBack()
      await tab(page, 'Customers').click()
      await expectPath(page, CUSTOMERS)
      releaseAgain()
      await twoFrames(page)
      await expectAtTop(page)
    })

    test('a reload forgets the offsets; Back then opens at the top and later offsets are recorded again', async ({
      page,
    }) => {
      await seedLongLists(page)

      await page.goto(SALES)
      await expect(page.getByRole('link', { name: /Zeta 20/ }).first()).toBeVisible()
      await scrollDown(page)
      await tap(page.getByRole('link', { name: /Zeta 20/ }).first())
      await expectPath(page, SALE)

      await page.reload()
      await expectPath(page, SALE)
      await page.goBack()
      await expectPath(page, SALES)
      await expect(page.getByRole('link', { name: /Zeta 20/ }).first()).toBeVisible()
      await expectAtTop(page)

      const later = await scrollDown(page)
      await page.goForward()
      await expectPath(page, SALE)
      await page.goBack()
      await expectPath(page, SALES)
      await expectScrolledTo(page, later)
    })

    test('Record payment: Back from it returns to the offset the payment hand-off saved', async ({ page }) => {
      await seedLongLists(page)

      await page.goto(CUSTOMERS)
      const opener = page.getByRole('link', { name: 'Collect from Zeta 30' })
      await expect(opener).toBeVisible()
      await opener.scrollIntoViewIfNeeded()
      const offset = await scrollY(page)
      expect(offset, 'the list is long enough to scroll').toBeGreaterThan(300)
      await opener.click()
      await expect(page.getByRole('dialog', { name: 'Record payment' })).toBeVisible()
      await expectScrolledTo(page, offset)

      await page.goBack()
      await expectPath(page, CUSTOMERS)
      await expect(page.getByRole('dialog')).toHaveCount(0)
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
        await twoFrames(page)
        await expectScrolledTo(page, offset)
      })

      test('the price modal opens and closes without moving the page under it', async ({ page }) => {
        await seedLongLists(page)
        await seedLongVarieties(page)

        await page.goto(VARIETIES)
        await expectPath(page, VARIETY)
        await expect(page.getByRole('link', { name: /Tulipan 40/ })).toBeVisible()
        const offset = await scrollDown(page)
        await tap(page.getByRole('link', { name: 'New price' }).first())
        const dialog = page.getByRole('dialog')
        await expect(dialog).toBeVisible()
        await expectScrolledTo(page, offset)

        await dialog.getByRole('button', { name: 'Close' }).click()
        await expect(page.getByRole('dialog')).toHaveCount(0)
        await expectScrolledTo(page, offset)
      })

      test('a whole-width form opens at the top with the focused control in view', async ({ page }) => {
        await seedLongLists(page)

        await page.goto(CUSTOMERS)
        await expect(page.getByRole('link', { name: /Zeta 40/ }).first()).toBeVisible()
        await scrollDown(page)
        await page.getByRole('link', { name: 'New sale' }).first().click()
        await expectPath(page, SALE_NEW)
        await expectAtTop(page)
        await expect(page.locator(':focus')).toBeInViewport()
      })
    } else {
      test('a routed sheet and an in-page sheet open and close without moving the page under them', async ({
        page,
      }) => {
        await seedLongLists(page)
        await seedLongExpenses(page)

        // Routed: New customer is a sheet over Customers.
        await page.goto(CUSTOMERS)
        await expect(page.getByRole('link', { name: /Zeta 40/ }).first()).toBeVisible()
        const customersOffset = await scrollDown(page)
        await tap(page.getByRole('link', { name: 'New customer' }))
        const routed = page.getByRole('dialog', { name: 'New customer' })
        await expect(routed).toBeVisible()
        await expectScrolledTo(page, customersOffset)
        await routed.getByRole('button', { name: 'Close' }).click()
        await expect(page.getByRole('dialog')).toHaveCount(0)
        await expectPath(page, CUSTOMERS)
        await expectScrolledTo(page, customersOffset)

        // In-page: editing an expense is a sheet on Expenses with no route of its own.
        await page.goto(EXPENSES)
        await expect(page.getByRole('button', { name: /Gasto 25/ })).toBeVisible()
        const expensesOffset = await scrollDown(page)
        await tap(page.getByRole('button', { name: /Gasto 25/ }))
        const inPage = page.getByRole('dialog', { name: 'Edit expense' })
        await expect(inPage).toBeVisible()
        await expectScrolledTo(page, expensesOffset)
        await inPage.getByRole('button', { name: 'Close' }).click()
        await expect(page.getByRole('dialog')).toHaveCount(0)
        await expectScrolledTo(page, expensesOffset)
      })

      test('the settings groups are sheets on a phone, so they keep the page they open over', async ({ page }) => {
        await seedLongLists(page)
        for (const group of [SETTINGS_BUSINESS, SETTINGS_USERS, SETTINGS_APPEARANCE, SETTINGS_ACCOUNT]) {
          await page.goto(group)
          await expect(page.getByRole('dialog'), group).toBeVisible()
        }
      })
    }
  })
}
