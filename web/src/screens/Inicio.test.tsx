/**
 * `Inicio`, now the panel (plan, "Front": built only from
 * `web/src/api/fixtures/panel.json`): every figure on every tab, negative
 * Ganancia/Caja, the pending-cost note's placement, no-average, "Nobody owes you",
 * navigation, stock rows, a no-year range across a year boundary, the
 * no first-use notice for any setup state (Home reads neither `/first-run` nor
 * `/onboarding-progress`), and a remount with a different answer never showing the
 * first answer's figures (`gcTime: 0`).
 */

import {
  CATALOG,
  CUSTOMER,
  CUSTOMER_PAYMENT,
  CUSTOMERS,
  HOME,
  SETTINGS,
} from '../routes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider, useLocation, useParams } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import panelFixture from '../api/fixtures/panel.json'
import type { PanelAnswer } from '../api/panel'
import type { Me } from '../api/me'
import { SHOWN_EN } from '../test/shownLanguage'
import { homeLayoutRoute } from '../test/homeLayoutRoute'
import { screenRoute } from '../test/screenRoute'
import { chooseTheme } from '../theme'
import { stubViewport } from '../test-viewport'
import { consumePaymentReturn, setPaymentReturn } from '../paymentReturn'
import { expectIconAndTextRule } from '../test/iconAndTextRule'
import Inicio, { PINNED_CATALOG_OUT_OF_DATE } from './Inicio'
import { baselineText } from '../i18n/testing'
import { SIN_CONEXION_MENSAJE } from '../copy/common'
import { MoneyFormatProvider } from '../format/MoneyFormatProvider'

const NOBODY_OWES = baselineText('inicio.ts:NOBODY_OWES')

const PANEL: PanelAnswer = panelFixture as PanelAnswer

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Every call the stub saw on the two reads Home no longer makes, as "METHOD url". */
const forbiddenCalls: string[] = []

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03', shown_language: SHOWN_EN, money: { symbol: '$', decimals: 0 } }

function Provide() {
  return <MoneyFormatProvider format={ME.money}><Outlet context={ME} /></MoneyFormatProvider>
}

function SettingsLanding() {
  const location = useLocation()
  return <span>{`Configuración inApp=${String((location.state as { inApp?: boolean } | null)?.inApp)}`}</span>
}

function stubFetch(panel: PanelAnswer, pinnedCatalogStatus: unknown = { status: null }, shown: Record<string, unknown> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/first-run') || url.includes('/onboarding-progress')) {
        // What the server would answer for this business: if Home asked, it would show it.
        forbiddenCalls.push(`${init?.method ?? 'GET'} ${url}`)
        const kind = url.includes('/first-run') ? 'first-run' : 'onboarding-progress'
        return Promise.resolve(jsonResponse(200, shown[kind] ?? {}))
      }
      if (url.includes('/pinned-catalog/status')) return Promise.resolve(jsonResponse(200, pinnedCatalogStatus))
      if (url.includes('/panel')) return Promise.resolve(jsonResponse(200, panel))
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    }),
  )
}

function PaymentStub() {
  const { id } = useParams<{ id: string }>()
  const state: unknown = useLocation().state
  const inApp = typeof state === 'object' && state !== null && 'inApp' in state && state.inApp === true
  return (
    <>
      <span>cobro de {id}</span>
      {inApp && <span>desde la app</span>}
    </>
  )
}

function renderInicio(
  client: QueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider
        router={createMemoryRouter(
          [
            {
              element: <Provide />,
              children: [
                homeLayoutRoute([screenRoute('home', <Inicio />)]),
                { path: CUSTOMERS, element: <span>pantalla clientes</span> },
                { path: CUSTOMER, element: <span>ficha de cliente</span> },
                { path: CUSTOMER_PAYMENT, element: <PaymentStub /> },
                { path: SETTINGS, element: <SettingsLanding /> },
              ],
            },
          ],
          { initialEntries: [HOME] },
        )}
      />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  chooseTheme('claro')
  forbiddenCalls.length = 0
  consumePaymentReturn()
})

test('the business avatar at the top opens Configuración in one tap, carrying inApp', async () => {
  stubFetch(PANEL)
  renderInicio()

  const avatar = await screen.findByRole('link', { name: 'Settings' })
  expect(avatar).toHaveAttribute('href', SETTINGS)
  expect(avatar).toHaveTextContent('LH')
  // The phone shows no business name: the avatar's initials are its only trace.
  expect(screen.queryByText('La Huerta')).not.toBeInTheDocument()
  await userEvent.click(avatar)

  expect(screen.getByText('Configuración inApp=true')).toBeInTheDocument()
})

