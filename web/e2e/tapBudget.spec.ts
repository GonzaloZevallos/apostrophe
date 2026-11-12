/**
 * The tap budget (PRD criterion 1; metric "Taps"), measured from each phone tab root: the
 * expense form opens in two taps from Home (the Analysis segment, then "Add expense") and three
 * from Sales, Customers and Products, one from Gastos; Settings in one (the avatar); a stock
 * withdrawal in two (Products, then "Take from stock"). A computer never takes more taps than
 * the phone. A tap is a click this spec makes through `tap()`, so the count is of what a seller
 * does, not of what the code calls. One expense is also recorded from the Expenses card on
 * Analysis, and the form's exit goes back by history to the screen that opened it.
 */

import { expectPath } from './helpers/url.js'
import {
  ANALYSIS,
  CATALOG,
  CUSTOMER,
  CUSTOMERS,
  CUSTOMER_PAYMENT,
  EXPENSES,
  EXPENSE_NEW,
  HOME,
  SALES,
  SALE_NEW,
  SETTINGS,
  STOCK_ENTRY_NEW,
  VARIETIES,
  VARIETY,
  WITHDRAWAL_NEW,
} from '../src/routes.js'
import { expect, test } from './fixtures.js'
import { expectToast } from './helpers/toast.js'
import type { Locator, Page } from '@playwright/test'
import { signUpNewBusiness } from './helpers/signup.js'
import { watchConsole } from './console.js'
import { seedRecords, signUp } from './helpers/seed.js'
import { uniqueTag } from './helpers/unique.js'
import { servedCountry } from './helpers/phoneCountries.js'


const PHONE = { width: 390, height: 844 }
const COMPUTER = { width: 1280, height: 920 }

/** Tab roots: where a seller can be standing when the need to record an expense comes. */
const ROOTS = [HOME, SALES, CUSTOMERS, VARIETIES, EXPENSES] as const

interface Counter {
  taps: number
}

async function tap(counter: Counter, target: Locator): Promise<void> {
  counter.taps += 1
  await target.click()
}

/** The Today | Analysis segment's "Analysis" option. */
function analysisOption(page: Page): Locator {
  return page.getByRole('group', { name: 'Home view' }).getByRole('link', { name: 'Analysis' })
}

/** Opens the expense form from wherever the seller is, the way the viewport allows;
 * returns the taps it took. */
async function openExpenseForm(page: Page, computer: boolean): Promise<number> {
  const counter: Counter = { taps: 0 }
  const here = new URL(page.url()).pathname
  if (here === EXPENSES) {
    await tap(counter, page.getByRole('link', { name: 'Add expense' }))
  } else if (computer) {
    await tap(counter, page.locator('.riel-lateral').getByRole('link', { name: 'Expenses' }))
    await tap(counter, page.getByRole('link', { name: 'Add expense' }))
  } else {
    // The phone: Home's segment leads to Analysis, whose Expenses card holds "Add expense".
    if (here !== HOME) await viaTab(page, counter, false, 'Home')
    await tap(counter, analysisOption(page))
    await tap(counter, page.getByRole('link', { name: 'Add expense' }))
  }
  await expectPath(page, EXPENSE_NEW)
  await expect(page.getByRole('button', { name: 'Close' })).toBeVisible()
  return counter.taps
}

test('the expense form opens within the tap budget from every tab root, phone and computer', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  await signUpNewBusiness(page, { businessName: `Flores del Gasto ${uniqueTag()}`, email: `duena-gasto-${uniqueTag()}@example.com` })

  const taps: Record<'phone' | 'computer', Record<string, number>> = { phone: {}, computer: {} }
  for (const [device, size] of [
    ['phone', PHONE],
    ['computer', COMPUTER],
  ] as const) {
    await page.setViewportSize(size)
    for (const root of ROOTS) {
      await page.goto(root)
      taps[device][root] = await openExpenseForm(page, device === 'computer')
    }
  }

  for (const root of ROOTS) {
    const phone = taps.phone[root]
    const computer = taps.computer[root]
    expect(computer, `computer, from ${root}`).toBeLessThanOrEqual(phone ?? 0)
  }
  expect(taps.phone[HOME]).toBe(2)
  expect(taps.phone[SALES]).toBe(3)
  expect(taps.phone[CUSTOMERS]).toBe(3)
  expect(taps.phone[VARIETIES]).toBe(3)
  expect(taps.phone[EXPENSES]).toBe(1)
  expect(consoleMessages).toEqual([])
})

