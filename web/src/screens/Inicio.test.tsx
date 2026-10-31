/**
 * `Inicio`, now the panel (plan, "Front": built only from
 * `web/src/api/fixtures/panel.json`): every figure on every tab, negative
 * Ganancia/Caja, the pending-cost note's placement, no-average, "Nobody owes you",
 * navigation, stock rows, a no-year range across a year boundary, the
 * "Start with your varieties" banner above the figures, and a remount with a
 * different answer never showing the first answer's figures (`gcTime: 0`).
 */

import {
  CATALOG,
  CUSTOMER,
  CUSTOMER_PAYMENT,
  CUSTOMERS,
  HOME,
  ONBOARDING_DONE,
  ONBOARDING_STOCK,
  SETTINGS,
} from '../routes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation, useParams } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import panelFixture from '../api/fixtures/panel.json'
import type { FirstRunAnswer } from '../api/firstRun'
import type { PanelAnswer } from '../api/panel'
import type { Me } from '../api/me'
import { SHOWN_EN } from '../test/shownLanguage'
import { LIMITS } from '../copy/limits'
import { chooseTheme } from '../theme'
import { consumePaymentReturn, setPaymentReturn } from '../paymentReturn'
import { invalidateResource } from '../api/keys'
import { expectIconAndTextRule } from '../test/iconAndTextRule'
import type { OnboardingProgress } from '../api/onboarding'
import Inicio, { PINNED_CATALOG_OUT_OF_DATE } from './Inicio'
import { baselineText } from '../i18n/testing'
import { SIN_CONEXION_MENSAJE } from '../copy/common'

const EMPTY_TITLE = baselineText('inicio.ts:EMPTY_TITLE')
const EMPTY_DETAIL = baselineText('inicio.ts:EMPTY_DETAIL')
const NOBODY_OWES = baselineText('inicio.ts:NOBODY_OWES')

const PANEL: PanelAnswer = panelFixture as PanelAnswer

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function answer(overrides: Partial<FirstRunAnswer>): FirstRunAnswer {
  return { kind: 'none', checklist: [], import_notice: false, nothing_qualifies: false, ...overrides }
}

const NONE = answer({})
const START = answer({ kind: 'start_varieties' })
const ONBOARDING_ANSWER = answer({ kind: 'onboarding' })

const NOT_OFFERED: OnboardingProgress = {
  offered: false,
  over: false,
  count: 0,
  resume: null,
  steps: [],
  can_skip_rest: false,
  varieties_count: 0,
  stock_entries_count: 0,
  price_target: null,
  priced_target: null,
  stock_target: null,
}

/** Every call the stub saw on `/onboarding-progress`, as "METHOD url". */
const calls: string[] = []

/** Every call the stub saw on `/first-run`, as "METHOD url". */
const firstRunCalls: string[] = []

/** What a POST to `/onboarding-progress/advance` answers; the read's answer when null. */
let advanced: OnboardingProgress | null = null

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03', shown_language: SHOWN_EN }

function Provide() {
  return <Outlet context={ME} />
}

function SettingsLanding() {
  const location = useLocation()
  return <span>{`Configuración inApp=${String((location.state as { inApp?: boolean } | null)?.inApp)}`}</span>
}

function ListoLanding() {
  const location = useLocation()
  return <span>{`Listo listo=${String((location.state as { listo?: boolean } | null)?.listo)}`}</span>
}

