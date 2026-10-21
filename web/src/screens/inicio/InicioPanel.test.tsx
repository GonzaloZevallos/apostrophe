/**
 * The panel's body through the `Inicio` screen (Testing Library, `fetch` faked): what Hoy
 * draws and what it leaves for Semana and Mes, What you have left's link on a low variety,
 * and "Collect from <name>" through the real Record payment and back, in both themes
 * (`data-tema`, set the way the Configuración switch does).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, RouterProvider, createMemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import panelFixture from '../../api/fixtures/panel.json'
import paymentFixture from '../../api/fixtures/payment.json'
import type { Me } from '../../api/me'
import type { PanelAnswer, PanelDebts } from '../../api/panel'
import FlashProvider from '../../flash/FlashProvider'
import { CUSTOMER, CUSTOMER_PAYMENT, CUSTOMERS, HOME, VARIETY, pathTo } from '../../routes'
import { chooseTheme } from '../../theme'
import CobroRoute from '../clientes/CobroRoute'
import Inicio from '../Inicio'
import { stubFetchWithSettings } from '../stubFetchWithSettings'

const PANEL: PanelAnswer = panelFixture as PanelAnswer
const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03' }

const RESULT_LABELS = [
  'Profit',
  'Cash',
  'Cost of goods sold',
  'Stock shortfall',
  'Promotion',
  'Own use',
  'Expenses',
  'You gave away',
  'Flower purchases',
]

/** The names of the figure groups on screen, in document order, from the closed list of
 * figure labels (so the "Period" group never enters). */
function figureNames(): string[] {
  return screen
    .getAllByRole('group')
    .map((node) => node.getAttribute('aria-labelledby'))
    .map((id) => (id === null ? '' : (document.getElementById(id)?.textContent ?? '')))
    .filter((name) => RESULT_LABELS.includes(name))
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function debts(rows: Array<[number, string, number]>, total: number, count: number): PanelDebts {
  return {
    total_owed: total,
    sales_owing_count: count,
    oldest: rows.length === 0 ? null : '2026-09-14',
    teaser: rows.map(([customer_id, name, balance]) => ({
      customer_id,
      name,
      balance,
      owing_since: '2026-09-14',
    })),
  }
}

const OWING_CUSTOMER = {
  id: 1,
  name: 'Ana Pérez',
  phone: '+5491122334455',
  vip: false,
  balance: 11000,
  owing_since: '2026-09-14',
  standing: 'owes',
}

const OWING_ACCOUNT = {
  balance: 11000,
  owing_since: '2026-09-14',
  standing: 'owes',
  rows: [
    {
      kind: 'sale',
      date: '2026-09-14',
      running_balance: 11000,
      standing: 'owes',
      sale: { id: 10, total: 11000, how_paid: 'owing' },
    },
  ],
}

/** What `GET /panel` answers now; a test moves it to what the API would answer after a payment. */
let panelNow: PanelAnswer = PANEL
/** What the next `POST /customers/1/payments` answers, and the panel it leaves behind. */
let paymentAnswer: unknown = paymentFixture
let panelAfterPayment: PanelAnswer = PANEL
let api: ReturnType<typeof stubFetchWithSettings>

function CustomerStub() {
  return <span>ficha de cliente</span>
}

function VarietyStub() {
  const location = useLocation()
  return <span>{`variedad ${location.pathname}`}</span>
}

function Provide() {
  return (
    <FlashProvider>
      <Outlet context={ME} />
    </FlashProvider>
  )
}

function renderInicio() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      {
        element: <Provide />,
        children: [
          { path: HOME, element: <Inicio /> },
          { path: CUSTOMERS, element: <span>pantalla clientes</span> },
          { path: CUSTOMER, element: <CustomerStub /> },
          { path: CUSTOMER_PAYMENT, element: <CobroRoute /> },
          { path: VARIETY, element: <VarietyStub /> },
        ],
      },
    ],
    { initialEntries: [HOME] },
  )
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router, ...view }
}

