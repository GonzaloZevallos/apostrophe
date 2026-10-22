/**
 * GH-54's own end-to-end run (plan, "Subtasks: front"): a customer without a phone
 * number is a normal customer, proven against the real backend, through the built
 * front alone — never a mock of either side.
 *
 * Depends on `customers-backend`: this branch is rebased onto it (plan, "Order":
 * "Merge only after `customers-backend` is approved: rebase onto it, with the
 * end-to-end spec below green against the real backend"), so this spec runs
 * against the real optional-phone domain, API and migration. What proves it
 * green is `web-e2e`'s own run, not a claim in this comment.
 *
 * Covers the PRD's own lifecycle for a customer with no number: registered, edited,
 * found by name, chosen for a sale left owing, paid through Registrar cobro, and
 * shown in Te deben — plus a new no-number customer created from Pick a customer
 * and sold to (its duration is not measured, docs/adr/0038), and that nothing personal reaches the console or the
 * browser's own storage.
 */

import { CUSTOMER, CUSTOMERS, CUSTOMER_NEW, SALE, SALE_NEW, VARIETIES } from '../src/routes.js'
import type { Locator, Page } from '@playwright/test'
import { expectPath } from './helpers/url.js'
import { expect, test } from './fixtures.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { watchConsole } from './console.js'
import { fillSaleLine } from './helpers/sale.js'
import { expectOnlyTheThemeStored } from './helpers/storage.js'
import { uniqueTag } from './helpers/unique.js'
import { seedLedger } from './helpers/ledger.js'

/** The customer's card, never the list beside it on a computer (the list holds the search box):
 * its "Te debe" and "Credit" are what these specs read. */
function cardOf(page: Page) {
  return page.locator('main').filter({ hasNot: page.getByLabel('Search customer') })
}

