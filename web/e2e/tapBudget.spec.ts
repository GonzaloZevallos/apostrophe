/**
 * The tap budget (PRD criterion 1; metric "Taps"): the expense form opens in at most
 * two taps from every tab root, one from Gastos, and a computer never takes more taps
 * than the phone. A tap is a click this spec makes through `tap()`, so the count is of
 * what a seller does, not of what the code calls. One expense is also recorded from
 * Más, and the form's exit goes back by history to the screen that opened it.
 */

import { HOME } from '../src/routes.js'
import { CUSTOMERS, EXPENSES, MORE, SALES, STOCK } from '../src/routes.js'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { newBusinessInvitationUrl } from './backend.js'
import { watchConsole } from './console.js'

const PASSWORD = 'correcthorsebattery'

const PHONE = { width: 390, height: 760 }
const COMPUTER = { width: 1280, height: 920 }

/** Tab roots: where a seller can be standing when the need to record an expense comes. */
const ROOTS = [HOME, SALES, CUSTOMERS, STOCK, MORE, EXPENSES] as const

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
  await expect(page).toHaveURL(/\/expenses\/new$/)
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
  await expect(page).toHaveURL(/\/more$/)

  await page.getByRole('link', { name: /^\+ Cargar gasto/ }).click()
  await page.getByRole('combobox', { name: 'Categoría' }).selectOption({ label: 'Packaging' })
  await page.getByLabel('Monto').fill('3200')
  await page.getByLabel('Detalle').fill('Cajas de cartón')
  await page.getByRole('button', { name: 'Guardá el gasto' }).click()
  await expect(page).toHaveURL(/\/more$/)
  await expect(page.getByText('Gasto guardado')).toBeVisible()

  await page.getByRole('navigation', { name: 'Más' }).getByRole('link', { name: /^Gastos/ }).click()
  await expect(page.getByText('Cajas de cartón')).toBeVisible()
  expect(consoleMessages).toEqual([])
})