test('switching to Semana shows the week\'s figures, including a negative Caja', async () => {
  stubFetch(PANEL)
  renderInicio()
  await screen.findByText('You sold today')

  screen.getByRole('button', { name: 'Week' }).click()

  expect(await screen.findByText('You sold this week')).toBeInTheDocument()
  expect(screen.getByText('28/09 – 04/10')).toBeInTheDocument()
  expect(screen.getByText('$ 42.000')).toBeInTheDocument()
  expect(screen.getByText('5 sales · average $ 8.400 · 28 g')).toBeInTheDocument()
  expect(screen.getByText('−$ 12.000')).toBeInTheDocument() // cash is negative
})

/** The names of the figure groups on screen, in document order, from the closed list of
 * figure labels. */
function figureNames(): string[] {
  const labels = [
    'You gave away',
    'Cost of goods sold',
    'Stock shortfall',
    'Marketing',
    'Own use',
    'Expenses',
    'Flower purchases',
    'Profit',
    'Cash',
  ]
  return screen
    .getAllByRole('group')
    .map((node) => node.getAttribute('aria-labelledby'))
    .map((id) => (id === null ? '' : (document.getElementById(id)?.textContent ?? '')))
    .filter((name) => labels.includes(name))
}

/** A figure's pending note: it lives inside the figure's own group. `null` when that
 * group has none. */
function noteIn(label: string): string | null {
  const note = within(screen.getByRole('group', { name: label })).queryByText('includes pending cost')
  return note === null ? null : note.textContent
}

test('Semana: Ganancia\'s note and the Stock shortfall row (with its own note) show; Cost of goods sold\'s doesn\'t', async () => {
  stubFetch(PANEL)
  renderInicio()
  await screen.findByText('You sold today')
  screen.getByRole('button', { name: 'Week' }).click()
  await screen.findByText('You sold this week')

  const ganancia = screen.getByRole('group', { name: 'Profit' })
  expect(within(ganancia).getByText('includes pending cost')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Cash' })).queryByText('includes pending cost')).toBeNull()

  // `pending_cost` is false on the week fixture: the Costo row stays unmarked even
  // though Ganancia's own flag (`profit_pending`) is true — each note reads exactly
  // one flag, never a combination.
  expect(noteIn('Cost of goods sold')).toBeNull()

  const faltante = screen.getByRole('group', { name: 'Stock shortfall' })
  expect(within(faltante).getByText('$ 3.000')).toBeInTheDocument()
  expect(noteIn('Stock shortfall')).toBe('includes pending cost')
})

test('Semana: Stock shortfall shows with no note of its own when its cost isn\'t pending', async () => {
  // A dedicated override: the shared fixture's week always carries a pending
  // shortfall, so nothing else proves the row renders without `pie` when
  // `shortfall.pending` is false.
  const costedShortfall: PanelAnswer = {
    ...PANEL,
    periods: {
      ...PANEL.periods,
      week: { ...PANEL.periods.week, shortfall: { amount: 3000, pending: false } },
    },
  }
  stubFetch(costedShortfall)
  renderInicio()
  await screen.findByText('You sold today')
  screen.getByRole('button', { name: 'Week' }).click()
  await screen.findByText('You sold this week')

  const faltante = screen.getByRole('group', { name: 'Stock shortfall' })
  expect(within(faltante).getByText('$ 3.000')).toBeInTheDocument()
  expect(noteIn('Stock shortfall')).toBeNull()
})

test('Semana: Marketing and Own use follow Stock shortfall and come before Gastos, each with its own note flag', async () => {
  stubFetch(PANEL)
  renderInicio()
  await screen.findByText('You sold today')
  screen.getByRole('button', { name: 'Week' }).click()
  await screen.findByText('You sold this week')

  expect(figureNames().slice(0, 6)).toEqual([
    'You gave away',
    'Cost of goods sold',
    'Stock shortfall',
    'Marketing',
    'Own use',
    'Expenses',
  ])
  const marketing = screen.getByRole('group', { name: 'Marketing' })
  expect(within(marketing).getByText('$ 2.000')).toBeInTheDocument()
  expect(noteIn('Marketing')).toBe('includes pending cost')
  const consumo = screen.getByRole('group', { name: 'Own use' })
  expect(within(consumo).getByText('$ 1.000')).toBeInTheDocument()
  expect(noteIn('Own use')).toBeNull()
})

test('Hoy and a period with no withdrawal show neither Marketing nor Own use', async () => {
  // Today carries a withdrawal of each reason, as it does right after the form's
  // default date is saved: Hoy still hides both lines.
  const withdrawnToday: PanelAnswer = {
    ...PANEL,
    periods: {
      ...PANEL.periods,
      today: {
        ...PANEL.periods.today,
        withdrawals: [{ reason_id: 1, name: 'Marketing', amount: 2000, pending: false, pending_quantity: 0 }, { reason_id: 2, name: 'Own use', amount: 1000, pending: false, pending_quantity: 0 }],
      },
      month: { ...PANEL.periods.month, withdrawals: [] },
    },
  }
  stubFetch(withdrawnToday)
  renderInicio()
  await screen.findByText('You sold today')
  expect(screen.queryByText('Marketing')).not.toBeInTheDocument()
  expect(screen.queryByText('Own use')).not.toBeInTheDocument()

  screen.getByRole('button', { name: 'Month' }).click()
  await screen.findByText('You sold this month')
  expect(screen.queryByText('Marketing')).not.toBeInTheDocument()
  expect(screen.queryByText('Own use')).not.toBeInTheDocument()
})

test('Mes: Cost of goods sold\'s note and Ganancia\'s note show; there is no Stock shortfall row', async () => {
  stubFetch(PANEL)
  renderInicio()
  await screen.findByText('You sold today')
  screen.getByRole('button', { name: 'Month' }).click()
  await screen.findByText('You sold this month')

  const ganancia = screen.getByRole('group', { name: 'Profit' })
  expect(within(ganancia).getByText('includes pending cost')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Cash' })).queryByText('includes pending cost')).toBeNull()
  expect(noteIn('Cost of goods sold')).toBe('includes pending cost')
  expect(screen.queryByText('Stock shortfall')).not.toBeInTheDocument()
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
        quantity_sold: 0,
        quantity_gifted: 0,
        cost_of_goods: 0,
        pending_cost: false,
        shortfall: null,
        withdrawals: [],
        expenses: 5000,
        purchases: 0,
        profit: -5000,
        profit_pending: false,
        cash: -5000,
      },
    },
  }
  stubFetch(noSalesThisMonth)
  renderInicio()
  await screen.findByText('You sold today')

  screen.getByRole('button', { name: 'Month' }).click()

  expect(await screen.findByText('You sold this month')).toBeInTheDocument()
  expect(screen.getByText('01/10 – 31/10')).toBeInTheDocument()
  expect(screen.getByText('0 sales · 0 g')).toBeInTheDocument()
  expect(screen.queryByText(/promedio/)).not.toBeInTheDocument()
  expect(screen.getAllByText('−$ 5.000')).toHaveLength(2) // profit and cash
  expect(screen.getByRole('group', { name: 'Profit' })).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Cash' })).toBeInTheDocument()
})