beforeEach(() => {
  panelNow = PANEL
  paymentAnswer = paymentFixture
  panelAfterPayment = PANEL
  api = stubFetchWithSettings()
  api.mockImplementation((input, init) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    if (url === '/panel') return Promise.resolve(jsonResponse(200, panelNow))
    if (url === '/varieties') return Promise.resolve(jsonResponse(200, [{ current_price: { id: 1 } }]))
    if (url === '/pinned-catalog/status') return Promise.resolve(jsonResponse(200, { status: null }))
    if (url === '/onboarding-progress') return Promise.resolve(jsonResponse(200, { offered: false }))
    if (url === '/customers/1') return Promise.resolve(jsonResponse(200, OWING_CUSTOMER))
    if (url === '/customers/1/account') return Promise.resolve(jsonResponse(200, OWING_ACCOUNT))
    if (url === '/customers/1/payments/preview') return Promise.resolve(jsonResponse(200, paymentAnswer))
    if (method === 'POST' && url === '/customers/1/payments') {
      panelNow = panelAfterPayment
      return Promise.resolve(jsonResponse(201, paymentAnswer))
    }
    return Promise.reject(new Error(`unexpected fetch: ${method} ${url}`))
  })
})

afterEach(() => {
  chooseTheme('claro')
  window.localStorage.clear()
  vi.unstubAllGlobals()
})

