/**
 * The panel's body through the `Inicio` screen (Testing Library, `fetch` faked): what Hoy
 * draws and what it leaves for Semana and Mes, Lo que te queda's link on a low variety,
 * and "Cobrar a <name>" through the real Registrar cobro and back, in both themes
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
  'Ganancia',
  'Caja',
  'Costo de lo vendido',
  'Faltante de stock',
  'Promoción',
  'Consumo propio',
  'Gastos',
  'Regalaste',
  'Compras de flores',
]

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
  test(`Hoy draws sold today, Te deben and Lo que te queda in that order, and no result figure (${theme})`, async () => {
    chooseTheme(theme)
    const { container } = renderInicio()
    await screen.findByText('Vendiste hoy')

    const order = ['.panel-ventas', '.bloque-deben', '.lista-stock'].map((selector) => {
      const node = container.querySelector(selector)
      expect(node).not.toBeNull()
      return node as Element
    })
    expect(order[0]?.compareDocumentPosition(order[1] as Element)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(order[1]?.compareDocumentPosition(order[2] as Element)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(screen.getByText('2 ventas · promedio $ 7.500 · 10 g')).toBeInTheDocument()
    for (const label of RESULT_LABELS) expect(screen.queryByText(label)).not.toBeInTheDocument()
    expect(container.querySelector('.panel-resultados')).toBeNull()
    expect(container.querySelector('.panel-lista')).toBeNull()
    expect(screen.queryByText('incluye costo pendiente')).not.toBeInTheDocument()
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
  await screen.findByText('Vendiste hoy')

  expect(screen.getByText('0 ventas · 0 g')).toBeInTheDocument()
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
  await screen.findByText('Vendiste hoy')

  for (const label of RESULT_LABELS) expect(screen.queryByText(label)).not.toBeInTheDocument()
})

test('Semana and Mes keep every result figure, Promoción and Consumo propio right after Faltante de stock', async () => {
  const { container } = renderInicio()
  await screen.findByText('Vendiste hoy')

  await userEvent.click(screen.getByRole('button', { name: 'Semana' }))
  await screen.findByText('Vendiste esta semana')
  for (const label of RESULT_LABELS) expect(screen.getByText(label)).toBeInTheDocument()
  const labels = Array.from(container.querySelectorAll('.panel-lista__fila > span:first-child')).map(
    (node) => node.textContent,
  )
  expect(labels).toEqual([
    'Regalaste',
    'Costo de lo vendido',
    'Faltante de stock',
    'Promoción',
    'Consumo propio',
    'Gastos',
    'Compras de flores',
  ])
  // Ganancia and Caja close the figures, as the design and results.md draw them.
  const list = container.querySelector('.panel-lista') as Element
  const results = container.querySelector('.panel-resultados') as Element
  expect(list.compareDocumentPosition(results)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)

  await userEvent.click(screen.getByRole('button', { name: 'Mes' }))
  await screen.findByText('Vendiste este mes')
  for (const label of ['Ganancia', 'Caja', 'Costo de lo vendido', 'Gastos', 'Regalaste', 'Compras de flores']) {
    expect(screen.getByText(label)).toBeInTheDocument()
  }
  // The same Te deben block and Lo que te queda sit under every tab.
  expect(screen.getByText('Lo que te queda')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Cobrar a Ana Pérez' })).toBeInTheDocument()
})

test('the sold headline and the result figures share one group, and the two blocks another, in the phone order', async () => {
  // `InicioCompu.dc.html`: headline beside the figures, then Te deben beside Lo que te queda.
  // The groups are the hooks the computer layout lays out; the order stays the phone's.
  const { container } = renderInicio()
  await screen.findByText('Vendiste hoy')
  await userEvent.click(screen.getByRole('button', { name: 'Semana' }))
  await screen.findByText('Vendiste esta semana')

  const figures = screen.getByTestId('inicio-cifras')
  const headline = within(figures).getByText('Vendiste esta semana')
  const results = within(figures).getByTestId('inicio-resultados')
  expect(within(results).getByText('Regalaste')).toBeInTheDocument()
  expect(within(results).getByText('Ganancia')).toBeInTheDocument()
  expect(headline.compareDocumentPosition(results)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)

  const blocks = screen.getByTestId('inicio-bloques')
  const debts = within(blocks).getByText('Te deben')
  const left = within(blocks).getByText('Lo que te queda')
  expect(debts.compareDocumentPosition(left)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  expect(figures.compareDocumentPosition(blocks)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  expect(container.contains(figures)).toBe(true)

  // Hoy has no result figures: its group holds the headline alone.
  await userEvent.click(screen.getByRole('button', { name: 'Hoy' }))
  await screen.findByText('Vendiste hoy')
  const today = screen.getByTestId('inicio-cifras')
  expect(within(today).getByText('Vendiste hoy')).toBeInTheDocument()
  expect(within(today).queryByTestId('inicio-resultados')).toBeNull()
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
    expect(words).toEqual(['baja', 'ok', 'agotada', 'sin entradas'])
    for (const row of container.querySelectorAll('.marca-estado')) {
      expect(row.querySelector('.marca-estado__forma')).toHaveAttribute('aria-hidden', 'true')
    }
    unmount()
  }
})

test('"Nadie te debe" shows with nothing to tap when nobody owes', async () => {
  panelNow = { ...PANEL, debts: debts([], 0, 0) }
  renderInicio()

  expect(await screen.findByText('Nadie te debe')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Cobrar a/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Te deben' })).not.toBeInTheDocument()
})

test('a debtor row names its Cobrar by the customer and keeps the rest of the row as the card link', async () => {
  const { router } = renderInicio()
  await screen.findByText('$ 37.000')

  const cobrar = screen.getByRole('link', { name: 'Cobrar a Ana Pérez' })
  expect(cobrar).toHaveAttribute('href', pathTo(CUSTOMER_PAYMENT, { id: 1 }))
  expect(cobrar.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByText('Ana Pérez').closest('a')).toHaveAttribute('href', pathTo(CUSTOMER, { id: 1 }))
  expect(screen.getByRole('link', { name: 'Te deben' })).toHaveAttribute('href', CUSTOMERS)

  await userEvent.click(cobrar)
  expect(await screen.findByRole('button', { name: 'Guardar' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(pathTo(CUSTOMER_PAYMENT, { id: 1 }))
})

async function payFromInicio(amount: string): Promise<void> {
  await userEvent.click(await screen.findByRole('link', { name: 'Cobrar a Ana Pérez' }))
  const sheet = (await screen.findByRole('button', { name: 'Guardar' })).closest('form')
  const inside = within(sheet as HTMLElement)
  await userEvent.clear(inside.getByLabelText('Monto'))
  await userEvent.type(inside.getByLabelText('Monto'), amount)
  await userEvent.click(inside.getByLabelText('Efectivo'))
  await userEvent.click(inside.getByRole('button', { name: 'Guardar' }))
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

test('Registrar cobro opened from Inicio: a partial payment returns in one move, the toast never names the customer, the row keeps its new balance', async () => {
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

  expect(await screen.findByText('Cobro guardado · queda debiendo $ 6.000')).toBeInTheDocument()
  expect(screen.getByText('Cobro guardado · queda debiendo $ 6.000').textContent).not.toMatch(/Ana/)
  expect(router.state.location.pathname).toBe(HOME)
  expect(router.state.historyAction).toBe('POP')
  expect(await screen.findByText('$ 27.000')).toBeInTheDocument()
  const row = screen.getByText('Ana Pérez').closest('.bloque-deben__fila') as HTMLElement
  expect(within(row).getByText('$ 6.000')).toBeInTheDocument()
})

test('Registrar cobro opened from Inicio: a full payment says plain "Cobro guardado", the row leaves and the teaser refills to 3', async () => {
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

  expect(await screen.findByText('Cobro guardado')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(HOME)
  await waitFor(() => expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument())
  expect(screen.getAllByRole('link', { name: /^Cobrar a / })).toHaveLength(3)
  expect(screen.getByRole('link', { name: 'Cobrar a Dani Ruiz' })).toBeInTheDocument()
  expect(screen.getByText('3 ventas · desde 14/09')).toBeInTheDocument()
})

test('Registrar cobro opened from Inicio: with nobody left owing the block reads "Nadie te debe"', async () => {
  paymentAnswer = {
    ...paymentFixture,
    after: { balance: 0, owing_since: null, standing: 'settled' },
  }
  panelNow = { ...PANEL, debts: debts([[1, 'Ana Pérez', 11000]], 11000, 1) }
  panelAfterPayment = { ...PANEL, debts: debts([], 0, 0) }
  renderInicio()
  await payFromInicio('11000')

  expect(await screen.findByText('Nadie te debe')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Cobrar a/ })).not.toBeInTheDocument()
})

test('"Cerrar" on Registrar cobro opened from Inicio returns to Inicio in one move', async () => {
  const { router } = renderInicio()
  await screen.findByText('$ 37.000')
  await userEvent.click(screen.getByRole('link', { name: 'Cobrar a Ana Pérez' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('Vendiste hoy')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(HOME)
  expect(router.state.historyAction).toBe('POP')
})
