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

import { ANALYSIS, HOME, SALE_NEW, STOCK_ENTRY_NEW, VARIETIES } from '../src/routes.js'
import { expectPath } from './helpers/url.js'
import { expect, test } from './fixtures.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { watchConsole } from './console.js'
import { openGastos, openMas } from './helpers/openMas.js'
import { fillSaleLine } from './helpers/sale.js'

test('a seller opens Análisis from Más, moves back a month and reads each section', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  const ownerEmail = `duena-analisis-${Date.now()}@example.com`
  const businessName = `Flores del Análisis ${Date.now()}`

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

  // A negative adjustment, today: 2 g out of that entry, costed at its $ 400 a gram.
  await page.goto(STOCK_ENTRY_NEW)
  await page.getByLabel('Gramos').fill('-2')
  await page.getByLabel('Variedad').selectOption({ label: 'Rosa' })
  await page.getByRole('button', { name: 'Ajuste', exact: true }).click()
  await page.getByRole('button', { name: 'Guardá la entrada' }).click()
  await expect(page.getByText('Entrada guardada')).toBeVisible()

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

  // Costo de lo vendido and Faltante de stock on the rows, from the phone (Más → Análisis)
  // and from the computer's sidebar. The 10 g sold today came from a 20.000 entry of 50 g:
  // $ 4.000 of cost; the 2 g adjusted out of it are a $ 800 shortfall; the expense is $ 1.500.
  const phone = { width: 390, height: 844 }
  await page.setViewportSize(phone)
  await page.goto(HOME)
  await page.getByRole('link', { name: 'Más', exact: true }).click()
  await page.getByRole('navigation', { name: 'Más' }).getByRole('link', { name: /^Análisis/ }).click()
  await expectPath(page, ANALYSIS)
  for (const row of [page.locator('.analisis__semana').last(), page.locator('.analisis__mes-fila').last()]) {
    await expect(row).toContainText('Costo de lo vendido $ 4.000')
    await expect(row).toContainText('Faltante de stock $ 800')
    await expect(row).toContainText('Gastos $ 1.500')
  }

  await page.setViewportSize({ width: 1280, height: 920 })
  await page.goto(HOME)
  await page.getByRole('link', { name: /^Análisis/ }).click()
  await expectPath(page, ANALYSIS)
  for (const section of ['semanas', 'meses']) {
    const lines = page.locator(`.analisis__tabla-contenedor--${section} .analisis__fila-costos`).last()
    await expect(lines.getByText('Costo de lo vendido $ 4.000', { exact: true })).toBeVisible()
    await expect(lines.getByText('Faltante de stock $ 800', { exact: true })).toBeVisible()
    await expect(lines.getByText('Gastos $ 1.500', { exact: true })).toBeVisible()
  }

  expect(consoleMessages).toEqual([])
})