test('a seller records an expense from the Expenses card and Close goes back to where the form was opened', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)
  await page.setViewportSize(PHONE)

  await signUpNewBusiness(page, { businessName: `Flores de la Tarjeta ${uniqueTag()}`, email: `duena-tarjeta-${uniqueTag()}@example.com` })

  await analysisOption(page).click()
  await page.getByRole('link', { name: 'Add expense' }).click()
  await page.getByRole('button', { name: 'Close' }).click()
  await expectPath(page, ANALYSIS)

  await page.getByRole('link', { name: 'Add expense' }).click()
  await page.getByRole('button', { name: /^Category/ }).click()
  await page.getByRole('button', { name: 'Packaging', exact: true }).click()
  await page.getByLabel('Amount').fill('3200')
  await page.getByLabel('Details').fill('Cajas de cartón')
  await expectToast(page, 'Expense saved', async () => {
    await page.getByRole('button', { name: 'Save the expense' }).click()
    await expectPath(page, ANALYSIS)
  })

  await page.getByRole('link', { name: 'See the expenses' }).click()
  await expectPath(page, EXPENSES)
  await expect(page.getByText('Cajas de cartón')).toBeVisible()
  expect(consoleMessages).toEqual([])
})

/** Goes to a tab through the bar or the sidebar, one tap, unless the seller is already there. */
async function viaTab(page: Page, counter: Counter, computer: boolean, label: string): Promise<void> {
  const nav = page.locator(computer ? '.riel-lateral' : '.bar-inferior')
  await tap(counter, nav.getByRole('link', { name: label, exact: true }))
}

/** On a computer Variedades selects its first variety on its own (no tap): wait for that to land, so
 * a tap on a link of the list is never overtaken by the automatic replace. */
async function settled(page: Page, computer: boolean): Promise<void> {
  if (computer) await expectPath(page, VARIETY)
}

