/**
 * The sales task's own end-to-end run (plan, "Order": `e2e-sales` lands last, after
 * every sales screen subtask). `flow.spec.ts` covers everything the front offered
 * before this task; this file is the seller's own journey through the three new
 * screens, against the real backend, through the built front alone — never a mock of
 * either side (PRD, M1: "no `curl` at any point").
 *
 * A phone viewport (`test.use` below), because PRD metric 1 is explicitly "from a
 * phone viewport", and because the fixed "Nueva venta" button and the tab bar only
 * show their phone shape (`Shell.tsx`'s `.bar-inferior`/`.boton-nueva-venta`) below
 * the design's own 900px breakpoint.
 *
 * One business proves the PRD's own metrics in sequence:
 * - The shell: the bar shows exactly Inicio, Ventas, Clientes, Variedades and Más.
 * - "Caught before save" (3): Debiendo disabled with no customer, and a line whose
 *   variety has no price that day, both shown before any save is attempted.
 * - "Under a minute" (1): each of the three sales below — a new customer, an
 *   existing one, none — is saved in under 60 s, timed from the moment the form
 *   opens to "Venta guardada".
 * - "One sale" (4) and "What I see is what I get" (2): a two-variety order with
 *   shipping charged once, where the live preview's price per gram, rule and total
 *   for *every* line match the saved detail's, figure for figure, not only the
 *   sale's own total.
 * - "Undo leaves nothing" (5): Deshacer right after saving removes the sale from
 *   every list.
 * - The shell's "Nueva venta a <name>" (accounts.md) opens the form with that
 *   customer already chosen; a $0 sale (a gift line on an otherwise priced variety)
 *   needs no payment method.
 * - "Fixing" (8): assigning a customer to a sale that had none, then deleting a sale
 *   through its confirmation, naming the date and the amount.
 * - Ventas' periods (6, 7): Hoy, Semana, Mes and Fechas each sum to the sales they
 *   actually show, not just one sale's own figure, and the week runs Monday to
 *   Sunday, not "the last 7 days" — a sale dated the Monday of this week counts in
 *   Semana, one dated the Sunday right before it does not.
 * - The list answers in under 300 ms with a few hundred sales (metric 6), seeded
 *   directly through the API: driving the form three hundred times would only time
 *   Playwright's own clicking, not the backend.
 * - Isolation (ADR-0004): a second business opening the first one's sale by its own
 *   id sees "Eso ya no está.", never the sale itself.
 *
 * `consoleMessages` is asserted empty at the end bar one line, exactly like
 * `flow.spec.ts` (CODING_STANDARDS.md section 9: nothing personal or technical
 * belongs in the console) — the one allowed exception is spelled out where it is
 * asserted — and the browser's own storage is asserted empty too, since a sale
 * carries a customer's name, a note and an amount — exactly what section 9 forbids
 * there.
 */

import { CUSTOMERS, SALE, SALES, SALE_NEW, VARIETIES } from '../src/routes.js'
import { expectPath } from './helpers/url.js'
import { expect, test } from '@playwright/test'
import { signUpNewBusiness } from './helpers/signup.js'
import { watchConsole } from './console.js'
import { fillSaleLine } from './helpers/sale.js'
import { expectOnlyTheThemeStored } from './helpers/storage.js'

test.use({ viewport: { width: 390, height: 844 } }) // a phone (PRD metric 1).

const RECORD_BUDGET_MS = 60_000 // PRD metric 1: "under a minute".
const LIST_BUDGET_MS = 300 // PRD metric 6.
const SEEDED_SALES_FOR_PERF = 300 // "a few hundred sales".

interface VarietyAnswer {
  id: number
  name: string
}

