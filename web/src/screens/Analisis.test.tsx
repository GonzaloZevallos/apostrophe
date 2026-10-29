/**
 * `Analisis` at the screen seam (CODING_STANDARDS §10): Testing Library, the API
 * faked at `fetch`, against the frozen fixtures `api/fixtures/analysis.json` and
 * `analysis-empty.json` (plan, subtask "built against the frozen fixture"). Every
 * assertion reads a figure the fixture already carries — none is computed here.
 */

import { ANALYSIS } from '../routes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import { SHOWN_EN } from '../test/shownLanguage'
import analysisEmptyFixture from '../api/fixtures/analysis-empty.json'
import analysisFixture from '../api/fixtures/analysis.json'
import { ANALYSIS_TEXT } from '../copy/analysis'
import { formatDateShort, formatMonthLong } from '../format/dates'
import { rowOf } from './analisis/rowOf'
import Analisis, {
  BEST_WEEKDAY_MARK,
  BEST_WEEK_MARK,
  BEST_WEEK_TABLE_MARK,
  NO_BEST_WEEK_LINE,
  SINCE_FIRST_RECORD_LABEL,
} from './Analisis'
import { baselineText } from '../i18n/testing'

const EMPTY_MONTH_LINE = baselineText('analysis.ts:EMPTY_MONTH_LINE')
const NO_HISTORY_LINE = baselineText('analysis.ts:NO_HISTORY_LINE')

/** The summary strip: the hero group's own container, holding the figures line and the withdrawal rows. */
function strip(): HTMLElement {
  return screen.getByRole('group', { name: ANALYSIS_TEXT.vendisteEnElMes }).parentElement as HTMLElement
}

/** The "since your first record" block: one named row per metric. */
function history(): HTMLElement {
  return screen.getByRole('group', { name: SINCE_FIRST_RECORD_LABEL })
}

/** What a row holds, in document order: its label, then its amount, then its marker. */
function partsOf(row: HTMLElement): string[] {
  return Array.from(
    row.querySelectorAll('.analisis__monto-etiqueta, .analisis__monto-cifra, .analisis__monto-marca'),
  ).map((node) => (node.textContent ?? '').trim())
}

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-04', shown_language: SHOWN_EN }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function Provide() {
  return <Outlet context={ME} />
}