for (const theme of ['claro', 'oscuro'] as const) {
  test(`Hoy draws sold today, Owed to you and What you have left in that order, and no result figure (${theme})`, async () => {
    chooseTheme(theme)
    const { container } = renderInicio()
    await screen.findByText('You sold today')

    const order = ['.panel-ventas', '.bloque-deben', '.lista-stock'].map((selector) => {
      const node = container.querySelector(selector)
      expect(node).not.toBeNull()
      return node as Element
    })
    expect(order[0]?.compareDocumentPosition(order[1] as Element)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(order[1]?.compareDocumentPosition(order[2] as Element)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(screen.getByText('2 sales · average $ 7.500 · 10 g')).toBeInTheDocument()
    for (const label of RESULT_LABELS) expect(screen.queryByText(label)).not.toBeInTheDocument()
    for (const label of RESULT_LABELS) expect(screen.queryByRole('group', { name: label })).toBeNull()
    expect(container.querySelector('.panel-cifras')).toBeNull()
    expect(container.querySelector('.panel-lista')).toBeNull()
    expect(container.querySelector('.panel-resultados')).toBeNull()
    expect(container.querySelector('.panel-periodo--con-cifras')).toBeNull()
    expect(screen.queryByText('includes pending cost')).not.toBeInTheDocument()
  })
}

test('Hoy shows the average only when there were sales, and real zeros otherwise', async () => {
  panelNow = {
    ...PANEL,
    periods: {
      ...PANEL.periods,
      today: { ...PANEL.periods.today, sales: 0, sales_count: 0, average_sale: null, grams_sold: 0 },
    },
  }
  renderInicio()
  await screen.findByText('You sold today')

  expect(screen.getByText('0 sales · 0 g')).toBeInTheDocument()
  expect(screen.queryByText(/promedio/)).not.toBeInTheDocument()
})

test('Hoy hides the withdrawal lines too, even when today carries one', async () => {
  panelNow = {
    ...PANEL,
    periods: {
      ...PANEL.periods,
      today: {
        ...PANEL.periods.today,
        shortfall: { amount: 3000, pending: false },
        promotion: { amount: 2000, pending: false },
        own_use: { amount: 1000, pending: false },
      },
    },
  }
  renderInicio()
  await screen.findByText('You sold today')

  for (const label of RESULT_LABELS) expect(screen.queryByText(label)).not.toBeInTheDocument()
})

test('Semana and Mes keep every result figure, Promotion and Own use right after Stock shortfall', async () => {
  renderInicio()
  await screen.findByText('You sold today')

  await userEvent.click(screen.getByRole('button', { name: 'Week' }))
  await screen.findByText('You sold this week')
  for (const label of RESULT_LABELS) expect(screen.getByRole('group', { name: label })).toBeInTheDocument()
  // The seven list figures, then Ganancia and Caja closing them, as the design and
  // results.md draw them.
  expect(figureNames()).toEqual([
    'You gave away',
    'Cost of goods sold',
    'Stock shortfall',
    'Promotion',
    'Own use',
    'Expenses',
    'Flower purchases',
    'Profit',
    'Cash',
  ])

  await userEvent.click(screen.getByRole('button', { name: 'Month' }))
  await screen.findByText('You sold this month')
  for (const label of ['Profit', 'Cash', 'Cost of goods sold', 'Expenses', 'You gave away', 'Flower purchases']) {
    expect(screen.getByRole('group', { name: label })).toBeInTheDocument()
  }
  // The same Owed to you block and What you have left sit under every tab.
  expect(screen.getByText('What you have left')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Collect from Ana Pérez' })).toBeInTheDocument()
})

test('the sold headline and the result figures share one group, and the two blocks another, in the phone order', async () => {
  // `InicioCompu.dc.html`: headline beside the figures, then Owed to you beside What you have left.
  // The groups are what the computer layout lays out; found by what they hold, and the
  // order stays the phone's. No test id: the phone check names its offenders by the nearest one.
  renderInicio()
  await screen.findByText('You sold today')
  await userEvent.click(screen.getByRole('button', { name: 'Week' }))
  const headline = await screen.findByText('You sold this week')

  const figures = headline.parentElement?.parentElement as HTMLElement
  expect(figures).toContainElement(screen.getByText('You gave away'))
  expect(figures).toContainElement(screen.getByText('Profit'))
  expect(figures).not.toContainElement(screen.getByText('Owed to you'))

  const debts = screen.getByText('Owed to you')
  const left = screen.getByText('What you have left')
  let blocks = debts.parentElement as HTMLElement
  while (!blocks.contains(left)) blocks = blocks.parentElement as HTMLElement
  expect(blocks).not.toContainElement(headline)
  expect(blocks.parentElement).toBe(figures.parentElement)
  expect(debts.compareDocumentPosition(left)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  expect(figures.compareDocumentPosition(blocks)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)

  // Hoy has no result figures: its group holds the headline alone.
  await userEvent.click(screen.getByRole('button', { name: 'Today' }))
  const today = (await screen.findByText('You sold today')).parentElement?.parentElement as HTMLElement
  expect(today).not.toContainElement(screen.getByText('Owed to you'))
  expect(within(today).queryByText('You gave away')).toBeNull()
})

test('a low variety links to its page; every other row is plain text, and order stays by name', async () => {
  panelNow = {
    ...PANEL,
    stock: [
      { ...PANEL.stock[0]!, variety_id: 1, name: 'Criolla', status: 'low' },
      { ...PANEL.stock[0]!, variety_id: 2, name: 'Mora', status: 'ok', days_left: 40 },
      { ...PANEL.stock[0]!, variety_id: 3, name: 'Zinnia', status: 'sold_out', days_left: null },
    ],
  }
  const { container } = renderInicio()
  await screen.findByText('Criolla')

  const link = screen.getByText('Criolla').closest('a')
  expect(link).toHaveAttribute('href', pathTo(VARIETY, { id: 1 }))
  expect(screen.getByText('Mora').closest('a')).toBeNull()
  expect(screen.getByText('Zinnia').closest('a')).toBeNull()
  expect(Array.from(container.querySelectorAll('.fila-stock__nombre')).map((n) => n.textContent)).toEqual([
    'Criolla',
    'Mora',
    'Zinnia',
  ])

  await userEvent.click(link as HTMLElement)
  expect(await screen.findByText(`variedad ${pathTo(VARIETY, { id: 1 })}`)).toBeInTheDocument()
})

test('every stock row says its state in a word as well as its mark, in both themes', async () => {
  panelNow = {
    ...PANEL,
    stock: [
      { ...PANEL.stock[0]!, variety_id: 1, name: 'Criolla', status: 'low' },
      { ...PANEL.stock[0]!, variety_id: 2, name: 'Mora', status: 'ok' },
      { ...PANEL.stock[0]!, variety_id: 3, name: 'Zinnia', status: 'sold_out' },
      { ...PANEL.stock[0]!, variety_id: 4, name: 'Nueva', status: 'no_entries' },
    ],
  }
  for (const theme of ['claro', 'oscuro'] as const) {
    chooseTheme(theme)
    const { container, unmount } = renderInicio()
    await screen.findByText('Criolla')
    const words = Array.from(container.querySelectorAll('.fila-stock')).map(
      (row) => row.querySelector('.marca-estado__palabra')?.textContent,
    )
    expect(words).toEqual(['low', 'ok', 'sold out', 'no entries'])
    for (const row of container.querySelectorAll('.marca-estado')) {
      expect(row.querySelector('.marca-estado__forma')).toHaveAttribute('aria-hidden', 'true')
    }
    unmount()
  }
})

test('"Nobody owes you" shows with nothing to tap when nobody owes', async () => {
  panelNow = { ...PANEL, debts: debts([], 0, 0) }
  renderInicio()

  expect(await screen.findByText('Nobody owes you')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Collect from/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Owed to you' })).not.toBeInTheDocument()
})

test('a debtor row names its Cobrar by the customer and keeps the rest of the row as the card link', async () => {
  const { router } = renderInicio()
  await screen.findByText('$ 37.000')

  const cobrar = screen.getByRole('link', { name: 'Collect from Ana Pérez' })
  expect(cobrar).toHaveAttribute('href', pathTo(CUSTOMER_PAYMENT, { id: 1 }))
  expect(cobrar.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByText('Ana Pérez').closest('a')).toHaveAttribute('href', pathTo(CUSTOMER, { id: 1 }))
  expect(screen.getByRole('link', { name: 'Owed to you' })).toHaveAttribute('href', CUSTOMERS)

  await userEvent.click(cobrar)
  expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(pathTo(CUSTOMER_PAYMENT, { id: 1 }))
})

async function payFromInicio(amount: string): Promise<void> {
  await userEvent.click(await screen.findByRole('link', { name: 'Collect from Ana Pérez' }))
  const sheet = (await screen.findByRole('button', { name: 'Save' })).closest('form')
  const inside = within(sheet as HTMLElement)
  await userEvent.clear(inside.getByLabelText('Amount'))
  await userEvent.type(inside.getByLabelText('Amount'), amount)
  await userEvent.click(inside.getByLabelText('Cash'))
  await userEvent.click(inside.getByRole('button', { name: 'Save' }))
}

const THREE_DEBTORS = debts(
  [
    [1, 'Ana Pérez', 15000],
    [2, 'Bea Gómez', 12000],
    [3, 'Cris Díaz', 9000],
  ],
  37000,
  4,
)

test('Record payment opened from Inicio: a partial payment returns in one move, the toast never names the customer, the row keeps its new balance', async () => {
  panelNow = { ...PANEL, debts: THREE_DEBTORS }
  panelAfterPayment = {
    ...PANEL,
    debts: debts(
      [
        [1, 'Ana Pérez', 6000],
        [2, 'Bea Gómez', 12000],
        [3, 'Cris Díaz', 9000],
      ],
      27000,
      4,
    ),
  }
  const { router } = renderInicio()
  await payFromInicio('5000')

  expect(await screen.findByText('Payment saved · still owing $ 6.000')).toBeInTheDocument()
  expect(screen.getByText('Payment saved · still owing $ 6.000').textContent).not.toMatch(/Ana/)
  expect(router.state.location.pathname).toBe(HOME)
  expect(router.state.historyAction).toBe('POP')
  expect(await screen.findByText('$ 27.000')).toBeInTheDocument()
  const row = screen.getByText('Ana Pérez').closest('.bloque-deben__fila') as HTMLElement
  expect(within(row).getByText('$ 6.000')).toBeInTheDocument()
})

test('Record payment opened from Inicio: a full payment says plain "Payment saved", the row leaves and the teaser refills to 3', async () => {
  paymentAnswer = {
    ...paymentFixture,
    after: { balance: 0, owing_since: null, standing: 'settled' },
  }
  panelNow = { ...PANEL, debts: THREE_DEBTORS }
  panelAfterPayment = {
    ...PANEL,
    debts: debts(
      [
        [2, 'Bea Gómez', 12000],
        [3, 'Cris Díaz', 9000],
        [4, 'Dani Ruiz', 4000],
      ],
      25000,
      3,
    ),
  }
  const { router } = renderInicio()
  await payFromInicio('11000')

  expect(await screen.findByText('Payment saved')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(HOME)
  await waitFor(() => expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument())
  expect(screen.getAllByRole('link', { name: /^Collect from / })).toHaveLength(3)
  expect(screen.getByRole('link', { name: 'Collect from Dani Ruiz' })).toBeInTheDocument()
  expect(screen.getByText('3 sales owing')).toBeInTheDocument()
})

test('Record payment opened from Inicio: with nobody left owing the block reads "Nobody owes you"', async () => {
  paymentAnswer = {
    ...paymentFixture,
    after: { balance: 0, owing_since: null, standing: 'settled' },
  }
  panelNow = { ...PANEL, debts: debts([[1, 'Ana Pérez', 11000]], 11000, 1) }
  panelAfterPayment = { ...PANEL, debts: debts([], 0, 0) }
  renderInicio()
  await payFromInicio('11000')

  expect(await screen.findByText('Nobody owes you')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Collect from/ })).not.toBeInTheDocument()
})

test('"Close" on Record payment opened from Inicio returns to Inicio in one move', async () => {
  const { router } = renderInicio()
  await screen.findByText('$ 37.000')
  await userEvent.click(screen.getByRole('link', { name: 'Collect from Ana Pérez' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Close' }))

  expect(await screen.findByText('You sold today')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(HOME)
  expect(router.state.historyAction).toBe('POP')
})

test('the period switch is text tabs (Pestanas) with the range last in the same row', async () => {
  const { container } = renderInicio()
  await screen.findByText('You sold today')

  const row = container.querySelector<HTMLElement>('.inicio__periodos')!
  const group = within(row).getByRole('group', { name: 'Period' })
  expect(group).toHaveClass('pestanas')
  expect(within(group).getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(group).getByRole('button', { name: 'Today' })).toHaveClass('pestanas__opcion--activa')
  expect(within(group).getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'false')
  expect(container.querySelector('.periodos, .periodos__boton')).toBeNull()
  expect(row.lastElementChild).toHaveClass('pie')
  expect(row.lastElementChild?.textContent).toMatch(/^Today \d\d\/\d\d$/)
})

test('a Owed to you row reads the name, then the amount in amber with its date, Cobrar beside it', async () => {
  const { container } = renderInicio()
  await screen.findByText('$ 37.000')

  const head = container.querySelector('.bloque-deben')!
  expect(head.querySelector('.bloque-deben__cuenta')).toHaveTextContent('4 sales owing')
  expect(head.querySelector('.bloque-deben__cuenta')).toHaveClass('pie')
  expect(head.querySelector('.bloque-deben__desde')).toHaveTextContent(/^since \d\d\/\d\d$/)

  const row = container.querySelector<HTMLElement>('.bloque-deben__fila')!
  const data = row.querySelector<HTMLElement>('.bloque-deben__datos')!
  expect(data.firstElementChild).toHaveTextContent('Ana Pérez')
  expect(data.querySelector('.monto-deuda')).toHaveTextContent(/^\$ [\d.]+$/)
  expect(data.lastElementChild).toHaveTextContent(/^\$ [\d.]+ · since \d\d\/\d\d$/)
  const cobrar = within(row).getByRole('link', { name: 'Collect from Ana Pérez' })
  expect(cobrar).toHaveTextContent('Collect')
  expect(data.contains(cobrar)).toBe(false)
})

test('What you have left: every status has its word once and days only as the side figure', async () => {
  panelNow = {
    ...PANEL,
    stock: [
      { ...PANEL.stock[0]!, variety_id: 1, name: 'Criolla', status: 'low', days_left: 5 },
      { ...PANEL.stock[0]!, variety_id: 2, name: 'Mora', status: 'ok', days_left: 40 },
      { ...PANEL.stock[0]!, variety_id: 3, name: 'Zinnia', status: 'sold_out', days_left: null },
      { ...PANEL.stock[0]!, variety_id: 4, name: 'Nueva', status: 'no_entries', days_left: null },
    ],
  }
  const { container } = renderInicio()
  await screen.findByText('Criolla')

  const rows = Array.from(container.querySelectorAll<HTMLElement>('.fila-stock'))
  expect(rows.map((row) => row.querySelectorAll('.marca-estado__palabra').length)).toEqual([1, 1, 1, 1])
  expect(rows.map((row) => row.querySelector('.fila-stock__insignia')?.textContent ?? null)).toEqual([
    '5 days',
    '40 days',
    null,
    null,
  ])
  for (const row of rows) {
    expect(row.querySelector('.fila-stock__insignia--sold_out, .fila-stock__insignia--low')).toBeNull()
    expect(row.querySelector('.fila-stock__detalle')).not.toBeNull()
  }
})