function stubFetch(
  panel: PanelAnswer,
  firstRun: FirstRunAnswer = NONE,
  pinnedCatalogStatus: unknown = { status: null },
  onboarding: OnboardingProgress = NOT_OFFERED,
) {
  let currentFirstRun = firstRun
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/first-run/import-notice/dismissal')) {
        firstRunCalls.push(`${init?.method ?? 'GET'} ${url}`)
        currentFirstRun = { ...currentFirstRun, import_notice: false }
        return Promise.resolve(new Response(null, { status: 204 }))
      }
      if (url.includes('/first-run')) {
        firstRunCalls.push(`${init?.method ?? 'GET'} ${url}`)
        return Promise.resolve(jsonResponse(200, currentFirstRun))
      }
      if (url.includes('/onboarding-progress')) {
        calls.push(`${init?.method ?? 'GET'} ${url}`)
        return Promise.resolve(jsonResponse(200, init?.method === 'POST' ? (advanced ?? onboarding) : onboarding))
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
      <MemoryRouter initialEntries={[HOME]}>
        <Routes>
          <Route element={<Provide />}>
            <Route index element={<Inicio />} />
            <Route path={CUSTOMERS} element={<span>pantalla clientes</span>} />
            <Route path={CUSTOMER} element={<span>ficha de cliente</span>} />
            <Route path={CUSTOMER_PAYMENT} element={<PaymentStub />} />
            <Route path={SETTINGS} element={<SettingsLanding />} />
            <Route path={ONBOARDING_DONE} element={<ListoLanding />} />
            <Route path={ONBOARDING_STOCK} element={<span>paso stock</span>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  chooseTheme('claro')
  calls.length = 0
  firstRunCalls.length = 0
  advanced = null
  consumePaymentReturn()
})

