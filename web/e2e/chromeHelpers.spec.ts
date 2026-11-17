/**
 * The bottom-chrome helpers (`helpers/chrome.ts`, GH-727 part 2), in a real browser at a phone
 * width: the one module where the phone's bar and the floating New sale entry are located.
 * On a tab root both exist and `bottomChromeTop` is the group's top, above the bar's; on a card
 * only the bar does; on a form neither does, the locator helpers count zero without throwing, and
 * only `bottomChromeTop` rejects.
 */

import { CUSTOMER, CUSTOMER_NEW, SALE_NEW } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import type { Page } from '@playwright/test'
import {
  NEW_SALE_GROUP,
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

test('on a tab root the bar and the floating entry exist, and the chrome top is the group top above the bar', async ({
  page,
}) => {
  await signUpNewBusiness(page)

  await expect(bottomBar(page)).toHaveCount(1)
  await expect(bottomBar(page)).toBeVisible()
  expect(await bottomBarItems(page).count()).toBeGreaterThanOrEqual(1)
  await expect(newSaleEntry(page)).toHaveCount(1)
  await expect(newSaleEntry(page)).toBeVisible()
  await expect(anyNewSaleButton(page)).toHaveCount(1)
  // The same node: the group-qualified entry is also the one unqualified button.
  await expect(newSaleEntry(page).and(anyNewSaleButton(page))).toHaveCount(1)

  const top = await bottomChromeTop(page)
  const groupTop = await topOf(page, `${NEW_SALE_GROUP} > *`)
  const barTop = await bottomBar(page).evaluate((bar) => bar.getBoundingClientRect().top)
  expect(Number.isFinite(top)).toBe(true)
  expect(top).toBeGreaterThan(0)
  expect(top).toBe(groupTop)
  expect(top).toBeLessThan(barTop)
})

test('on a card the bar is the whole chrome: no floating entry, and the chrome top is the bar top', async ({
  page,
}) => {
  await signUpNewBusiness(page)
  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Name', { exact: true }).fill(`Ficha ${uniqueTag()}`)
  await page.getByRole('button', { name: 'Save and use' }).click()
  await expectPath(page, CUSTOMER)

  await expect(bottomBar(page)).toBeVisible()
  await expect(newSaleEntry(page)).toHaveCount(0)
  await expect(anyNewSaleButton(page)).toHaveCount(0)
  const barTop = await bottomBar(page).evaluate((bar) => bar.getBoundingClientRect().top)
  expect(await bottomChromeTop(page)).toBe(barTop)
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

test('openNewSaleFromChrome taps the floating entry and lands on New sale', async ({ page }) => {
  await signUpNewBusiness(page)
  await openNewSaleFromChrome(page)
  await expectPath(page, SALE_NEW)
})
