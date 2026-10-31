/**
 * Where the page is scrolled when the seller changes screen (GH-480, navigation.md criteria
 * 21-23, ADR-0068), measured as the real `window.scrollY` of a real browser at 320, 375 and 430
 * px and on a computer (1280x800). `test-setup.ts` stubs `scrollTo` in the unit tests, so only
 * this spec can show what the page really does.
 *   - 21: a tab, a row into its detail and "+ New sale" open the new screen at the top.
 *   - 22: Back and "‹" by history, and "Close" of a form opened inside the app, return the screen
 *     to the offset it was left at, also when its content arrives late.
 *   - 23: opening and closing a sheet never moves the page under it. Record payment, opened from
 *     a scrolled Customers list and from a scrolled Home, returns to that offset after Close,
 *     after Back and after a save; on a computer, Customers also keeps its offset while the modal
 *     is open (Home's picture behind the modal is not held to an offset: PM, round 3).
 * Roles, names, text and URLs only.
 */

import type { Locator, Page } from '@playwright/test'
import { CUSTOMERS, EXPENSES, HOME, SALE, SALES, SALE_NEW, VARIETIES } from '../src/routes.js'
import { expect, test, withToastRecorder } from './fixtures.js'
import { seedLongExpenses, seedLongLists, seedLongVarieties } from './helpers/scrollSeed.js'
import { expectToast } from './helpers/toast.js'
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
  expect(reached, 'the page is long enough to scroll').toBeGreaterThan(300)
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

const rowOfSale = (page: Page): Locator => page.getByRole('link', { name: /Zeta 20/ }).first()

const backToSales = (page: Page): Locator => page.getByRole('button', { name: '‹ Sales' })

const newSale = (page: Page): Locator => page.getByRole('link', { name: 'New sale', exact: true }).first()

/** Two animation frames: whatever a frame callback was going to do has been done. */
function twoFrames(page: Page): Promise<void> {
  return page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  )
}

/** Holds the Sales list's own request (not the page's) until `release` is called. */
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

const COLLECT = /^Collect from /

// One business, seeded once for the whole file (signing up and 40 customers per test took the
// run past the gate's 1500 s): the cases leave the lists as they found them, bar the debts the
// Record payment saves clear. Every viewport reuses the one page and resizes it.
let page: Page

