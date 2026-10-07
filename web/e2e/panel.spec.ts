/**
 * The panel's own end-to-end run (plan, subtask `e2e`: "Open Inicio and check that
 * every figure equals `GET /panel`, read in the same run"), against the real
 * backend, through the built front alone (PRD, M1: "no `curl` at any point").
 *
 * `flow.spec.ts`, `sales.spec.ts`, `payments.spec.ts` and `catalog.spec.ts` cover
 * everything offered before this task; this file seeds, through the front, exactly
 * what `results.md`'s PRD needs a figure for — a priced variety, a purchase, a sale
 * left owing, a sale paid on the spot, an expense — then proves Inicio (now the
 * panel) shows nothing it did not read from `GET /panel` in this same run: every
 * figure, across Hoy, Semana and Mes, and the "Te deben" teaser's own navigation
 * (PRD, "No curl" metric: "opens Inicio, switches across the three periods, opens
 * Te deben from the block and a customer from the teaser").
 *
 * The screen's own figures are never recomputed here from the seed (plan invariant:
 * "No screen does arithmetic ... on an amount from the API") — this file only
 * formats the one `GET /panel` answer it fetches directly and compares that text to
 * what Inicio renders, the same way `catalog.spec.ts` compares the clipboard to
 * `GET /catalog`'s own text.
 *
 * `consoleMessages` is asserted empty at the end, and the browser's own storage too
 * (CODING_STANDARDS.md section 9: no figure or customer name belongs in either) —
 * exactly like `payments.spec.ts`, since this run carries a customer name and
 * several amounts through the panel alone.
 */

import { CUSTOMER, CUSTOMERS, CUSTOMER_NEW, HOME, SALES, SALE_NEW, STOCK_ENTRY_NEW, VARIETIES, pathTo } from '../src/routes.js'
import { expectPath } from './helpers/url.js'
import { expect, test } from '@playwright/test'
import { signUpNewBusiness } from './helpers/signup.js'
import { watchConsole } from './console.js'
import { openGastos } from './helpers/openMas.js'
import { fillSaleLine } from './helpers/sale.js'
import { expectOnlyTheThemeStored } from './helpers/storage.js'

interface PanelPeriod {
  start: string
  end: string
  sales: number
  sales_count: number
  average_sale: number | null
  grams_sold: number
  grams_gifted: number
  cost_of_goods: number
  pending_cost: boolean
  expenses: number
  purchases: number
  profit: number
  cash: number
}

type Status = 'no_entries' | 'sold_out' | 'low' | 'ok'

interface PanelAnswer {
  periods: { today: PanelPeriod; week: PanelPeriod; month: PanelPeriod }
  debts: {
    total_owed: number
    sales_owing_count: number
    oldest: string | null
    teaser: { customer_id: number; name: string; balance: number; owing_since: string }[]
  }
  stock: {
    variety_id: number
    name: string
    grams: number
    status: Status
    sold_out_since: string | null
    threshold: number | null
    days_left: number | null
  }[]
}

