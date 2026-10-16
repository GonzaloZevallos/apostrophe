/**
 * Análisis's own end-to-end run (plan, "Order": "The integration step runs the
 * end-to-end flow on the merged branch"; PRD metric "No curl": "the end-to-end
 * front run opens Más → Análisis, moves back a month and reads each section").
 *
 * A seller prices a variety, buys stock, sells some of it and records an expense —
 * then opens Análisis from Más, reads the month's variety row, the week-by-week,
 * day-by-week and expense sections, moves back a month (where there is nothing to
 * show, since everything above happened today) and reads every section again,
 * through the built front alone, against the real backend.
 */

import { ANALYSIS, SALE_NEW, STOCK_ENTRY_NEW, VARIETIES, WITHDRAWAL_NEW } from '../src/routes.js'
import { expectPath } from './helpers/url.js'
import { expect, test } from './fixtures.js'
import type { Page } from '@playwright/test'
import { signUpNewBusiness } from './helpers/signup.js'
import { watchConsole } from './console.js'
import { openGastos, openMas } from './helpers/openMas.js'
import { fillSaleLine } from './helpers/sale.js'
import { uniqueTag } from './helpers/unique.js'

test('a seller opens Análisis from Más, moves back a month and reads each section', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  const ownerEmail = `duena-analisis-${uniqueTag()}@example.com`
  const businessName = `Flores del Análisis ${uniqueTag()}`

  await signUpNewBusiness(page, { businessName, email: ownerEmail })
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // A priced variety.
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'Nueva variedad' }).click()
  await page.getByLabel('Nombre').fill('Rosa')
  await page.getByRole('button', { name: 'Agregá la variedad' }).click()
  await expect(page.getByText('Variedad guardada')).toBeVisible()
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('link', { name: 'Nuevo precio' }).click()
  await page.getByLabel(/^Precio de lista/).fill('900')
  await page.getByRole('button', { name: 'Guardá el precio' }).click()
  await expect(page.getByText('Precio guardado')).toBeVisible()

  // A stock entry (origin defaults to "Compra"), backdated into last month so the
  // business's first record — and so "Mes anterior" — is not this same month.
  await page.goto(STOCK_ENTRY_NEW)
  const todayIso = await page.getByLabel('Fecha').inputValue()
  const lastMonth = new Date(todayIso)
  lastMonth.setDate(1)
  lastMonth.setMonth(lastMonth.getMonth() - 1)
  await page.getByLabel('Fecha').fill(lastMonth.toISOString().slice(0, 10))
  await page.getByLabel('Gramos').fill('50')
  await page.getByLabel('Variedad').selectOption({ label: 'Rosa' })
  await page.getByLabel('Costo total').fill('20000')
  await page.getByRole('button', { name: 'Guardá la entrada' }).click()
  await expect(page.getByText('Entrada guardada')).toBeVisible()

  // A cash sale, today.
  await page.goto(SALE_NEW)
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '10' })
  await page.getByRole('radio', { name: 'Efectivo' }).check()
  await page.getByRole('button', { name: 'Guardá la venta' }).click()
  await expect(page.getByText('Venta guardada')).toBeVisible()

  // An expense, today, with a category created inline.
  await openGastos(page)
  await page.getByRole('link', { name: 'Cargar gasto' }).click()
  await page.getByRole('button', { name: 'Crear una categoría nueva' }).click()
  await page.getByLabel('Nombre de la categoría nueva').fill('Flete')
  await page.getByRole('button', { name: 'Crear categoría' }).click()
  await page.getByLabel('Monto').fill('1500')
  await page.getByLabel('Detalle').fill('Flete al mercado')
  await page.getByRole('button', { name: 'Guardá el gasto' }).click()
  await expect(page.getByText('Gasto guardado')).toBeVisible()

  // Más → Análisis.
  await openMas(page)
  await page.getByRole('navigation', { name: 'Más' }).getByRole('link', { name: /^Análisis/ }).click()
  await expectPath(page, ANALYSIS)

  // The current month: the variety row, week by week, by weekday and both expense
  // breakdowns all carry this month's activity. At this (desktop-sized) viewport,
  // `AnalisisCompu.dc.html`'s tables are the ones on screen — the phone's cards
  // carry the same rows but are CSS-hidden here, the same switch the shell's own
  // side rail/bottom bar already make.
  await expect(page.getByText('Vendiste en el mes')).toBeVisible()
  const varietyRow = page
    .locator('.analisis__tabla-contenedor--variedades tbody tr')
    .filter({ hasText: 'Rosa' })
  await expect(varietyRow).toBeVisible()
  await expect(varietyRow.getByRole('cell').nth(5)).toContainText('$') // Costo
  await expect(varietyRow.getByRole('cell').nth(6)).toContainText('$') // Margen

  await expect(page.getByText('Semana a semana · últimas 8')).toBeVisible()
  const weekRows = page.locator('.analisis__tabla-contenedor--semanas tbody tr')
  await expect(weekRows.first()).toBeVisible()

  await expect(page.getByText('Por día de la semana')).toBeVisible()
  await expect(page.locator('.analisis__dia').first()).toBeVisible()

  await expect(page.getByText('Gastos del mes')).toBeVisible()
  await expect(page.getByText('Flete').first()).toBeVisible()
  await expect(page.getByText('Van aparte, se cargan en Stock').first()).toBeVisible()

  await expect(page.locator('.gastos__mes-etiqueta').first()).toHaveText(/\S/)
  const monthLabelBefore = await page
    .locator('.gastos__mes-etiqueta')
    .first()
    .textContent()

  // Move back a month: nothing happened then, so the variety table says so, while
  // the week/weekday sections (not tied to the chosen month) and the purchases line
  // keep showing, at $0.
  await page.getByRole('button', { name: 'Mes anterior' }).click()
  await expect(page.locator('.gastos__mes-etiqueta').first()).not.toHaveText(
    monthLabelBefore ?? '',
  )
  await expect(page.getByText('No vendiste ni regalaste nada este mes.')).toBeVisible()
  await expect(page.getByText('Semana a semana · últimas 8')).toBeVisible()
  await expect(weekRows.first()).toBeVisible()
  await expect(page.getByText('Por día de la semana')).toBeVisible()
  await expect(page.getByText('Van aparte, se cargan en Stock').first()).toBeVisible()

  expect(consoleMessages).toEqual([])
})

