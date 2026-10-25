/**
 * `Analisis` at the screen seam (CODING_STANDARDS §10): Testing Library, the API
 * faked at `fetch`, against the frozen fixtures `api/fixtures/analysis.json` and
 * `analysis-empty.json` (plan, subtask "built against the frozen fixture"). Every
 * assertion reads a figure the fixture already carries — none is computed here.
 */

import { ANALYSIS } from '../routes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import { SHOWN_EN } from '../test/shownLanguage'
import analysisEmptyFixture from '../api/fixtures/analysis-empty.json'
import analysisFixture from '../api/fixtures/analysis.json'
import { ANALYSIS_TEXT } from '../copy/analysis'
import { formatDateShort, formatMonthLong } from '../format/dates'
import { formatGrams, formatMoney } from '../format/money'
import { flipViewport, stubViewport } from '../test-viewport'
import type { Viewport } from '../routes'
import { rowOf } from './analisis/rowOf'
import Analisis, {
  BEST_WEEKDAY_MARK,
  BEST_WEEK_MARK,
  BEST_WEEK_TABLE_MARK,
  EMPTY_MONTH_LINE,
  NO_BEST_WEEK_LINE,
  NO_HISTORY_LINE,
  SINCE_FIRST_RECORD_LABEL,
} from './Analisis'

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

/** The phone's cards of one section, in document order: its list holds one named group per row. */
const cardsIn = (list: string): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>(`${list} > [role="group"]`))

/** A card's figures in order (the headline first). */
const figuresOf = (card: HTMLElement): string[] =>
  Array.from(card.querySelectorAll('.analisis__tarjeta-cifra')).map((node) => node.textContent ?? '')

/** Each row of a card as read, spaces collapsed. */
const rowsOf = (card: HTMLElement): string[] =>
  Array.from(card.querySelectorAll('.analisis__tarjeta-fila')).map((node) =>
    (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
  )

/** The row of a card that starts with a label, or undefined when the card has none. */
const rowStarting = (card: HTMLElement, label: string): string | undefined =>
  rowsOf(card).find((text) => text.startsWith(label))

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

function renderAnalisis(
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>,
  viewport: Viewport = 'phone',
) {
  stubViewport(viewport)
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
  expect(screen.getByRole('group', { name: 'Flor A' })).toHaveTextContent(/margin \$ 40\.000/)
  expect(screen.getByRole('group', { name: 'Flor Gift' })).toHaveTextContent(/margin \$ -5\.000/)

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
  expect(screen.getByRole('group', { name: 'Flor B' })).toHaveTextContent(
    /cost \$ 9\.000 and 2,5 g without cost/,
  )
})

