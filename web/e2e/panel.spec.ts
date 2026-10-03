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

import { expect, test } from '@playwright/test'
import { newBusinessInvitationUrl } from './backend.js'
import { watchConsole } from './console.js'

const PASSWORD = 'correcthorsebattery'

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

interface PanelAnswer {
  periods: { today: PanelPeriod; week: PanelPeriod; month: PanelPeriod }
  debts: {
    total_owed: number
    sales_owing_count: number
    oldest: string | null
    teaser: { customer_id: number; name: string; balance: number; owing_since: string }[]
  }
  stock: { variety_id: number; name: string; grams: number; status: string }[]
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

test('a seller sees the panel agree with GET /panel, across periods, from the front alone', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  const ownerEmail = `duena-panel-${Date.now()}@example.com`
  const businessName = `Flores del Panel ${Date.now()}`

  // Accept a new-business invitation.
  await page.goto(newBusinessInvitationUrl())
  await page.getByLabel('Nombre del negocio').fill(businessName)
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Creá el negocio' }).click()
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // A priced variety.
  await page.goto('/variedades')
  await page.getByRole('button', { name: 'Nueva variedad' }).click()
  await page.getByLabel('Nombre').fill('Rosa')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Variedad guardada')).toBeVisible()
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('button', { name: 'Nuevo precio' }).click()
  await page.getByLabel('Precio de lista').fill('1000')
  await page.getByRole('button', { name: 'Guardar precio' }).click()
  await expect(page.getByText('Precio guardado')).toBeVisible()

  // A purchase: the "Origen" pill defaults to "Compra" (`EntradaStock.tsx`).
  await page.goto('/mi-stock/nueva-entrada')
  await page.getByLabel('Gramos').fill('50')
  await page.getByLabel('Variedad').selectOption({ label: 'Rosa' })
  await expect(page.getByRole('button', { name: 'Compra' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Costo total').fill('45000')
  await page.getByRole('button', { name: 'Guardá la entrada' }).click()
  await expect(page.getByText('Entrada guardada')).toBeVisible()

  // A customer, for the sale left owing.
  await page.goto('/clientes/nuevo')
  await page.getByLabel('Teléfono').fill('+5491155550077')
  await page.getByLabel('Nombre').fill('Carla Pérez')
  await page.getByRole('button', { name: 'Guardá y usá' }).click()
  await expect(page).toHaveURL(/\/clientes$/)
  await expect(page.getByText('Cliente guardado')).toBeVisible()

  // A sale left owing, to Carla.
  await page.getByRole('link', { name: 'Carla Pérez' }).click()
  await page.getByRole('link', { name: 'Nueva venta a Carla Pérez' }).click()
  await expect(page).toHaveURL(/\/ventas\/nueva$/)
  const todayIso = await page.getByLabel('Fecha').inputValue()
  await page.getByLabel('Variedad línea 1').selectOption({ label: 'Rosa' })
  await page.getByLabel('Gramos línea 1').fill('5')
  await page.getByRole('radio', { name: 'Debiendo' }).check()
  await page.getByRole('button', { name: 'Guardar venta' }).click()
  await expect(page.getByText('Venta guardada')).toBeVisible()

  // A sale paid on the spot, no customer.
  await page.goto('/ventas')
  await page.getByRole('link', { name: 'Nueva venta' }).click()
  await page.getByLabel('Variedad línea 1').selectOption({ label: 'Rosa' })
  await page.getByLabel('Gramos línea 1').fill('3')
  await page.getByRole('radio', { name: 'Efectivo' }).check()
  await page.getByRole('button', { name: 'Guardar venta' }).click()
  await expect(page.getByText('Venta guardada')).toBeVisible()

  // An expense, in the business's own default "Otros" category.
  await page.goto('/gastos')
  await page.getByRole('button', { name: 'Nuevo gasto' }).click()
  await page.getByLabel('Categoría').selectOption({ label: 'Otros' })
  await page.getByLabel('Monto').fill('1500')
  await page.getByLabel('Detalle').fill('Bolsas de regalo')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Gasto guardado')).toBeVisible()

  // `GET /panel`, read in this same run: the one answer Inicio must agree with,
  // figure for figure, never recomputed here (plan invariant).
  const panel = await page.evaluate(() =>
    fetch('/panel', { credentials: 'include' }).then((response) => response.json() as Promise<PanelAnswer>),
  )

  await page.goto('/')
  await expect(page.locator('.encabezado__titulo')).toHaveText('Inicio')

  async function assertPeriod(period: PanelPeriod, rangeText: string): Promise<void> {
    await expect(page.locator('.periodos .pie')).toContainText(rangeText)
    await expect(page.locator('.panel-ventas .cifra-xl')).toHaveText(pesos(period.sales))
    await expect(page.locator('.panel-resultados__valor--acento')).toHaveText(
      signedPesos(period.profit),
    )
    await expect(page.locator('.panel-resultados__celda').nth(1).locator('.panel-resultados__valor')).toHaveText(
      signedPesos(period.cash),
    )
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

  // Lo que te queda: Rosa's own row, straight from the fetched answer.
  const rosa = panel.stock.find((row) => row.name === 'Rosa')
  if (rosa === undefined) throw new Error('Rosa missing from GET /panel stock')
  const rosaRow = page.locator('.fila-stock').filter({ hasText: 'Rosa' })
  await expect(rosaRow.locator('.fila-stock__gramos')).toHaveText(grams(rosa.grams))

  // Te deben: the block shows the fetched total, then opens Te deben from its
  // heading, then goes back to Inicio.
  await expect(page.locator('.bloque-deben .cifra-xl')).toHaveText(pesos(panel.debts.total_owed))
  await page.getByRole('link', { name: 'Te deben' }).click()
  await expect(page).toHaveURL(/\/clientes\/deben$/)
  await expect(page.locator('.ventas__resumen .cifra-xl')).toHaveText(pesos(panel.debts.total_owed))
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('.encabezado__titulo')).toHaveText('Inicio')

  // The teaser: Carla's own row, opening her card.
  const [teaserRow] = panel.debts.teaser
  if (teaserRow === undefined) throw new Error('empty teaser in GET /panel')
  await page.getByRole('link', { name: teaserRow.name }).click()
  await expect(page).toHaveURL(new RegExp(`/clientes/${teaserRow.customer_id}$`))
  await expect(page.locator('.encabezado__titulo')).toHaveText(teaserRow.name)
  await expect(page.getByText(`Te debe ${pesos(teaserRow.balance)}`)).toBeVisible()

  // Nothing personal or technical reaches the console or the browser's own storage
  // (CODING_STANDARDS.md section 9) — a customer's name and several amounts moved
  // through this run's panel alone.
  const storage = await page.evaluate(() => ({
    local: Object.keys(localStorage).length,
    session: Object.keys(sessionStorage).length,
  }))
  expect(storage).toEqual({ local: 0, session: 0 })
  expect(consoleMessages).toEqual([])
})
