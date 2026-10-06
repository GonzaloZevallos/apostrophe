/**
 * The tap budget (PRD criterion 1; metric "Taps"): the expense form opens in at most
 * two taps from every tab root, one from Gastos, and a computer never takes more taps
 * than the phone. A tap is a click this spec makes through `tap()`, so the count is of
 * what a seller does, not of what the code calls. One expense is also recorded from
 * Más, and the form's exit goes back by history to the screen that opened it.
 */

import { expectPath } from './helpers/url.js'
import { CATALOG, CUSTOMERS, CUSTOMER_PAYMENT, EXPENSES, EXPENSE_NEW, HOME, MORE, SALES, SALE_NEW, STOCK_ENTRY_NEW, VARIETIES } from '../src/routes.js'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { newBusinessInvitationUrl } from './backend.js'
import { watchConsole } from './console.js'
import { seedRecords, signUp } from './helpers/seed.js'

const PASSWORD = 'correcthorsebattery'

const PHONE = { width: 390, height: 760 }
const COMPUTER = { width: 1280, height: 920 }

/** Tab roots: where a seller can be standing when the need to record an expense comes. */
const ROOTS = [HOME, SALES, CUSTOMERS, VARIETIES, MORE, EXPENSES] as const

interface Counter {
  taps: number
}

async function tap(counter: Counter, target: Locator): Promise<void> {
  counter.taps += 1
  await target.click()
}

/** Opens the expense form from wherever the seller is, the way the viewport allows;
 * returns the taps it took. */
async function openExpenseForm(page: Page, computer: boolean): Promise<number> {
  const counter: Counter = { taps: 0 }
  const here = new URL(page.url()).pathname
  if (here === EXPENSES) {
    await tap(counter, page.getByRole('link', { name: 'Cargar gasto' }))
  } else if (here === MORE) {
    await tap(counter, page.getByRole('link', { name: /^\+ Cargar gasto/ }))
  } else if (computer) {
    await tap(counter, page.locator('.riel-lateral').getByRole('link', { name: 'Gastos' }))
    await tap(counter, page.getByRole('link', { name: 'Cargar gasto' }))
  } else {
    await tap(counter, page.locator('.bar-inferior').getByRole('link', { name: 'Más' }))
    await tap(counter, page.getByRole('link', { name: /^\+ Cargar gasto/ }))
  }
  await expectPath(page, EXPENSE_NEW)
  await expect(page.getByRole('button', { name: 'Cerrar' })).toBeVisible()
  return counter.taps
}

test('the expense form opens within the tap budget from every tab root, phone and computer', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  await page.goto(newBusinessInvitationUrl())
  await page.getByLabel('Nombre del negocio').fill(`Flores del Gasto ${Date.now()}`)
  await page.getByLabel('Email').fill(`duena-gasto-${Date.now()}@example.com`)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Creá el negocio' }).click()
  await expect(page.locator('.encabezado__negocio')).toBeVisible()

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
    expect(phone, `phone, from ${root}`).toBeLessThanOrEqual(root === EXPENSES ? 1 : 2)
    expect(computer, `computer, from ${root}`).toBeLessThanOrEqual(phone ?? 0)
  }
  expect(taps.phone[MORE]).toBe(1)
  expect(taps.phone[EXPENSES]).toBe(1)
  expect(consoleMessages).toEqual([])
})

test('a seller records an expense from Más and Cerrar goes back to where the form was opened', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)
  await page.setViewportSize(PHONE)

  await page.goto(newBusinessInvitationUrl())
  await page.getByLabel('Nombre del negocio').fill(`Flores de Más ${Date.now()}`)
  await page.getByLabel('Email').fill(`duena-mas-${Date.now()}@example.com`)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Creá el negocio' }).click()
  await expect(page.locator('.encabezado__negocio')).toBeVisible()

  await page.goto(MORE)
  await page.getByRole('link', { name: /^\+ Cargar gasto/ }).click()
  await page.getByRole('button', { name: 'Cerrar' }).click()
  await expectPath(page, MORE)

  await page.getByRole('link', { name: /^\+ Cargar gasto/ }).click()
  await page.getByRole('combobox', { name: 'Categoría' }).selectOption({ label: 'Packaging' })
  await page.getByLabel('Monto').fill('3200')
  await page.getByLabel('Detalle').fill('Cajas de cartón')
  await page.getByRole('button', { name: 'Guardá el gasto' }).click()
  await expectPath(page, MORE)
  await expect(page.getByText('Gasto guardado')).toBeVisible()

  await page.getByRole('navigation', { name: 'Más' }).getByRole('link', { name: /^Gastos/ }).click()
  await expect(page.getByText('Cajas de cartón')).toBeVisible()
  expect(consoleMessages).toEqual([])
})

/** Goes to a tab through the bar or the sidebar, one tap, unless the seller is already there. */
async function viaTab(page: Page, counter: Counter, computer: boolean, label: string): Promise<void> {
  const nav = page.locator(computer ? '.riel-lateral' : '.bar-inferior')
  await tap(counter, nav.getByRole('link', { name: label, exact: true }))
}

test('the sale form, Registrar cobro, the catalog and a stock entry open within the tap budget', async ({ page }) => {
  test.setTimeout(120_000)
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
      await tap(counter, page.getByRole('link', { name: /Nueva venta$/ }).filter({ visible: true }).first())
      await expectPath(page, SALE_NEW)
      measure(`sale ${root}`, device, counter.taps)

      if (root === HOME || root === CUSTOMERS) {
        await page.goto(root)
        counter = { taps: 0 }
        await tap(counter, page.getByRole('link', { name: 'Cobrar a Carla Toques' }).first())
        await expectPath(page, CUSTOMER_PAYMENT)
        await expect(page.getByRole('button', { name: 'Cerrar' }), label).toBeVisible()
        measure(`payment ${root}`, device, counter.taps)
      }

      await page.goto(root)
      counter = { taps: 0 }
      if (root === MORE) {
        await tap(counter, page.getByRole('navigation', { name: 'Más' }).getByRole('link', { name: /^Catálogo/ }))
      } else {
        if (root !== VARIETIES) await viaTab(page, counter, computer, 'Variedades')
        await tap(counter, page.getByRole('link', { name: 'Mandar catálogo' }))
      }
      await expectPath(page, CATALOG)
      measure(`catalog ${root}`, device, counter.taps)

      await page.goto(root)
      counter = { taps: 0 }
      if (root !== VARIETIES) await viaTab(page, counter, computer, 'Variedades')
      await tap(counter, page.getByRole('link', { name: '+ Entrada de stock' }))
      await expectPath(page, STOCK_ENTRY_NEW)
      measure(`stock entry ${root}`, device, counter.taps)
    }
  }

  expect(Object.keys(taps).length).toBeGreaterThan(10)
  for (const [key, { phone, computer }] of Object.entries(taps)) {
    expect(phone, `phone: ${key}`).toBeGreaterThan(0)
    expect(phone, `phone: ${key}`).toBeLessThanOrEqual(key.startsWith('sale') || key.startsWith('payment') ? 1 : 2)
    expect(computer, `computer: ${key}`).toBeLessThanOrEqual(phone)
  }
  expect(consoleMessages).toEqual([])
})