test('a customer with no phone number is registered, edited, sold to, paid and shown in Te deben', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  const ownerEmail = `duena-sin-telefono-${uniqueTag()}@example.com`
  const businessName = `Flores Sin Telefono ${uniqueTag()}`

  await signUpNewBusiness(page, { businessName, email: ownerEmail })
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // One priced variety, $1.000/g — round figures for every assertion below.
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'New variety' }).click()
  await page.getByLabel('Name').fill('Jazmín')
  await page.getByRole('button', { name: 'Add the variety' }).click()
  await expect(page.getByText('Variety saved')).toBeVisible()
  await page.getByRole('link', { name: /Jazmín/ }).click()
  await page.getByRole('link', { name: 'New price' }).click()
  await page.getByLabel(/^List price/).fill('1000')
  await page.getByRole('button', { name: 'Save the price' }).click()
  await expect(page.getByText('Price saved')).toBeVisible()

  // Registered with no phone number at all.
  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Name').fill('Noe Sinnumero')
  await page.getByRole('button', { name: 'Save and use' }).click()
  await expectPath(page, CUSTOMER)
  await expect(page.getByText('Customer saved')).toBeVisible()

  await page.goto(CUSTOMERS)
  // Found by name, in the list: no phone line, no dash, no placeholder.
  const row = page.getByRole('link', { name: /Noe Sinnumero/ })
  await expect(row).toBeVisible()
  await expect(row.locator('.lista-clientes__telefono')).toHaveCount(0)
  await expect(row).not.toContainText('-')
  await expect(row).not.toContainText('Sin teléfono')

  // The card shows no phone field either.
  await row.click()
  await expectPath(page, CUSTOMER)
  await expect(page.getByText('Phone')).toHaveCount(0)

  // Edited: still no phone number, and the edit form shows no required marker on
  // the phone field while it stays usable.
  await page.getByRole('link', { name: 'Edit' }).click()
  await expect(page.getByLabel('Phone')).toHaveValue('')
  await page.getByRole('button', { name: 'Save and use' }).click()
  await expect(page.getByText('Customer saved')).toBeVisible()
  await expect(page.getByText('Phone')).toHaveCount(0)

  // Chosen for a sale, left owing — $4.000.
  await page.getByRole('link', { name: 'New sale to Noe Sinnumero' }).click()
  await expectPath(page, SALE_NEW)
  await fillSaleLine(page, 1, { variety: 'Jazmín', grams: '4' })
  await page.getByRole('radio', { name: 'Owing' }).check()
  await page.getByRole('button', { name: 'Save sale' }).click()
  await expectPath(page, SALE)
  await expect(page.getByText('Sale saved')).toBeVisible()

  await page.goto(CUSTOMERS)
  await page.getByRole('link', { name: 'Noe Sinnumero' }).first().click()
  await expect(page.locator('.ficha-deuda', { hasText: /Owes you\s*\$ 4\.000/ })).toBeVisible()

  // The block is a small label over a large figure: the figure is set larger than its label.
  const sizes = await page.locator('.ficha-deuda').evaluate((block) => {
    const size = (selector: string): number => {
      const node = block.querySelector(selector)
      if (node === null) throw new Error(`no ${selector}`)
      return parseFloat(getComputedStyle(node).fontSize)
    }
    return { label: size('.ficha-deuda__rotulo'), figure: size('.monto-deuda') }
  })
  expect(sizes.figure).toBeGreaterThan(sizes.label)

  // Paid in full through Registrar cobro.
  await page.getByRole('link', { name: 'Record payment' }).click()
  await page.getByRole('button', { name: 'All: $ 4.000' }).click()
  await page.getByRole('radio', { name: 'Cash' }).check()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Payment saved', { exact: true })).toBeVisible()
  await expect(cardOf(page).getByText('Owes you', { exact: false })).toHaveCount(0)

  // A second customer, also without a phone number, created straight from Elegir
  // cliente inside a new sale, chosen and sold to in one run.
  await page.goto(SALE_NEW)
  await page.getByRole('button', { name: 'Pick a customer' }).click()
  await page.getByRole('button', { name: 'New customer' }).click()
  await page.getByLabel('Name').fill('Sol Sinnumero')
  await page.getByRole('button', { name: 'Create customer' }).click()
  await expect(page.getByRole('button', { name: /Sol Sinnumero/ })).toBeVisible()
  // The chosen chip carries no phone element either.
  const chip = page.getByRole('button', { name: /Sol Sinnumero/ })
  await expect(chip.locator('.nueva-venta__cliente-telefono')).toHaveCount(0)
  await fillSaleLine(page, 1, { variety: 'Jazmín', grams: '2' })
  await page.getByRole('radio', { name: 'Owing' }).check()
  await page.getByRole('button', { name: 'Save sale' }).click()
  await expectPath(page, SALE)
  await expect(page.getByText('Sale saved')).toBeVisible()

  // Te deben lists the second, no-number customer's own fresh debt — the first
  // customer's debt is already settled, so she never named here.
  await page.goto(CUSTOMERS)
  const debtorRow = page.getByRole('region', { name: 'Owed to you' }).getByRole('link', { name: /^Sol Sinnumero/ })
  await expect(debtorRow).toBeVisible()
  await expect(debtorRow).toContainText('$ 2.000')
  await expect(page.getByRole('region', { name: 'Owed to you' }).getByRole('link', { name: 'Noe Sinnumero' })).toHaveCount(0)

  // Nothing personal or technical reaches the console or the browser's own storage.
  await expectOnlyTheThemeStored(page)
  expect(consoleMessages).toEqual([])
})

/**
 * The card's pinned footer ("New sale to <name>", GH-278): against the viewport, the ledger's
 * last row and the bottom bar, read only as bounding boxes relative to each other.
 */
interface Rect {
  x: number
  y: number
  width: number
  height: number
}

async function rectOf(locator: Locator): Promise<Rect> {
  const found = await locator.boundingBox()
  if (found === null) throw new Error('element has no box')
  return found
}

// Sub-pixel rounding only: the footer's bottom edge is the viewport's, less the (zero here) inset.
const SUBPIXEL = 1

async function viewportHeight(page: Page): Promise<number> {
  const size = page.viewportSize()
  if (size === null) throw new Error('no viewport')
  return size.height
}