test.describe.serial('Scroll on a change of screen', () => {
  test.beforeAll(async ({ browser, workerServer }) => {
    test.setTimeout(300_000)
    page = await (
      await withToastRecorder(browser.newContext({ baseURL: workerServer.url, viewport: VIEWPORTS[0] }))
    ).newPage()
    await seedLongLists(page)
    await seedLongVarieties(page)
    await seedLongExpenses(page)
  })

  test.afterAll(async () => {
    await page.context().close()
  })

  for (const viewport of VIEWPORTS) {
    const computer = viewport.width >= 900

    test.describe(`on a ${viewport.name}`, () => {
      test.beforeEach(async () => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
      })

      test('a tab, a list row and "+ New sale" open the new screen at the top', async () => {
        await page.goto(CUSTOMERS)
        await expect(page.getByRole('link', { name: /Zeta 40/ }).first()).toBeVisible()
        await scrollDown(page)
        await tab(page, 'Sales').click()
        await expectPath(page, SALES)
        await expectAtTop(page)

        await expect(rowOfSale(page)).toBeVisible()
        await scrollDown(page)
        await tap(rowOfSale(page))
        await expectPath(page, SALE)
        await expectAtTop(page)

        await page.goto(CUSTOMERS)
        await expect(page.getByRole('link', { name: /Zeta 40/ }).first()).toBeVisible()
        await scrollDown(page)
        await tap(newSale(page))
        await expectPath(page, SALE_NEW)
        await expectAtTop(page)
      })

      test('Back and "‹" return the Sales list to its offset', async () => {
        await page.goto(SALES)
        await expect(rowOfSale(page)).toBeVisible()
        const offset = await scrollDown(page)
        await tap(rowOfSale(page))
        await expectPath(page, SALE)
        await expectAtTop(page)

        await page.goBack()
        await expectPath(page, SALES)
        await expectScrolledTo(page, offset)

        await tap(rowOfSale(page))
        await expectPath(page, SALE)
        await expectAtTop(page)
        await backToSales(page).click()
        await expectPath(page, SALES)
        await expectScrolledTo(page, offset)
      })

      test('Back with the Sales list still loading waits for its content, then restores', async () => {
        await page.goto(SALES)
        await expect(rowOfSale(page)).toBeVisible()
        const offset = await scrollDown(page)
        await tap(rowOfSale(page))
        await expectPath(page, SALE)

        const release = await holdSalesRequest(page)
        try {
          await page.goBack()
          await expectPath(page, SALES)
          await twoFrames(page)
        } finally {
          release()
          await page.unroute((url) => url.pathname === SALES)
        }
        await expect(rowOfSale(page)).toBeVisible()
        await expectScrolledTo(page, offset)
      })

      test('"Close" of New sale, opened from a scrolled Customers list, returns to that offset', async () => {
        await page.goto(CUSTOMERS)
        await expect(page.getByRole('link', { name: /Zeta 40/ }).first()).toBeVisible()
        const offset = await scrollDown(page)
        await tap(newSale(page))
        await expectPath(page, SALE_NEW)
        await expectAtTop(page)

        await page.getByRole('button', { name: 'Close' }).click()
        await expectPath(page, CUSTOMERS)
        await expectScrolledTo(page, offset)
      })

      test('a sheet over a scrolled list opens and closes without moving the page', async () => {
        // A phone edits an expense in a sheet on Expenses with no route of its own; a computer
        // opens a variety's price in a modal over Varieties. The page under either keeps its place.
        const sheet = page.getByRole('dialog', { name: computer ? 'New price' : 'Edit expense' })
        if (computer) {
          await page.goto(VARIETIES)
          await expect(page.getByRole('link', { name: /Tulipan 40/ })).toBeVisible()
        } else {
          await page.goto(EXPENSES)
          await expect(page.getByRole('button', { name: /Gasto 25/ })).toBeVisible()
        }
        const offset = await scrollDown(page)
        await tap(computer ? page.getByRole('link', { name: 'New price' }).first() : page.getByRole('button', { name: /Gasto 25/ }))
        await expect(sheet).toBeVisible()
        // The picture a computer's modal covers is inert and re-renders as the detail beside the
        // list changes (the browser keeps its content in place: PM, round 3), so only a phone's
        // in-page sheet is held to the offset while it is open; both are, once closed.
        if (!computer) await expectScrolledTo(page, offset)
        await sheet.getByRole('button', { name: 'Close' }).click()
        await expect(page.getByRole('dialog')).toHaveCount(0)
        await expectScrolledTo(page, offset)
      })

      for (const origin of ['Customers', 'Home'] as const) {
        test(`Record payment opened from a scrolled ${origin}: Close, Back and a save return to its offset`, async () => {
          const path = origin === 'Home' ? HOME : CUSTOMERS
          const opener = (): Locator => page.getByRole('link', { name: COLLECT }).first()
          const dialog = page.getByRole('dialog', { name: 'Record payment' })

          async function openScrolled(): Promise<number> {
            await page.goto(path)
            await expect(opener()).toBeVisible()
            if (origin === 'Home') await expect(page.getByText('Tulipan 40', { exact: true })).toBeVisible()
            const offset = await scrollDown(page)
            await tap(opener())
            await expect(dialog).toBeVisible()
            if (computer && origin === 'Customers') await expectScrolledTo(page, offset)
            return offset
          }

          let offset = await openScrolled()
          await dialog.getByRole('button', { name: 'Close' }).click()
          await expectPath(page, path)
          await expect(page.getByRole('dialog')).toHaveCount(0)
          await expectScrolledTo(page, offset)

          // The same screen, as left: open again and use the browser's Back.
          await tap(opener())
          await expect(dialog).toBeVisible()
          await page.goBack()
          await expectPath(page, path)
          await expect(page.getByRole('dialog')).toHaveCount(0)
          await expectScrolledTo(page, offset)

          // A save: the whole debt of the first debtor.
          offset = await openScrolled()
          await page.getByRole('button', { name: /^All: / }).click()
          await page.getByRole('radio', { name: 'Cash' }).check()
          await expectToast(page, 'Payment saved', () => page.getByRole('button', { name: 'Save' }).click())
          await expectPath(page, path)
          await expect(page.getByRole('dialog')).toHaveCount(0)
          await expectScrolledTo(page, offset)
        })
      }
    })
  }
})
