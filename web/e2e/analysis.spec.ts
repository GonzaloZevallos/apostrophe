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
import { setPriceDate } from './helpers/priceDate.js'
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
  await page.getByRole('link', { name: 'New variety' }).click()
  await page.getByLabel('Name').fill('Rosa')
  await page.getByRole('button', { name: 'Add the variety' }).click()
  await expect(page.getByText('Variety saved')).toBeVisible()
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('link', { name: 'New price' }).click()
  await page.getByLabel(/^List price/).fill('900')
  await page.getByRole('button', { name: 'Save the price' }).click()
  await expect(page.getByText('Price saved')).toBeVisible()

  // A stock entry (origin defaults to "Purchase"), backdated into last month so the
  // business's first record — and so "Previous month" — is not this same month.
  await page.goto(STOCK_ENTRY_NEW)
  const todayIso = await page.getByLabel('Date').inputValue()
  await page.getByLabel('Date').fill(firstOfMonth(todayIso, 1))
  await page.getByLabel('Grams').fill('50')
  await page.getByLabel('Variety').selectOption({ label: 'Rosa' })
  await page.getByLabel('Total cost').fill('20000')
  await page.getByRole('button', { name: 'Save the entry' }).click()
  await expect(page.getByText('Entry saved')).toBeVisible()

  // A cash sale, today.
  await page.goto(SALE_NEW)
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '10' })
  await page.getByRole('radio', { name: 'Cash' }).check()
  await page.getByRole('button', { name: 'Save sale' }).click()
  await expect(page.getByText('Sale saved')).toBeVisible()

  // An expense, today, with a category created inline.
  await openGastos(page)
  await page.getByRole('link', { name: 'Add expense' }).click()
  await page.getByRole('button', { name: 'Create a new category' }).click()
  await page.getByLabel('New category name').fill('Flete')
  await page.getByRole('button', { name: 'Create category' }).click()
  await page.getByLabel('Amount').fill('1500')
  await page.getByLabel('Details').fill('Flete al mercado')
  await page.getByRole('button', { name: 'Save the expense' }).click()
  await expect(page.getByText('Expense saved')).toBeVisible()

  // Más → Análisis.
  await openMas(page)
  await page.getByRole('navigation', { name: 'More' }).getByRole('link', { name: /^Analysis/ }).click()
  await expectPath(page, ANALYSIS)

  // The current month: the variety row, week by week, by weekday and both expense
  // breakdowns all carry this month's activity. At this (desktop-sized) viewport,
  // `AnalisisCompu.dc.html`'s tables are the ones on screen — the phone's cards
  // carry the same rows but are CSS-hidden here, the same switch the shell's own
  // side rail/bottom bar already make.
  await expect(page.getByText('You sold in the month')).toBeVisible()
  const varietyRow = page
    .locator('.analisis__tabla-contenedor--variedades tbody tr')
    .filter({ hasText: 'Rosa' })
  await expect(varietyRow).toBeVisible()
  await expect(varietyRow.getByRole('cell').nth(5)).toContainText('$') // Costo
  await expect(varietyRow.getByRole('cell').nth(6)).toContainText('$') // Margen

  await expect(page.getByText('Week by week · last 8')).toBeVisible()
  const weekRows = page.locator('.analisis__tabla-contenedor--semanas tbody tr')
  await expect(weekRows.first()).toBeVisible()

  await expect(page.getByText('By day of the week')).toBeVisible()
  await expect(page.locator('.analisis__dia').first()).toBeVisible()

  await expect(page.getByText('Expenses of the month')).toBeVisible()
  await expect(page.getByText('Flete').first()).toBeVisible()
  await expect(page.getByText('Kept apart, added in Stock').first()).toBeVisible()

  await expect(page.locator('.gastos__mes-etiqueta').first()).toHaveText(/\S/)
  const monthLabelBefore = await page
    .locator('.gastos__mes-etiqueta')
    .first()
    .textContent()

  // Move back a month: nothing happened then, so the variety table says so, while
  // the week/weekday sections (not tied to the chosen month) and the purchases line
  // keep showing, at $0.
  await page.getByRole('button', { name: 'Previous month' }).click()
  await expect(page.locator('.gastos__mes-etiqueta').first()).not.toHaveText(
    monthLabelBefore ?? '',
  )
  await expect(page.getByText('You did not sell or give away anything this month.')).toBeVisible()
  await expect(page.getByText('Week by week · last 8')).toBeVisible()
  await expect(weekRows.first()).toBeVisible()
  await expect(page.getByText('By day of the week')).toBeVisible()
  await expect(page.getByText('Kept apart, added in Stock').first()).toBeVisible()

  expect(consoleMessages).toEqual([])
})

