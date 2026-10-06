/**
 * `VarietyPage` at the screen seam (`varieties.md`, "A variety's page"), through Testing
 * Library with `fetch` faked and the real router, and `VarietyRoute`'s parameter parsing.
 * The page is told its variety only by the `varietyId` prop; nothing here asks the faked
 * API for a stock status, a catalog reason or the catalog text beyond what it answers.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, RouterProvider, createMemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import FlashProvider from '../../flash/FlashProvider'
import { VARIETIES, VARIETY, relative } from '../../routes'
import VarietyPage from './VarietyPage'
import VarietyRoute from './VarietyRoute'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }

const VARIETY_ROW = {
  id: 1,
  name: '24K Gold',
  current_price: { id: 3, effective_from: '2026-09-25', list_price: 11000, bulk_price: 10000, bulk_minimum: 10 },
}
const NO_PRICE_ROW = { id: 1, name: '24K Gold', current_price: null }

const PRICES = [
  { id: 4, effective_from: '2026-10-01', list_price: 12000, bulk_price: null, bulk_minimum: null },
  { id: 3, effective_from: '2026-09-25', list_price: 11000, bulk_price: 10000, bulk_minimum: 10 },
  { id: 2, effective_from: '2026-09-01', list_price: 10500, bulk_price: null, bulk_minimum: null },
  { id: 1, effective_from: '2026-07-05', list_price: 9800, bulk_price: null, bulk_minimum: null },
]

function entry(id: number, varietyId: number, date: string, grams: number) {
  return {
    id,
    date,
    variety_id: varietyId,
    origin: 'purchase',
    grams,
    total_cost: 280000,
    cost_per_gram: 7000,
    note: null,
  }
}

const STOCK_ROW = { variety_id: 1, grams: 18, status: 'low', sold_out_since: null, threshold: 20, days_left: 24 }

function stockOf(row: Record<string, unknown>, entries = ENTRIES) {
  return { total: 18, varieties: [row, { ...STOCK_ROW, variety_id: 2 }], entries }
}
const ENTRIES = [
  entry(14, 1, '2026-09-30', 10),
  entry(13, 2, '2026-09-29', 99),
  entry(12, 1, '2026-09-20', 20),
  entry(11, 1, '2026-09-10', 30),
  entry(10, 1, '2026-09-01', 40),
]

const CATALOG = {
  text: 'texto',
  header: '',
  footer: '',
  varieties: [
    { id: 1, name: '24K Gold', emoji: '🍪', indica_share: 70, aroma: 'Galletita y vainilla', shown: true, state: 'in' },
    { id: 2, name: 'Otra', emoji: null, indica_share: null, aroma: null, shown: true, state: 'in' },
  ],
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

type Answers = Record<string, () => Response>

function defaults(): Answers {
  return {
    'GET /varieties/1': () => json(200, VARIETY_ROW),
    'GET /varieties/1/prices': () => json(200, PRICES),
    'GET /stock': () => json(200, stockOf(STOCK_ROW)),
    'GET /catalog': () => json(200, CATALOG),
  }
}

function Where() {
  const location = useLocation()
  return <output aria-label="ubicación">{`${location.pathname}${location.search}|${JSON.stringify(location.state)}`}</output>
}

function renderPage(path: string, overrides: Answers = {}) {
  const answers = { ...defaults(), ...overrides }
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const answer = answers[`${init?.method ?? 'GET'} ${url}`]
    if (answer === undefined) return Promise.reject(new Error(`unexpected request: ${init?.method ?? 'GET'} ${url}`))
    return Promise.resolve(answer())
  })
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      {
        element: (
          <QueryClientProvider client={queryClient}>
            <FlashProvider>
              <Outlet context={ME} />
              <Where />
            </FlashProvider>
          </QueryClientProvider>
        ),
        children: [
          { path: relative(VARIETIES), element: <main>Pantalla Variedades</main> },
          {
            path: relative(VARIETY(':id')),
            element: <VarietyRoute render={(varietyId) => <VarietyPage varietyId={varietyId} />} />,
          },
          { path: '*', element: <main>Otra pantalla</main> },
        ],
      },
    ],
    { initialEntries: ['/varieties', path], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
  return { router, fetchMock }
}

function writes(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls
    .map(([url, init]) => ({ url: url as string, method: (init as RequestInit | undefined)?.method ?? 'GET' }))
    .filter(({ method }) => method !== 'GET')
    .map(({ url, method }) => `${method} ${url}`)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the summary line', () => {
  test('tells grams, status by shape and word, days left and today\'s price', async () => {
    renderPage('/varieties/1')

    const line = await screen.findByText(/24 días/)
    expect(line).toHaveTextContent('18 g · baja · 24 días · $ 11.000 x g')
    expect(screen.getByRole('heading', { name: '24K Gold' })).toBeInTheDocument()
  })

  test.each([
    ['sold_out', { grams: 0, status: 'sold_out', days_left: null, sold_out_since: '2026-09-30' }, '0 g · agotada'],
    ['no_entries', { grams: 0, status: 'no_entries', days_left: null }, '0 g · sin entradas'],
    ['ok', { grams: 90, status: 'ok', days_left: 60 }, '90 g · ok · 60 días'],
  ])('a %s variety', async (_name, patch, expected) => {
    renderPage('/varieties/1', { 'GET /stock': () => json(200, stockOf({ ...STOCK_ROW, ...patch })) })

    const line = await screen.findByText(/\$ 11\.000 x g/)
    expect(line).toHaveTextContent(expected)
  })

  test('no price in force says it cannot be sold', async () => {
    renderPage('/varieties/1', { 'GET /varieties/1': () => json(200, NO_PRICE_ROW) })

    expect(await screen.findByText(/Sin precio: no se puede vender/)).toBeInTheDocument()
  })

  test('a variety left out of the catalog is marked "Oculta" beside its status', async () => {
    const hidden = { ...CATALOG, varieties: [{ ...CATALOG.varieties[0], shown: false, state: 'hidden' }] }
    renderPage('/varieties/1', { 'GET /catalog': () => json(200, hidden) })

    const line = (await screen.findByText('Oculta')).closest('p')
    expect(line).toHaveTextContent('18 g · baja · Oculta · 24 días')
  })
})

describe('the actions and the sections', () => {
  test('"+ Entrada" opens the entry form with this variety, "Nuevo precio" its price form', async () => {
    renderPage('/varieties/1')

    expect(await screen.findByRole('link', { name: '+ Entrada' })).toHaveAttribute('href', '/varieties/entries/new?variety=1')
    expect(screen.getByRole('link', { name: 'Nuevo precio' })).toHaveAttribute('href', '/varieties/1/prices/new')
  })

  test('the page is a detail: "‹ Variedades" and no "+ Nueva venta"', async () => {
    renderPage('/varieties/1')

    expect(await screen.findByRole('link', { name: '‹ Variedades' })).toHaveAttribute('href', '/varieties')
    expect(screen.queryByText('+ Nueva venta')).not.toBeInTheDocument()
  })

  test('Stock y entradas carries this variety\'s last 3 entries and "Ver todas"', async () => {
    renderPage('/varieties/1')

    const section = (await screen.findByRole('heading', { name: 'Stock y entradas' })).closest('section')
    expect(section).not.toBeNull()
    const inside = within(section as HTMLElement)
    expect(inside.getByText('10 g')).toBeInTheDocument()
    expect(inside.getByText('20 g')).toBeInTheDocument()
    expect(inside.getByText('30 g')).toBeInTheDocument()
    expect(inside.queryByText('40 g')).not.toBeInTheDocument()
    expect(inside.queryByText('99 g')).not.toBeInTheDocument()
    expect(inside.getByRole('link', { name: 'Ver todas' })).toHaveAttribute('href', '/varieties/1/entries')
  })

  test('Precios carries the last 3 prices, "Vigente hoy" and "Ver todas"', async () => {
    renderPage('/varieties/1')

    const section = (await screen.findByRole('heading', { name: 'Precios' })).closest('section')
    const inside = within(section as HTMLElement)
    expect(inside.getAllByText(/Rige desde/)).toHaveLength(3)
    expect(inside.getByText('Vigente hoy')).toBeInTheDocument()
    expect(inside.queryByText('$ 9.800')).not.toBeInTheDocument()
    expect(inside.getByRole('link', { name: 'Ver todas' })).toHaveAttribute('href', '/varieties/1/prices')
  })

  test('only those two sections carry "Ver todas"', async () => {
    renderPage('/varieties/1')

    await screen.findByRole('heading', { name: 'Precios' })
    expect(screen.getAllByRole('link', { name: 'Ver todas' })).toHaveLength(2)
  })

  test('Aviso de stock bajo reads the saved threshold, with a switch and "Editar"', async () => {
    renderPage('/varieties/1')

    const section = (await screen.findByRole('heading', { name: 'Aviso de stock bajo' })).closest('section')
    const inside = within(section as HTMLElement)
    expect(inside.getByText('Avisando: quedan 18 g')).toBeInTheDocument()
    expect(inside.getByRole('switch')).toBeChecked()
    expect(inside.getByRole('button', { name: /Editar/ })).toBeInTheDocument()
  })

  test.each([
    ['no threshold', { threshold: null, status: 'ok', grams: 90, days_left: 60 }, 'Aviso apagado'],
    ['a threshold not reached', { threshold: 15, status: 'ok', grams: 90, days_left: 60 }, 'Avisame abajo de 15 g'],
  ])('Aviso de stock bajo with %s', async (_name, patch, expected) => {
    renderPage('/varieties/1', { 'GET /stock': () => json(200, stockOf({ ...STOCK_ROW, ...patch })) })

    expect(await screen.findByText(expected)).toBeInTheDocument()
  })

  test('En el catálogo reads shown, emoji, % índica and aroma, with "Editar"', async () => {
    renderPage('/varieties/1')

    const section = (await screen.findByRole('heading', { name: 'En el catálogo' })).closest('section')
    const inside = within(section as HTMLElement)
    expect(await inside.findByText('🍪')).toBeInTheDocument()
    expect(inside.getByText('70 %')).toBeInTheDocument()
    expect(inside.getByText('Galletita y vainilla')).toBeInTheDocument()
    expect(inside.getByText('Se muestra')).toBeInTheDocument()
    expect(inside.getByRole('button', { name: /Editar/ })).toBeInTheDocument()
    expect(section).toHaveAttribute('id', 'en-el-catalogo')
  })

  test('En el catálogo tells a hidden variety by word', async () => {
    const hidden = { ...CATALOG, varieties: [{ ...CATALOG.varieties[0], shown: false, state: 'hidden' }] }
    renderPage('/varieties/1', { 'GET /catalog': () => json(200, hidden) })

    const section = (await screen.findByRole('heading', { name: 'En el catálogo' })).closest('section')
    expect(await within(section as HTMLElement).findByText('No se muestra')).toBeInTheDocument()
  })
})

describe('gone and foreign varieties', () => {
  test('a variety that is not there, or is another business\'s, shows "Eso ya no está."', async () => {
    renderPage('/varieties/1', {
      'GET /varieties/1': () => json(404, { code: 'variety.not_found' }),
      'GET /varieties/1/prices': () => json(404, { code: 'variety.not_found' }),
    })

    expect(await screen.findByText('Eso ya no está.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a Variedades' })).toHaveAttribute('href', '/varieties')
  })

  test('VarietyRoute: an id that is not a whole number is gone, and the API is never asked', async () => {
    const { fetchMock } = renderPage('/varieties/abc')

    expect(await screen.findByText('Eso ya no está.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('the openers push a history entry, so Back closes the form', () => {
  test('"Editar" on Aviso de stock bajo pushes the threshold form', async () => {
    const user = userEvent.setup()
    const { router } = renderPage('/varieties/1')

    const section = (await screen.findByRole('heading', { name: 'Aviso de stock bajo' })).closest('section')
    await user.click(within(section as HTMLElement).getByRole('button', { name: /Editar/ }))

    expect(router.state.location.pathname).toBe('/varieties/1')
    expect(router.state.location.state).toEqual({ form: 'threshold' })
    await router.navigate(-1)
    expect(router.state.location.state).toBeNull()
  })

  test('"Editar" on En el catálogo pushes the catalog form', async () => {
    const user = userEvent.setup()
    const { router } = renderPage('/varieties/1')

    const section = (await screen.findByRole('heading', { name: 'En el catálogo' })).closest('section')
    await user.click(within(section as HTMLElement).getByRole('button', { name: /Editar/ }))

    expect(router.state.location.state).toEqual({ form: 'catalog' })
  })

  test('turning the warning on opens the form and calls nothing', async () => {
    const user = userEvent.setup()
    const { router, fetchMock } = renderPage('/varieties/1', {
      'GET /stock': () => json(200, stockOf({ ...STOCK_ROW, threshold: null, status: 'ok', grams: 90, days_left: 60 })),
    })

    await user.click(await screen.findByRole('switch'))

    expect(router.state.location.state).toEqual({ form: 'threshold' })
    expect(writes(fetchMock)).toEqual([])
  })

  test('an unknown form state renders no form and no placeholder', async () => {
    renderPage('/varieties/1')
    await screen.findByRole('heading', { name: 'Precios' })
    expect(screen.queryByText(/Próximamente/)).not.toBeInTheDocument()
  })
})

describe('turning the warning off', () => {
  test('saves {grams: null}, keeps the switch on and disabled until the server answers, then flips and toasts', async () => {
    const user = userEvent.setup()
    let release: (response: Response) => void = () => undefined
    let stock = stockOf(STOCK_ROW)
    const { fetchMock } = renderPage('/varieties/1', {
      'GET /stock': () => json(200, stock),
      'PUT /stock/varieties/1/threshold': () => {
        throw new Error('replaced below')
      },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        const key = `${init?.method ?? 'GET'} ${url}`
        if (key === 'PUT /stock/varieties/1/threshold') {
          return new Promise<Response>((resolve) => {
            release = resolve
          })
        }
        return (fetchMock as unknown as (u: string, i?: RequestInit) => Promise<Response>)(url, init)
      }),
    )

    const toggle = await screen.findByRole('switch')
    await user.click(toggle)

    expect(toggle).toBeChecked()
    expect(toggle).toBeDisabled()
    stock = stockOf({ ...STOCK_ROW, threshold: null, status: 'ok', grams: 90, days_left: 60 })
    release(json(200, { ...STOCK_ROW, threshold: null }))

    expect(await screen.findByText('Aviso apagado')).toBeInTheDocument()
    expect(screen.getByRole('switch')).not.toBeChecked()
    expect(screen.getByRole('switch')).toBeEnabled()
    expect(await screen.findByText('Aviso guardado')).toBeInTheDocument()
  })

  test('a refusal leaves the switch on and says so inline', async () => {
    const user = userEvent.setup()
    renderPage('/varieties/1', {
      'PUT /stock/varieties/1/threshold': () => json(422, { code: 'stock.threshold_invalid' }),
    })

    const toggle = await screen.findByRole('switch')
    await user.click(toggle)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeChecked()
    expect(screen.getByRole('switch')).toBeEnabled()
    expect(screen.queryByText('Aviso guardado')).not.toBeInTheDocument()
  })

  test('a dropped network leaves the switch on and shows the no-network state', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderPage('/varieties/1')
    const base = fetchMock.getMockImplementation() as (u: string, i?: RequestInit) => Promise<Response>
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === 'PUT' ? Promise.reject(new TypeError('Failed to fetch')) : base(url, init),
    )

    await user.click(await screen.findByRole('switch'))

    expect(await screen.findByText('Te quedaste sin internet')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeChecked()
  })
})