test('the business avatar at the top opens Configuración in one tap, carrying inApp', async () => {
  stubFetch(PANEL)
  renderInicio()

  const avatar = await screen.findByRole('link', { name: 'Settings for La Huerta' })
  expect(avatar).toHaveAttribute('href', SETTINGS)
  expect(avatar).toHaveTextContent('LH')
  // The name stays above the title, as the design draws it.
  expect(screen.getByText('La Huerta')).toBeInTheDocument()
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
    'Promotion',
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

test('Semana: Promotion and Own use follow Stock shortfall and come before Gastos, each with its own note flag', async () => {
  stubFetch(PANEL)
  renderInicio()
  await screen.findByText('You sold today')
  screen.getByRole('button', { name: 'Week' }).click()
  await screen.findByText('You sold this week')

  expect(figureNames().slice(0, 6)).toEqual([
    'You gave away',
    'Cost of goods sold',
    'Stock shortfall',
    'Promotion',
    'Own use',
    'Expenses',
  ])
  const promocion = screen.getByRole('group', { name: 'Promotion' })
  expect(within(promocion).getByText('$ 2.000')).toBeInTheDocument()
  expect(noteIn('Promotion')).toBe('includes pending cost')
  const consumo = screen.getByRole('group', { name: 'Own use' })
  expect(within(consumo).getByText('$ 1.000')).toBeInTheDocument()
  expect(noteIn('Own use')).toBeNull()
})

test('Hoy and a period with no withdrawal show neither Promotion nor Own use', async () => {
  // Today carries a withdrawal of each reason, as it does right after the form's
  // default date is saved: Hoy still hides both lines.
  const withdrawnToday: PanelAnswer = {
    ...PANEL,
    periods: {
      ...PANEL.periods,
      today: {
        ...PANEL.periods.today,
        promotion: { amount: 2000, pending: false },
        own_use: { amount: 1000, pending: false },
      },
    },
  }
  stubFetch(withdrawnToday)
  renderInicio()
  await screen.findByText('You sold today')
  expect(screen.queryByText('Promotion')).not.toBeInTheDocument()
  expect(screen.queryByText('Own use')).not.toBeInTheDocument()

  screen.getByRole('button', { name: 'Month' }).click()
  await screen.findByText('You sold this month')
  expect(screen.queryByText('Promotion')).not.toBeInTheDocument()
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
        promotion: null,
        own_use: null,
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

test('the empty-state line the screen renders is the registered binding and fits its limit', async () => {
  stubFetch(PANEL, START)
  renderInicio()

  expect((await screen.findByText(EMPTY_DETAIL)).textContent?.length).toBeLessThanOrEqual(LIMITS.emptyLine)
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

for (const theme of ['claro', 'oscuro'] as const) {
  test(`"Start with your varieties" shows above the panel, which still shows its real figures (${theme})`, async () => {
    chooseTheme(theme)
    stubFetch(PANEL, START)
    const { container } = renderInicio()

    expect(await screen.findByText(EMPTY_TITLE)).toBeInTheDocument()
    expect(screen.getByText('You sold today')).toBeInTheDocument()
    expect(within(container.querySelector<HTMLElement>('.panel-ventas')!).getByText('$ 15.000')).toBeInTheDocument()

    // The banner sits above the panel, not in place of it.
    const titleIndex = Array.from(container.querySelectorAll('.cuerpo > *')).findIndex((el) =>
      el.textContent?.includes(EMPTY_TITLE),
    )
    const panelIndex = Array.from(container.querySelectorAll('.cuerpo > *')).findIndex((el) =>
      el.classList.contains('inicio__periodos'),
    )
    expect(titleIndex).toBeLessThan(panelIndex)
  })
}

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
      if (url.includes('/first-run')) return Promise.resolve(jsonResponse(200, NONE))
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    }),
  )
  renderInicio()

  expect(await screen.findByText(SIN_CONEXION_MENSAJE)).toBeInTheDocument()
  expect(screen.queryByText('You sold today')).not.toBeInTheDocument()
})

test('shows the fixed pinned-catalog notice while the pin is out of date', async () => {
  stubFetch(PANEL, NONE, {
    status: { state: 'out_of_date', reason: 'telegram_unreachable', last_published_on: '2026-09-29' },
  })
  renderInicio()

  const notice = await screen.findByText(PINNED_CATALOG_OUT_OF_DATE)
  expect(notice.closest('a')).toHaveAttribute('href', CATALOG)
})

test('the stale-catalog notice and the "Start with your varieties" state carry the decorative attention icon; a fresh pin has none', async () => {
  stubFetch(PANEL, START, {
    status: { state: 'out_of_date', reason: 'telegram_unreachable', last_published_on: '2026-09-29' },
  })
  const { unmount } = renderInicio()

  const notice = (await screen.findByText(PINNED_CATALOG_OUT_OF_DATE)).closest('a')!
  expect(notice).toHaveClass('aviso-ambar')
  expect(notice).toHaveAttribute('role', 'status')
  expect(notice.querySelectorAll('svg')).toHaveLength(1)
  expect(notice.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  const empty = screen.getByText(EMPTY_TITLE).closest('.estado-vacio')!
  expect(empty.querySelectorAll('svg')).toHaveLength(1)
  expect(empty.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(empty).toHaveTextContent(EMPTY_DETAIL)
  unmount()

  stubFetch(PANEL, NONE)
  const fresh = renderInicio()
  await screen.findByText('You sold today')
  expect(fresh.container.querySelector('.aviso-ambar')).toBeNull()
  expect(fresh.container.querySelector('.estado-vacio')).toBeNull()
})

const STEPS_AFTER_ONE: OnboardingProgress['steps'] = [
  { step: 'variety', state: 'done' },
  { step: 'stock', state: 'pending' },
  { step: 'header_footer', state: 'pending' },
  { step: 'bot', state: 'pending' },
  { step: 'partner', state: 'pending' },
  { step: 'categories', state: 'pending' },
]

const MID_ONBOARDING: OnboardingProgress = {
  ...NOT_OFFERED,
  offered: true,
  count: 1,
  resume: 'stock',
  steps: STEPS_AFTER_ONE,
  varieties_count: 1,
}

const FINISH: OnboardingProgress = {
  ...MID_ONBOARDING,
  count: 6,
  resume: 'finish',
  steps: STEPS_AFTER_ONE.map((item) => ({ ...item, state: 'done' as const })),
}

for (const theme of ['claro', 'oscuro'] as const) {
  test(`an Onboarding business sees the notice at the top with its count and what is missing, and never Start with your varieties (${theme})`, async () => {
    chooseTheme(theme)
    stubFetch(PANEL, ONBOARDING_ANSWER, { status: null }, MID_ONBOARDING)
    renderInicio()

    const notice = await screen.findByRole('link', { name: /Go on to the setup/ })
    expect(within(notice).getByText('1 of 6 steps')).toBeInTheDocument()
    expect(within(notice).getByText('Missing: initial stock')).toBeInTheDocument()
    expect(notice).toHaveAttribute('href', ONBOARDING_STOCK)
    await screen.findByText('You sold today')
    expect(screen.queryByText(EMPTY_TITLE)).not.toBeInTheDocument()
  })
}

test('with /first-run answering last, slot 1 stays empty: Arrancá never flashes for an Onboarding business', async () => {
  let release: (response: Response) => void = () => undefined
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/first-run'))
        return new Promise<Response>((resolve) => {
          release = resolve
        })
      if (url.includes('/onboarding-progress')) return Promise.resolve(jsonResponse(200, MID_ONBOARDING))
      if (url.includes('/pinned-catalog/status')) return Promise.resolve(jsonResponse(200, { status: null }))
      if (url.includes('/panel')) return Promise.resolve(jsonResponse(200, PANEL))
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    }),
  )
  renderInicio()
  await screen.findByText('You sold today')

  expect(screen.queryByText(EMPTY_TITLE)).not.toBeInTheDocument()
  expect(screen.queryByText('emptyStates:homeVarietiesTitle')).not.toBeInTheDocument()
  release(jsonResponse(200, ONBOARDING_ANSWER))
  expect(await screen.findByText('Go on to the setup')).toBeInTheDocument()
  expect(screen.queryByText(EMPTY_TITLE)).not.toBeInTheDocument()
})

