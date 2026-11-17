/**
 * The bottom-chrome helpers (`helpers/chrome.ts`, GH-727 part 2), in a real browser at a phone
 * width: the one module where the phone's bar and its New sale entry (the bar's +) are located.
 * On a tab root and on a card both exist and `bottomChromeTop` is the +'s top, above the bar's; on a
 * form neither does, the locator helpers count zero without throwing, and only `bottomChromeTop`
 * rejects.
 */

import { CUSTOMER, CUSTOMER_NEW, SALE_NEW } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import type { Page } from '@playwright/test'
import {
  NEW_SALE_BUTTON,
  anyNewSaleButton,
  bottomBar,
  bottomBarItems,
  bottomChromeTop,
  newSaleEntry,
  openNewSaleFromChrome,
} from './helpers/chrome.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { uniqueTag } from './helpers/unique.js'
import { expectPath } from './helpers/url.js'

test.use({ viewport: { width: 390, height: 700 } })

async function topOf(page: Page, selector: string): Promise<number> {
  return page.locator(selector).first().evaluate((element) => element.getBoundingClientRect().top)
}

test('on a tab root the bar and the + exist, and the chrome top is the + top above the bar', async ({
  page,
}) => {
  await signUpNewBusiness(page)

  await expect(bottomBar(page)).toHaveCount(1)
  await expect(bottomBar(page)).toBeVisible()
  await expect(bottomBarItems(page)).toHaveCount(4)
  await expect(newSaleEntry(page)).toHaveCount(1)
  await expect(newSaleEntry(page)).toBeVisible()
  await expect(anyNewSaleButton(page)).toHaveCount(1)
  // The same node: the entry found by role and name is also the one found by class.
  await expect(newSaleEntry(page).and(anyNewSaleButton(page))).toHaveCount(1)

  const top = await bottomChromeTop(page)
  const plusTop = await topOf(page, NEW_SALE_BUTTON)
  const barTop = await bottomBar(page).evaluate((bar) => bar.getBoundingClientRect().top)
  expect(Number.isFinite(top)).toBe(true)
  expect(top).toBeGreaterThan(0)
  expect(top).toBe(plusTop)
  expect(top).toBeLessThan(barTop)
})

test('on a card the bar and its + are the whole chrome, and the chrome top is the + top', async ({
  page,
}) => {
  await signUpNewBusiness(page)
  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Name', { exact: true }).fill(`Ficha ${uniqueTag()}`)
  await page.getByRole('button', { name: 'Save and use' }).click()
  await expectPath(page, CUSTOMER)

  await expect(bottomBar(page)).toBeVisible()
  await expect(bottomBarItems(page)).toHaveCount(4)
  await expect(newSaleEntry(page)).toHaveCount(1)
  await expect(anyNewSaleButton(page)).toHaveCount(1)
  const plusTop = await topOf(page, NEW_SALE_BUTTON)
  const barTop = await bottomBar(page).evaluate((bar) => bar.getBoundingClientRect().top)
  expect(await bottomChromeTop(page)).toBe(plusTop)
  expect(plusTop).toBeLessThan(barTop)
})

test('on a form there is no chrome: the locators count zero and only bottomChromeTop rejects', async ({
  page,
}) => {
  await signUpNewBusiness(page)
  await page.goto(SALE_NEW)
  await expectPath(page, SALE_NEW)

  await expect(bottomBar(page)).toHaveCount(0)
  await expect(bottomBarItems(page)).toHaveCount(0)
  await expect(newSaleEntry(page)).toHaveCount(0)
  await expect(anyNewSaleButton(page)).toHaveCount(0)
  await expect(bottomChromeTop(page)).rejects.toThrow('no bottom chrome is rendered')
})

test('openNewSaleFromChrome taps the bar\'s + and lands on New sale', async ({ page }) => {
  await signUpNewBusiness(page)
  await openNewSaleFromChrome(page)
  await expectPath(page, SALE_NEW)
})