test('a variety only gifted shows no margin percentage', async () => {
  renderAnalisis(async () => jsonResponse(200, analysisFixture))

  const giftCard = await screen.findByRole('group', { name: 'Flor Gift' })
  const margin = rowStarting(giftCard, 'margin')
  expect(margin).toBeDefined()
  expect(margin).not.toMatch(/%/)
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
  renderAnalisis(async () => jsonResponse(200, analysisFixture), 'computer')

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

describe.each(['phone', 'computer'] as const)('"None stood out" at %s width', (viewport) => {
test('shows once when every week is $0', async () => {
  const noBestFixture = {
    ...analysisFixture,
    weeks: analysisFixture.weeks.map((week) => ({
      ...week,
      sales: 0,
      best: false,
    })),
  }
  renderAnalisis(async () => jsonResponse(200, noBestFixture), viewport)

  expect(await screen.findAllByText(NO_BEST_WEEK_LINE)).toHaveLength(1)
})
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

  // Phone cards: only the fixture's first week (10/8) has a promotion and an own use.
  const weekCards = cardsIn('.analisis__semanas')
  expect(weekCards).toHaveLength(8)
  expect(rowStarting(weekCards[0]!, 'Promotion')).toBe('Promotion $ 1.000')
  expect(rowStarting(weekCards[0]!, 'Own use')).toBe('Own use $ 500')
  for (const card of weekCards.slice(1)) {
    expect(rowStarting(card, 'Promotion')).toBeUndefined()
    expect(rowStarting(card, 'Own use')).toBeUndefined()
  }

  // The month cards: the same, with the fixture's last month holding no promotion.
  const monthCards = cardsIn('.analisis__meses')
  expect(rowStarting(monthCards[0]!, 'Promotion')).toBe('Promotion $ 1.000')
  expect(rowStarting(monthCards.at(-1)!, 'Promotion')).toBeUndefined()
})

const FIXTURE_FIRST_WEEK = analysisFixture.weeks[0]!
const FIXTURE_LAST_WEEK = analysisFixture.weeks.at(-1)!

function pendingRowFixture() {
  const fullyPending = { amount: 0, pending_grams: 4, all_pending: true }
  const partlyPending = { amount: 7000, pending_grams: 1.5, all_pending: false }
  return {
    ...analysisFixture,
    month: { ...analysisFixture.month, shortfall: { amount: 0, pending_grams: 2, all_pending: true } },
    since_first_record: {
      ...analysisFixture.since_first_record,
      promotion: { amount: 0, pending_grams: 3, all_pending: true },
    },
    weeks: analysisFixture.weeks.map((week, index) =>
      index === 1
        ? { ...week, cost_of_goods: partlyPending }
        : index === 2
          ? { ...week, cost_of_goods: fullyPending }
          : index === 3
            ? { ...week, cost_of_goods: { amount: 0, pending_grams: 0, all_pending: false } }
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

  const weekCards = cardsIn('.analisis__semanas')
  const monthCards = cardsIn('.analisis__meses')
  expect(weekCards).toHaveLength(analysisFixture.weeks.length)
  expect(monthCards).toHaveLength(analysisFixture.months.length)
  for (const card of [...weekCards, ...monthCards]) {
    expect(rowStarting(card, 'Cost of goods sold')).toMatch(/^Cost of goods sold \$ [\d.]+$/)
  }

  // Cost of goods sold, Stock shortfall, Promotion, Own use: the named rows, in order.
  const first = weekCards[0]!
  const names = rowsOf(first)
    .map((text) => text.match(/^(Cost of goods sold|Stock shortfall|Promotion|Own use)/)?.[1])
    .filter((name) => name !== undefined)
  expect(names).toEqual(['Cost of goods sold', 'Stock shortfall', 'Promotion', 'Own use'])
  const cost = FIXTURE_FIRST_WEEK.cost_of_goods.amount.toLocaleString('es-AR')
  expect(rowStarting(first, 'Cost of goods sold')).toBe(`Cost of goods sold $ ${cost}`)
})

test.each(['phone', 'computer'] as const)('each week and month renders its cost rows once at %s width', async (viewport) => {
  renderAnalisis(async () => jsonResponse(200, analysisFixture), viewport)
  await screen.findByText(SINCE_FIRST_RECORD_LABEL)

  const names = [
    formatDateShort(FIXTURE_FIRST_WEEK.first_day),
    formatMonthLong(analysisFixture.months[0]!.month),
  ]
  for (const name of names) {
    const copies = screen.getAllByRole('group', { name })
    expect(copies, 'the one layout on screen').toHaveLength(1)
    const cost =
      viewport === 'phone'
        ? rowStarting(copies[0]!, 'Cost of goods sold')
        : rowOf(copies[0]!, 'Cost of goods sold').textContent
    expect(cost).toMatch(/^Cost of goods sold \$ [\d.]+$/)
  }

  // The partly pending week carries label, amount, marker, in that order.
  const pending = pendingRowFixture()
  expect(pending.weeks[1]!.cost_of_goods.pending_grams).toBe(1.5)
})

test('a row with an amount and pending grams reads label, amount, marker in that order', async () => {
  renderAnalisis(async () => jsonResponse(200, pendingRowFixture()))
  await screen.findByText(SINCE_FIRST_RECORD_LABEL)

  const card = screen.getByRole('group', { name: formatDateShort(analysisFixture.weeks[1]!.first_day) })
  const cost = Array.from(card.querySelectorAll('.analisis__tarjeta-fila')).find((node) =>
    node.textContent?.startsWith('Cost of goods sold'),
  )!
  // label, then the amount, then the pending text on its own line
  expect(cost.firstChild?.textContent).toBe('Cost of goods sold ')
  expect(cost.querySelector('.analisis__tarjeta-cifra')?.textContent).toBe('$ 7.000')
  expect(cost.querySelector('.analisis__tarjeta-pendiente')?.textContent).toBe(' and 1,5 g without cost')
  expect(rowStarting(card, 'Cost of goods sold')).toBe('Cost of goods sold $ 7.000 and 1,5 g without cost')
})

test('Stock shortfall shows on a row only when its shortfall is not null', async () => {
  renderAnalisis(async () => jsonResponse(200, analysisFixture))
  await screen.findByText(SINCE_FIRST_RECORD_LABEL)

  const weekCards = cardsIn('.analisis__semanas')
  expect(rowStarting(weekCards[0]!, 'Stock shortfall')).toBe('Stock shortfall $ 2.000')
  for (const card of weekCards.slice(1)) {
    expect(rowStarting(card, 'Stock shortfall')).toBeUndefined()
  }
  const monthCards = cardsIn('.analisis__meses')
  expect(rowStarting(monthCards[0]!, 'Stock shortfall')).toBe('Stock shortfall $ 2.000')
  expect(rowStarting(monthCards.at(-1)!, 'Stock shortfall')).toBeUndefined()
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
  expect(rowStarting(cardsIn('.analisis__meses')[1]!, 'Promotion')).toBe('Promotion 4 g without cost')
  expect(rowStarting(cardsIn('.analisis__semanas')[2]!, 'Cost of goods sold')).toBe(
    'Cost of goods sold 4 g without cost',
  )
  expect(screen.queryByText(/\$ 0 y \d+ g without cost/)).not.toBeInTheDocument()
})

test('a partly pending cost of goods reads its amount and its grams; a real zero reads $ 0', async () => {
  renderAnalisis(async () => jsonResponse(200, pendingRowFixture()))
  await screen.findByText(SINCE_FIRST_RECORD_LABEL)

  const weekCards = cardsIn('.analisis__semanas')
  expect(rowStarting(weekCards[1]!, 'Cost of goods sold')).toBe(
    'Cost of goods sold $ 7.000 and 1,5 g without cost',
  )
  expect(rowStarting(weekCards[3]!, 'Cost of goods sold')).toBe('Cost of goods sold $ 0')
})

test('the computer tables carry the same cost lines under each row', async () => {
  renderAnalisis(async () => jsonResponse(200, pendingRowFixture()), 'computer')
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

test('the history marker shows only when pending_grams > 0, and alone when all_pending', async () => {
  const fixture = {
    ...analysisFixture,
    since_first_record: {
      ...analysisFixture.since_first_record,
      profit: { amount: 140000, pending_grams: 0 },
      shortfall: null,
      promotion: { amount: 0, pending_grams: 3, all_pending: true },
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
  function withMargin(average_margin: { amount: number; percent: number | null; pending_grams: number }) {
    return { ...analysisFixture, month: { ...analysisFixture.month, average_margin } }
  }

  test('percent with nothing pending', async () => {
    renderAnalisis(async () =>
      jsonResponse(200, withMargin({ amount: 41000, percent: 55, pending_grams: 0 })),
    )
    expect(await screen.findByText(/average margin/)).toHaveTextContent(
      `${line} · average margin 55%`,
    )
    expect(screen.getByText(/average margin/).textContent).toBe(`${line} · average margin 55%`)
  })

  test('percent with pending grams', async () => {
    renderAnalisis(async () =>
      jsonResponse(200, withMargin({ amount: 41000, percent: 55, pending_grams: 2.5 })),
    )
    const node = await screen.findByText(/average margin/)
    expect(node.textContent).toBe(`${line} · average margin 55% and 2,5 g without cost`)
    // Each figure is its own nowrap element.
    const figures = Array.from(node.querySelectorAll('.analisis__monto-cifra')).map((n) => n.textContent)
    expect(figures).toEqual(['28 g', '15 g', '55%'])
  })

  test('percent null with pending grams', async () => {
    renderAnalisis(async () =>
      jsonResponse(200, withMargin({ amount: 0, percent: null, pending_grams: 2.5 })),
    )
    const node = await screen.findByText(/average margin/)
    expect(node.textContent).toBe(`${line} · average margin and 2,5 g without cost`)
  })
})

describe('one layout in the DOM, chosen by the viewport', () => {
  test('at phone width no table is in the page', async () => {
    renderAnalisis(async () => jsonResponse(200, analysisFixture), 'phone')
    await screen.findByText(SINCE_FIRST_RECORD_LABEL)

    expect(screen.queryByRole('table')).toBeNull()
    expect(document.querySelectorAll('.analisis__variedades > .analisis__tarjeta')).toHaveLength(
      analysisFixture.month.varieties.length,
    )
  })

  test('at computer width the three tables render and no card does', async () => {
    renderAnalisis(async () => jsonResponse(200, analysisFixture), 'computer')
    await screen.findByText(SINCE_FIRST_RECORD_LABEL)

    expect(screen.getAllByRole('table')).toHaveLength(3)
    expect(document.querySelector('.analisis__tarjeta')).toBeNull()
  })

  test('the month selector, the section headings and the aside are the same nodes across 900 px', async () => {
    renderAnalisis(async () => jsonResponse(200, analysisFixture), 'phone')
    await screen.findByText(SINCE_FIRST_RECORD_LABEL)

    const shared = () => [
      document.querySelector('.gastos__mes'),
      screen.getByText(ANALYSIS_TEXT.porVariedad),
      screen.getByText(ANALYSIS_TEXT.semanaASemanaUltimas),
      screen.getByText(ANALYSIS_TEXT.mesAMesUltimos),
      document.querySelector('.analisis__aside'),
    ]
    const before = shared()
    expect(before.every((node) => node !== null)).toBe(true)

    flipViewport('computer')
    expect(screen.getAllByRole('table')).toHaveLength(3)
    const after = shared()
    after.forEach((node, index) => expect(node).toBe(before[index]))

    flipViewport('phone')
    expect(screen.queryByRole('table')).toBeNull()
    shared().forEach((node, index) => expect(node).toBe(before[index]))
  })

  test('the empty-month line shows once at both widths', async () => {
    const emptyMonth = {
      ...analysisFixture,
      month: { ...analysisFixture.month, varieties: [] },
    }
    for (const viewport of ['phone', 'computer'] as const) {
      renderAnalisis(async () => jsonResponse(200, emptyMonth), viewport)
      expect(await screen.findAllByText(EMPTY_MONTH_LINE)).toHaveLength(1)
      cleanup()
    }
  })
})

describe('the phone renders cards, one per row, month selector first', () => {
  test('the first control is Previous month', async () => {
    renderAnalisis(async () => jsonResponse(200, analysisFixture), 'phone')
    await screen.findByText(SINCE_FIRST_RECORD_LABEL)

    const [first, second] = screen.getAllByRole('button')
    expect(first).toHaveAccessibleName('Previous month')
    expect(second).toHaveAccessibleName('Next month')
  })

  test('each variety is one card carrying its table row, in order', async () => {
    renderAnalisis(async () => jsonResponse(200, analysisFixture), 'phone')
    await screen.findByText(SINCE_FIRST_RECORD_LABEL)

    const cards = cardsIn('.analisis__variedades')
    expect(cards).toHaveLength(analysisFixture.month.varieties.length)
    analysisFixture.month.varieties.forEach((variety, index) => {
      const card = cards[index]!
      expect(card).toHaveAccessibleName(variety.name)
      const share = variety.share_percent === null ? [] : [String(variety.share_percent)]
      expect(figuresOf(card)).toEqual([
        formatMoney(variety.sales_without_shipping),
        ...share,
        formatGrams(variety.grams_sold),
        formatGrams(variety.grams_gifted),
        formatMoney(variety.cost.costed),
        formatMoney(variety.margin.amount),
      ])
      expect(rowsOf(card).at(-1)).toBe(
        `${ANALYSIS_TEXT.margen}${formatMoney(variety.margin.amount)}${
          variety.margin.percent === null ? '' : ` (${variety.margin.percent}%)`
        }${
          variety.margin.pending_grams > 0
            ? ANALYSIS_TEXT.pendingSuffix(formatGrams(variety.margin.pending_grams))
            : ''
        }`.trim(),
      )
    })
  })

  test('each week is one card with its figures in order, the last is current and the best is marked', async () => {
    renderAnalisis(async () => jsonResponse(200, analysisFixture), 'phone')
    await screen.findByText(SINCE_FIRST_RECORD_LABEL)

    const cards = cardsIn('.analisis__semanas')
    expect(cards).toHaveLength(analysisFixture.weeks.length)
    analysisFixture.weeks.forEach((week, index) => {
      const card = cards[index]!
      expect(card).toHaveAccessibleName(formatDateShort(week.first_day))
      const withdrawals = [week.shortfall, week.promotion, week.own_use]
        .filter((cost) => cost !== null)
        .map((cost) => formatMoney(cost.amount))
      expect(figuresOf(card)).toEqual([
        formatMoney(week.sales),
        formatGrams(week.grams),
        formatMoney(week.cost_of_goods.amount),
        ...withdrawals,
        formatMoney(week.expenses),
        formatMoney(week.profit.amount),
        formatMoney(week.cash),
      ])
      expect(card.classList.contains('analisis__tarjeta--actual')).toBe(
        index === analysisFixture.weeks.length - 1,
      )
      expect(within(card).queryByText(BEST_WEEK_MARK) !== null).toBe(week.best)
    })
    const labels = rowsOf(cards[0]!).map((text) => text.replace(/ \$.*$| [\d,.]+ g$/, ''))
    expect(labels).toEqual([
      'Grams',
      'Cost of goods sold',
      'Stock shortfall',
      'Promotion',
      'Own use',
      'expenses',
      'profit',
      'cash',
    ])
  })

  test('each month is one card with its figures in order', async () => {
    renderAnalisis(async () => jsonResponse(200, analysisFixture), 'phone')
    await screen.findByText(SINCE_FIRST_RECORD_LABEL)

    const cards = cardsIn('.analisis__meses')
    expect(cards).toHaveLength(analysisFixture.months.length)
    analysisFixture.months.forEach((row, index) => {
      const card = cards[index]!
      expect(card).toHaveAccessibleName(formatMonthLong(row.month))
      expect(figuresOf(card)[0]).toBe(formatMoney(row.sales))
      expect(figuresOf(card).at(-1)).toBe(formatMoney(row.cash))
      expect(card.classList.contains('analisis__tarjeta--actual')).toBe(false)
    })
  })

  test('a pending text sits in its own element, below a whole figure; a full one has no figure', async () => {
    renderAnalisis(async () => jsonResponse(200, pendingRowFixture()), 'phone')
    await screen.findByText(SINCE_FIRST_RECORD_LABEL)

    const [, partly, fully] = cardsIn('.analisis__semanas')
    const partlyCost = Array.from(partly!.querySelectorAll('.analisis__tarjeta-fila')).find(
      (node) => node.textContent?.startsWith('Cost of goods sold'),
    )!
    const figure = partlyCost.querySelector('.analisis__tarjeta-cifra')!
    const pending = partlyCost.querySelector('.analisis__tarjeta-pendiente')!
    expect(figure.textContent).toBe('$ 7.000')
    expect(pending.textContent).toBe(' and 1,5 g without cost')
    expect(figure.contains(pending)).toBe(false)
    expect(pending.contains(figure)).toBe(false)
    expect(figure.nextElementSibling).toBe(pending)

    const fullyCost = Array.from(fully!.querySelectorAll('.analisis__tarjeta-fila')).find(
      (node) => node.textContent?.startsWith('Cost of goods sold'),
    )!
    expect(fullyCost.querySelector('.analisis__tarjeta-cifra')).toBeNull()
    expect(fullyCost.querySelector('.analisis__tarjeta-pendiente')?.textContent).toBe('4 g without cost')
  })

  test('a pending variety cost and margin show their text apart from the figure', async () => {
    const [first, ...rest] = analysisFixture.month.varieties
    const body = {
      ...analysisFixture,
      month: {
        ...analysisFixture.month,
        varieties: [
          {
            ...first!,
            cost: { costed: 5000, pending_grams: 2.5 },
            margin: { amount: 9000, percent: null, pending_grams: 2.5 },
          },
          ...rest,
        ],
      },
    }
    renderAnalisis(async () => jsonResponse(200, body), 'phone')
    await screen.findByText(SINCE_FIRST_RECORD_LABEL)

    const card = cardsIn('.analisis__variedades')[0]!
    const pendings = Array.from(card.querySelectorAll('.analisis__tarjeta-pendiente'))
    expect(pendings.map((node) => node.textContent)).toEqual([
      ' and 2,5 g without cost',
      ' and 2,5 g without cost',
    ])
    expect(rowsOf(card).at(-1)).toBe('margin $ 9.000 and 2,5 g without cost')
  })

  test('the cards draw no table nor AmountRow, and the none-stood-out line follows the week cards', async () => {
    renderAnalisis(async () => jsonResponse(200, analysisFixture), 'phone')
    await screen.findByText(SINCE_FIRST_RECORD_LABEL)

    expect(screen.queryByRole('table')).toBeNull()
    for (const card of document.querySelectorAll('.analisis__tarjeta')) {
      expect(card.querySelector('.analisis__monto, .analisis__costos')).toBeNull()
    }
  })

  test('the none-stood-out line comes right after the week cards', async () => {
    const noBest = {
      ...analysisFixture,
      weeks: analysisFixture.weeks.map((week) => ({ ...week, best: false })),
    }
    renderAnalisis(async () => jsonResponse(200, noBest), 'phone')
    const line = await screen.findByText(NO_BEST_WEEK_LINE)
    expect(line.previousElementSibling).toBe(document.querySelector('.analisis__semanas'))
  })
})
