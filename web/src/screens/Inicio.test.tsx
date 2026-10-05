/**
 * `Inicio`, now the panel (plan, "Front": built only from
 * `web/src/api/fixtures/panel.json`): every figure on every tab, negative
 * Ganancia/Caja, the pending-cost note's placement, no-average, "Nadie te debe",
 * navigation, stock rows, a no-year range across a year boundary, the
 * "Arrancá por las variedades" banner above the figures, and a remount with a
 * different answer never showing the first answer's figures (`gcTime: 0`).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import panelFixture from '../api/fixtures/panel.json'
import type { PanelAnswer } from '../api/panel'
import type { Me } from '../api/me'
import Inicio, { EMPTY_TITLE, PINNED_CATALOG_OUT_OF_DATE } from './Inicio'

const PANEL: PanelAnswer = panelFixture as PanelAnswer

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03' }

function Provide() {
  return <Outlet context={ME} />
}

function stubFetch(
  panel: PanelAnswer,
  varieties: Array<{ current_price: unknown }> = [{ current_price: { id: 1 } }],
  pinnedCatalogStatus: unknown = { status: null },
) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/pinned-catalog/status')) return Promise.resolve(jsonResponse(200, pinnedCatalogStatus))
      if (url.includes('/panel')) return Promise.resolve(jsonResponse(200, panel))
      if (url.includes('/varieties')) return Promise.resolve(jsonResponse(200, varieties))
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    }),
  )
}

function renderInicio(
  client: QueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Provide />}>
            <Route index element={<Inicio />} />
            <Route path="clientes/deben" element={<span>pantalla te deben</span>} />
            <Route path="clientes/:id" element={<span>ficha de cliente</span>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('shows today\'s figures on open: heading, count, average, grams, Ganancia, Caja', async () => {
  stubFetch(PANEL)
  const { container } = renderInicio()
  await screen.findByText('Vendiste hoy')

  expect(within(container).getByText('2 ventas · promedio $ 7.500 · 10 g')).toBeInTheDocument()
  expect(within(container.querySelector<HTMLElement>('.panel-ventas')!).getByText('$ 15.000')).toBeInTheDocument()
  expect(within(container.querySelector<HTMLElement>('.panel-lista')!).getByText('$ 6.000')).toBeInTheDocument()
  const resultados = container.querySelector<HTMLElement>('.panel-resultados')!
  expect(within(resultados).getByText('$ 9.000')).toBeInTheDocument() // profit (positive)
  expect(within(resultados).getByText('$ 15.000')).toBeInTheDocument() // cash
})

test('switching to Semana shows the week\'s figures, including a negative Caja', async () => {
  stubFetch(PANEL)
  renderInicio()
  await screen.findByText('Vendiste hoy')

  screen.getByRole('button', { name: 'Semana' }).click()

  expect(await screen.findByText('Vendiste esta semana')).toBeInTheDocument()
  expect(screen.getByText('28/09 – 04/10')).toBeInTheDocument()
  expect(screen.getByText('$ 42.000')).toBeInTheDocument()
  expect(screen.getByText('5 ventas · promedio $ 8.400 · 28 g')).toBeInTheDocument()
  expect(screen.getByText('−$ 12.000')).toBeInTheDocument() // cash is negative
})

test('the pending-cost note shows under both Costo de lo vendido and Ganancia, only when pending', async () => {
  stubFetch(PANEL)
  renderInicio()
  await screen.findByText('Vendiste hoy')
  expect(screen.queryByText('incluye costo pendiente')).not.toBeInTheDocument()

  screen.getByRole('button', { name: 'Semana' }).click()
  await screen.findByText('Vendiste esta semana')
  expect(screen.getAllByText('incluye costo pendiente')).toHaveLength(2)

  screen.getByRole('button', { name: 'Mes' }).click()
  await screen.findByText('Vendiste este mes')
  expect(screen.queryByText('incluye costo pendiente')).not.toBeInTheDocument()
})

test('no sales shows no average, and the range reads with no year', async () => {
  // A dedicated override, not the shared fixture: a period with no sales must still
  // be a period that could really exist (the shared fixture's month contains today,
  // which has sales, so it can never itself read 0 sales).
  const noSalesThisMonth: PanelAnswer = {
    ...PANEL,
    periods: {
      ...PANEL.periods,
      month: {
        start: '2026-10-01',
        end: '2026-10-31',
        sales: 0,
        sales_count: 0,
        average_sale: null,
        grams_sold: 0,
        grams_gifted: 0,
        cost_of_goods: 0,
        pending_cost: false,
        shortfall: null,
        expenses: 5000,
        purchases: 0,
        profit: -5000,
        profit_pending: false,
        cash: -5000,
      },
    },
  }
  stubFetch(noSalesThisMonth)
  const { container } = renderInicio()
  await screen.findByText('Vendiste hoy')

  screen.getByRole('button', { name: 'Mes' }).click()

  expect(await screen.findByText('Vendiste este mes')).toBeInTheDocument()
  expect(screen.getByText('01/10 – 31/10')).toBeInTheDocument()
  expect(screen.getByText('0 ventas · 0 g')).toBeInTheDocument()
  expect(screen.queryByText(/promedio/)).not.toBeInTheDocument()
  expect(screen.getAllByText('−$ 5.000')).toHaveLength(2) // profit and cash
  expect(container.querySelector<HTMLElement>('.panel-resultados')).not.toBeNull()
})

test('Te deben: total, count, oldest date, and the teaser opens a customer card', async () => {
  stubFetch(PANEL)
  renderInicio()

  expect(await screen.findByText('$ 37.000')).toBeInTheDocument()
  expect(screen.getByText('4 ventas · desde 14/09')).toBeInTheDocument()
  const row = screen.getByText('Ana Pérez').closest('a')
  expect(row).not.toBeNull()
  row?.click()
  expect(await screen.findByText('ficha de cliente')).toBeInTheDocument()
})

test('tapping "Te deben" opens the Te deben screen', async () => {
  stubFetch(PANEL)
  renderInicio()
  await screen.findByText('$ 37.000')

  screen.getByRole('link', { name: 'Te deben' }).click()

  expect(await screen.findByText('pantalla te deben')).toBeInTheDocument()
})

test('"Nadie te debe" with nothing to tap when nobody owes', async () => {
  const empty: PanelAnswer = {
    ...PANEL,
    debts: { total_owed: 0, sales_owing_count: 0, oldest: null, teaser: [] },
  }
  stubFetch(empty)
  renderInicio()

  expect(await screen.findByText('Nadie te debe')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Te deben' })).not.toBeInTheDocument()
})

test('stock rows: name, grams, status and days left, in the API\'s own order, with no total', async () => {
  stubFetch(PANEL)
  renderInicio()

  expect(await screen.findByText('Criolla')).toBeInTheDocument()
  expect(screen.getByText('18 g')).toBeInTheDocument()
  expect(screen.getByText('6 días')).toBeInTheDocument()
  expect(screen.queryByText(/en total/)).not.toBeInTheDocument()
})

test('"Arrancá por las variedades" shows above the panel, which still shows its real figures', async () => {
  stubFetch(PANEL, [{ current_price: null }])
  const { container } = renderInicio()

  expect(await screen.findByText(EMPTY_TITLE)).toBeInTheDocument()
  expect(screen.getByText('Vendiste hoy')).toBeInTheDocument()
  expect(within(container.querySelector<HTMLElement>('.panel-ventas')!).getByText('$ 15.000')).toBeInTheDocument()

  // The banner sits above the panel, not in place of it.
  const titleIndex = Array.from(container.querySelectorAll('.cuerpo > *')).findIndex((el) =>
    el.textContent?.includes(EMPTY_TITLE),
  )
  const panelIndex = Array.from(container.querySelectorAll('.cuerpo > *')).findIndex((el) =>
    el.classList.contains('periodos'),
  )
  expect(titleIndex).toBeLessThan(panelIndex)
})

test('a remount with a different answer never shows the first answer\'s figures', async () => {
  const client = new QueryClient()
  stubFetch(PANEL)
  const first = renderInicio(client)
  await screen.findByText('Vendiste hoy')
  expect(within(first.container.querySelector<HTMLElement>('.panel-ventas')!).getByText('$ 15.000')).toBeInTheDocument()
  first.unmount()
  // `gcTime: 0` schedules the cache entry's removal for the next tick (TanStack's own
  // behaviour), the same gap a real navigation away and back leaves: this is what the
  // seam actually promises — a remount never shows a resolved mount's stale cache.
  await new Promise((resolve) => setTimeout(resolve, 0))

  const other: PanelAnswer = {
    ...PANEL,
    periods: { ...PANEL.periods, today: { ...PANEL.periods.today, sales: 999, sales_count: 1 } },
  }
  stubFetch(other)
  const second = renderInicio(client)
  await screen.findByText('Vendiste hoy')

  const scoped = within(second.container.querySelector<HTMLElement>('.panel-ventas')!)
  expect(scoped.getByText('$ 999')).toBeInTheDocument()
  expect(scoped.queryByText('$ 15.000')).not.toBeInTheDocument()
})

test('shows "Sin conexión" when the panel fetch fails, with no figures', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/panel')) return Promise.reject(new Error('network error'))
      if (url.includes('/varieties')) return Promise.resolve(jsonResponse(200, [{ current_price: { id: 1 } }]))
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    }),
  )
  renderInicio()

  expect(await screen.findByText('Te quedaste sin internet')).toBeInTheDocument()
  expect(screen.queryByText('Vendiste hoy')).not.toBeInTheDocument()
})

test('shows the fixed pinned-catalog notice while the pin is out of date', async () => {
  stubFetch(PANEL, [{ current_price: { id: 1 } }], {
    status: { state: 'out_of_date', reason: 'telegram_unreachable', last_published_on: '2026-09-29' },
  })
  renderInicio()

  const notice = await screen.findByText(PINNED_CATALOG_OUT_OF_DATE)
  expect(notice.closest('a')).toHaveAttribute('href', '/catalogo')
})