test('a business never offered the Onboarding keeps Arrancá and sees no notice', async () => {
  stubFetch(PANEL, START)
  renderInicio()

  expect(await screen.findByText(EMPTY_TITLE)).toBeInTheDocument()
  expect(screen.queryByText('Go on to the setup')).not.toBeInTheDocument()
})

for (const theme of ['claro', 'oscuro'] as const) {
  test(`the finish notice reads 6 of 6 with no Missing line and sends advance only on a tap (${theme})`, async () => {
    chooseTheme(theme)
    stubFetch(PANEL, ONBOARDING_ANSWER, { status: null }, FINISH)
    renderInicio()

    const notice = await screen.findByRole('button', { name: /Go on to the setup/ })
    expect(within(notice).getByText('6 of 6 steps')).toBeInTheDocument()
    expect(screen.queryByText(/Missing:/)).not.toBeInTheDocument()
    await screen.findByText('You sold today')
    expect(calls).toEqual(['GET /onboarding-progress'])
  })
}

test('the Onboarding notice goes once the Onboarding is over', async () => {
  stubFetch(PANEL, NONE, { status: null }, { ...FINISH, over: true, resume: null })
  renderInicio()
  await screen.findByText('You sold today')

  expect(screen.queryByText('Go on to the setup')).not.toBeInTheDocument()
})

test('tapping the finish notice sends advance, and "Done" opens only from an answer with over: true', async () => {
  advanced = { ...FINISH, over: true, resume: null }
  stubFetch(PANEL, ONBOARDING_ANSWER, { status: null }, FINISH)
  renderInicio()

  await userEvent.click(await screen.findByRole('button', { name: /Go on to the setup/ }))

  expect(await screen.findByText('Listo listo=true')).toBeInTheDocument()
  expect(calls).toEqual(['GET /onboarding-progress', 'POST /onboarding-progress/advance'])
})

test('tapping the finish notice when advance answers over: false does not draw "Done"', async () => {
  advanced = { ...MID_ONBOARDING }
  stubFetch(PANEL, ONBOARDING_ANSWER, { status: null }, FINISH)
  renderInicio()

  await userEvent.click(await screen.findByRole('button', { name: /Go on to the setup/ }))

  expect(await screen.findByText('paso stock')).toBeInTheDocument()
  expect(screen.queryByText(/Listo listo/)).not.toBeInTheDocument()
})