test('Owed to you: total, count, oldest date, and the teaser opens a customer card', async () => {
  stubFetch(PANEL)
  const { container } = renderInicio()

  expect(await screen.findByText('$ 37.000')).toBeInTheDocument()
  expect(screen.getByText('4 sales owing')).toBeInTheDocument()
  expect(container.querySelector('.bloque-deben__desde')).toHaveTextContent('since 14/09')
  const row = screen.getByText('Ana Pérez').closest('a')
  expect(row).not.toBeNull()
  expect(row).toHaveTextContent(/\$ [\d.]+ · since \d\d\/\d\d/)
  row?.click()
  expect(await screen.findByText('ficha de cliente')).toBeInTheDocument()
})

test('the teaser\'s "Collect from X" opens Record payment for that customer, from inside the app', async () => {
  stubFetch(PANEL)
  renderInicio()
  await screen.findByText('$ 37.000')

  screen.getByRole('link', { name: 'Collect from Ana Pérez' }).click()

  expect(await screen.findByText('cobro de 1')).toBeInTheDocument()
  expect(screen.getByText('desde la app')).toBeInTheDocument()
})

test('"Collect" carries the cobro icon, hidden from assistive technology, and keeps its name', async () => {
  stubFetch(PANEL)
  renderInicio()
  await screen.findByText('$ 37.000')

  const link = screen.getByRole('link', { name: 'Collect from Ana Pérez' })
  expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(link).toHaveTextContent('Collect')
})

test('tapping "Owed to you" opens Clientes, where the debtors section is', async () => {
  stubFetch(PANEL)
  renderInicio()
  await screen.findByText('$ 37.000')

  screen.getByRole('link', { name: 'Owed to you' }).click()

  expect(await screen.findByText('pantalla clientes')).toBeInTheDocument()
})