/**
 * The cost lines on the rows, the header and "Desde el primer registro" (GH-141), through the
 * built front against the real backend. A cost is pending for the grams beyond every lot
 * (CONTEXT.md, Pending cost). The seeded business has:
 *
 * - Rosa: no stock entry at all, so everything taken from it is pending: a promotion of 2 g on
 *   the first of last month (a past month, fully pending), and today a negative adjustment of
 *   1 g (the current month's Faltante de stock, fully pending) and an own use of 1 g.
 * - Lirio: one purchase lot of 10 g for $ 10.000 and a sale of 15 g two weeks ago: its Costo de
 *   lo vendido is $ 10.000 y 5 g sin costo (a past week, partly pending).
 *
 * It saves screenshots of the header, the rows and "Desde el primer registro" at a phone and a
 * computer viewport, in both themes, as attachments of this test (the PR's evidence).
 */

function daysFrom(iso: string, days: number): string {
  const day = new Date(`${iso}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() + days)
  return day.toISOString().slice(0, 10)
}

function firstOfMonth(iso: string, monthsBack: number): string {
  const day = new Date(`${iso}T00:00:00Z`)
  day.setUTCDate(1)
  day.setUTCMonth(day.getUTCMonth() - monthsBack)
  return day.toISOString().slice(0, 10)
}

async function recordEntry(
  page: Page,
  entry: { date: string; grams: string; variety: string; origin: string; cost?: string },
): Promise<void> {
  await page.goto(STOCK_ENTRY_NEW)
  await page.getByLabel('Fecha').fill(entry.date)
  await page.getByLabel('Gramos').fill(entry.grams)
  await page.getByLabel('Variedad').selectOption({ label: entry.variety })
  await page.getByRole('button', { name: entry.origin, exact: true }).click()
  if (entry.cost !== undefined) await page.getByLabel('Costo total').fill(entry.cost)
  await page.getByRole('button', { name: 'Guardá la entrada' }).click()
  await expect(page.getByText('Entrada guardada')).toBeVisible()
}

async function recordWithdrawal(
  page: Page,
  withdrawal: { date: string; grams: string; variety: string; reason: string },
): Promise<void> {
  await page.goto(WITHDRAWAL_NEW)
  await page.getByLabel('Fecha').fill(withdrawal.date)
  await page.getByLabel('Variedad 1', { exact: true }).selectOption({ label: withdrawal.variety })
  await page.getByLabel('Gramos 1', { exact: true }).fill(withdrawal.grams)
  await page.getByRole('button', { name: withdrawal.reason, exact: true }).click()
  await page.getByRole('button', { name: 'Guardá el retiro' }).click()
  await expect(page.getByText('Retiro guardado')).toBeVisible()
}

test('Análisis reads Costo de lo vendido, Faltante de stock, Promoción and Consumo propio, fully and partly pending', async ({
  page,
}, testInfo) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)
  await signUpNewBusiness(page, {
    businessName: `Flores del Costo ${uniqueTag()}`,
    email: `duena-costo-${uniqueTag()}@example.com`,
  })

  for (const name of ['Rosa', 'Lirio']) {
    await page.goto(VARIETIES)
    await page.getByRole('link', { name: 'Nueva variedad' }).click()
    await page.getByLabel('Nombre').fill(name)
    await page.getByRole('button', { name: 'Agregá la variedad' }).click()
    await expect(page.getByText('Variedad guardada')).toBeVisible()
  }
  await page.goto(STOCK_ENTRY_NEW)
  const today = await page.getByLabel('Fecha').inputValue()
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: /Lirio/ }).click()
  await page.getByRole('link', { name: 'Nuevo precio' }).click()
  // The sale below is two weeks old, so the price has to be in force by then.
  await page.getByLabel('Rige desde').fill(firstOfMonth(today, 2))
  await page.getByLabel(/^Precio de lista/).fill('900')
  await page.getByRole('button', { name: 'Guardá el precio' }).click()
  await expect(page.getByText('Precio guardado')).toBeVisible()

  const lastMonth = firstOfMonth(today, 1)
  const twoWeeksAgo = daysFrom(today, -14)

  await recordEntry(page, {
    date: daysFrom(today, -30),
    grams: '10',
    variety: 'Lirio',
    origin: 'Compra',
    cost: '10000',
  })
  await recordEntry(page, { date: today, grams: '-1', variety: 'Rosa', origin: 'Ajuste' })
  await recordWithdrawal(page, { date: lastMonth, grams: '2', variety: 'Rosa', reason: 'Promoción' })
  await recordWithdrawal(page, { date: today, grams: '1', variety: 'Rosa', reason: 'Consumo propio' })

  await page.goto(SALE_NEW)
  await page.getByLabel('Fecha').fill(twoWeeksAgo)
  await fillSaleLine(page, 1, { variety: 'Lirio', grams: '15' })
  await page.getByRole('radio', { name: 'Efectivo' }).check()
  await page.getByRole('button', { name: 'Guardá la venta' }).click()
  await expect(page.getByText('Venta guardada')).toBeVisible()

  // The computer: the week and month tables carry one cost sub-row under each row.
  await page.setViewportSize({ width: 1280, height: 920 })
  await page.goto(ANALYSIS)
  await expect(page.getByText('Vendiste en el mes')).toBeVisible()
  const weekCosts = page.locator('.analisis__tabla-contenedor--semanas .analisis__fila-costos')
  const monthCosts = page.locator('.analisis__tabla-contenedor--meses .analisis__fila-costos')
  const weekRows = await weekCosts.count()
  expect(weekRows).toBeGreaterThan(2)
  for (const costs of [weekCosts, monthCosts]) {
    for (let i = 0; i < (await costs.count()); i += 1) {
      await expect(costs.nth(i)).toContainText('Costo de lo vendido')
    }
  }

  // A past week, partly pending: the costed 10 g plus 5 g still without a cost.
  await expect(
    weekCosts.filter({ hasText: 'Costo de lo vendido $ 10.000 y 5 g sin costo' }),
  ).toHaveCount(1)
  // A week with no sales reads a real $ 0.
  await expect(weekCosts.filter({ hasText: 'Costo de lo vendido $ 0' }).first()).toBeVisible()
  // The current week, its last row, has the fully pending shortfall and own use.
  await expect(weekCosts.last()).toContainText('Faltante de stock 1 g sin costo')
  await expect(weekCosts.last()).toContainText('Consumo propio 1 g sin costo')
  await expect(weekCosts.first()).not.toContainText('Faltante de stock')
  // A past month, fully pending promotion; only the current month has the shortfall.
  await expect(monthCosts.filter({ hasText: 'Promoción 2 g sin costo' })).toHaveCount(1)
  await expect(monthCosts.filter({ hasText: 'Faltante de stock 1 g sin costo' })).toHaveCount(1)
  await expect(monthCosts.last()).toContainText('Faltante de stock 1 g sin costo')

  // The header and "Desde el primer registro": fully pending, grams only.
  const header = page.locator('.cuerpo > div').filter({ hasText: 'Vendiste en el mes' }).first()
  await expect(header).toContainText('Faltante de stock 1 g sin costo')
  await expect(header).toContainText('Consumo propio 1 g sin costo')
  const since = page.locator('.analisis__historico')
  await expect(since).toContainText('Faltante de stock 1 g sin costo')
  await expect(since).toContainText('Promoción 2 g sin costo')
  await expect(since).toContainText('Consumo propio 1 g sin costo')

  // Never a pending cost read as a zero, anywhere a cost line is drawn.
  for (const region of [weekCosts, monthCosts, header, since]) {
    await expect(region.first()).not.toContainText(/\$ 0 y \d/)
  }

  // The same rows on the phone, as cards.
  await page.setViewportSize({ width: 390, height: 844 })
  const phoneWeeks = page.locator('.analisis__semana')
  await expect(phoneWeeks.filter({ hasText: 'Costo de lo vendido $ 10.000 y 5 g sin costo' })).toHaveCount(1)
  await expect(phoneWeeks.last()).toContainText('Faltante de stock 1 g sin costo')
  await expect(page.locator('.analisis__mes-fila').filter({ hasText: 'Promoción 2 g sin costo' })).toHaveCount(1)

  // Screenshots for the PR: header, the rows and the since-the-first-record block, per
  // viewport and theme.
  for (const [viewport, size] of [
    ['telefono', { width: 390, height: 844 }],
    ['computadora', { width: 1280, height: 920 }],
  ] as const) {
    await page.setViewportSize(size)
    for (const theme of ['claro', 'oscuro']) {
      await page.evaluate((value) => {
        if (value === 'oscuro') document.documentElement.dataset.tema = 'oscuro'
        else document.documentElement.removeAttribute('data-tema')
      }, theme)
      const rows = viewport === 'telefono' ? page.locator('.analisis__semanas') : page.locator('.analisis__tabla-contenedor--semanas')
      const months = viewport === 'telefono' ? page.locator('.analisis__meses') : page.locator('.analisis__tabla-contenedor--meses')
      for (const [name, target] of [
        ['encabezado', header],
        ['semanas', rows],
        ['meses', months],
        ['desde-el-primer-registro', since],
      ] as const) {
        const file = testInfo.outputPath(`analisis-${viewport}-${theme}-${name}.png`)
        await target.screenshot({ path: file })
        await testInfo.attach(`analisis-${viewport}-${theme}-${name}`, { path: file, contentType: 'image/png' })
      }
    }
  }

  expect(consoleMessages).toEqual([])
})