for (const theme of ['claro', 'oscuro'] as const) {
  test(`the resume notice keeps its words and its card: boton-aviso, never a row, named by its visible text, with no icon of its own (${theme})`, async () => {
    chooseTheme(theme)
    stubFetch(PANEL, ONBOARDING_ANSWER, { status: null }, MID_ONBOARDING)
    renderInicio()

    const notice = await screen.findByRole('link', { name: /Go on to the setup/ })
    expect(notice).toHaveClass('boton-aviso')
    expect(notice).not.toHaveClass('boton--fila')
    expect(notice).not.toHaveAttribute('aria-label')
    expect(notice.textContent).toContain('Go on to the setup')
    expect(notice.textContent).toContain('1 of 6 steps')
    expect(notice.textContent).toContain('Missing: initial stock')
    // Only the title's decorative chevron: no attention icon, and it is hidden from the name.
    expect(notice.querySelectorAll('svg')).toHaveLength(1)
    expect(notice.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expectIconAndTextRule(notice)
  })
}

for (const theme of ['claro', 'oscuro'] as const) {
  test(`the finish notice is the same card as a button, named by its visible text (${theme})`, async () => {
    chooseTheme(theme)
    stubFetch(PANEL, ONBOARDING_ANSWER, { status: null }, FINISH)
    renderInicio()

    const notice = await screen.findByRole('button', { name: /Go on to the setup/ })
    expect(notice).toHaveClass('boton-aviso')
    expect(notice).not.toHaveClass('boton--fila')
    expect(notice).not.toHaveAttribute('aria-label')
    expect(notice.querySelectorAll('svg')).toHaveLength(1)
    expectIconAndTextRule(notice)
  })
}

const CHECKLIST = answer({
  kind: 'checklist',
  checklist: [
    { step: 'priced_variety', required: true, done: true },
    { step: 'stock_entry', required: true, done: false },
    { step: 'published', required: false, done: false },
    { step: 'second_user', required: false, done: true },
  ],
  nothing_qualifies: true,
})

test.each([
  ['none', answer({ kind: 'none', checklist: [] })],
  ['onboarding', answer({ kind: 'onboarding', checklist: [] })],
])('a "%s" answer with an empty checklist draws no "To get started" list', async (_kind, firstRun) => {
  stubFetch(PANEL, firstRun)
  renderInicio()

  await screen.findByText('You sold today')
  expect(screen.queryByRole('list', { name: 'To get started' })).not.toBeInTheDocument()
  expect(screen.queryByText('To get started')).not.toBeInTheDocument()
})

test('the kind decides: an "onboarding" answer carrying checklist items still draws no checklist', async () => {
  stubFetch(PANEL, answer({ kind: 'onboarding', checklist: CHECKLIST.checklist }))
  renderInicio()

  await screen.findByText('You sold today')
  expect(screen.queryByRole('list', { name: 'To get started' })).not.toBeInTheDocument()
  expect(screen.queryByText('To get started')).not.toBeInTheDocument()
})

const IMPORT_NOTICE_TEXT = 'Connect the bot so the pinned catalog updates by itself'

for (const theme of ['claro', 'oscuro'] as const) {
  test(`the checklist draws four steps, "Done" only on the met ones, and tells required from optional in words (${theme})`, async () => {
    chooseTheme(theme)
    stubFetch(PANEL, CHECKLIST)
    renderInicio()

    const list = await screen.findByRole('list', { name: 'To get started' })
    const steps = within(list).getAllByRole('listitem')
    expect(steps.map((step) => step.textContent)).toEqual([
      'Add a variety with its priceRequiredDone',
      'Add what you have todayRequired',
      'Connect the botOptional',
      'Invite a partnerOptionalDone',
    ])
    expect(within(list).getAllByText('Done')).toHaveLength(2)
    // The attention icon is for the notices: the checklist carries none.
    expect(list.closest('section')?.querySelector('.aviso-ambar__icono')).toBeNull()
    expect(screen.queryByText(EMPTY_TITLE)).not.toBeInTheDocument()
    expectIconAndTextRule(list)
  })
}

test('the checklist is a box of its own, not the attention state', async () => {
  stubFetch(PANEL, CHECKLIST)
  const { container } = renderInicio()

  const box = (await screen.findByRole('list', { name: 'To get started' })).closest('section')!
  expect(box).not.toBeNull()
  expect(container.querySelectorAll('.aviso-ambar__icono')).toHaveLength(0)
})

test('slot 1, then the out-of-date pin, then the import notice, then the figures, in that order', async () => {
  stubFetch(PANEL, answer({ ...CHECKLIST, import_notice: true }), { status: { state: 'out_of_date' } })
  const { container } = renderInicio()
  await screen.findByText('You sold today')

  const nodes = [
    screen.getByRole('list', { name: 'To get started' }).closest('section')!,
    screen.getByText(PINNED_CATALOG_OUT_OF_DATE),
    screen.getByText(IMPORT_NOTICE_TEXT),
    container.querySelector('.panel-ventas')!,
  ]
  for (const [index, node] of nodes.entries()) {
    const next = nodes[index + 1]
    if (next !== undefined) expect(node.compareDocumentPosition(next)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  }
})

test('the same notices sit above Semana and Mes', async () => {
  stubFetch(PANEL, answer({ ...CHECKLIST, import_notice: true }))
  renderInicio()
  await screen.findByText('You sold today')

  screen.getByRole('button', { name: 'Month' }).click()

  await screen.findByText('You sold this month')
  expect(screen.getByRole('list', { name: 'To get started' })).toBeInTheDocument()
  expect(screen.getByText(IMPORT_NOTICE_TEXT)).toBeInTheDocument()
})

for (const theme of ['claro', 'oscuro'] as const) {
  for (const kind of ['none', 'start_varieties'] as const) {
    test(`the import notice shows beside a "${kind}" slot 1, with the attention icon and a dismiss control (${theme})`, async () => {
      chooseTheme(theme)
      stubFetch(PANEL, answer({ kind, import_notice: true }))
      renderInicio()

      const notice = (await screen.findByText(IMPORT_NOTICE_TEXT)).closest('.aviso-ambar')!
      expect(notice.querySelector('.aviso-ambar__icono svg')).toHaveAttribute('aria-hidden', 'true')
      expect(within(notice as HTMLElement).getByRole('button', { name: 'Dismiss notice' })).toBeInTheDocument()
      expectIconAndTextRule(notice as HTMLElement)
    })
  }
}

test('dismissing the import notice sends the dismissal, asks /first-run again and the notice goes', async () => {
  stubFetch(PANEL, answer({ import_notice: true }))
  renderInicio()
  await screen.findByText(IMPORT_NOTICE_TEXT)

  await userEvent.click(screen.getByRole('button', { name: 'Dismiss notice' }))

  await waitFor(() => expect(screen.queryByText(IMPORT_NOTICE_TEXT)).not.toBeInTheDocument())
  expect(firstRunCalls).toContain('POST /first-run/import-notice/dismissal')
  expect(firstRunCalls.filter((call) => call === 'GET /first-run')).toHaveLength(2)
})

test('a failed dismissal keeps the notice and says so', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/first-run/import-notice/dismissal') && init?.method === 'POST')
        return Promise.reject(new Error('network error'))
      if (url.includes('/first-run')) return Promise.resolve(jsonResponse(200, answer({ import_notice: true })))
      if (url.includes('/onboarding-progress')) return Promise.resolve(jsonResponse(200, NOT_OFFERED))
      if (url.includes('/pinned-catalog/status')) return Promise.resolve(jsonResponse(200, { status: null }))
      if (url.includes('/panel')) return Promise.resolve(jsonResponse(200, PANEL))
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    }),
  )
  renderInicio()
  await screen.findByText(IMPORT_NOTICE_TEXT)

  await userEvent.click(screen.getByRole('button', { name: 'Dismiss notice' }))

  expect(await screen.findByText(SIN_CONEXION_MENSAJE)).toBeInTheDocument()
  expect(screen.getByText(IMPORT_NOTICE_TEXT)).toBeInTheDocument()
})