test('the sale form, Registrar cobro, the catalog and a stock entry open within the tap budget', async ({ page }) => {
  test.setTimeout(180_000)
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)
  await signUp(page, 'Toques')
  await seedRecords(page, 'Carla Toques')

  const taps: Record<string, Record<'phone' | 'computer', number>> = {}
  const measure = (key: string, device: 'phone' | 'computer', count: number): void => {
    taps[key] = { ...(taps[key] ?? { phone: 0, computer: 0 }), [device]: count }
  }

  for (const [device, size] of [['phone', PHONE], ['computer', COMPUTER]] as const) {
    await page.setViewportSize(size)
    const computer = device === 'computer'
    for (const root of ROOTS) {
      const label = `${device} from ${root}`

      await page.goto(root)
      let counter: Counter = { taps: 0 }
      if (computer && root === VARIETIES) {
        // Variedades selects its first variety on its own, and a variety's page is a card: a
        // card never shows "+ Nueva venta" (navigation.md, "Marco y camino de vuelta"), the rail
        // included. So the sale is not one tap from here on a computer; the tab roots that
        // stay roots (the others) are measured below.
        await settled(page, computer)
        await expect(
          page.locator('.riel-lateral').getByRole('link', { name: /New sale$/ }),
          label,
        ).toHaveCount(0)
      } else if (!computer && root === EXPENSES) {
        // On the phone Gastos is a card under Analysis: a card never shows "+ New sale", so
        // the sale is not one tap from here; the computer, where it stays a root, measures it.
        await expect(page.getByRole('link', { name: /New sale$/ }), label).toHaveCount(0)
      } else {
        await tap(counter, page.getByRole('link', { name: /New sale$/ }).filter({ visible: true }).first())
        await expectPath(page, SALE_NEW)
        measure(`sale ${root}`, device, counter.taps)
      }

      if (root === HOME || root === CUSTOMERS) {
        await page.goto(root)
        counter = { taps: 0 }
        await tap(counter, page.getByRole('link', { name: 'Collect from Carla Toques' }).first())
        await expectPath(page, CUSTOMER_PAYMENT)
        await expect(page.getByRole('button', { name: 'Close' }), label).toBeVisible()
        measure(`payment ${root}`, device, counter.taps)
      }

      // Collecting from any tab root: Clientes through its tab (none from Clientes itself),
      // then "Collect from <name>" on the debtor's row. Two taps at most, never more on a computer.
      await page.goto(root)
      counter = { taps: 0 }
      if (root !== CUSTOMERS) await viaTab(page, counter, computer, 'Customers')
      await expectPath(page, CUSTOMERS)
      await tap(counter, page.getByRole('link', { name: 'Collect from Carla Toques' }).first())
      await expectPath(page, CUSTOMER_PAYMENT)
      await expect(page.getByRole('button', { name: 'Close' }), label).toBeVisible()
      await expect(page.locator('.cobro__cliente'), label).toContainText('Carla Toques')
      measure(`collect ${root}`, device, counter.taps)

      await page.goto(root)
      counter = { taps: 0 }
      if (root !== VARIETIES) await viaTab(page, counter, computer, 'Products')
      await settled(page, computer)
      await tap(counter, page.getByRole('link', { name: 'Send catalog' }))
      await expectPath(page, CATALOG)
      measure(`catalog ${root}`, device, counter.taps)

      await page.goto(root)
      counter = { taps: 0 }
      if (root !== VARIETIES) await viaTab(page, counter, computer, 'Products')
      await settled(page, computer)
      await tap(counter, page.getByRole('link', { name: '+ Stock entry' }))
      await expectPath(page, STOCK_ENTRY_NEW)
      measure(`stock entry ${root}`, device, counter.taps)

      // Settings: the avatar on the phone, the rail's business row on a computer. One tap.
      await page.goto(root)
      counter = { taps: 0 }
      await settled(page, computer && root === VARIETIES)
      await tap(
        counter,
        computer
          ? page.locator('.riel-lateral').getByRole('link', { name: /^Settings for / })
          : page.getByRole('link', { name: 'Settings', exact: true }),
      )
      await expectPath(page, SETTINGS)
      measure(`settings ${root}`, device, counter.taps)

      // Stock withdrawal: Products, then "Take from stock" next to "+ Stock entry". The list's
      // is the first in the page (a computer's selected variety carries its own beside it).
      await page.goto(root)
      counter = { taps: 0 }
      if (root !== VARIETIES) await viaTab(page, counter, computer, 'Products')
      await settled(page, computer)
      await tap(counter, page.getByRole('link', { name: 'Take from stock' }).first())
      await expectPath(page, WITHDRAWAL_NEW)
      measure(`withdrawal ${root}`, device, counter.taps)
    }
  }

  expect(Object.keys(taps).length).toBeGreaterThan(10)
  for (const [key, { phone, computer }] of Object.entries(taps)) {
    if (key === `sale ${EXPENSES}`) {
      // Phone-less on purpose (a card shows no "+ New sale"): the computer's one tap stands alone.
      expect(phone, `phone: ${key}`).toBe(0)
      expect(computer, `computer: ${key}`).toBe(1)
      continue
    }
    expect(phone, `phone: ${key}`).toBeGreaterThan(0)
    expect(phone, `phone: ${key}`).toBeLessThanOrEqual(
      key.startsWith('sale') || key.startsWith('payment') || key.startsWith('settings') ? 1 : 2,
    )
    expect(computer, `computer: ${key}`).toBeLessThanOrEqual(phone)
  }
  expect(consoleMessages).toEqual([])
})