test('"Nobody owes you" with nothing to tap when nobody owes', async () => {
  const empty: PanelAnswer = {
    ...PANEL,
    debts: { total_owed: 0, sales_owing_count: 0, oldest: null, teaser: [] },
  }
  stubFetch(empty)
  renderInicio()

  expect(await screen.findByText(NOBODY_OWES)).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Owed to you' })).not.toBeInTheDocument()
})

test('stock rows: name, grams, status and days left, in the API\'s own order, with no total', async () => {
  stubFetch(PANEL)
  renderInicio()

  expect(await screen.findByText('Criolla')).toBeInTheDocument()
  expect(screen.getByText('18 g')).toBeInTheDocument()
  expect(screen.getByText('6 days')).toBeInTheDocument()
  expect(screen.queryByText(/en total/)).not.toBeInTheDocument()
})

test('a remount with a different answer never shows the first answer\'s figures', async () => {
  const client = new QueryClient()
  stubFetch(PANEL)
  const first = renderInicio(client)
  await screen.findByText('You sold today')
  expect(within(first.container.querySelector<HTMLElement>('.panel-ventas')!).getByText('$ 15.000')).toBeInTheDocument()
  first.unmount()
  // `gcTime: 0` schedules the cache entry's removal for the next tick (TanStack's own
  // behaviour), the same gap a real navigation away and back leaves: this is what the
  // seam actually promises — a remount never shows a resolved mount's stale cache.
  await waitFor(() => expect(client.getQueryCache().find({ queryKey: ['panel'] })).toBeUndefined())

  const other: PanelAnswer = {
    ...PANEL,
    periods: { ...PANEL.periods, today: { ...PANEL.periods.today, sales: 999, sales_count: 1 } },
  }
  stubFetch(other)
  const second = renderInicio(client)
  await screen.findByText('You sold today')

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

  expect(await screen.findByText(SIN_CONEXION_MENSAJE)).toBeInTheDocument()
  expect(screen.queryByText('You sold today')).not.toBeInTheDocument()
})

const OUT_OF_DATE = {
  status: { state: 'out_of_date', reason: 'telegram_unreachable', last_published_on: '2026-09-29' },
}

test('shows the fixed pinned-catalog notice while the pin is out of date, with the decorative attention icon', async () => {
  stubFetch(PANEL, OUT_OF_DATE)
  renderInicio()

  const notice = (await screen.findByText(PINNED_CATALOG_OUT_OF_DATE)).closest('a')!
  expect(notice).toHaveAttribute('href', CATALOG)
  expect(notice).toHaveClass('aviso-ambar')
  expect(notice).toHaveAttribute('role', 'status')
  expect(notice.querySelectorAll('svg')).toHaveLength(1)
  expect(notice.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expectIconAndTextRule(notice)
  expect(forbiddenCalls).toEqual([])
})

test('a fresh pin shows no notice above the figures', async () => {
  stubFetch(PANEL, { status: { state: 'up_to_date' } })
  const { container } = renderInicio()
  await screen.findByText('You sold today')

  expect(screen.queryByText(PINNED_CATALOG_OUT_OF_DATE)).not.toBeInTheDocument()
  expect(container.querySelector('.aviso-ambar')).toBeNull()
  expect(container.querySelector('.estado-vacio')).toBeNull()
})

// The owner took the first-use notices off Home (registro-unificado.md): whatever the setup state,
// Home is the panel and nothing else, and it asks neither /first-run nor /onboarding-progress.
const FIRST_USE_TEXTS = [
  'Go on to the setup',
  'To get started',
  'Connect the bot so the pinned catalog updates by itself',
  'Start with your products',
]

const SETUP_STATES: [string, Record<string, unknown>][] = [
  [
    'a business in Onboarding',
    {
      'first-run': { kind: 'onboarding', checklist: [], import_notice: false, nothing_qualifies: false },
      'onboarding-progress': { offered: true, over: false, count: 1, resume: 'stock', steps: [] },
    },
  ],
  [
    'a pre-Onboarding business',
    {
      'first-run': {
        kind: 'checklist',
        checklist: [
          { step: 'priced_variety', required: true, done: true },
          { step: 'stock_entry', required: true, done: false },
        ],
        import_notice: false,
        nothing_qualifies: true,
      },
      'onboarding-progress': { offered: false, over: false, count: 0, resume: null, steps: [] },
    },
  ],
  [
    'an imported business',
    {
      'first-run': { kind: 'none', checklist: [], import_notice: true, nothing_qualifies: false },
      'onboarding-progress': { offered: true, over: true, count: 6, resume: null, steps: [] },
    },
  ],
  [
    'a business with no price today',
    {
      'first-run': { kind: 'start_varieties', checklist: [], import_notice: false, nothing_qualifies: true },
      'onboarding-progress': { offered: false, over: false, count: 0, resume: null, steps: [] },
    },
  ],
]

for (const theme of ['claro', 'oscuro'] as const) {
  test.each(SETUP_STATES)(`%s sees the panel and no first-use notice, and Home asks for neither read (${theme})`, async (_state, shown) => {
    chooseTheme(theme)
    stubFetch(PANEL, { status: null }, shown)
    const { container } = renderInicio()

    expect(await screen.findByText('You sold today')).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 20))
    for (const text of FIRST_USE_TEXTS) expect(screen.queryByText(text)).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'To get started' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dismiss notice' })).not.toBeInTheDocument()
    expect(container.querySelector('.estado-vacio')).toBeNull()
    expect(forbiddenCalls).toEqual([])
  })
}