function renderAnalisis(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl))
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[ANALYSIS]}>
        <Routes>
          <Route element={<Provide />}>
            <Route path={ANALYSIS} element={<Analisis />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.useRealTimers()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('reads the best and worst variety by margin, the best week, the best weekday and the largest category', async () => {
  renderAnalisis(async (url) => {
    expect(url.toString()).toBe('/analysis?month=2026-10')
    return jsonResponse(200, analysisFixture)
  })

  // The fixture sorts `varieties` by margin descending (plan, invariants: the front
  // never sorts) — "Flor A" (margin $ 40.000) is the best, "Flor Gift" (margin
  // -$ 5.000) is the worst. Reading them in that order needs no arithmetic.
  // Both the phone's cards and the computer's table carry the same names (CSS
  // alone picks one), so this reads only the card view's own copy.
  const varietyNames = (await screen.findAllByText(/^(Flor A|Flor B|Flor Gift)$/))
    .filter((node) => node.closest('.analisis__variedades') !== null)
    .map((node) => node.textContent)
  expect(varietyNames).toEqual(['Flor A', 'Flor B', 'Flor Gift'])
  expect(screen.getByText(/margin \$ 40\.000/)).toBeInTheDocument()
  expect(screen.getByText(/margin \$ -5\.000/)).toBeInTheDocument()

  // The fixture's last week (28/9) carries `best: true`.
  expect(screen.getAllByText(BEST_WEEK_MARK)).toHaveLength(1)

  // The fixture's Friday (weekday 5) carries `best: true`.
  expect(screen.getAllByText(BEST_WEEKDAY_MARK)).toHaveLength(1)

  // The month's largest expense category ("Insumos", $ 4.000) is readable on screen.
  const insumos = screen.getAllByText('Insumos')[0]!
  const category = insumos.closest('.gastos__categoria-cabecera') as HTMLElement
  expect(within(category).getByText('$ 4.000')).toBeInTheDocument()
})

test('pending marks show their own N, never a $0 cost', async () => {
  renderAnalisis(async () => jsonResponse(200, analysisFixture))

  // The month header: average margin and stock shortfall each carry their own N.
  expect(await screen.findByText(/average margin/)).toHaveTextContent(
    '28 g sold · 15 g given away · average margin 55% and 2,5 g without cost',
  )
  const shortfall = rowOf(strip(), 'Stock shortfall')
  expect(shortfall.textContent).toBe('Stock shortfall $ 3.000 and 1 g without cost')

  // "Flor B"'s own cost and margin carry the same mark.
  expect(screen.getByText(/cost \$ 9\.000 and 2,5 g without cost/)).toBeInTheDocument()
})

test('a variety only gifted shows no margin percentage', async () => {
  renderAnalisis(async () => jsonResponse(200, analysisFixture))

  // "Flor Gift" names both the card and the computer table's row; only the card
  // carries the "margen" label this assertion reads.
  const giftRow = (await screen.findAllByText('Flor Gift'))
    .map((node) => node.closest('.analisis__variedad'))
    .find((node) => node !== null)
  expect(giftRow).not.toBeUndefined()
  const margin = within(giftRow as HTMLElement).getByText(/^margin/)
  expect(margin.textContent).not.toMatch(/%/)
})

test('a business with no history shows its fixed line and no figures', async () => {
  renderAnalisis(async () => jsonResponse(200, analysisEmptyFixture))

  expect(await screen.findByText(NO_HISTORY_LINE)).toBeInTheDocument()
  expect(screen.queryByText(EMPTY_MONTH_LINE)).not.toBeInTheDocument()
  expect(screen.queryByText('Month by month · last 12')).not.toBeInTheDocument()
})

test('the since-first-record figures are labelled as money moved, not money on hand', async () => {
  renderAnalisis(async () => jsonResponse(200, analysisFixture))

  expect(await screen.findByText(SINCE_FIRST_RECORD_LABEL)).toBeInTheDocument()
})

test('month navigation requests the previous month and disables at the bounds', async () => {
  const user = userEvent.setup()
  let requested: string[] = []
  renderAnalisis(async (url) => {
    requested.push(url.toString())
    return jsonResponse(200, analysisFixture)
  })

  await screen.findByText('October 2026', { selector: '.gastos__mes-etiqueta' })
  // The fixture's `next` is null: October is the current month, nothing comes after.
  expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled()

  await user.click(screen.getByRole('button', { name: 'Previous month' }))
  expect(requested).toContain('/analysis?month=2026-09')
})

test('the computer table carries headers, the margin stack, pending marks and the best/current week', async () => {
  renderAnalisis(async () => jsonResponse(200, analysisFixture))

  const table = (await screen.findAllByText('Variety')).find(
    (node) => node.closest('table') !== null,
  )
  expect(table).not.toBeUndefined()
  const varietyTable = (table as HTMLElement).closest('table') as HTMLElement
  expect(within(varietyTable).getByText('Gift grams')).toBeInTheDocument()
  expect(within(varietyTable).getByText('Margin')).toBeInTheDocument()

  // "Flor B" (margin $ 6.000, 40%, 2,5 g pending): the table's own cell, with no
  // "margen" label and no "costo" label — those belong to the card view only.
  const [giftCell] = within(varietyTable).getAllByText('Flor Gift')
  expect(giftCell).not.toBeUndefined()
  const giftRow = (giftCell as HTMLElement).closest('tr') as HTMLElement
  // A gift-only variety's sales are $0, so its margin percentage is left out
  // (its "Parte" column still reads 0%, since share — unlike margin — is never
  // null for a variety with its own $0 sales, only when the whole month is $0).
  const giftMarginCell = giftRow.querySelector('.analisis__celda-margen') as HTMLElement
  expect(within(giftMarginCell).queryByText(/%$/)).toBeNull()

  // Request item 1 ("Done when"): the pending mark shows inside the computer
  // layout's Costo and Margen cells too, not only the phone cards. "Flor B"
  // (cost $ 9.000 with 2,5 g pending, margin $ 6.000/40% with the same 2,5 g
  // pending): the table's own Costo and Margen cells each carry "y 2,5 g sin
  // costo" beside their amount. `pendingSuffix` renders inside the same
  // element as the figure (Analisis.tsx), so this matches the cell's own
  // `textContent` rather than a standalone "y … g without cost" node.
  const headerNames = within(varietyTable)
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  const costoIndex = headerNames.indexOf('Cost')
  const margenIndex = headerNames.indexOf('Margin')
  expect(costoIndex).toBeGreaterThanOrEqual(0)
  expect(margenIndex).toBeGreaterThanOrEqual(0)

  const [florBCell] = within(varietyTable).getAllByText('Flor B')
  expect(florBCell).not.toBeUndefined()
  const florBRow = (florBCell as HTMLElement).closest('tr') as HTMLElement
  const florBCells = within(florBRow).getAllByRole('cell')
  expect(florBCells[costoIndex]).toHaveTextContent('and 2,5 g without cost')
  expect(florBCells[margenIndex]).toHaveTextContent('and 2,5 g without cost')

  // Request item 1 ("Done when"): the margin stack's own child order. In that
  // same Margen cell, the amount sits above (before, in source order) the
  // percentage: the first child span holds "$ 6.000…", the second "40%".
  const florBMarginCell = florBCells[margenIndex] as HTMLElement
  const marginSpans = florBMarginCell.querySelectorAll('span')
  expect(marginSpans).toHaveLength(2)
  expect(marginSpans[0]).toHaveTextContent('$ 6.000')
  expect(marginSpans[0]).toHaveTextContent('and 2,5 g without cost')
  expect(marginSpans[1]).toHaveTextContent('40%')

  const weekTables = (await screen.findAllByText('Week')).map((node) => node.closest('table'))
  const weekTable = weekTables.find((t) => t !== null) as HTMLElement
  // Drop the header row and each row's cost sub-row.
  const rows = within(weekTable)
    .getAllByRole('row')
    .slice(1)
    .filter((row) => !row.classList.contains('analisis__fila-costos'))
  const lastRow = rows.at(-1)
  expect(lastRow).not.toBeUndefined()
  expect((lastRow as HTMLElement).className).toContain('analisis__fila-actual')
  expect(within(lastRow as HTMLElement).getByText(BEST_WEEK_TABLE_MARK)).toBeInTheDocument()

  const monthHeaders = await screen.findAllByText('Month')
  const monthTable = monthHeaders
    .map((node) => node.closest('table'))
    .find((t) => t !== null) as HTMLElement
  expect(within(monthTable).getByText('Cash')).toBeInTheDocument()
})

test('"None stood out" shows in the week table when every week is $0', async () => {
  const noBestFixture = {
    ...analysisFixture,
    weeks: analysisFixture.weeks.map((week) => ({
      ...week,
      sales: 0,
      best: false,
    })),
  }
  renderAnalisis(async () => jsonResponse(200, noBestFixture))

  expect(await screen.findByText(NO_BEST_WEEK_LINE)).toBeInTheDocument()
})

test('month navigation disables "Previous month" when there is no earlier month', async () => {
  // The chosen month is already the first record's own month: `previous` is null,
  // same shape `GET /analysis` would answer for a business that far back.
  const firstMonthFixture = {
    ...analysisFixture,
    month: { ...analysisFixture.month, previous: null },
  }
  renderAnalisis(async () => jsonResponse(200, firstMonthFixture))

  await screen.findByText('October 2026', { selector: '.gastos__mes-etiqueta' })
  expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled()
})

test('Promotion and Own use show apart from Stock shortfall, each with only its own pending grams', async () => {
  renderAnalisis(async () => jsonResponse(200, analysisFixture))

  // The month header: a promotion with half a pending gram, an own use fully costed.
  await screen.findByText(SINCE_FIRST_RECORD_LABEL)
  expect(rowOf(strip(), 'Promotion').textContent).toBe('Promotion $ 4.000 and 0,5 g without cost')
  expect(rowOf(strip(), 'Own use').textContent).toBe('Own use $ 1.500')
  expect(rowOf(strip(), 'Stock shortfall').textContent).toBe(
    'Stock shortfall $ 3.000 and 1 g without cost',
  )

  // The since-the-first-record totals read the same two lines.
  expect(rowOf(history(), 'Promotion').textContent).toBe('Promotion $ 9.000 and 0,5 g without cost')
  expect(rowOf(history(), 'Own use').textContent).toBe('Own use $ 2.500')
})

test('a week and a month row show a withdrawal line only when the period has one', async () => {
  renderAnalisis(async () => jsonResponse(200, analysisFixture))
  await screen.findByText(SINCE_FIRST_RECORD_LABEL)

  // Phone rows: only the fixture's first week (10/8) has a promotion and an own use.
  const weekRows = Array.from(document.querySelectorAll<HTMLElement>('.analisis__semana'))
  expect(weekRows).toHaveLength(8)
  expect(rowOf(weekRows[0]!, 'Promotion').textContent).toBe('Promotion $ 1.000')
  expect(rowOf(weekRows[0]!, 'Own use').textContent).toBe('Own use $ 500')
  for (const row of weekRows.slice(1)) {
    expect(within(row).queryByRole('group', { name: /Promotion|Own use/ })).not.toBeInTheDocument()
  }

  // The month rows: the same, with the fixture's last month holding no promotion.
  const monthRows = Array.from(document.querySelectorAll<HTMLElement>('.analisis__mes-fila'))
  expect(rowOf(monthRows[0]!, 'Promotion').textContent).toBe('Promotion $ 1.000')
  expect(
    within(monthRows[monthRows.length - 1]!).queryByRole('group', { name: 'Promotion' }),
  ).not.toBeInTheDocument()
})

const FIXTURE_FIRST_WEEK = analysisFixture.weeks[0]!
const FIXTURE_LAST_WEEK = analysisFixture.weeks.at(-1)!

function pendingRowFixture() {
  const fullyPending = { amount: 0, pending_quantity: 4, all_pending: true }
  const partlyPending = { amount: 7000, pending_quantity: 1.5, all_pending: false }
  return {
    ...analysisFixture,
    month: { ...analysisFixture.month, shortfall: { amount: 0, pending_quantity: 2, all_pending: true } },
    since_first_record: {
      ...analysisFixture.since_first_record,
      promotion: { amount: 0, pending_quantity: 3, all_pending: true },
    },
    weeks: analysisFixture.weeks.map((week, index) =>
      index === 1
        ? { ...week, cost_of_goods: partlyPending }
        : index === 2
          ? { ...week, cost_of_goods: fullyPending }
          : index === 3
            ? { ...week, cost_of_goods: { amount: 0, pending_quantity: 0, all_pending: false } }
            : week,
    ),
    months: analysisFixture.months.map((row, index) =>
      index === 1 ? { ...row, promotion: fullyPending } : row,
    ),
  }
}

test('every week and month row shows Cost of goods sold, in the PRD order', async () => {
  renderAnalisis(async () => jsonResponse(200, analysisFixture))
  await screen.findByText(SINCE_FIRST_RECORD_LABEL)

  const weekRows = Array.from(document.querySelectorAll<HTMLElement>('.analisis__semana'))
  const monthRows = Array.from(document.querySelectorAll<HTMLElement>('.analisis__mes-fila'))
  expect(weekRows).toHaveLength(analysisFixture.weeks.length)
  expect(monthRows).toHaveLength(analysisFixture.months.length)
  for (const row of [...weekRows, ...monthRows]) {
    expect(rowOf(row, 'Cost of goods sold').textContent).toMatch(/^Cost of goods sold \$ [\d.]+$/)
  }

  // Cost of goods sold, Stock shortfall, Promotion, Own use: the named rows, in order.
  const first = weekRows[0]!
  const names = within(first)
    .getAllByRole('group')
    .map((group) => group.querySelector('.analisis__monto-etiqueta')?.textContent)
  expect(names).toEqual(['Cost of goods sold', 'Stock shortfall', 'Promotion', 'Own use'])
  const cost = FIXTURE_FIRST_WEEK.cost_of_goods.amount.toLocaleString('es-AR')
  expect(rowOf(first, 'Cost of goods sold').textContent).toBe(`Cost of goods sold $ ${cost}`)
})

test('each week and month renders its cost rows in both the card and the table', async () => {
  renderAnalisis(async () => jsonResponse(200, analysisFixture))
  await screen.findByText(SINCE_FIRST_RECORD_LABEL)

  const names = [
    formatDateShort(FIXTURE_FIRST_WEEK.first_day),
    formatMonthLong(analysisFixture.months[0]!.month),
  ]
  for (const name of names) {
    const copies = screen.getAllByRole('group', { name })
    expect(copies, 'card and table').toHaveLength(2)
    for (const copy of copies) {
      // label, amount, marker: in that order inside each cost row
      const cost = rowOf(copy, 'Cost of goods sold')
      expect(partsOf(cost).slice(0, 2)).toEqual(['Cost of goods sold', expect.stringMatching(/^\$ /)])
      expect(cost.firstElementChild).toHaveClass('analisis__monto-etiqueta')
      expect(cost.lastElementChild).toHaveClass('analisis__monto-valor')
    }
  }

  // The partly pending week carries label, amount, marker, in that order.
  const pending = pendingRowFixture()
  expect(pending.weeks[1]!.cost_of_goods.pending_quantity).toBe(1.5)
})

test('a row with an amount and pending grams reads label, amount, marker in that order', async () => {
  renderAnalisis(async () => jsonResponse(200, pendingRowFixture()))
  await screen.findByText(SINCE_FIRST_RECORD_LABEL)

  const name = formatDateShort(analysisFixture.weeks[1]!.first_day)
  for (const copy of screen.getAllByRole('group', { name })) {
    const cost = rowOf(copy, 'Cost of goods sold')
    expect(partsOf(cost)).toEqual(['Cost of goods sold', '$ 7.000', 'and 1,5 g without cost'])
    expect(cost.textContent).toBe('Cost of goods sold $ 7.000 and 1,5 g without cost')
    const amount = cost.querySelector('.analisis__monto-cifra')!
    expect(amount.textContent).toBe('$ 7.000')
  }
})

test('Stock shortfall shows on a row only when its shortfall is not null', async () => {
  renderAnalisis(async () => jsonResponse(200, analysisFixture))
  await screen.findByText(SINCE_FIRST_RECORD_LABEL)

  const weekRows = Array.from(document.querySelectorAll<HTMLElement>('.analisis__semana'))
  expect(rowOf(weekRows[0]!, 'Stock shortfall').textContent).toBe('Stock shortfall $ 2.000')
  for (const row of weekRows.slice(1)) {
    expect(within(row).queryByRole('group', { name: 'Stock shortfall' })).not.toBeInTheDocument()
  }
  const monthRows = Array.from(document.querySelectorAll<HTMLElement>('.analisis__mes-fila'))
  expect(rowOf(monthRows[0]!, 'Stock shortfall').textContent).toBe('Stock shortfall $ 2.000')
  expect(
    within(monthRows.at(-1)!).queryByRole('group', { name: 'Stock shortfall' }),
  ).not.toBeInTheDocument()
  expect(FIXTURE_LAST_WEEK.shortfall).toBeNull()
})

test('a fully pending figure reads only its grams on the header, the since lines and the rows', async () => {
  renderAnalisis(async () => jsonResponse(200, pendingRowFixture()))
  await screen.findByText(SINCE_FIRST_RECORD_LABEL)

  const shortfall = rowOf(strip(), 'Stock shortfall')
  expect(shortfall.textContent).toBe('Stock shortfall 2 g without cost')
  // No amount element and no $: the grams alone sit in the marker.
  expect(shortfall.querySelector('.analisis__monto-cifra')).toBeNull()
  expect(shortfall.textContent).not.toContain('$')
  expect(rowOf(history(), 'Promotion').textContent).toBe('Promotion 3 g without cost')
  const monthRows = Array.from(document.querySelectorAll<HTMLElement>('.analisis__mes-fila'))
  expect(rowOf(monthRows[1]!, 'Promotion').textContent).toBe('Promotion 4 g without cost')
  const weekRows = Array.from(document.querySelectorAll<HTMLElement>('.analisis__semana'))
  expect(rowOf(weekRows[2]!, 'Cost of goods sold').textContent).toBe(
    'Cost of goods sold 4 g without cost',
  )
  expect(screen.queryByText(/\$ 0 y \d+ g without cost/)).not.toBeInTheDocument()
})

test('a partly pending cost of goods reads its amount and its grams; a real zero reads $ 0', async () => {
  renderAnalisis(async () => jsonResponse(200, pendingRowFixture()))
  await screen.findByText(SINCE_FIRST_RECORD_LABEL)

  const weekRows = Array.from(document.querySelectorAll<HTMLElement>('.analisis__semana'))
  expect(rowOf(weekRows[1]!, 'Cost of goods sold').textContent).toBe(
    'Cost of goods sold $ 7.000 and 1,5 g without cost',
  )
  expect(rowOf(weekRows[3]!, 'Cost of goods sold').textContent).toBe('Cost of goods sold $ 0')
})

test('the computer tables carry the same cost lines under each row', async () => {
  renderAnalisis(async () => jsonResponse(200, pendingRowFixture()))
  await screen.findByText(SINCE_FIRST_RECORD_LABEL)

  const weekTable = document.querySelector<HTMLElement>('.analisis__tabla-contenedor--semanas')!
  const costRows = weekTable.querySelectorAll<HTMLElement>('.analisis__fila-costos')
  expect(costRows).toHaveLength(analysisFixture.weeks.length)
  expect(rowOf(costRows[2]!, 'Cost of goods sold').textContent).toBe(
    'Cost of goods sold 4 g without cost',
  )
  expect(rowOf(costRows[0]!, 'Stock shortfall').textContent).toBe('Stock shortfall $ 2.000')

  const monthTable = document.querySelector<HTMLElement>('.analisis__tabla-contenedor--meses')!
  const monthCostRows = monthTable.querySelectorAll<HTMLElement>('.analisis__fila-costos')
  expect(monthCostRows).toHaveLength(analysisFixture.months.length)
  expect(rowOf(monthCostRows[1]!, 'Promotion').textContent).toBe('Promotion 4 g without cost')
})

test('the history block has one named row per metric, in order, each with its amount', async () => {
  renderAnalisis(async () => jsonResponse(200, analysisFixture))
  await screen.findByText(SINCE_FIRST_RECORD_LABEL)

  const block = history()
  const names = within(block)
    .getAllByRole('group')
    .map((group) => group.querySelector('.analisis__monto-etiqueta')?.textContent)
  expect(names).toEqual([
    'Sales',
    'Expenses',
    'Profit',
    'Cash',
    'Stock shortfall',
    'Promotion',
    'Own use',
  ])
  expect(partsOf(rowOf(block, 'Sales'))).toEqual(['Sales', '$ 399.818'])
  expect(partsOf(rowOf(block, 'Expenses'))).toEqual(['Expenses', '$ 43.300'])
  // Profit has its own marker (9,5 g pending); Cash has none.
  expect(partsOf(rowOf(block, 'Profit'))).toEqual(['Profit', '$ 140.000', 'and 9,5 g without cost'])
  expect(partsOf(rowOf(block, 'Cash'))).toEqual(['Cash', '$ 317.000'])
  expect(rowOf(block, 'Profit').textContent).toBe('Profit $ 140.000 and 9,5 g without cost')
})

test('the history marker shows only when pending_quantity > 0, and alone when all_pending', async () => {
  const fixture = {
    ...analysisFixture,
    since_first_record: {
      ...analysisFixture.since_first_record,
      profit: { amount: 140000, pending_quantity: 0 },
      shortfall: null,
      promotion: { amount: 0, pending_quantity: 3, all_pending: true },
    },
  }
  renderAnalisis(async () => jsonResponse(200, fixture))
  await screen.findByText(SINCE_FIRST_RECORD_LABEL)

  const block = history()
  expect(partsOf(rowOf(block, 'Profit'))).toEqual(['Profit', '$ 140.000'])
  expect(within(block).queryByRole('group', { name: 'Stock shortfall' })).not.toBeInTheDocument()
  const promotion = rowOf(block, 'Promotion')
  expect(promotion.textContent).toBe('Promotion 3 g without cost')
  expect(partsOf(promotion)).toEqual(['Promotion', '3 g without cost'])
})

test('the hero is a group named "You sold in the month" holding the amount in one nowrap element', async () => {
  renderAnalisis(async () => jsonResponse(200, analysisFixture))
  await screen.findByText(SINCE_FIRST_RECORD_LABEL)

  const hero = screen.getByRole('group', { name: ANALYSIS_TEXT.vendisteEnElMes })
  const amount = within(hero).getByText('$ 83.818')
  expect(amount).toHaveClass('cifra-xl')
  expect(amount).toHaveClass('analisis__monto-cifra')
})

describe('the strip line of grams and average margin', () => {
  const line = '28 g sold · 15 g given away'
  function withMargin(average_margin: { amount: number; percent: number | null; pending_quantity: number }) {
    return { ...analysisFixture, month: { ...analysisFixture.month, average_margin } }
  }

  test('percent with nothing pending', async () => {
    renderAnalisis(async () =>
      jsonResponse(200, withMargin({ amount: 41000, percent: 55, pending_quantity: 0 })),
    )
    expect(await screen.findByText(/average margin/)).toHaveTextContent(
      `${line} · average margin 55%`,
    )
    expect(screen.getByText(/average margin/).textContent).toBe(`${line} · average margin 55%`)
  })

  test('percent with pending grams', async () => {
    renderAnalisis(async () =>
      jsonResponse(200, withMargin({ amount: 41000, percent: 55, pending_quantity: 2.5 })),
    )
    const node = await screen.findByText(/average margin/)
    expect(node.textContent).toBe(`${line} · average margin 55% and 2,5 g without cost`)
    // Each figure is its own nowrap element.
    const figures = Array.from(node.querySelectorAll('.analisis__monto-cifra')).map((n) => n.textContent)
    expect(figures).toEqual(['28 g', '15 g', '55%'])
  })

  test('percent null with pending grams', async () => {
    renderAnalisis(async () =>
      jsonResponse(200, withMargin({ amount: 0, percent: null, pending_quantity: 2.5 })),
    )
    const node = await screen.findByText(/average margin/)
    expect(node.textContent).toBe(`${line} · average margin and 2,5 g without cost`)
  })
})