function shortDate(iso: string): string {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

/** This test script is not the front — only `web/src` is held to "never `Date`"
 * (plan, invariants: `format/dates.ts` alone computes periods from `me.today`).
 * Plain UTC day arithmetic on an API date's digits, for this file's own fixtures,
 * the same way `Date.now()` already names this run's own business and emails. */
function parseIso(iso: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (match === null) throw new Error(`not an ISO date: ${iso}`)
  const [, year, month, day] = match
  return { year: Number(year ?? ''), month: Number(month ?? ''), day: Number(day ?? '') }
}

function addDays(iso: string, delta: number): string {
  const { year, month, day } = parseIso(iso)
  const shifted = new Date(Date.UTC(year, month - 1, day) + delta * 86_400_000)
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`
}

function weekdayOf(iso: string): number {
  const { year, month, day } = parseIso(iso)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() // 0 = Sunday .. 6 = Saturday.
}

function lastDayOfMonth(iso: string): string {
  const { year, month } = parseIso(iso)
  const dt = new Date(Date.UTC(year, month, 0)) // day 0 of next month = last day of this one.
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

function pesos(amount: number): string {
  return `$ ${amount.toLocaleString('es-AR')}`
}

function countLabel(count: number): string {
  return `${count} ${count === 1 ? 'venta' : 'ventas'}`
}

test('a seller records, undoes, fixes and isolates sales, from the front alone', async ({
  page,
  browser,
}) => {
  // Seeding a few hundred sales one at a time (below, for the 300 ms list check)
  // comfortably clears a 30 s budget on its own; this test's own journey
  // around it needs the room too. Under load (backend suite looping beside it) it ran past
  // its former 90 s, so the ceiling is 240 s: raised, never lowered (GH-110).
  test.setTimeout(240_000)

  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  const ownerEmail = `duena-ventas-${Date.now()}@example.com`
  const businessName = `Vivero Jacarandá ${Date.now()}`

  // Accept a new-business invitation.
  await signUpNewBusiness(page, { businessName, email: ownerEmail })
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // Two priced varieties and one with no price at all, for the "no price that day"
  // check below. Jazmín's own price is backdated well before this run's own week
  // and month (`effectiveFrom`), since it is the one variety the periods and
  // perf sections below seed sales for on dates before today — a default "Rige
  // desde" of today would leave those earlier dates with no price of their own.
  async function addVariety(name: string, listPrice?: string, effectiveFrom?: string): Promise<void> {
    await page.goto(VARIETIES)
    await page.getByRole('button', { name: 'Nueva variedad' }).click()
    await page.getByLabel('Nombre').fill(name)
    await page.getByRole('button', { name: 'Agregá la variedad' }).click()
    await expect(page.getByText('Variedad guardada')).toBeVisible()
    if (listPrice === undefined) return
    await page.getByRole('link', { name: new RegExp(name) }).click()
    await page.getByRole('link', { name: 'Nuevo precio' }).click()
    if (effectiveFrom !== undefined) await page.getByLabel('Rige desde').fill(effectiveFrom)
    await page.getByLabel(/^Precio de lista/).fill(listPrice)
    await page.getByRole('button', { name: 'Guardá el precio' }).click()
    await expect(page.getByText('Precio guardado')).toBeVisible()
  }
  await addVariety('Jazmín', '500', '2000-01-01')
  await addVariety('Lirio', '300')
  await addVariety('Mimosa')

  await page.goto(SALES)

  // Shell metric: the bar shows exactly Inicio, Ventas, Clientes, Variedades and Más, in that
  // order — the mobile bottom bar at this viewport (`Shell.tsx`'s `.bar-inferior`;
  // the side rail, `.riel-lateral`, shares the same `aria-label` but is hidden here).
  const tabBar = page.getByRole('navigation', { name: 'Navegación' }).last()
  await expect(tabBar.getByRole('link')).toHaveText([
    'Inicio',
    'Ventas',
    'Clientes',
    'Variedades',
    'Más',
  ])

  // --- Sale A: caught-before-save, a new customer, two varieties, one shipping. ---
  // `.last()`: at this phone viewport the side rail's own "Nueva venta" link (first
  // in `Shell.tsx`'s markup) is the one CSS hides; the fixed bottom button is last.
  await page.getByRole('link', { name: 'Nueva venta' }).last().click()
  await expectPath(page, SALE_NEW)
  const todayIso = await page.getByLabel('Fecha').inputValue()

  const varieties: VarietyAnswer[] = await (
    await page.request.get(`/varieties?on=${todayIso}`)
  ).json()
  const jazmin = varieties.find((variety) => variety.name === 'Jazmín')
  if (jazmin === undefined) throw new Error('Jazmín missing from GET /varieties?on=')
  const jazminId = jazmin.id

  const saleAStart = Date.now()

  // Debiendo is disabled and explained while there is no customer.
  await expect(page.getByRole('radio', { name: 'Debiendo' })).toBeDisabled()
  await expect(page.getByText('Para dejar debiendo elegí un cliente')).toBeVisible()

  // A variety with no price that day is caught on its own line, before saving.
  await fillSaleLine(page, 1, { variety: 'Mimosa', grams: '5' })
  await expect(page.getByText('Mimosa no tiene precio para esa fecha')).toBeVisible()

  // Swap it for a priced variety and add a second line.
  await fillSaleLine(page, 1, { variety: 'Jazmín', grams: '10' })
  await fillSaleLine(page, 2, { variety: 'Lirio', grams: '20' })
  await page.getByLabel('Envío').fill('1000')
  await page.getByLabel('Nota').fill('Pedido para el grupo')

  // A brand-new customer, created from inside the sheet, without leaving the sale.
  await page.getByRole('button', { name: 'Elegir cliente' }).click()
  await page.getByRole('button', { name: 'Nuevo cliente' }).click()
  await page.getByLabel('Teléfono').fill('+5491155550010')
  await page.getByLabel('Nombre').fill('Carla Pérez')
  await page.getByRole('button', { name: 'Crear cliente' }).click()
  await expect(page.getByText('Elegir cliente')).toHaveCount(0)
  await expect(page.locator('.lista-clientes__nombre')).toHaveText('Carla Pérez')

  // Choosing a customer turns Debiendo back on; Efectivo is used here instead.
  await expect(page.getByRole('radio', { name: 'Debiendo' })).toBeEnabled()
  await page.getByRole('radio', { name: 'Efectivo' }).check()

  // The live preview, before saving — every line, not only the sale's own total:
  // PRD metric 2, "0 differences" against what the detail shows after saving.
  // Line 1 (Jazmín) is now the closed row — "Agregar otra variedad" closed it
  // when line 2 opened (plan, "Line editor": one open line at a time); line 2
  // (Lirio) is still the open editor.
  const previewJazmin = page.getByRole('button', { name: /^Línea 1: Jazmín/ })
  await expect(previewJazmin.locator('.insignia')).toHaveText('lista')
  await expect(previewJazmin.getByText('$ 500 x g', { exact: true })).toBeVisible()
  await expect(previewJazmin.getByText('$ 5.000', { exact: true })).toBeVisible()

  const previewLirio = page.locator('.nueva-venta__linea--abierta').filter({ has: page.getByLabel('Variedad línea 2') })
  await expect(previewLirio.locator('.insignia')).toHaveText('lista')
  await expect(previewLirio.getByText('$ 300 x g', { exact: true })).toBeVisible()
  await expect(previewLirio.getByText('$ 6.000', { exact: true })).toBeVisible()

  await expect(page.locator('.cifra-xl')).toHaveText('$ 12.000') // 5.000 + 6.000 + 1.000 shipping.
  await expect(page.getByText('30 g vendidos')).toBeVisible()

  await page.getByRole('button', { name: 'Guardá la venta' }).click()
  await expectPath(page, SALE)
  await expect(page.getByText('Venta guardada')).toBeVisible()
  expect(Date.now() - saleAStart).toBeLessThan(RECORD_BUDGET_MS) // a new customer.

  // What is shown now is what the API answered, not the preview — but it is the
  // same figures, line for line, since nothing changed in between.
  await expect(page.locator('.cifra-xl')).toHaveText('$ 12.000')
  const detailJazmin = page.locator('.venta-detalle__linea').filter({ hasText: 'Jazmín' })
  await expect(detailJazmin.locator('.insignia')).toHaveText('lista')
  await expect(detailJazmin.locator('.venta-detalle__precio')).toHaveText('$ 500 por gramo')
  await expect(detailJazmin.locator('.venta-detalle__total')).toHaveText('$ 5.000')
  const detailLirio = page.locator('.venta-detalle__linea').filter({ hasText: 'Lirio' })
  await expect(detailLirio.locator('.insignia')).toHaveText('lista')
  await expect(detailLirio.locator('.venta-detalle__precio')).toHaveText('$ 300 por gramo')
  await expect(detailLirio.locator('.venta-detalle__total')).toHaveText('$ 6.000')
  await expect(page.getByText('Envío cobrado')).toBeVisible()
  await expect(page.getByText('$ 1.000')).toBeVisible()
  await expect(page.getByText('Pedido para el grupo')).toBeVisible()
  await expect(page.getByText('Carla Pérez')).toBeVisible()

  // Deshacer, right after saving: nothing of this sale survives.
  await page.getByRole('button', { name: 'Deshacer' }).click()
  await expectPath(page, SALES)
  await expect(page.getByText('Venta eliminada')).toBeVisible()
  await expect(page.getByText('0 ventas')).toBeVisible()
  await expect(page.getByText('Todavía no registraste ninguna venta en este período.')).toBeVisible()

  // --- Sale B: "Nueva venta a <name>", a gift line, no payment needed for $0. ---
  await page.goto(CUSTOMERS)
  await page.getByRole('link', { name: 'Carla Pérez' }).first().click()
  await page.getByRole('link', { name: 'Nueva venta a Carla Pérez' }).click()
  await expectPath(page, SALE_NEW)
  const saleBStart = Date.now()
  // Already chosen, no picking needed: fetched by id (keys.saleFormCustomer), not
  // carried along in history state (plan, invariants).
  await expect(page.locator('.lista-clientes__nombre')).toHaveText('Carla Pérez')

  await fillSaleLine(page, 1, { variety: 'Jazmín', grams: '4', gift: true })
  await expect(page.getByLabel('Precio especial línea 1')).toBeDisabled()

  // A $0 sale — a gift line marked by hand on a variety that does have a price
  // (Jazmín): saving is never blocked for a missing payment method when the total
  // is $0.
  await expect(page.locator('.cifra-xl')).toHaveText('$ 0')
  const saveButtonB = page.getByRole('button', { name: 'Guardá la venta' })
  await expect(saveButtonB).toBeEnabled()
  await saveButtonB.click()
  await expectPath(page, SALE)
  const saleBUrl = page.url()
  await expect(page.getByText('Venta guardada')).toBeVisible()
  expect(Date.now() - saleBStart).toBeLessThan(RECORD_BUDGET_MS) // an existing customer.
  await expect(page.locator('.cifra-xl')).toHaveText('$ 0')
  await expect(page.getByRole('button', { name: 'Asignar cliente' })).toHaveCount(0) // already has one.

  // --- Sale C: no customer, assigned afterwards, then deleted. ---
  await page.goto(SALES)
  await page.getByRole('link', { name: 'Nueva venta' }).last().click()
  const saleCStart = Date.now()
  await fillSaleLine(page, 1, { variety: 'Jazmín', grams: '2' })
  await page.getByRole('radio', { name: 'Efectivo' }).check()
  await page.getByRole('button', { name: 'Guardá la venta' }).click()
  await expectPath(page, SALE)
  await expect(page.getByText('Venta guardada')).toBeVisible()
  expect(Date.now() - saleCStart).toBeLessThan(RECORD_BUDGET_MS) // no customer: the fastest.
  await expect(page.getByText('Sin cliente')).toBeVisible()

  // Assigning a customer: the sheet never offers "Sin cliente" here.
  await page.getByRole('button', { name: 'Asignar cliente' }).click()
  await expect(page.getByRole('button', { name: 'Sin cliente' })).toHaveCount(0)
  await page.getByLabel('Buscar').fill('Carla')
  await page.getByRole('button', { name: /Carla Pérez/ }).click()
  await expect(page.getByText('Cliente asignado')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Asignar cliente' })).toHaveCount(0)

  // Borrar venta, confirmed with the date and the amount, then gone from the list.
  await page.getByRole('button', { name: 'Borrar venta' }).click()
  await expect(
    page.getByRole('alertdialog', {
      name: `¿Borrás la venta de $ 1.000 del ${shortDate(todayIso)}? Vuelven 2 g al stock.`,
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Sí, borrala' }).click()
  await expectPath(page, SALES)
  await expect(page.getByText('Venta eliminada')).toBeVisible()

  // --- Ventas' periods: sums across several sales, and the Monday-to-Sunday week
  // edge. Only the $0 gift sale (Sale B, dated today) is left from the form so far;
  // two more are seeded directly through the API (no need to drive the whole form
  // again) to prove a period's total is an actual sum, not one sale's own figure,
  // and that the week is Monday-to-Sunday, never "the last 7 days". ---
  async function seedSale(date: string, grams: string): Promise<void> {
    const response = await page.request.post('/sales', {
      data: {
        date,
        customer_id: null,
        shipping_charged: 0,
        note: null,
        payment: 'cash',
        lines: [{ variety_id: jazminId, grams, gift: false, special_price: null }],
      },
    })
    expect(response.ok()).toBe(true)
  }

  const mondayOffset = weekdayOf(todayIso) === 0 ? -6 : 1 - weekdayOf(todayIso)
  const mondayIso = addDays(todayIso, mondayOffset)
  const sundayBeforeIso = addDays(mondayIso, -1)
  const sundayEndIso = addDays(mondayIso, 6)
  const monthStartIso = `${todayIso.slice(0, 7)}-01`
  const monthEndIso = lastDayOfMonth(todayIso)

  const activeSales: { date: string; total: number }[] = [{ date: todayIso, total: 0 }] // Sale B.
  async function seedAndTrack(date: string, grams: string, total: number): Promise<void> {
    await seedSale(date, grams)
    activeSales.push({ date, total })
  }
  await seedAndTrack(todayIso, '2', 1000) // today again: the period's total is a sum.
  await seedAndTrack(mondayIso, '6', 3000) // this week's own Monday: inside Semana.
  await seedAndTrack(sundayBeforeIso, '8', 4000) // the Sunday right before: outside it.

  function expectedFor(start: string, end: string): { count: number; total: number } {
    const included = activeSales.filter((sale) => sale.date >= start && sale.date <= end)
    return { count: included.length, total: included.reduce((sum, sale) => sum + sale.total, 0) }
  }

  // The header's range text carries the count next to it now ("28/09 – 04/10 ·
  // N ventas", `Ventas.tsx`'s `ventas__rango`), not a standalone node — checked by
  // substring (`toContainText`), and the total through its own `ventas__total`
  // class, which replaced the oversized shared `.cifra-xl`.
  await page.goto(SALES)
  const hoy = expectedFor(todayIso, todayIso)
  await expect(page.locator('.ventas__rango')).toContainText(countLabel(hoy.count))
  await expect(page.locator('.ventas__total')).toHaveText(pesos(hoy.total))

  await page.getByRole('button', { name: 'Semana' }).click()
  const semana = expectedFor(mondayIso, sundayEndIso)
  await expect(page.locator('.ventas__rango')).toContainText(countLabel(semana.count))
  await expect(page.locator('.ventas__total')).toHaveText(pesos(semana.total))

  await page.getByRole('button', { name: 'Mes' }).click()
  const mes = expectedFor(monthStartIso, monthEndIso)
  await expect(page.locator('.ventas__rango')).toContainText(countLabel(mes.count))
  await expect(page.locator('.ventas__total')).toHaveText(pesos(mes.total))

  await page.getByRole('button', { name: 'Fechas' }).click()
  // Fechas opens on the current month's own range too (Ventas.tsx: its `custom`
  // state starts as `monthRange(me.today)`), so it answers exactly like Mes here.
  await expect(page.locator('.ventas__rango')).toContainText(countLabel(mes.count))
  await expect(page.locator('.ventas__total')).toHaveText(pesos(mes.total))

  // --- The list still answers fast with a few hundred sales (PRD metric 6): seeded
  // directly, then timed on the exact request `listSales` makes. ---
  // Sequential, not `Promise.all`: this is a single SQLite file (the e2e run's own
  // throwaway one, `env.ts`), and three hundred concurrent writers would only time
  // how long they spend queued behind each other's write lock, not the one request
  // this section actually measures below.
  for (let i = 0; i < SEEDED_SALES_FOR_PERF; i += 1) {
    await seedSale(todayIso, '1')
  }
  const perfStart = Date.now()
  const perfResponse = await page.request.get(`/sales?date_from=${todayIso}&date_to=${todayIso}`)
  const elapsedMs = Date.now() - perfStart
  expect(perfResponse.ok()).toBe(true)
  expect(elapsedMs, `list took ${elapsedMs} ms`).toBeLessThan(LIST_BUDGET_MS)

  // --- Isolation: a second business can never reach the first one's sale. ---
  const otherContext = await browser.newContext()
  const otherPage = await otherContext.newPage()
  watchConsole(otherPage, consoleMessages)
  await signUpNewBusiness(otherPage, {
    businessName: `Otro negocio ${Date.now()}`,
    email: `otra-${Date.now()}@example.com`,
  })

  await otherPage.goto(saleBUrl)
  await expect(otherPage.getByText('Eso ya no está.')).toBeVisible()
  await otherPage.getByRole('link', { name: 'Volver a Ventas' }).click()
  await expectPath(otherPage, SALES)
  await otherContext.close()

  // Nothing personal or technical reaches the console or the browser's own storage
  // (CODING_STANDARDS.md section 9, in the browser too).
  await expectOnlyTheThemeStored(page)

  // Every browser logs a generic "Failed to load resource: 404" line for any fetch
  // that comes back non-2xx, app code notwithstanding: the one unavoidable message
  // here is the isolation check just above (`GET /sales/<id>` from a business that
  // doesn't own it), which carries no id, name, note or amount — exactly what
  // ADR-0004's 404 is for. Anything else in the console still fails this assertion.
  //
  // `GET /customers/{id}/account` (`payments-front`) is wired by `payments-api` into
  // `app/main.py` on this branch (`payments-e2e`, after every payments subtask is
  // merged), so "Sale B"'s customer card above no longer 404s on its own account view.
  const RESOURCE_404 = 'error: Failed to load resource: the server responded with a status of 404 (Not Found)'
  expect(consoleMessages).toEqual([RESOURCE_404])
})
