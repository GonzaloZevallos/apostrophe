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
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import analysisEmptyFixture from '../api/fixtures/analysis-empty.json'
import analysisFixture from '../api/fixtures/analysis.json'
import Analisis, {
  BEST_WEEKDAY_MARK,
  BEST_WEEK_MARK,
  BEST_WEEK_TABLE_MARK,
  EMPTY_MONTH_LINE,
  NO_BEST_WEEK_LINE,
  NO_HISTORY_LINE,
  SINCE_FIRST_RECORD_LABEL,
} from './Analisis'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-04' }

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
  expect(screen.getByText(/margen \$ 40\.000/)).toBeInTheDocument()
  expect(screen.getByText(/margen \$ -5\.000/)).toBeInTheDocument()

  // The fixture's last week (28/9) carries `best: true`.
  expect(screen.getAllByText(BEST_WEEK_MARK)).toHaveLength(1)

  // The fixture's Friday (weekday 5) carries `best: true`.
  expect(screen.getAllByText(BEST_WEEKDAY_MARK)).toHaveLength(1)

  // The month's largest expense category ("Insumos", $ 4.000) is readable on screen.
  expect(screen.getAllByText('Insumos').length).toBeGreaterThan(0)
  expect(screen.getByText('$ 4.000')).toBeInTheDocument()
})

test('pending marks show their own N, never a $0 cost', async () => {
  renderAnalisis(async () => jsonResponse(200, analysisFixture))

  // The month header: average margin and stock shortfall each carry their own N.
  expect(await screen.findByText(/margen promedio 55% y 2,5 g sin costo/)).toBeInTheDocument()
  expect(screen.getByText(/Faltante de stock \$ 3\.000 y 1 g sin costo/)).toBeInTheDocument()

  // "Flor B"'s own cost and margin carry the same mark.
  expect(screen.getByText(/costo \$ 9\.000 y 2,5 g sin costo/)).toBeInTheDocument()
})

test('a variety only gifted shows no margin percentage', async () => {
  renderAnalisis(async () => jsonResponse(200, analysisFixture))

  // "Flor Gift" names both the card and the computer table's row; only the card
  // carries the "margen" label this assertion reads.
  const giftRow = (await screen.findAllByText('Flor Gift'))
    .map((node) => node.closest('.analisis__variedad'))
    .find((node) => node !== null)
  expect(giftRow).not.toBeUndefined()
  const margin = within(giftRow as HTMLElement).getByText(/^margen/)
  expect(margin.textContent).not.toMatch(/%/)
})

test('a business with no history shows its fixed line and no figures', async () => {
  renderAnalisis(async () => jsonResponse(200, analysisEmptyFixture))

  expect(await screen.findByText(NO_HISTORY_LINE)).toBeInTheDocument()
  expect(screen.queryByText(EMPTY_MONTH_LINE)).not.toBeInTheDocument()
  expect(screen.queryByText('Mes a mes · últimos 12')).not.toBeInTheDocument()
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

  await screen.findByText('Octubre 2026', { selector: '.gastos__mes-etiqueta' })
  // The fixture's `next` is null: October is the current month, nothing comes after.
  expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeDisabled()

  await user.click(screen.getByRole('button', { name: 'Mes anterior' }))
  expect(requested).toContain('/analysis?month=2026-09')
})

test('the computer table carries headers, the margin stack, pending marks and the best/current week', async () => {
  renderAnalisis(async () => jsonResponse(200, analysisFixture))

  const table = (await screen.findAllByText('Variedad')).find(
    (node) => node.closest('table') !== null,
  )
  expect(table).not.toBeUndefined()
  const varietyTable = (table as HTMLElement).closest('table') as HTMLElement
  expect(within(varietyTable).getByText('Gramos regalo')).toBeInTheDocument()
  expect(within(varietyTable).getByText('Margen')).toBeInTheDocument()

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
  // `textContent` rather than a standalone "y … g sin costo" node.
  const headerNames = within(varietyTable)
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  const costoIndex = headerNames.indexOf('Costo')
  const margenIndex = headerNames.indexOf('Margen')
  expect(costoIndex).toBeGreaterThanOrEqual(0)
  expect(margenIndex).toBeGreaterThanOrEqual(0)

  const [florBCell] = within(varietyTable).getAllByText('Flor B')
  expect(florBCell).not.toBeUndefined()
  const florBRow = (florBCell as HTMLElement).closest('tr') as HTMLElement
  const florBCells = within(florBRow).getAllByRole('cell')
  expect(florBCells[costoIndex]).toHaveTextContent('y 2,5 g sin costo')
  expect(florBCells[margenIndex]).toHaveTextContent('y 2,5 g sin costo')

  // Request item 1 ("Done when"): the margin stack's own child order. In that
  // same Margen cell, the amount sits above (before, in source order) the
  // percentage: the first child span holds "$ 6.000…", the second "40%".
  const florBMarginCell = florBCells[margenIndex] as HTMLElement
  const marginSpans = florBMarginCell.querySelectorAll('span')
  expect(marginSpans).toHaveLength(2)
  expect(marginSpans[0]).toHaveTextContent('$ 6.000')
  expect(marginSpans[0]).toHaveTextContent('y 2,5 g sin costo')
  expect(marginSpans[1]).toHaveTextContent('40%')

  const weekTables = (await screen.findAllByText('Semana')).map((node) => node.closest('table'))
  const weekTable = weekTables.find((t) => t !== null) as HTMLElement
  const rows = within(weekTable).getAllByRole('row').slice(1) // drop the header row
  const lastRow = rows.at(-1)
  expect(lastRow).not.toBeUndefined()
  expect((lastRow as HTMLElement).className).toContain('analisis__fila-actual')
  expect(within(lastRow as HTMLElement).getByText(BEST_WEEK_TABLE_MARK)).toBeInTheDocument()

  const monthHeaders = await screen.findAllByText('Mes')
  const monthTable = monthHeaders
    .map((node) => node.closest('table'))
    .find((t) => t !== null) as HTMLElement
  expect(within(monthTable).getByText('Caja')).toBeInTheDocument()
})