async function scrollTo(page: Page, fraction: number): Promise<void> {
  await page.evaluate((at) => {
    window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * at)
  }, fraction)
}

async function expectTheDocumentScrolls(page: Page): Promise<void> {
  const scrolls = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)
  expect(scrolls).toBe(true)
}

async function expectPinnedInView(page: Page, footer: Locator): Promise<void> {
  const height = await viewportHeight(page)
  const box = await rectOf(footer)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(height + SUBPIXEL)
  expect(Math.abs(height - (box.y + box.height))).toBeLessThanOrEqual(SUBPIXEL)
}

test.describe('the card\'s pinned "New sale to <name>" on a phone', () => {
  test.use({ viewport: { width: 390, height: 700 } })

  test('a long ledger keeps it in view at load and mid-scroll, and at the end it clears the last row and the bar', async ({
    page,
  }) => {
    await signUpNewBusiness(page)
    const name = `Larga ${uniqueTag()}`
    await seedLedger(page, name, 9)
    const footer = page.locator('.ficha-cliente__pie')
    await expect(footer).toBeVisible()
    await expectTheDocumentScrolls(page)

    await scrollTo(page, 0)
    await expectPinnedInView(page, footer)
    await scrollTo(page, 0.5)
    await expectPinnedInView(page, footer)

    await scrollTo(page, 1)
    const end = await rectOf(footer)
    const last = await rectOf(page.locator('.cuenta-cliente__fila').last())
    const bar = await rectOf(page.locator('.bar-inferior'))
    expect(end.y).toBeGreaterThanOrEqual(last.y + last.height - SUBPIXEL)
    expect(end.y + end.height).toBeLessThanOrEqual(bar.y + SUBPIXEL)
  })

  test('a short card has it after the ledger, in view, above the bar and over nothing', async ({ page }) => {
    await signUpNewBusiness(page)
    const name = `Corta ${uniqueTag()}`
    await seedLedger(page, name, 1)
    const footer = page.locator('.ficha-cliente__pie')
    await expect(footer).toBeVisible()

    const height = await viewportHeight(page)
    const box = await rectOf(footer)
    const last = await rectOf(page.locator('.cuenta-cliente__fila').last())
    const bar = await rectOf(page.locator('.bar-inferior'))
    expect(box.y).toBeGreaterThanOrEqual(last.y + last.height - SUBPIXEL)
    expect(box.y + box.height).toBeLessThanOrEqual(height + SUBPIXEL)
    expect(box.y + box.height).toBeLessThanOrEqual(bar.y + SUBPIXEL)
  })
})

test.describe('the card\'s pinned "New sale to <name>" on a computer', () => {
  test.use({ viewport: { width: 1280, height: 600 } })

  test('a long ledger keeps it in view inside the right pane, and at the end it clears the last row', async ({
    page,
  }) => {
    await signUpNewBusiness(page)
    const name = `Larga ${uniqueTag()}`
    await seedLedger(page, name, 9)
    const footer = page.locator('.ficha-cliente__pie')
    await expect(footer).toBeVisible()
    await expectTheDocumentScrolls(page)

    const pane = await rectOf(page.locator('.clientes-paneles__detalle'))
    for (const at of [0, 0.5]) {
      await scrollTo(page, at)
      await expectPinnedInView(page, footer)
      const box = await rectOf(footer)
      expect(box.x).toBeGreaterThanOrEqual(pane.x - SUBPIXEL)
      expect(box.x + box.width).toBeLessThanOrEqual(pane.x + pane.width + SUBPIXEL)
    }

    await scrollTo(page, 1)
    const end = await rectOf(footer)
    const last = await rectOf(page.locator('.cuenta-cliente__fila').last())
    expect(end.y).toBeGreaterThanOrEqual(last.y + last.height - SUBPIXEL)
    expect(end.x).toBeGreaterThanOrEqual(pane.x - SUBPIXEL)
    expect(end.x + end.width).toBeLessThanOrEqual(pane.x + pane.width + SUBPIXEL)
  })
})