/** What a seller taps to give a new customer a phone number in the country the device detected: the form's
 * own two buttons and nothing for the Phone country (customers.md, success criterion 5). */
const NEW_CUSTOMER_TAPS = 2
const NEW_CUSTOMER_IN_SALE_TAPS = 3
/** Picking another country: the field, then the option. */
const COUNTRY_PICK_TAPS = 2

test('a new customer, alone or from Pick a customer, with a local number in the detected country adds no tap; another country adds the two of the Selector', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)
  await page.setViewportSize(PHONE)
  await signUpNewBusiness(page, { businessName: `Flores del Pais ${uniqueTag()}`, email: `duena-pais-${uniqueTag()}@example.com` })

  const argentina = await servedCountry(page, 'AR', 'Argentina')
  const uruguay = await servedCountry(page, 'UY', 'Uruguay')
  const country = page.getByRole('button', { name: /^Phone country/ })
  const phone = page.getByLabel('Phone', { exact: true })
  /** The device is Argentine (the config's pins), so Argentina is the detected country. */
  const awaitDetected = async (): Promise<void> => {
    await expect(country).toContainText(argentina.label)
    await expect(country).not.toHaveAttribute('aria-busy', 'true')
  }
  const pickUruguay = async (counter: Counter): Promise<void> => {
    await tap(counter, country)
    await tap(counter, page.getByRole('dialog', { name: 'Phone country options' }).getByRole('button', { name: uruguay.label, exact: true }))
  }

  /** The same number twice is a duplicate customer: each form gets its own last digit. */
  const distinct = (example: string, digit: number): string => `${example.slice(0, -1)}${digit}`
  const measured: Record<string, number> = {}

  // From Customers: the link, then Save.
  for (const [key, other] of [['detected', false], ['other', true]] as const) {
    await page.goto(CUSTOMERS)
    const counter: Counter = { taps: 0 }
    await tap(counter, page.getByRole('link', { name: 'New customer' }))
    await page.getByLabel('Name').fill(`Cliente ${key} ${uniqueTag()}`)
    await awaitDetected()
    if (other) await pickUruguay(counter)
    await phone.fill(distinct(other ? uruguay.example : argentina.example, other ? 2 : 1))
    await tap(counter, page.getByRole('button', { name: 'Save and use' }))
    await expectPath(page, CUSTOMER)
    measured[`customer ${key}`] = counter.taps
  }

  // From the sale: Pick a customer, New customer, Create customer.
  for (const [key, other] of [['detected', false], ['other', true]] as const) {
    await page.goto(SALE_NEW)
    const counter: Counter = { taps: 0 }
    await tap(counter, page.getByRole('button', { name: 'Pick a customer' }))
    await tap(counter, page.getByRole('button', { name: 'New customer' }))
    await page.getByLabel('Name').fill(`Cliente venta ${key} ${uniqueTag()}`)
    await awaitDetected()
    if (other) await pickUruguay(counter)
    await phone.fill(distinct(other ? uruguay.example : argentina.example, other ? 4 : 3))
    await tap(counter, page.getByRole('button', { name: 'Create customer' }))
    await expect(page.getByText('Pick a customer')).toHaveCount(0)
    measured[`sale ${key}`] = counter.taps
  }

  expect(measured).toEqual({
    'customer detected': NEW_CUSTOMER_TAPS,
    'customer other': NEW_CUSTOMER_TAPS + COUNTRY_PICK_TAPS,
    'sale detected': NEW_CUSTOMER_IN_SALE_TAPS,
    'sale other': NEW_CUSTOMER_IN_SALE_TAPS + COUNTRY_PICK_TAPS,
  })
  expect(consoleMessages).toEqual([])
})
