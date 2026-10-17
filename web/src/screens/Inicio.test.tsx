/**
 * `Inicio`, now the panel (plan, "Front": built only from
 * `web/src/api/fixtures/panel.json`): every figure on every tab, negative
 * Ganancia/Caja, the pending-cost note's placement, no-average, "Nadie te debe",
 * navigation, stock rows, a no-year range across a year boundary, the
 * "Arrancá por las variedades" banner above the figures, and a remount with a
 * different answer never showing the first answer's figures (`gcTime: 0`).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import panelFixture from '../api/fixtures/panel.json'
import type { PanelAnswer, PanelSetup } from '../api/panel'
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

let current: Me = ME

function Provide() {
  return <Outlet context={current} />
}

function stubFetch(
  panel: PanelAnswer | PanelAnswer[],
  pinnedCatalogStatus: unknown = { status: null },
  extra: (url: string, init?: RequestInit) => Response | undefined = () => undefined,
) {
  const answers = Array.isArray(panel) ? panel : [panel]
  let panelCalls = 0
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const handled = extra(url, init)
      if (handled !== undefined) return Promise.resolve(handled)
      if (url.includes('/pinned-catalog/status')) return Promise.resolve(jsonResponse(200, pinnedCatalogStatus))
      if (url.includes('/panel')) {
        const answer = answers[Math.min(panelCalls, answers.length - 1)]
        panelCalls += 1
        return Promise.resolve(jsonResponse(200, answer))
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    }),
  )
}

function panelCalls(): number {
  return vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/panel')).length
}

function withSetup(setup: Partial<PanelSetup>, base: PanelAnswer = PANEL): PanelAnswer {
  return { ...base, setup: { ...base.setup, ...setup } }
}

const GONE: Partial<PanelSetup> = { checklist: null, priced_today: true, bot_notice: false }

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
            <Route path="variedades/:id" element={<span>detalle de variedad</span>} />
            <Route path="negocio" element={<span>pantalla negocio</span>} />
            <Route path="catalogo" element={<span>pantalla catalogo</span>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  current = ME
  vi.unstubAllGlobals()
})

test('shows today\'s figures on open: heading, count, grams, and nothing that moved to Semana and Mes', async () => {
  stubFetch(PANEL)
  const { container } = renderInicio()
  await screen.findByText('Vendiste hoy')

  expect(within(container).getByText('2 ventas · 10 g')).toBeInTheDocument()
  expect(within(container.querySelector<HTMLElement>('.panel-ventas')!).getByText('$ 15.000')).toBeInTheDocument()
  expect(container.querySelector('.panel-resultados')).toBeNull() // Ganancia and Caja
  expect(container.querySelector('.panel-lista')).toBeNull() // Costo, Gastos, Regalaste, Compras
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
        expenses: 5000,
        purchases: 0,
        profit: -5000,
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

test('"Arrancá por las variedades" shows above the panel when the checklist is gone and nothing is priced today, and the panel keeps its real figures', async () => {
  stubFetch(withSetup({ ...GONE, priced_today: false }))
  const { container } = renderInicio()

  expect(await screen.findByText(EMPTY_TITLE)).toBeInTheDocument()
  expect(screen.getByText('Vendiste hoy')).toBeInTheDocument()
  expect(within(container.querySelector<HTMLElement>('.panel-ventas')!).getByText('$ 15.000')).toBeInTheDocument()

  const children = Array.from(container.querySelectorAll('.cuerpo > *'))
  const titleIndex = children.findIndex((el) => el.textContent?.includes(EMPTY_TITLE))
  const panelIndex = children.findIndex((el) => el.classList.contains('periodos'))
  expect(titleIndex).toBeLessThan(panelIndex)
})

test('Inicio no longer reads /varieties: the server says whether anything is priced today', async () => {
  stubFetch(withSetup(GONE))
  renderInicio()
  await screen.findByText('Vendiste hoy')

  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/varieties'))).toBe(false)
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
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    }),
  )
  renderInicio()

  expect(await screen.findByText('Te quedaste sin internet')).toBeInTheDocument()
  expect(screen.queryByText('Vendiste hoy')).not.toBeInTheDocument()
})

test('shows the fixed pinned-catalog notice while the pin is out of date', async () => {
  stubFetch(PANEL, {
    status: { state: 'out_of_date', reason: 'telegram_unreachable', last_published_on: '2026-09-29' },
  })
  renderInicio()

  const notice = await screen.findByText(PINNED_CATALOG_OUT_OF_DATE)
  expect(notice.closest('a')).toHaveAttribute('href', '/catalogo')
})

const NINA = { customer_id: 2, name: 'Nina Soto', balance: 8000, owing_since: '2026-09-20' }
const ANA = PANEL.debts.teaser[0]!
const TWO_DEBTORS: PanelAnswer = {
  ...PANEL,
  debts: { total_owed: 23000, sales_owing_count: 2, oldest: '2026-09-14', teaser: [ANA, NINA] },
}
const ONE_DEBTOR: PanelAnswer = {
  ...PANEL,
  debts: { total_owed: 8000, sales_owing_count: 1, oldest: '2026-09-20', teaser: [NINA] },
}

function customerResponse(url: string): Response | undefined {
  if (url === '/customers/1')
    return jsonResponse(200, { id: 1, name: 'Ana Pérez', phone: null, channel: null, vip: false, balance: 15000, owing_since: '2026-09-14', standing: 'owes' })
  if (url.includes('/payments/preview'))
    return jsonResponse(200, { applied_to: [{ sale_id: 10, sale_date: '2026-09-14', amount: 15000 }], after: { balance: 0, owing_since: null, standing: 'settled' } })
  return undefined
}

test('each debtor has a "Cobrar a <name>" button that is a separate target from the row, which still opens the card', async () => {
  stubFetch(TWO_DEBTORS, { status: null }, customerResponse)
  renderInicio()

  const cobrar = await screen.findByRole('button', { name: 'Cobrar a Ana Pérez' })
  expect(screen.getByRole('button', { name: 'Cobrar a Nina Soto' })).toBeInTheDocument()
  expect(cobrar.closest('a')).toBeNull()

  await userEvent.click(screen.getByText('Ana Pérez').closest('a')!)
  expect(await screen.findByText('ficha de cliente')).toBeInTheDocument()
})

test('Cobrar opens the sheet with that customer chosen and the balance read now; saving closes it and the panel is read again without the paid debtor', async () => {
  stubFetch([TWO_DEBTORS, ONE_DEBTOR], { status: null }, (url, init) => {
    if (url === '/customers/1/payments' && init?.method === 'POST')
      return jsonResponse(201, { payment: { id: 5, paid_on: '2026-10-03', amount: 15000, method: 'cash' }, applied_to: [], after: { balance: 0, owing_since: null, standing: 'settled' } })
    return customerResponse(url)
  })
  renderInicio()

  await userEvent.click(await screen.findByRole('button', { name: 'Cobrar a Ana Pérez' }))
  expect(await screen.findByText('Registrar cobro')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByLabelText('Monto')).toHaveValue('15000'))
  expect(screen.getByLabelText(/Fecha/)).toHaveValue('2026-10-03')

  await userEvent.click(screen.getByRole('radio', { name: 'Efectivo' }))
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  await waitFor(() => expect(screen.queryByText('Registrar cobro')).not.toBeInTheDocument())
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Cobrar a Ana Pérez' })).not.toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Cobrar a Nina Soto' })).toBeInTheDocument()
  expect(screen.getByText('Cobro guardado')).toBeInTheDocument()
  expect(panelCalls()).toBe(2)
})

test('closing Cobro without saving reads nothing again', async () => {
  stubFetch(TWO_DEBTORS, { status: null }, customerResponse)
  renderInicio()

  await userEvent.click(await screen.findByRole('button', { name: 'Cobrar a Ana Pérez' }))
  await screen.findByText('Registrar cobro')
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

  expect(screen.queryByText('Registrar cobro')).not.toBeInTheDocument()
  expect(panelCalls()).toBe(1)
  expect(screen.getByRole('button', { name: 'Cobrar a Ana Pérez' })).toBeInTheDocument()
})

test('Lo que te queda: baja and agotada rows open that variety, ok and sin entradas rows do not', async () => {
  const stock: PanelAnswer['stock'] = [
    { variety_id: 1, name: 'Criolla', grams: 18, status: 'low', sold_out_since: null, threshold: 20, days_left: 6 },
    { variety_id: 2, name: 'Sativa', grams: 0, status: 'sold_out', sold_out_since: '2026-10-01', threshold: 20, days_left: null },
    { variety_id: 3, name: 'Indica', grams: 64, status: 'ok', sold_out_since: null, threshold: 20, days_left: 21 },
    { variety_id: 4, name: 'Hibrida', grams: 0, status: 'no_entries', sold_out_since: null, threshold: null, days_left: null },
  ]
  stubFetch({ ...PANEL, stock })
  renderInicio()

  const low = (await screen.findByText('Criolla')).closest('a')
  expect(low).toHaveAttribute('href', '/variedades/1')
  expect(screen.getByText('Sativa').closest('a')).toHaveAttribute('href', '/variedades/2')
  expect(screen.getByText('Indica').closest('a')).toBeNull()
  expect(screen.getByText('Hibrida').closest('a')).toBeNull()
  // A tappable row says so by shape (a chevron), not by color.
  expect(low!.querySelector('svg')).not.toBeNull()

  await userEvent.click(low!)
  expect(await screen.findByText('detalle de variedad')).toBeInTheDocument()
})

test('Hoy shows none of Ganancia, Caja, Gastos, Regalaste, Compras, Costo de lo vendido or the average', async () => {
  stubFetch(PANEL)
  renderInicio()
  await screen.findByText('Vendiste hoy')

  for (const word of [/Ganancia/, /Caja/, /Gastos/, /Regalaste/, /Compras/, /Costo de lo vendido/, /promedio/]) {
    expect(screen.queryByText(word)).not.toBeInTheDocument()
  }
})

test('with no sales today: real zeros and no average', async () => {
  stubFetch({
    ...PANEL,
    periods: { ...PANEL.periods, today: { ...PANEL.periods.today, sales: 0, sales_count: 0, grams_sold: 0 } },
  })
  const { container } = renderInicio()
  await screen.findByText('Vendiste hoy')

  const sold = within(container.querySelector<HTMLElement>('.panel-ventas')!)
  expect(sold.getByText('$ 0')).toBeInTheDocument()
  expect(sold.getByText('0 ventas · 0 g')).toBeInTheDocument()
})

test('the checklist shows its steps in the server\'s order, replacing "Arrancá por las variedades", and only on Hoy', async () => {
  stubFetch(withSetup({ priced_today: false }))
  renderInicio()

  const list = await screen.findByRole('list')
  expect(within(list).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
    '/variedades',
    '/mi-stock/nueva-entrada',
    '/catalogo',
    '/negocio',
  ])
  expect(screen.queryByText(EMPTY_TITLE)).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Semana' }))
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
})

test('the bot notice shows on Hoy only, opens Catálogo, and never beside the checklist', async () => {
  stubFetch(withSetup({ ...GONE, bot_notice: true }))
  renderInicio()

  const connect = await screen.findByRole('link', { name: 'Conectar el bot' })
  expect(connect).toHaveAttribute('href', '/catalogo')
  expect(screen.queryByText('Para empezar a vender')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Mes' }))
  expect(screen.queryByRole('link', { name: 'Conectar el bot' })).not.toBeInTheDocument()
})

test('dismissing the bot notice reads the panel again and the notice goes, with no toast', async () => {
  stubFetch([withSetup({ ...GONE, bot_notice: true }), withSetup(GONE)], { status: null }, (url, init) =>
    url === '/panel/bot-notice/dismissal' && init?.method === 'POST' ? new Response(null, { status: 204 }) : undefined,
  )
  renderInicio()

  await userEvent.click(await screen.findByRole('button', { name: 'No mostrar más' }))

  await waitFor(() => expect(screen.queryByRole('link', { name: 'Conectar el bot' })).not.toBeInTheDocument())
  expect(panelCalls()).toBe(2)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('the stale-catalog notice is one of only three, and opens Catálogo', async () => {
  stubFetch(withSetup({ ...GONE, bot_notice: true, priced_today: false }), {
    status: { state: 'out_of_date' },
  })
  renderInicio()

  await screen.findByText(PINNED_CATALOG_OUT_OF_DATE)
  expect(screen.getByText(EMPTY_TITLE)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Conectar el bot' })).toBeInTheDocument()
  expect(screen.getByText(PINNED_CATALOG_OUT_OF_DATE).closest('a')).toHaveAttribute('href', '/catalogo')
})

test.each([
  ['La Huerta', 'L'],
  ['ñandú', 'Ñ'],
  ['7 Flores', '7'],
])('the avatar shows %s as %s, named "Configuración", opens Negocio, on all three tabs', async (name, initial) => {
  stubFetch(PANEL)
  current = { ...ME, business_name: name }
  renderInicio()

  for (const tab of ['Hoy', 'Semana', 'Mes']) {
    await userEvent.click(await screen.findByRole('button', { name: tab }))
    const avatar = screen.getByRole('link', { name: 'Configuración' })
    expect(avatar).toHaveTextContent(initial)
    expect(avatar).toHaveAttribute('href', '/negocio')
  }
  await userEvent.click(screen.getByRole('link', { name: 'Configuración' }))
  expect(await screen.findByText('pantalla negocio')).toBeInTheDocument()
})