test('"Ninguna se destacó" shows in the week table when every week is $0', async () => {
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

test('month navigation disables "Mes anterior" when there is no earlier month', async () => {
  // The chosen month is already the first record's own month: `previous` is null,
  // same shape `GET /analysis` would answer for a business that far back.
  const firstMonthFixture = {
    ...analysisFixture,
    month: { ...analysisFixture.month, previous: null },
  }
  renderAnalisis(async () => jsonResponse(200, firstMonthFixture))

  await screen.findByText('Octubre 2026', { selector: '.gastos__mes-etiqueta' })
  expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeDisabled()
})

test('Promoción and Consumo propio show apart from Faltante de stock, each with only its own pending grams', async () => {
  renderAnalisis(async () => jsonResponse(200, analysisFixture))

  // The month header: a promotion with half a pending gram, an own use fully costed.
  expect(await screen.findByText(/^Promoción \$ 4\.000 y 0,5 g sin costo$/)).toBeInTheDocument()
  expect(screen.getByText(/^Consumo propio \$ 1\.500$/)).toBeInTheDocument()
  expect(screen.getByText(/Faltante de stock \$ 3\.000 y 1 g sin costo/)).toBeInTheDocument()

  // The since-the-first-record totals read the same two lines.
  expect(screen.getByText(/^Promoción \$ 9\.000 y 0,5 g sin costo$/)).toBeInTheDocument()
  expect(screen.getByText(/^Consumo propio \$ 2\.500$/)).toBeInTheDocument()
})

test('a week and a month row show a withdrawal line only when the period has one', async () => {
  renderAnalisis(async () => jsonResponse(200, analysisFixture))
  await screen.findByText(SINCE_FIRST_RECORD_LABEL)

  // Phone rows: only the fixture's first week (10/8) has a promotion and an own use.
  const weekRows = Array.from(document.querySelectorAll<HTMLElement>('.analisis__semana'))
  expect(weekRows).toHaveLength(8)
  expect(within(weekRows[0]!).getByText('Promoción $ 1.000')).toBeInTheDocument()
  expect(within(weekRows[0]!).getByText('Consumo propio $ 500')).toBeInTheDocument()
  for (const row of weekRows.slice(1)) {
    expect(within(row).queryByText(/Promoción|Consumo propio/)).not.toBeInTheDocument()
  }

  // The month rows: the same, with the fixture's last month holding no promotion.
  const monthRows = Array.from(document.querySelectorAll<HTMLElement>('.analisis__mes-fila'))
  expect(within(monthRows[0]!).getByText('Promoción $ 1.000')).toBeInTheDocument()
  expect(within(monthRows[monthRows.length - 1]!).queryByText(/Promoción/)).not.toBeInTheDocument()
})

// ---- Entirely pending figures (GH-141): "N g sin costo" alone, decided by `all_pending` ----

const FLOR_B_ALL_PENDING = {
  cost: { costed: 0, pending_grams: 8.0, all_pending: true },
  // A non-null percent: the screen, not the fixture, must leave a grams-only margin bare.
  margin: { amount: 0, percent: 0, pending_grams: 8.0 },
}

function withVarietyAllPending() {
  return {
    ...analysisFixture,
    month: {
      ...analysisFixture.month,
      varieties: analysisFixture.month.varieties.map((variety) =>
        variety.name === 'Flor B' ? { ...variety, ...FLOR_B_ALL_PENDING } : variety,
      ),
    },
  }
}

test('an entirely pending variety reads grams only for cost and margin, with no percentage, on the phone cards', async () => {
  renderAnalisis(async () => jsonResponse(200, withVarietyAllPending()))

  const card = (await screen.findAllByText('Flor B'))
    .map((node) => node.closest('.analisis__variedad'))
    .find((node) => node !== null) as HTMLElement
  expect(within(card).getByText(/^costo 8 g sin costo$/)).toBeInTheDocument()
  const margin = within(card).getByText(/^margen/)
  expect(margin).toHaveTextContent(/^margen 8 g sin costo$/)
  expect(margin.textContent).not.toMatch(/%|\$/)
})

test('an entirely pending variety reads grams only for cost and margin, with no percentage, in the computer table', async () => {
  renderAnalisis(async () => jsonResponse(200, withVarietyAllPending()))

  const varietyTable = (await screen.findAllByText('Variedad'))
    .map((node) => node.closest('table'))
    .find((t) => t !== null) as HTMLElement
  const headers = within(varietyTable)
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  const row = within(varietyTable).getByText('Flor B').closest('tr') as HTMLElement
  const cells = within(row).getAllByRole('cell')
  expect(cells[headers.indexOf('Costo')]).toHaveTextContent(/^8 g sin costo$/)
  const marginCell = cells[headers.indexOf('Margen')] as HTMLElement
  expect(marginCell).toHaveTextContent(/^8 g sin costo$/)
  expect(marginCell.textContent).not.toMatch(/%|\$/)
})

test('a $0 lot with pending grams reads "$ 0 y N g sin costo", since it is not entirely pending', async () => {
  const zeroLot = {
    ...analysisFixture,
    month: {
      ...analysisFixture.month,
      varieties: analysisFixture.month.varieties.map((variety) =>
        variety.name === 'Flor B'
          ? {
              ...variety,
              cost: { costed: 0, pending_grams: 3.0, all_pending: false },
              margin: { amount: 8000, percent: 100, pending_grams: 3.0 },
            }
          : variety,
      ),
    },
  }
  renderAnalisis(async () => jsonResponse(200, zeroLot))

  expect(await screen.findByText(/^costo \$ 0 y 3 g sin costo$/)).toBeInTheDocument()
})

const ALL_PENDING_FIGURE = { amount: 0, pending_grams: 2.0, all_pending: true }

function withEveryFigureAllPending() {
  const week = analysisFixture.weeks[0]!
  const monthRow = analysisFixture.months[0]!
  return {
    ...withVarietyAllPending(),
    month: {
      ...withVarietyAllPending().month,
      shortfall: ALL_PENDING_FIGURE,
      promotion: ALL_PENDING_FIGURE,
      own_use: ALL_PENDING_FIGURE,
    },
    weeks: [
      {
        ...week,
        promotion: ALL_PENDING_FIGURE,
        own_use: ALL_PENDING_FIGURE,
        // Ganancia is a real figure over the costed part: its amount stays, with its mark.
        profit: { amount: 7000, pending_grams: 5.0 },
      },
      ...analysisFixture.weeks.slice(1),
    ],
    months: [
      { ...monthRow, promotion: ALL_PENDING_FIGURE, own_use: ALL_PENDING_FIGURE },
      ...analysisFixture.months.slice(1),
    ],
    since_first_record: {
      ...analysisFixture.since_first_record,
      shortfall: ALL_PENDING_FIGURE,
      promotion: ALL_PENDING_FIGURE,
      own_use: ALL_PENDING_FIGURE,
    },
  }
}

test('every entirely pending cost figure reads grams alone, in the header, the rows and since the first record', async () => {
  renderAnalisis(async () => jsonResponse(200, withEveryFigureAllPending()))
  await screen.findByText(SINCE_FIRST_RECORD_LABEL)

  // Month header (a `.pie` span each) and the since-first-record block.
  expect(screen.getAllByText(/^Faltante de stock 2 g sin costo$/)).toHaveLength(2)
  expect(screen.getAllByText(/^Promoción 2 g sin costo$/).length).toBeGreaterThanOrEqual(3)
  expect(screen.getAllByText(/^Consumo propio 2 g sin costo$/).length).toBeGreaterThanOrEqual(3)

  // The computer tables' promotion and own-use cells of the first week and month.
  const weekCells = Array.from(
    document.querySelectorAll('.analisis__tabla-contenedor--semanas tbody tr:first-child td'),
  ).map((cell) => cell.textContent)
  expect(weekCells).toContain('2 g sin costo')
  const monthCells = Array.from(
    document.querySelectorAll('.analisis__tabla-contenedor--meses tbody tr:first-child td'),
  ).map((cell) => cell.textContent)
  expect(monthCells).toContain('2 g sin costo')

  // Nothing on the screen pairs a $ 0 with pending grams.
  expect(document.body.textContent).not.toMatch(/\$ 0 y [\d,]+ g sin costo/)
})

test('Ganancia with every draw pending still shows its amount and its mark', async () => {
  renderAnalisis(async () => jsonResponse(200, withEveryFigureAllPending()))
  await screen.findByText(SINCE_FIRST_RECORD_LABEL)

  const firstWeek = document.querySelector<HTMLElement>('.analisis__semana') as HTMLElement
  expect(within(firstWeek).getByText(/^ganancia \$ 7\.000 y 5 g sin costo$/)).toBeInTheDocument()
  const weekRow = document.querySelector(
    '.analisis__tabla-contenedor--semanas tbody tr:first-child',
  ) as HTMLElement
  expect(weekRow).toHaveTextContent('$ 7.000 y 5 g sin costo')
})