test('a business in Onboarding still sees the out-of-date catalog notice, and nothing else above the figures', async () => {
  stubFetch(PANEL, OUT_OF_DATE, SETUP_STATES[0]![1])
  const { container } = renderInicio()

  expect(await screen.findByText(PINNED_CATALOG_OUT_OF_DATE)).toBeInTheDocument()
  await screen.findByText('You sold today')
  expect(container.querySelectorAll('.cuerpo > .aviso-ambar')).toHaveLength(1)
  expect(forbiddenCalls).toEqual([])
})

// Back from Record payment, Home takes focus back (PM option a): the hand-off a save left is
// applied once the panel has rendered, then taken. The page's scroll is ScrollSync's (ADR-0069).

test('after a save Home focuses that customer\'s "Collect" and leaves the scroll to ScrollSync', async () => {
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  setPaymentReturn(1)
  stubFetch(PANEL)
  renderInicio()

  const collect = await screen.findByRole('link', { name: 'Collect from Ana Pérez' })

  await waitFor(() => expect(collect).toHaveFocus())
  expect(scrollTo).not.toHaveBeenCalled()
})

test('when that customer\'s row is gone Home focuses the "Owed to you" heading', async () => {
  setPaymentReturn(99)
  stubFetch(PANEL)
  renderInicio()

  const heading = await screen.findByRole('link', { name: 'Owed to you' })

  await waitFor(() => expect(heading).toHaveFocus())
})

test('when nobody owes any more Home focuses the "Nobody owes you" line', async () => {
  setPaymentReturn(1)
  stubFetch({ ...PANEL, debts: { total_owed: 0, sales_owing_count: 0, oldest: null, teaser: [] } })
  renderInicio()

  const line = await screen.findByText(NOBODY_OWES)

  await waitFor(() => expect(line).toHaveFocus())
})

test('with no hand-off Home moves nothing and focuses nothing', async () => {
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  stubFetch(PANEL)
  renderInicio()

  const collect = await screen.findByRole('link', { name: 'Collect from Ana Pérez' })
  await new Promise((resolve) => setTimeout(resolve, 50))

  expect(collect).not.toHaveFocus()
  expect(scrollTo).not.toHaveBeenCalled()
})

test('a failed panel read hides the Loading marker even with a hand-off waiting', async () => {
  setPaymentReturn(1)
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/pinned-catalog/status')) return Promise.resolve(jsonResponse(200, { status: null }))
      if (url.includes('/panel')) return Promise.resolve(jsonResponse(500, { detail: 'boom' }))
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    }),
  )
  renderInicio()

  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument())
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Collect from Ana Pérez' })).not.toBeInTheDocument()
})

test('the phone header shows no business name, no apostrophe image and a hidden title', async () => {
  stubViewport('phone')
  stubFetch(PANEL)
  renderInicio()
  await screen.findByText('You sold today')

  expect(screen.queryByText('La Huerta')).not.toBeInTheDocument()
  expect(screen.queryByRole('img', { name: 'apostrophe' })).not.toBeInTheDocument()
  expect(screen.queryByAltText('apostrophe')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toHaveClass('visualmente-oculto')
})

test('the computer header keeps the business name above the visible title', async () => {
  stubViewport('computer')
  stubFetch(PANEL)
  renderInicio()
  await screen.findByText('You sold today')

  const title = screen.getByRole('heading', { level: 1, name: 'Home' })
  expect(title).not.toHaveClass('visualmente-oculto')
  const name = screen.getByText('La Huerta')
  expect(name.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.queryByRole('img', { name: 'apostrophe' })).not.toBeInTheDocument()
})
