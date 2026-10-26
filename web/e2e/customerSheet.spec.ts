/**
 * The customer form as a sheet on a phone (ADR-0053): a direct address opens it over its parent
 * (new over Customers, edit over the customer's card), focus is in the first field, and Save sits
 * at the bottom of the sheet within the bottom inset. Roles, names, text and URLs only.
 */

import type { Page } from '@playwright/test'
import { CUSTOMER, CUSTOMER_EDIT, CUSTOMER_NEW, CUSTOMERS, pathTo } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { expectPath } from './helpers/url.js'

test.use({ viewport: { width: 390, height: 844 } })

/** Signs up and registers "Carla Cobrar"; returns her card's id from the URL. */
async function makeCustomer(page: Page): Promise<string> {
  await signUpNewBusiness(page)
  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Name').fill('Carla Cobrar')
  await page.getByRole('button', { name: 'Save and use' }).click()
  await expectPath(page, CUSTOMER)
  const id = /\/customers\/(\d+)/.exec(page.url())?.[1]
  if (id === undefined) throw new Error('no customer id in the URL')
  return id
}

async function expectActionAtTheBottom(page: Page, dialogName: string): Promise<void> {
  const dialog = page.getByRole('dialog', { name: dialogName })
  const save = dialog.getByRole('button', { name: 'Save and use' })
  await expect(save).toBeInViewport()
  // `.sheet__actions` ends at the sheet's bottom, and its own padding (one spacing step plus
  // `--inset-abajo`) is all that lies between the action and that edge.
  const padding = await page
    .locator('.sheet__actions')
    .evaluate((element) => parseFloat(getComputedStyle(element).paddingBottom))
  const sheet = await page.locator('main.sheet').boundingBox()
  const action = await save.boundingBox()
  if (sheet === null || action === null) throw new Error('no box')
  const gap = sheet.y + sheet.height - (action.y + action.height)
  expect(Math.abs(gap - padding)).toBeLessThanOrEqual(1)
}

test('a direct address to New customer opens the sheet over Customers, focus in Name', async ({ page }) => {
  await signUpNewBusiness(page)
  await page.goto(CUSTOMER_NEW)

  const dialog = page.getByRole('dialog', { name: 'New customer' })
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Name' })).toBeFocused()
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible()
  await expect(page.locator('.behind-pane')).toBeAttached()
  await expect(page.locator('.behind-pane')).toHaveAttribute('inert', '')
  await expectActionAtTheBottom(page, 'New customer')
})

test('a direct address to Edit customer opens the sheet over the card, focus in Name', async ({ page }) => {
  const id = await makeCustomer(page)
  await page.goto(pathTo(CUSTOMER_EDIT, { id }))

  await expect(page.getByRole('dialog', { name: 'Edit customer' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Name' })).toBeFocused()
  await expect(page.locator('.behind-pane')).toContainText('Carla Cobrar')
  await expectActionAtTheBottom(page, 'Edit customer')
})

test('Close from a scrolled Customers list returns to it at the same scroll position', async ({ page }) => {
  await signUpNewBusiness(page)
  for (let index = 1; index <= 30; index += 1) {
    const created = await page.request.post('/customers', {
      data: { name: `Zeta ${String(index).padStart(2, '0')}`, phone: null, vip: false },
    })
    expect(created.ok()).toBe(true)
  }
  await page.goto(CUSTOMERS)
  await expect(page.getByRole('link', { name: /Zeta 30/ })).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 700))
  const before = await page.evaluate(() => window.scrollY)
  expect(before).toBeGreaterThan(300)

  // A synthetic click: the link is at the top of the page, and a real click would scroll to it.
  await page.getByRole('link', { name: 'New customer' }).dispatchEvent('click')
  await expect(page.getByRole('dialog', { name: 'New customer' })).toBeVisible()
  // The page behind is held where it was while the sheet is open.
  expect(await page.evaluate(() => window.scrollY)).toBe(before)

  await page.getByRole('button', { name: 'Close' }).click()
  await expectPath(page, CUSTOMERS)
  await expect(page.getByRole('link', { name: /Zeta 30/ })).toBeAttached()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before)
})