function shortDate(iso: string): string {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

function pesos(amount: number): string {
  return `$ ${Math.round(amount).toLocaleString('es-AR')}`
}

function signedPesos(amount: number): string {
  const rounded = Math.round(amount)
  return rounded < 0 ? `−${pesos(Math.abs(rounded))}` : pesos(rounded)
}

function grams(value: number): string {
  return `${value.toLocaleString('es-AR', { maximumFractionDigits: 2 })} g`
}

function countLabel(count: number): string {
  return `${count} ${count === 1 ? 'venta' : 'ventas'}`
}

// A local mirror of `web/src/components/MarcaEstado.tsx`'s own word table and
// `web/src/stock/detail.ts`'s `detailFor` — this file never imports `web/src`
// (every other e2e spec duplicates its own small formatters the same way), and
// every value fed through it below comes from the one `GET /panel` answer this
// run fetches, never invented.
const STATUS_WORD: Record<Status, string> = {
  no_entries: 'sin entradas',
  sold_out: 'agotada',
  low: 'baja',
  ok: 'ok',
}

function detailFor(
  variety: { status: Status; sold_out_since: string | null; threshold: number | null },
  today: string,
): string {
  switch (variety.status) {
    case 'no_entries':
      return 'Cargale la primera entrada'
    case 'sold_out':
      return variety.sold_out_since === null
        ? 'Sin gramos'
        : `Sin gramos desde el ${formatDate(variety.sold_out_since, today)}`
    case 'low':
      return variety.threshold === null
        ? 'Avisás por debajo del umbral'
        : `Avisás abajo de ${grams(variety.threshold)}`
    case 'ok':
      return 'Al ritmo de los últimos 30 días'
  }
}

/** `web/src/stock/detail.ts`'s own `sideNoteFor`: the one place `days_left`
 * itself shows, in `.fila-stock__insignia` — never in the detail line. */
function sideNoteFor(variety: { status: Status; days_left: number | null }): string | null {
  if (variety.status === 'sold_out') return 'agotada'
  if (variety.status === 'no_entries') return 'sin entradas'
  if (variety.days_left === null) return null
  return `${variety.days_left} días`
}

/** `web/src/format/dates.ts`'s own `formatDate`: dd/mm, or dd/mm/yyyy when the
 * year differs from `todayIso`'s. */
function formatDate(iso: string, todayIso: string): string {
  const [year] = iso.split('-')
  const [todayYear] = todayIso.split('-')
  return year === todayYear ? shortDate(iso) : `${shortDate(iso)}/${year}`
}

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

test('a seller sees the panel agree with GET /panel, across periods, from the front alone', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  const ownerEmail = `duena-panel-${Date.now()}@example.com`
  const businessName = `Flores del Panel ${Date.now()}`

  // Accept a new-business invitation.
  await signUpNewBusiness(page, { businessName, email: ownerEmail })
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // A priced variety.
  await page.goto(VARIETIES)
  await page.getByRole('button', { name: 'Nueva variedad' }).click()
  await page.getByLabel('Nombre').fill('Rosa')
  await page.getByRole('button', { name: 'Agregá la variedad' }).click()
  await expect(page.getByText('Variedad guardada')).toBeVisible()
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('link', { name: 'Nuevo precio' }).click()
  // Backdated well before this run's own month (sales.spec.ts does the same for
  // Jazmín): the extra, month-only sale seeded below needs a price that reaches
  // back that far too.
  await page.getByLabel('Rige desde').fill('2000-01-01')
  await page.getByLabel(/^Precio de lista/).fill('1000')
  await page.getByRole('button', { name: 'Guardá el precio' }).click()
  await expect(page.getByText('Precio guardado')).toBeVisible()

  // A purchase: the "Origen" pill defaults to "Compra" (`EntradaStock.tsx`).
  await page.goto(STOCK_ENTRY_NEW)
  await page.getByLabel('Gramos').fill('50')
  await page.getByLabel('Variedad').selectOption({ label: 'Rosa' })
  await expect(page.getByRole('button', { name: 'Compra' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Costo total').fill('45000')
  await page.getByRole('button', { name: 'Guardá la entrada' }).click()
  await expect(page.getByText('Entrada guardada')).toBeVisible()

  // A customer, for the sale left owing.
  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Teléfono').fill('+5491155550077')
  await page.getByLabel('Nombre').fill('Carla Pérez')
  await page.getByRole('button', { name: 'Guardá y usá' }).click()
  await expectPath(page, CUSTOMER)
  await expect(page.getByText('Cliente guardado')).toBeVisible()

  // A sale left owing, to Carla.
  await page.getByRole('link', { name: 'Nueva venta a Carla Pérez' }).click()
  await expectPath(page, SALE_NEW)
  const todayIso = await page.getByLabel('Fecha').inputValue()
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '5' })
  await page.getByRole('radio', { name: 'Debiendo' }).check()
  await page.getByRole('button', { name: 'Guardá la venta' }).click()
  await expect(page.getByText('Venta guardada')).toBeVisible()

  // A sale paid on the spot, no customer.
  await page.goto(SALES)
  await page.getByRole('link', { name: 'Nueva venta' }).click()
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '3' })
  await page.getByRole('radio', { name: 'Efectivo' }).check()
  await page.getByRole('button', { name: 'Guardá la venta' }).click()
  await expect(page.getByText('Venta guardada')).toBeVisible()

  // Two more sales, dated at the start of this week and the start of this month —
  // so Hoy, Semana and Mes can differ by more than their range label, whatever day
  // this run happens to land on. `mondayIso` and `monthStartIso` are each today or
  // earlier, never future (a week's or a month's start never comes after the today
  // it contains), so both are always safe to seed; deduplicated against `todayIso`
  // and each other, so a day that already carries a sale (today being Monday, or
  // the 1st of the month) is never seeded twice. Whichever of the two falls outside
  // the current month (when the week crosses a month boundary, as it does whenever
  // today is early in the month) widens Semana past Mes; whichever falls outside
  // the current week widens Mes past Semana — between the two, at least one real
  // difference from Hoy's own figures is guaranteed.
  // Seeded directly, through the same session's own `page.request` (`sales.spec.ts`
  // already seeds this way for its own period checks) — this is the panel's own
  // seam, "the end-to-end front run", not a `curl` shortcut: same browser, same
  // cookies, no second process.
  const monthStartIso = `${todayIso.slice(0, 7)}-01`
  const mondayOffset = weekdayOf(todayIso) === 0 ? -6 : 1 - weekdayOf(todayIso)
  const mondayIso = addDays(todayIso, mondayOffset)
  const extraDatesIso = [...new Set([mondayIso, monthStartIso])].filter((iso) => iso !== todayIso)
  if (extraDatesIso.length > 0) {
    const varietiesAnswer: { id: number; name: string }[] = await (
      await page.request.get(`/varieties?on=${todayIso}`)
    ).json()
    const rosaId = varietiesAnswer.find((variety) => variety.name === 'Rosa')?.id
    if (rosaId === undefined) throw new Error('Rosa missing from GET /varieties?on=')
    for (const dateIso of extraDatesIso) {
      const extraResponse = await page.request.post('/sales', {
        data: {
          date: dateIso,
          customer_id: null,
          shipping_charged: 0,
          note: null,
          payment: 'cash',
          lines: [{ variety_id: rosaId, grams: '1', gift: false, special_price: null }],
        },
      })
      expect(extraResponse.ok()).toBe(true)
    }
  }

  // An expense, in the business's own default "Otros" category.
  await openGastos(page)
  await page.getByRole('link', { name: 'Cargar gasto' }).click()
  await page.getByLabel('Categoría').selectOption({ label: 'Otros' })
  await page.getByLabel('Monto').fill('1500')
  await page.getByLabel('Detalle').fill('Bolsas de regalo')
  await page.getByRole('button', { name: 'Guardá el gasto' }).click()
  await expect(page.getByText('Gasto guardado')).toBeVisible()

  // `GET /panel`, read in this same run: the one answer Inicio must agree with,
  // figure for figure, never recomputed here (plan invariant).
  const panel = await page.evaluate(() =>
    fetch('/panel', { credentials: 'include' }).then((response) => response.json() as Promise<PanelAnswer>),
  )

  await page.goto(HOME)
  await expect(page.locator('.encabezado__titulo')).toHaveText('Inicio')

  async function assertPeriod(period: PanelPeriod, rangeText: string): Promise<void> {
    await expect(page.locator('.periodos .pie')).toContainText(rangeText)
    await expect(page.locator('.panel-ventas .cifra-xl')).toHaveText(pesos(period.sales))
    await expect(
      page.locator('.panel-resultados__celda').filter({ hasText: 'Ganancia' }).locator('.panel-resultados__valor--acento'),
    ).toHaveText(signedPesos(period.profit))
    await expect(
      page.locator('.panel-resultados__celda').filter({ hasText: 'Caja' }).locator('.panel-resultados__valor'),
    ).toHaveText(signedPesos(period.cash))
    await expect(
      page.locator('.panel-lista__fila').filter({ hasText: 'Costo de lo vendido' }).locator('.panel-lista__valor'),
    ).toHaveText(pesos(period.cost_of_goods))
    await expect(
      page.locator('.panel-lista__fila').filter({ hasText: 'Gastos' }).locator('.panel-lista__valor'),
    ).toHaveText(pesos(period.expenses))
    await expect(
      page.locator('.panel-lista__fila').filter({ hasText: 'Regalaste' }).locator('.panel-lista__valor'),
    ).toHaveText(grams(period.grams_gifted))
    await expect(
      page.locator('.panel-lista__fila').filter({ hasText: 'Compras de flores' }).locator('.panel-lista__valor'),
    ).toHaveText(pesos(period.purchases))

    // "Vendiste ..."'s own subtitle: count, average (absent with no sales) and
    // grams sold (`Inicio.tsx`'s own `salesSubtitle`).
    const count = countLabel(period.sales_count)
    const gramsSoldText = grams(period.grams_sold)
    const subtitle =
      period.average_sale === null
        ? `${count} · ${gramsSoldText}`
        : `${count} · promedio ${pesos(period.average_sale)} · ${gramsSoldText}`
    await expect(page.locator('.panel-ventas .pie')).toHaveText(subtitle)

    // "incluye costo pendiente", under both Costo de lo vendido and Ganancia only,
    // never under Caja (plan, PRD: "Caja never carries it").
    await expect(page.getByText('incluye costo pendiente')).toHaveCount(period.pending_cost ? 2 : 0)
  }

  // Hoy: the panel opens here (plan, "Front").
  await expect(page.getByRole('button', { name: 'Hoy', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await assertPeriod(panel.periods.today, shortDate(todayIso))

  // Semana.
  await page.getByRole('button', { name: 'Semana' }).click()
  await assertPeriod(panel.periods.week, `${shortDate(panel.periods.week.start)} – ${shortDate(panel.periods.week.end)}`)

  // Mes.
  await page.getByRole('button', { name: 'Mes' }).click()
  await assertPeriod(panel.periods.month, `${shortDate(panel.periods.month.start)} – ${shortDate(panel.periods.month.end)}`)

  // Back to Hoy for the rest of the run.
  await page.getByRole('button', { name: 'Hoy', exact: true }).click()

  // Lo que te queda: Rosa's own row, straight from the fetched answer — grams,
  // status (shape and word), the detail line, and the side badge, which is the
  // one place days left itself shows (`sideNoteFor`, never the detail line).
  const rosa = panel.stock.find((row) => row.name === 'Rosa')
  if (rosa === undefined) throw new Error('Rosa missing from GET /panel stock')
  const rosaRow = page.locator('.fila-stock').filter({ hasText: 'Rosa' })
  await expect(rosaRow.locator('.fila-stock__gramos')).toHaveText(grams(rosa.grams))
  await expect(rosaRow.locator('.marca-estado')).toHaveClass(new RegExp(`marca-estado--${rosa.status}\\b`))
  await expect(rosaRow.locator('.marca-estado__palabra')).toHaveText(STATUS_WORD[rosa.status])
  await expect(rosaRow.locator('.fila-stock__detalle')).toHaveText(detailFor(rosa, todayIso))
  const rosaSideNote = sideNoteFor(rosa)
  if (rosaSideNote === null) {
    await expect(rosaRow.locator('.fila-stock__insignia')).toHaveCount(0)
  } else {
    await expect(rosaRow.locator('.fila-stock__insignia')).toHaveText(rosaSideNote)
  }

  // Te deben: the block shows the fetched total, count and oldest date, and the
  // teaser's own balance and "desde dd/mm" — all read, never computed here.
  const debtsSubtitle =
    panel.debts.oldest === null
      ? countLabel(panel.debts.sales_owing_count)
      : `${countLabel(panel.debts.sales_owing_count)} · desde ${shortDate(panel.debts.oldest)}`
  await expect(page.locator('.bloque-deben .cifra-xl')).toHaveText(pesos(panel.debts.total_owed))
  // The direct child only: each teaser row below carries its own `.pie` too
  // ("desde dd/mm"), nested inside its own `<Link>`, never a direct child here.
  await expect(page.locator('.bloque-deben > .pie')).toHaveText(debtsSubtitle)

  const [teaserRow] = panel.debts.teaser
  if (teaserRow === undefined) throw new Error('empty teaser in GET /panel')
  const teaserLink = page.locator('.bloque-deben__fila').filter({ hasText: teaserRow.name })
  await expect(teaserLink).toContainText(pesos(teaserRow.balance))
  await expect(teaserLink).toContainText(`desde ${shortDate(teaserRow.owing_since)}`)

  // Opens Te deben from the block's own heading, then goes back to Inicio.
  await page.getByRole('link', { name: 'Te deben' }).click()
  await expectPath(page, CUSTOMERS)
  await expect(page.locator('.ventas__resumen .cifra-xl')).toHaveText(pesos(panel.debts.total_owed))
  await page.goBack()
  await expectPath(page, HOME)
  await expect(page.locator('.encabezado__titulo')).toHaveText('Inicio')

  // The teaser: Carla's own row, opening her card.
  await page.getByRole('link', { name: teaserRow.name }).first().click()
  await expect(page).toHaveURL(new RegExp(`${pathTo(CUSTOMER, { id: teaserRow.customer_id })}$`))
  await expect(page.locator('.encabezado__titulo')).toHaveText(teaserRow.name)
  await expect(page.getByText(`Te debe ${pesos(teaserRow.balance)}`)).toBeVisible()

  // Nothing personal or technical reaches the console or the browser's own storage
  // (CODING_STANDARDS.md section 9) — a customer's name and several amounts moved
  // through this run's panel alone.
  await expectOnlyTheThemeStored(page)
  expect(consoleMessages).toEqual([])
})