test('a failed /first-run draws no slot 1 and no error: the figures still show', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/first-run')) return Promise.reject(new Error('network error'))
      if (url.includes('/onboarding-progress')) return Promise.resolve(jsonResponse(200, NOT_OFFERED))
      if (url.includes('/pinned-catalog/status')) return Promise.resolve(jsonResponse(200, { status: null }))
      if (url.includes('/panel')) return Promise.resolve(jsonResponse(200, PANEL))
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    }),
  )
  renderInicio()

  expect(await screen.findByText('You sold today')).toBeInTheDocument()
  expect(screen.queryByText(EMPTY_TITLE)).not.toBeInTheDocument()
  expect(screen.queryByRole('list', { name: 'To get started' })).not.toBeInTheDocument()
  expect(screen.queryByText(SIN_CONEXION_MENSAJE)).not.toBeInTheDocument()
})

test('a stock write elsewhere makes the next read of /first-run, and the checklist goes', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  stubFetch(PANEL, CHECKLIST)
  renderInicio(client)
  await screen.findByRole('list', { name: 'To get started' })
  stubFetch(PANEL, NONE)

  invalidateResource(client, 'stock')

  await waitFor(() => expect(screen.queryByRole('list', { name: 'To get started' })).not.toBeInTheDocument())
})