/**
 * The cost lines on the rows, the header and "Desde el primer registro" (GH-141), through the
 * built front against the real backend. A cost is pending for the grams beyond every lot
 * (CONTEXT.md, Pending cost). The seeded business has:
 *
 * - Rosa: no stock entry at all, so everything taken from it is pending: a promotion of 2 g on
 *   the first of last month (a past month, fully pending), and today a negative adjustment of
 *   1 g (the current month's Stock shortfall, fully pending) and an own use of 1 g.
 * - Lirio: one purchase lot of 10 g for $ 10.000 and a sale of 15 g two weeks ago: its Costo de
 *   is $ 10.000 and 5 g without cost (a past week, partly pending).
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
  await page.getByLabel('Date').fill(entry.date)
  await page.getByLabel('Grams').fill(entry.grams)
  await page.getByLabel('Variety').selectOption({ label: entry.variety })
  await page.getByRole('button', { name: entry.origin, exact: true }).click()
  if (entry.cost !== undefined) await page.getByLabel('Total cost').fill(entry.cost)
  await page.getByRole('button', { name: 'Save the entry' }).click()
  await expect(page.getByText('Entry saved')).toBeVisible()
}

async function recordWithdrawal(
  page: Page,
  withdrawal: { date: string; grams: string; variety: string; reason: string },
): Promise<void> {
  await page.goto(WITHDRAWAL_NEW)
  await page.getByLabel('Date').fill(withdrawal.date)
  await page.getByLabel('Variety 1', { exact: true }).selectOption({ label: withdrawal.variety })
  await page.getByLabel('Grams 1', { exact: true }).fill(withdrawal.grams)
  await page.getByRole('button', { name: withdrawal.reason, exact: true }).click()
  await page.getByRole('button', { name: 'Save the withdrawal' }).click()
  await expect(page.getByText('Withdrawal saved')).toBeVisible()
}

test('Análisis reads Cost of goods sold, Stock shortfall, Promotion and Own use, fully and partly pending', async ({
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
    await page.getByRole('link', { name: 'New variety' }).click()
    await page.getByLabel('Name').fill(name)
    await page.getByRole('button', { name: 'Add the variety' }).click()
    await expect(page.getByText('Variety saved')).toBeVisible()
  }
  await page.goto(STOCK_ENTRY_NEW)
  const today = await page.getByLabel('Date').inputValue()
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: /Lirio/ }).click()
  await page.getByRole('link', { name: 'New price' }).click()
  // The sale below is two weeks old, so the price has to be in force by then.
  await setPriceDate(page, firstOfMonth(today, 2))
  await page.getByLabel(/^List price/).fill('900')
  await page.getByRole('button', { name: 'Save the price' }).click()
  await expect(page.getByText('Price saved')).toBeVisible()

  const lastMonth = firstOfMonth(today, 1)
  const twoWeeksAgo = daysFrom(today, -14)

  await recordEntry(page, {
    date: daysFrom(today, -30),
    grams: '10',
    variety: 'Lirio',
    origin: 'Purchase',
    cost: '10000',
  })
  await recordEntry(page, { date: today, grams: '-1', variety: 'Rosa', origin: 'Adjustment' })
  await recordWithdrawal(page, { date: lastMonth, grams: '2', variety: 'Rosa', reason: 'Promotion' })
  await recordWithdrawal(page, { date: today, grams: '1', variety: 'Rosa', reason: 'Own use' })

  await page.goto(SALE_NEW)
  await page.getByLabel('Date').fill(twoWeeksAgo)
  await fillSaleLine(page, 1, { variety: 'Lirio', grams: '15' })
  await page.getByRole('radio', { name: 'Cash' }).check()
  await page.getByRole('button', { name: 'Save sale' }).click()
  await expect(page.getByText('Sale saved')).toBeVisible()

  // The computer: the week and month tables carry one cost sub-row under each row.
  await page.setViewportSize({ width: 1280, height: 920 })
  await page.goto(ANALYSIS)
  await expect(page.getByText('You sold in the month')).toBeVisible()
  const weekCosts = page.locator('.analisis__tabla-contenedor--semanas .analisis__fila-costos')
  const monthCosts = page.locator('.analisis__tabla-contenedor--meses .analisis__fila-costos')
  const weekRows = await weekCosts.count()
  expect(weekRows).toBeGreaterThan(2)
  for (const costs of [weekCosts, monthCosts]) {
    for (let i = 0; i < (await costs.count()); i += 1) {
      await expect(costs.nth(i)).toContainText('Cost of goods sold')
    }
  }

  // A past week, partly pending: the costed 10 g plus 5 g still without a cost.
  await expect(
    weekCosts.filter({ hasText: 'Cost of goods sold $ 10.000 and 5 g without cost' }),
  ).toHaveCount(1)
  // A week with no sales reads a real $ 0.
  await expect(weekCosts.filter({ hasText: 'Cost of goods sold $ 0' }).first()).toBeVisible()
  // The current week, its last row, has the fully pending shortfall and own use.
  await expect(weekCosts.last()).toContainText('Stock shortfall 1 g without cost')
  await expect(weekCosts.last()).toContainText('Own use 1 g without cost')
  await expect(weekCosts.first()).not.toContainText('Stock shortfall')
  // A past month, fully pending promotion; only the current month has the shortfall.
  await expect(monthCosts.filter({ hasText: 'Promotion 2 g without cost' })).toHaveCount(1)
  await expect(monthCosts.filter({ hasText: 'Stock shortfall 1 g without cost' })).toHaveCount(1)
  await expect(monthCosts.last()).toContainText('Stock shortfall 1 g without cost')

  // The header and "Desde el primer registro": fully pending, grams only.
  const header = page.locator('.cuerpo > div').filter({ hasText: 'You sold in the month' }).first()
  await expect(header).toContainText('Stock shortfall 1 g without cost')
  await expect(header).toContainText('Own use 1 g without cost')
  const since = page.locator('.analisis__historico')
  await expect(since).toContainText('Stock shortfall 1 g without cost')
  await expect(since).toContainText('Promotion 2 g without cost')
  await expect(since).toContainText('Own use 1 g without cost')

  // Never a pending cost read as a zero, anywhere a cost line is drawn.
  for (const region of [weekCosts, monthCosts, header, since]) {
    await expect(region.first()).not.toContainText(/\$ 0 y \d/)
  }

  // The same rows on the phone, as cards.
  await page.setViewportSize({ width: 390, height: 844 })
  const phoneWeeks = page.locator('.analisis__semanas > .analisis__tarjeta')
  await expect(phoneWeeks.filter({ hasText: 'Cost of goods sold $ 10.000 and 5 g without cost' })).toHaveCount(1)
  await expect(phoneWeeks.last()).toContainText('Stock shortfall 1 g without cost')
  await expect(page.locator('.analisis__meses > .analisis__tarjeta').filter({ hasText: 'Promotion 2 g without cost' })).toHaveCount(1)

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

test('Análisis cards fit at 320 px and at 246 px with a 60-character name and nine-digit figures', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)
  await signUpNewBusiness(page, {
    businessName: `Flores del Ancho ${uniqueTag()}`,
    email: `duena-ancho-${uniqueTag()}@example.com`,
  })

  const longName = 'Rosa de invernadero de pétalos grandes y color muy intenso 1'.slice(0, 60)
  expect(longName).toHaveLength(60)
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'New variety' }).click()
  await page.getByLabel('Name').fill(longName)
  await page.getByRole('button', { name: 'Add the variety' }).click()
  await expect(page.getByText('Variety saved')).toBeVisible()
  await page.getByRole('link', { name: /Rosa de invernadero/ }).click()
  await page.getByRole('link', { name: 'New price' }).click()
  await page.getByLabel(/^List price/).fill('900000')
  await page.getByRole('button', { name: 'Save the price' }).click()
  await expect(page.getByText('Price saved')).toBeVisible()

  // The first record is two weeks old, so there is more than the current week. 10 g are costed; the 500 g sold leave 490 g without a cost: a partly pending figure.
  await page.goto(STOCK_ENTRY_NEW)
  const today = await page.getByLabel('Date').inputValue()
  await recordEntry(page, { date: daysFrom(today, -14), grams: '10', variety: longName, origin: 'Purchase', cost: '10000' })
  await page.goto(SALE_NEW)
  await fillSaleLine(page, 1, { variety: longName, grams: '500' })
  await page.getByRole('radio', { name: 'Cash' }).check()
  await page.getByRole('button', { name: 'Save sale' }).click()
  await expect(page.getByText('Sale saved')).toBeVisible()

  for (const width of [320, 246]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(ANALYSIS)
    await expect(page.getByText('You sold in the month')).toBeVisible()

    // The cards' column holds nothing wider than the page. The hero's nine-digit figure and
    // the aside are fitted by the hero-and-aside subtask, which owns the page-level check
    // (`documentElement.scrollWidth <= clientWidth`) once they fit.
    const wide = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.analisis__principal, .analisis__principal *'))
        .filter((node) => node.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5)
        .map((node) => `${node.tagName}.${node.className}:${node.textContent?.slice(0, 30)}`)
        .slice(0, 12),
    )
    expect(wide, `elements of the cards wider than the page at ${width} px`).toEqual([])

    const name = page.locator('.analisis__variedades .analisis__tarjeta-titulo').first()
    const truncated = await name.evaluate((node) => ({
      cut: node.scrollWidth > node.clientWidth,
      overflow: getComputedStyle(node).textOverflow,
    }))
    expect(truncated).toEqual({ cut: true, overflow: 'ellipsis' })

    // Every pending line sits below the figure it belongs to, whole.
    const pendings = page.locator('.analisis__tarjeta-pendiente')
    expect(await pendings.count()).toBeGreaterThan(0)
    for (let i = 0; i < (await pendings.count()); i += 1) {
      const gap = await pendings.nth(i).evaluate((node) => {
        const figure = node.parentElement?.querySelector('.analisis__tarjeta-cifra')
        if (!figure) return Number.POSITIVE_INFINITY
        return node.getBoundingClientRect().top - figure.getBoundingClientRect().bottom
      })
      expect(gap).toBeGreaterThanOrEqual(0)
    }

    // The current week is set apart by its border, not by its fill alone.
    const edges = await page.locator('.analisis__semanas > .analisis__tarjeta').evaluateAll((cards) =>
      cards.map((card) => getComputedStyle(card).borderInlineStartWidth),
    )
    expect(edges.at(-1)).not.toBe(edges[0])
  }
  expect(consoleMessages).toEqual([])
})