// Back from Record payment, Home takes focus back (PM option a): the hand-off a save left is
// applied once the panel has rendered, then taken. The page's scroll is ScrollSync's (ADR-0068).

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

test('Home takes focus back only after the notice above the panel has answered', async () => {
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  setPaymentReturn(1)
  let answerFirstRun: (response: Response) => void = () => undefined
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/first-run')) return new Promise<Response>((resolve) => (answerFirstRun = resolve))
      if (url.includes('/onboarding-progress')) return Promise.resolve(jsonResponse(200, NOT_OFFERED))
      if (url.includes('/pinned-catalog/status')) return Promise.resolve(jsonResponse(200, { status: null }))
      if (url.includes('/panel')) return Promise.resolve(jsonResponse(200, PANEL))
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    }),
  )
  renderInicio()

  const collect = await screen.findByRole('link', { name: 'Collect from Ana Pérez' })
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(scrollTo).not.toHaveBeenCalled()
  expect(collect).not.toHaveFocus()

  answerFirstRun(jsonResponse(200, CHECKLIST))

  await waitFor(() => expect(collect).toHaveFocus())
})

// The scroll owner waits for the Loading marker before it puts Home back at its offset (ADR-0068):
// after a save Home shows it until the hand-off has its place; a first visit never does.

function holdFirstRun(): (response: Response) => void {
  let answerFirstRun: (response: Response) => void = () => undefined
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/first-run')) return new Promise<Response>((resolve) => (answerFirstRun = resolve))
      if (url.includes('/onboarding-progress')) return Promise.resolve(jsonResponse(200, NOT_OFFERED))
      if (url.includes('/pinned-catalog/status')) return Promise.resolve(jsonResponse(200, { status: null }))
      if (url.includes('/panel')) return Promise.resolve(jsonResponse(200, PANEL))
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    }),
  )
  return (response) => answerFirstRun(response)
}

test('after a save Home shows the Loading marker until the notices above the panel have answered', async () => {
  setPaymentReturn(1)
  const answerFirstRun = holdFirstRun()
  renderInicio()

  const collect = await screen.findByRole('link', { name: 'Collect from Ana Pérez' })
  expect(screen.getByRole('progressbar')).toBeInTheDocument()

  answerFirstRun(jsonResponse(200, NONE))

  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument())
  expect(collect).toBeInTheDocument()
})

test('a first visit to Home shows no Loading marker while the notices answer', async () => {
  holdFirstRun()
  renderInicio()

  await screen.findByRole('link', { name: 'Collect from Ana Pérez' })

  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
})
