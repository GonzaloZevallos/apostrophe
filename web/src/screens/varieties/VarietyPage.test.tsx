/**
 * `VarietyPage` at the screen seam (`varieties.md`, "A variety's page"), through Testing
 * Library with `fetch` faked and the real router, and `VarietyRoute`'s parameter parsing.
 * The page is told its variety only by the `varietyId` prop; nothing here asks the faked
 * API for a stock status, a catalog reason or the catalog text beyond what it answers.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, RouterProvider, createMemoryRouter, matchRoutes, useLocation } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import FlashProvider from '../../flash/FlashProvider'
import { router as appRouter } from '../../router'
import Shell from '../../shell/Shell'
import {
  STOCK_ENTRY_NEW,
  VARIETIES,
  VARIETY,
  VARIETY_ENTRIES,
  VARIETY_PRICE_NEW,
  VARIETY_PRICES,
  WITHDRAWAL,
  pathTo,
  relative,
  withdrawalNewFor,
} from '../../routes'
import { iconAndTextProblems } from '../../test/iconAndTextRule'
import VarietyPage from './VarietyPage'
import VarietyRoute from './VarietyRoute'
import { SIN_CONEXION_MENSAJE } from '../../copy/common'

const VARIETY_ONE = pathTo(VARIETY, { id: 1 })

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }

const VARIETY_ROW = {
  id: 1,
  name: '24K Gold',
  current_price: { id: 3, effective_from: '2026-09-25', list_price: 11000, bulk_price: 10000, bulk_minimum: 10, vip_price: 9000 },
}
const NO_PRICE_ROW = { id: 1, name: '24K Gold', current_price: null }

const PRICES = [
  { id: 4, effective_from: '2026-10-01', list_price: 12000, bulk_price: null, bulk_minimum: null, vip_price: null },
  { id: 3, effective_from: '2026-09-25', list_price: 11000, bulk_price: 10000, bulk_minimum: 10, vip_price: 9000 },
  { id: 2, effective_from: '2026-09-01', list_price: 10500, bulk_price: null, bulk_minimum: null, vip_price: null },
  { id: 1, effective_from: '2026-07-05', list_price: 9800, bulk_price: null, bulk_minimum: null, vip_price: null },
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

function archivedRow(shown: boolean) {
  return { variety_id: 1, name: '24K Gold', shown, emoji: '🍪', indica_share: 70, aroma: 'Galletita y vainilla' }
}

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
    'GET /catalog/archived': () => json(200, [archivedRow(true)]),
    'GET /pricing-settings': () => json(200, { is_bulk_pricing: true, is_vip_customers: true }),
    'GET /stock/varieties/1/movements': () =>
      json(
        200,
        ENTRIES.filter((row) => row.variety_id === 1).map((row) => ({ ...row, kind: 'entry' })),
      ),
  }
}

function Where() {
  const location = useLocation()
  return <output aria-label="ubicación">{`${location.pathname}${location.search}|${JSON.stringify(location.state)}`}</output>
}

function renderPage(path: string, overrides: Answers = {}, state: unknown = null) {
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
          {
            element: <Shell />,
            children: [
              { path: relative(VARIETIES), element: <main>Pantalla Variedades</main>, handle: { screen: 'varieties' } },
              {
                path: relative(VARIETY),
                element: <VarietyRoute render={(varietyId) => <VarietyPage varietyId={varietyId} />} />,
                // The handle the app's own route table declares, so the shell draws the same chrome.
                handle: matchRoutes(appRouter.routes, pathTo(VARIETY, { id: 1 }))?.at(-1)?.route.handle,
              },
              { path: '*', element: <main>Otra pantalla</main> },
            ],
          },
        ],
      },
    ],
    { initialEntries: [VARIETIES, { pathname: path, state }], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
  return { router, fetchMock }
}

function putOf(fetchMock: ReturnType<typeof vi.fn>): { url: string; body: unknown } {
  const call = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
  if (call === undefined) throw new Error('no PUT was sent')
  return { url: call[0] as string, body: JSON.parse((call[1] as RequestInit).body as string) as unknown }
}

function reads(fetchMock: ReturnType<typeof vi.fn>, call: string): number {
  return fetchMock.mock.calls.filter(([url, init]) => `${(init as RequestInit | undefined)?.method ?? 'GET'} ${url as string}` === call).length
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
    renderPage(VARIETY_ONE)

    const line = await screen.findByText(/24 días/)
    expect(line).toHaveTextContent('18 g · baja · 24 días · $ 11.000 x g')
    expect(screen.getByRole('heading', { name: '24K Gold' })).toBeInTheDocument()
  })

  test.each([
    ['sold_out', { grams: 0, status: 'sold_out', days_left: null, sold_out_since: '2026-09-30' }, '0 g · agotada'],
    ['no_entries', { grams: 0, status: 'no_entries', days_left: null }, '0 g · sin entradas'],
    ['ok', { grams: 90, status: 'ok', days_left: 60 }, '90 g · ok · 60 días'],
  ])('a %s variety', async (_name, patch, expected) => {
    renderPage(VARIETY_ONE, { 'GET /stock': () => json(200, stockOf({ ...STOCK_ROW, ...patch })) })

    const line = await screen.findByText(/\$ 11\.000 x g/)
    expect(line).toHaveTextContent(expected)
  })

  test('no price in force says it cannot be sold', async () => {
    renderPage(VARIETY_ONE, { 'GET /varieties/1': () => json(200, NO_PRICE_ROW) })

    expect(await screen.findByText(/Sin precio: no se puede vender/)).toBeInTheDocument()
  })

  test('a variety left out of the catalog is marked "Oculta" beside its status', async () => {
    const hidden = { ...CATALOG, varieties: [{ ...CATALOG.varieties[0], shown: false, state: 'hidden' }] }
    renderPage(VARIETY_ONE, { 'GET /catalog': () => json(200, hidden) })

    const line = (await screen.findByText('Oculta')).closest('p')
    expect(line).toHaveTextContent('18 g · baja · Oculta · 24 días')
  })
})

describe('the icon and text rule', () => {
  test("a live page's actions carry an icon hidden from assistive technology, their names stay the words", async () => {
    renderPage(VARIETY_ONE)

    await screen.findByRole('link', { name: '+ Entrada' })
    for (const name of ['+ Entrada', 'New price', 'Take from stock']) {
      const link = screen.getByRole('link', { name })
      expect(link.querySelectorAll('svg')).toHaveLength(1)
      expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    }
  })

  test("a price row's delete is the icon-only delete: no word, a 44 px class and its current name", async () => {
    renderPage(VARIETY_ONE)

    const deletes = await screen.findAllByRole('button', { name: 'Borrar este precio' })
    expect(deletes.length).toBeGreaterThan(0)
    for (const button of deletes) {
      expect(button).toHaveClass('boton-icono')
      expect(button.textContent).toBe('')
      expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    }
  })

  test('"Eliminar variedad" is the critical icon + text action with its current word as its name', async () => {
    renderPage(VARIETY_ONE, { 'GET /varieties/1': () => json(200, { ...VARIETY_ROW, removal: 'delete' }) })

    const button = await screen.findByRole('button', { name: 'Eliminar variedad' })
    expect(button).toHaveClass('boton--critico')
    expect(button).not.toHaveClass('boton-icono')
    expect(button.textContent).toBe('Eliminar variedad')
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  test('what the live page keeps as text is only its links and the switch; Archivar variedad has its icon', async () => {
    renderPage(VARIETY_ONE, { 'GET /varieties/1': () => json(200, { ...VARIETY_ROW, removal: 'archive' }) })

    await screen.findByRole('link', { name: '+ Entrada' })
    expect(await screen.findByRole('button', { name: 'Archivar variedad' })).toBeInTheDocument()
    const problems = iconAndTextProblems(screen.getByRole('main'))
    // The low-stock switch is a switch with its label beside it, no icon and no visible text
    // of its own (the rule's helper reads any text-less button as an icon-only control).
    expect(problems.filter((problem) => !problem.includes('Avisar cuando quede poco'))).toEqual([])
  })

  test('an archived variety keeps only Restaurar, with its icon', async () => {
    renderPage(VARIETY_ONE, {
      'GET /varieties/1': () => json(200, { ...VARIETY_ROW, archived: true, removal: null }),
      'GET /stock?archived=true': () => json(200, stockOf(STOCK_ROW)),
    })

    expect(await screen.findByRole('button', { name: 'Restaurar' })).toBeInTheDocument()
    expect(iconAndTextProblems(screen.getByRole('main'))).toEqual([])
  })
})

describe("an archived variety's summary line and its one action", () => {
  const ARCHIVED: Answers = {
    'GET /varieties/1': () => json(200, { ...VARIETY_ROW, archived: true, removal: null }),
    'GET /stock?archived=true': () => json(200, stockOf(STOCK_ROW)),
  }

  test.each([
    ['hidden', false, true],
    ['shown', true, false],
  ])('a %s one says Archivada, and Oculta only when hidden, with no status mark nor days left', async (_name, shown, oculta) => {
    renderPage(VARIETY_ONE, { ...ARCHIVED, 'GET /catalog/archived': () => json(200, [archivedRow(shown)]) })

    const line = await screen.findByText(/\$ 11\.000 x g/)
    expect(line).toHaveTextContent(/^18 g · \$ 11\.000 x g$/)
    expect(screen.getByText('Archivada')).toHaveClass('insignia')
    expect(screen.queryByText('Oculta') !== null).toBe(oculta)
    expect(screen.queryByText(/baja|ok|agotada|sin entradas/)).not.toBeInTheDocument()
    expect(screen.queryByText(/24 días/)).not.toBeInTheDocument()
  })

  test('its grams show as a figure even when negative, and no price says Sin precio', async () => {
    renderPage(VARIETY_ONE, {
      ...ARCHIVED,
      'GET /varieties/1': () => json(200, { ...NO_PRICE_ROW, archived: true, removal: null }),
      'GET /stock?archived=true': () => json(200, stockOf({ ...STOCK_ROW, grams: -4, status: 'sold_out' })),
    })

    expect(await screen.findByText(/Sin precio/)).toHaveTextContent('-4 g · Sin precio: no se puede vender')
  })

  test('Restaurar is the only action: no entry, price, withdrawal, archive or delete', async () => {
    renderPage(VARIETY_ONE, ARCHIVED)

    await screen.findByRole('button', { name: 'Restaurar' })
    const main = screen.getByRole('main')
    const buttons = within(main).getAllByRole('button').map((button) => button.textContent)
    expect(buttons.filter((name) => name !== '')).toEqual(['Restaurar'])
    expect(within(main).queryByRole('button', { name: 'Eliminar variedad' })).toBeNull()
    expect(within(main).queryByRole('button', { name: 'Archivar variedad' })).toBeNull()
    for (const name of ['+ Entrada', 'New price', 'Take from stock']) {
      expect(within(main).queryByRole('link', { name })).toBeNull()
    }
  })
})

describe("an archived variety's four sections, read-only", () => {
  const ARCHIVED: Answers = {
    'GET /varieties/1': () => json(200, { ...VARIETY_ROW, archived: true, removal: null }),
    'GET /stock?archived=true': () => json(200, stockOf(STOCK_ROW)),
    'GET /catalog/archived': () => json(200, [archivedRow(false)]),
  }

  test('Stock y entradas, Precios, Aviso de stock bajo and En el catálogo are all shown, none editable', async () => {
    renderPage(VARIETY_ONE, ARCHIVED)

    const section = async (name: string) => within((await screen.findByRole('heading', { name })).closest('section')!)
    const stock = await section('Stock y entradas')
    expect(stock.getAllByRole('listitem')).toHaveLength(3)
    expect(stock.getByRole('link', { name: 'Ver todas' })).toBeInTheDocument()
    const prices = await section('Prices')
    expect(prices.getByRole('link', { name: 'Ver todas' })).toBeInTheDocument()
    expect(prices.queryByRole('button', { name: 'Borrar este precio' })).toBeNull()
    const warning = await section('Aviso de stock bajo')
    expect(warning.getByText('Avisame abajo de 20 g')).toBeInTheDocument()
    expect(warning.queryByText(/Avisando/)).toBeNull()
    const catalog = await section('En el catálogo')
    expect(catalog.getByText('No se muestra')).toBeInTheDocument()
    expect(catalog.getByText('🍪')).toBeInTheDocument()
    expect(catalog.getByText('70 %')).toBeInTheDocument()
    expect(catalog.getByText('Galletita y vainilla')).toBeInTheDocument()
    const main = screen.getByRole('main')
    expect(within(main).queryByRole('switch')).toBeNull()
    expect(within(main).queryByRole('button', { name: /^Edit/ })).toBeNull()
  })

  test('a threshold that is off reads Aviso apagado', async () => {
    renderPage(VARIETY_ONE, {
      ...ARCHIVED,
      'GET /stock?archived=true': () => json(200, stockOf({ ...STOCK_ROW, threshold: null, status: 'ok' })),
    })

    expect(await screen.findByText('Warning off')).toBeInTheDocument()
  })
})

describe('the actions and the sections', () => {
  test('"+ Entrada" opens the entry form with this variety, "New price" its price form', async () => {
    renderPage(VARIETY_ONE)

    expect(await screen.findByRole('link', { name: '+ Entrada' })).toHaveAttribute('href', `${STOCK_ENTRY_NEW}?variety=1`)
    expect(screen.getByRole('link', { name: 'New price' })).toHaveAttribute('href', pathTo(VARIETY_PRICE_NEW, { id: 1 }))
  })

  test('the page is a detail: "‹ Varieties" and no "+ Nueva venta"', async () => {
    const { router } = renderPage(VARIETY_ONE)

    const back = await screen.findByRole('button', { name: '‹ Varieties' })
    expect(screen.queryByText(/New sale/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0)
    await userEvent.click(back)
    await waitFor(() => expect(router.state.location.pathname).toBe(VARIETIES))
  })

  test('Stock y entradas carries this variety\'s last 3 entries and "Ver todas"', async () => {
    renderPage(VARIETY_ONE)

    const section = (await screen.findByRole('heading', { name: 'Stock y entradas' })).closest('section')
    expect(section).not.toBeNull()
    const inside = within(section as HTMLElement)
    expect(inside.getByText('10 g')).toBeInTheDocument()
    expect(inside.getByText('20 g')).toBeInTheDocument()
    expect(inside.getByText('30 g')).toBeInTheDocument()
    expect(inside.queryByText('40 g')).not.toBeInTheDocument()
    expect(inside.queryByText('99 g')).not.toBeInTheDocument()
    expect(inside.getByRole('link', { name: 'Ver todas' })).toHaveAttribute('href', pathTo(VARIETY_ENTRIES, { id: 1 }))
  })

  test('"Take from stock" opens the withdrawal form with this variety already chosen', async () => {
    renderPage(pathTo(VARIETY, { id: 1 }))

    expect(await screen.findByRole('link', { name: 'Take from stock' })).toHaveAttribute(
      'href',
      withdrawalNewFor(1),
    )
  })

  test('a withdrawal in Stock y entradas says its reason and a minus sign, mixed with entries, and opens its detail', async () => {
    renderPage(pathTo(VARIETY, { id: 1 }), {
      'GET /stock/varieties/1/movements': () =>
        json(200, [
          { ...ENTRIES[0], kind: 'entry' },
          { kind: 'withdrawal', id: 5, date: '2026-09-25', reason: 'promotion', grams: 5.5 },
          { ...ENTRIES[2], kind: 'entry' },
          { ...ENTRIES[3], kind: 'entry' },
        ]),
    })

    const section = (await screen.findByRole('heading', { name: 'Stock y entradas' })).closest('section')
    const inside = within(section as HTMLElement)
    const reason = await inside.findByText(/Promotion/)
    expect(reason.closest('li')).toHaveTextContent('−5,5 g')
    expect(reason.closest('a')).toHaveAttribute('href', pathTo(WITHDRAWAL, { id: 5 }))
    expect(inside.getByText('10 g')).toBeInTheDocument()
    expect(inside.getByText('20 g')).toBeInTheDocument()
    expect(inside.queryByText('30 g')).not.toBeInTheDocument()
  })

  test('Precios carries the last 3 prices, "Vigente hoy" and "Ver todas"', async () => {
    renderPage(VARIETY_ONE)

    const section = (await screen.findByRole('heading', { name: 'Prices' })).closest('section')
    const inside = within(section as HTMLElement)
    expect(inside.getAllByText(/Rige desde/)).toHaveLength(3)
    expect(inside.getByText('Vigente hoy')).toBeInTheDocument()
    expect(inside.queryByText('$ 9.800')).not.toBeInTheDocument()
    expect(inside.getByRole('link', { name: 'Ver todas' })).toHaveAttribute('href', pathTo(VARIETY_PRICES, { id: 1 }))
  })


  test('Precios follows the switches: each rule shows only while it is on, and comes back when on again', async () => {
    renderPage(pathTo(VARIETY, { id: 1 }), {
      'GET /pricing-settings': () => json(200, { is_bulk_pricing: false, is_vip_customers: true }),
      'GET /varieties/1/prices': () =>
        json(200, [{ ...PRICES[1], vip_price: 9000 }, { ...PRICES[0], vip_price: null }]),
    })

    const section = (await screen.findByRole('heading', { name: 'Prices' })).closest('section')
    const inside = within(section as HTMLElement)
    expect(await inside.findByText('Precio VIP · $ 9.000')).toBeInTheDocument()
    expect(inside.queryByText(/Desde/)).not.toBeInTheDocument()
  })

  test('Precios shows no VIP price while Clientes VIP is off', async () => {
    renderPage(pathTo(VARIETY, { id: 1 }), {
      'GET /pricing-settings': () => json(200, { is_bulk_pricing: true, is_vip_customers: false }),
    })

    const section = (await screen.findByRole('heading', { name: 'Prices' })).closest('section')
    const inside = within(section as HTMLElement)
    expect(await inside.findByText('Desde 10 g · $ 10.000')).toBeInTheDocument()
    expect(inside.queryByText(/VIP/)).not.toBeInTheDocument()
  })

  test("an archived variety's Precios follows the switches too, read-only", async () => {
    renderPage(pathTo(VARIETY, { id: 1 }), {
      'GET /varieties/1': () => json(200, { ...VARIETY_ROW, archived: true }),
      'GET /stock?archived=true': () => json(200, stockOf(STOCK_ROW)),
      'GET /pricing-settings': () => json(200, { is_bulk_pricing: true, is_vip_customers: false }),
      'GET /varieties/1/prices': () => json(200, [{ ...PRICES[1], vip_price: 9000 }, PRICES[0]]),
    })

    const section = (await screen.findByRole('heading', { name: 'Prices' })).closest('section')
    const inside = within(section as HTMLElement)
    expect(await inside.findAllByText(/Rige desde/)).not.toHaveLength(0)
    expect(inside.queryByText(/VIP/)).not.toBeInTheDocument()
    expect(inside.queryByRole('button', { name: 'Borrar este precio' })).toBeNull()
  })
  test('only those two sections carry "Ver todas"', async () => {
    renderPage(VARIETY_ONE)

    await screen.findByRole('heading', { name: 'Prices' })
    expect(screen.getAllByRole('link', { name: 'Ver todas' })).toHaveLength(2)
  })

  test('Aviso de stock bajo reads the saved threshold, with a switch and "Edit"', async () => {
    renderPage(VARIETY_ONE)

    const section = (await screen.findByRole('heading', { name: 'Aviso de stock bajo' })).closest('section')
    const inside = within(section as HTMLElement)
    expect(inside.getByText('Avisando: quedan 18 g')).toBeInTheDocument()
    expect(inside.getByRole('switch')).toBeChecked()
    expect(inside.getByRole('button', { name: /Edit/ })).toBeInTheDocument()
  })

  test.each([
    ['no threshold', { threshold: null, status: 'ok', grams: 90, days_left: 60 }, 'Warning off'],
    ['a threshold not reached', { threshold: 15, status: 'ok', grams: 90, days_left: 60 }, 'Avisame abajo de 15 g'],
  ])('Aviso de stock bajo with %s', async (_name, patch, expected) => {
    renderPage(VARIETY_ONE, { 'GET /stock': () => json(200, stockOf({ ...STOCK_ROW, ...patch })) })

    expect(await screen.findByText(expected)).toBeInTheDocument()
  })

  test('En el catálogo reads shown, emoji, % índica and aroma, with "Edit"', async () => {
    renderPage(VARIETY_ONE)

    const section = (await screen.findByRole('heading', { name: 'En el catálogo' })).closest('section')
    const inside = within(section as HTMLElement)
    expect(await inside.findByText('🍪')).toBeInTheDocument()
    expect(inside.getByText('70 %')).toBeInTheDocument()
    expect(inside.getByText('Galletita y vainilla')).toBeInTheDocument()
    expect(inside.getByText('Se muestra')).toBeInTheDocument()
    expect(inside.getByRole('button', { name: /Edit/ })).toBeInTheDocument()
    expect(section).toHaveAttribute('id', 'en-el-catalogo')
  })

  test('En el catálogo tells a hidden variety by word', async () => {
    const hidden = { ...CATALOG, varieties: [{ ...CATALOG.varieties[0], shown: false, state: 'hidden' }] }
    renderPage(VARIETY_ONE, { 'GET /catalog': () => json(200, hidden) })

    const section = (await screen.findByRole('heading', { name: 'En el catálogo' })).closest('section')
    expect(await within(section as HTMLElement).findByText('No se muestra')).toBeInTheDocument()
  })
})

describe('gone and foreign varieties', () => {
  test('a variety that is not there, or is another business\'s, shows "That is gone."', async () => {
    renderPage(VARIETY_ONE, {
      'GET /varieties/1': () => json(404, { code: 'variety.not_found' }),
      'GET /varieties/1/prices': () => json(404, { code: 'variety.not_found' }),
    })

    expect(await screen.findByText('That is gone.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Varieties' })).toHaveAttribute('href', VARIETIES)
  })

  test('VarietyRoute: an id that is not a whole number is gone, and the API is never asked', async () => {
    const { fetchMock } = renderPage(pathTo(VARIETY, { id: 'abc' }))

    expect(await screen.findByText('That is gone.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('the openers push a history entry, so Back closes the form', () => {
  test('"Edit" on Aviso de stock bajo pushes the threshold form', async () => {
    const user = userEvent.setup()
    const { router } = renderPage(VARIETY_ONE)

    const section = (await screen.findByRole('heading', { name: 'Aviso de stock bajo' })).closest('section')
    await user.click(within(section as HTMLElement).getByRole('button', { name: /Edit/ }))

    expect(router.state.location.pathname).toBe(VARIETY_ONE)
    expect(router.state.location.state).toEqual({ form: 'threshold' })
    await router.navigate(-1)
    expect(router.state.location.state).toBeNull()
  })

  test('"Edit" on En el catálogo pushes the catalog form', async () => {
    const user = userEvent.setup()
    const { router } = renderPage(VARIETY_ONE)

    const section = (await screen.findByRole('heading', { name: 'En el catálogo' })).closest('section')
    await user.click(within(section as HTMLElement).getByRole('button', { name: /Edit/ }))

    expect(router.state.location.state).toEqual({ form: 'catalog' })
  })

  test('turning the warning on opens the form and calls nothing', async () => {
    const user = userEvent.setup()
    const { router, fetchMock } = renderPage(VARIETY_ONE, {
      'GET /stock': () => json(200, stockOf({ ...STOCK_ROW, threshold: null, status: 'ok', grams: 90, days_left: 60 })),
    })

    await user.click(await screen.findByRole('switch'))

    expect(router.state.location.state).toEqual({ form: 'threshold' })
    expect(writes(fetchMock)).toEqual([])
  })

  test.each([
    ['an unknown form name', { form: 'bogus' }],
    ['a form that is not a string', { form: 7 }],
    ['a state with no form', { other: 'rename' }],
    ['a state that is not an object', 'rename'],
  ])('%s renders no form and no placeholder', async (_name, state) => {
    const { router } = renderPage(VARIETY_ONE)
    await screen.findByRole('heading', { name: 'Prices' })
    await act(() => router.navigate('.', { state }))

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    expect(screen.queryByText('Renombrar variedad')).not.toBeInTheDocument()
    expect(screen.queryByText(/Próximamente/)).not.toBeInTheDocument()
  })
})

describe('renaming from the page', () => {
  test('"Edit" next to the name pushes {form: "rename"} and shows the rename form', async () => {
    const user = userEvent.setup()
    const { router } = renderPage(VARIETY_ONE)

    await user.click(await screen.findByRole('button', { name: 'Editar nombre' }))

    expect(router.state.location.state).toEqual({ form: 'rename' })
    expect(await screen.findByText('Renombrar variedad')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('24K Gold')
  })

  test('"Close" goes back by history and the form is gone', async () => {
    const user = userEvent.setup()
    const { router } = renderPage(VARIETY_ONE)
    await user.click(await screen.findByRole('button', { name: 'Editar nombre' }))

    await user.click(await screen.findByRole('button', { name: 'Close' }))

    await waitFor(() => expect(router.state.location.state).toBeNull())
    expect(screen.queryByText('Renombrar variedad')).not.toBeInTheDocument()
  })

  test('Back closes the form', async () => {
    const user = userEvent.setup()
    const { router } = renderPage(VARIETY_ONE)
    await user.click(await screen.findByRole('button', { name: 'Editar nombre' }))
    await screen.findByText('Renombrar variedad')

    await act(() => router.navigate(-1))

    expect(screen.queryByText('Renombrar variedad')).not.toBeInTheDocument()
  })

  test('saving renames, closes the form and toasts "Variedad guardada"', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderPage(VARIETY_ONE, {
      'PATCH /varieties/1': () => json(200, { ...VARIETY_ROW, name: 'Gold' }),
    })
    await user.click(await screen.findByRole('button', { name: 'Editar nombre' }))
    const field = await screen.findByLabelText('Name')
    await user.clear(field)
    await user.type(field, 'Gold')
    await user.click(screen.getByRole('button', { name: 'Save the name' }))

    expect(await screen.findByText('Variedad guardada')).toBeInTheDocument()
    expect(screen.queryByText('Renombrar variedad')).not.toBeInTheDocument()
    expect(writes(fetchMock)).toEqual(['PATCH /varieties/1'])
  })

  test('leaving with a changed name asks first, and keeping stays on the form', async () => {
    const user = userEvent.setup()
    const { router } = renderPage(VARIETY_ONE)
    await user.click(await screen.findByRole('button', { name: 'Editar nombre' }))
    await user.type(await screen.findByLabelText('Name'), ' 2')

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(await screen.findByText('Discard the change?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'No, keep typing' }))
    expect(screen.getByLabelText('Name')).toHaveValue('24K Gold 2')
    expect(router.state.location.state).toEqual({ form: 'rename' })
  })

  test('discarding leaves the form without saving', async () => {
    const user = userEvent.setup()
    const { router, fetchMock } = renderPage(VARIETY_ONE)
    await user.click(await screen.findByRole('button', { name: 'Editar nombre' }))
    await user.type(await screen.findByLabelText('Name'), ' 2')
    await user.click(screen.getByRole('button', { name: 'Close' }))

    await user.click(await screen.findByRole('button', { name: 'Yes, discard it' }))

    await waitFor(() => expect(router.state.location.state).toBeNull())
    expect(writes(fetchMock)).toEqual([])
  })

  test('a name already taken is refused inline and keeps what was typed', async () => {
    const user = userEvent.setup()
    renderPage(VARIETY_ONE, { 'PATCH /varieties/1': () => json(409, { code: 'variety.name_taken' }) })
    await user.click(await screen.findByRole('button', { name: 'Editar nombre' }))
    const field = await screen.findByLabelText('Name')
    await user.clear(field)
    await user.type(field, 'Otra')
    await user.click(screen.getByRole('button', { name: 'Save the name' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe una variedad con ese nombre')
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Otra')
  })
})

describe('turning the warning off', () => {
  test('saves {grams: null}, keeps the switch on and disabled until the server answers, then flips and toasts', async () => {
    const user = userEvent.setup()
    let release: (response: Response) => void = () => undefined
    let stock = stockOf(STOCK_ROW)
    const { fetchMock } = renderPage(VARIETY_ONE, {
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

    expect(await screen.findByText('Warning off')).toBeInTheDocument()
    expect(screen.getByRole('switch')).not.toBeChecked()
    expect(screen.getByRole('switch')).toBeEnabled()
    expect(await screen.findByText('Aviso guardado')).toBeInTheDocument()
  })

  test('a refusal leaves the switch on and says so inline', async () => {
    const user = userEvent.setup()
    renderPage(VARIETY_ONE, {
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
    const { fetchMock } = renderPage(VARIETY_ONE)
    const base = fetchMock.getMockImplementation() as (u: string, i?: RequestInit) => Promise<Response>
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === 'PUT' ? Promise.reject(new TypeError('Failed to fetch')) : base(url, init),
    )

    await user.click(await screen.findByRole('switch'))

    expect(await screen.findByText(SIN_CONEXION_MENSAJE)).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeChecked()
  })
})

describe('Aviso de stock bajo: the form', () => {
  const OFF = { ...STOCK_ROW, threshold: null, status: 'ok', grams: 90, days_left: 60 }

  test('the section is read-only until "Edit" opens the form with the saved amount', async () => {
    const user = userEvent.setup()
    renderPage(VARIETY_ONE)

    const section = (await screen.findByRole('heading', { name: 'Aviso de stock bajo' })).closest('section') as HTMLElement
    expect(screen.queryByLabelText('Avisar con menos de')).not.toBeInTheDocument()
    await user.click(within(section).getByRole('button', { name: 'Editar aviso' }))

    expect(await screen.findByLabelText('Avisar con menos de')).toHaveValue('20')
    expect(screen.getByRole('button', { name: 'Guardá el aviso' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  test('turning the warning on opens an empty form, and closing it leaves the warning off', async () => {
    const user = userEvent.setup()
    const { router, fetchMock } = renderPage(VARIETY_ONE, { 'GET /stock': () => json(200, stockOf(OFF)) })

    await user.click(await screen.findByRole('switch'))
    expect(await screen.findByLabelText('Avisar con menos de')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(router.state.location.state).toBeNull())
    expect(screen.queryByLabelText('Avisar con menos de')).not.toBeInTheDocument()
    expect(screen.getByRole('switch')).not.toBeChecked()
    expect(screen.getByText('Warning off')).toBeInTheDocument()
    expect(writes(fetchMock)).toEqual([])
  })

  test('saving puts the typed grams, closes the form, toasts and asks stock and the catalog again', async () => {
    const user = userEvent.setup()
    let stock = stockOf(OFF)
    const { fetchMock } = renderPage(VARIETY_ONE, {
      'GET /stock': () => json(200, stock),
      'PUT /stock/varieties/1/threshold': () => {
        stock = stockOf({ ...STOCK_ROW, threshold: 15.5 })
        return json(200, { ...STOCK_ROW, threshold: 15.5 })
      },
    })
    await user.click(await screen.findByRole('switch'))
    await user.type(await screen.findByLabelText('Avisar con menos de'), '15,5')
    await user.click(screen.getByRole('button', { name: 'Guardá el aviso' }))

    expect(await screen.findByText('Aviso guardado')).toBeInTheDocument()
    expect(screen.queryByLabelText('Avisar con menos de')).not.toBeInTheDocument()
    expect(putOf(fetchMock)).toEqual({ url: '/stock/varieties/1/threshold', body: { grams: 15.5 } })
    await waitFor(() => expect(reads(fetchMock, 'GET /stock')).toBe(2))
    await waitFor(() => expect(reads(fetchMock, 'GET /catalog')).toBe(2))
    expect(await screen.findByRole('switch')).toBeChecked()
  })

  test('a refused amount shows under the field and keeps what was typed', async () => {
    const user = userEvent.setup()
    renderPage(VARIETY_ONE, { 'PUT /stock/varieties/1/threshold': () => json(422, { code: 'stock.threshold_invalid' }) })
    await user.click(await screen.findByRole('button', { name: 'Editar aviso' }))
    const field = await screen.findByLabelText('Avisar con menos de')
    await user.clear(field)
    await user.type(field, '5')
    await user.click(screen.getByRole('button', { name: 'Guardá el aviso' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Revisá el umbral cargado')
    expect(alert.closest('label')).toHaveTextContent('Avisar con menos de')
    expect(screen.getByLabelText(/^Avisar con menos de/)).toHaveValue('5')
  })

  test('text that is no amount is refused under the field without asking the server', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderPage(VARIETY_ONE)
    await user.click(await screen.findByRole('button', { name: 'Editar aviso' }))
    const field = await screen.findByLabelText('Avisar con menos de')
    await user.clear(field)
    await user.type(field, 'mucho')
    await user.click(screen.getByRole('button', { name: 'Guardá el aviso' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Revisá el umbral cargado')
    expect(writes(fetchMock)).toEqual([])
  })

  test('a variety that is gone while saving shows "That is gone."', async () => {
    const user = userEvent.setup()
    renderPage(VARIETY_ONE, { 'PUT /stock/varieties/1/threshold': () => json(404, { code: 'variety.not_found' }) })
    await user.click(await screen.findByRole('button', { name: 'Editar aviso' }))
    await user.type(await screen.findByLabelText('Avisar con menos de'), '1')
    await user.click(screen.getByRole('button', { name: 'Guardá el aviso' }))

    expect(await screen.findByText('That is gone.')).toBeInTheDocument()
  })

  test('Back closes the form', async () => {
    const user = userEvent.setup()
    const { router } = renderPage(VARIETY_ONE)
    await user.click(await screen.findByRole('button', { name: 'Editar aviso' }))
    await screen.findByLabelText('Avisar con menos de')

    await act(() => router.navigate(-1))

    expect(screen.queryByLabelText('Avisar con menos de')).not.toBeInTheDocument()
  })

  test('typed text is asked about before leaving; keeping stays, discarding closes', async () => {
    const user = userEvent.setup()
    const { router, fetchMock } = renderPage(VARIETY_ONE)
    await user.click(await screen.findByRole('button', { name: 'Editar aviso' }))
    await user.type(await screen.findByLabelText('Avisar con menos de'), '5')
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(await screen.findByText('Discard the change?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'No, keep typing' }))
    expect(screen.getByLabelText('Avisar con menos de')).toHaveValue('205')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.click(await screen.findByRole('button', { name: 'Yes, discard it' }))

    await waitFor(() => expect(router.state.location.state).toBeNull())
    expect(writes(fetchMock)).toEqual([])
  })

  test('closing an untouched form does not ask', async () => {
    const user = userEvent.setup()
    const { router } = renderPage(VARIETY_ONE)
    await user.click(await screen.findByRole('button', { name: 'Editar aviso' }))
    await user.click(await screen.findByRole('button', { name: 'Close' }))

    await waitFor(() => expect(router.state.location.state).toBeNull())
    expect(screen.queryByText('Discard the change?')).not.toBeInTheDocument()
  })

  test('a reload with the form open reopens it with the saved amount', async () => {
    renderPage(VARIETY_ONE, {}, { form: 'threshold' })

    expect(await screen.findByLabelText('Avisar con menos de')).toHaveValue('20')
  })
})

describe('En el catálogo: the form', () => {
  const section = async () =>
    (await screen.findByRole('heading', { name: 'En el catálogo' })).closest('section') as HTMLElement

  test('the section is read-only until "Edit" opens one form holding the four saved values', async () => {
    const user = userEvent.setup()
    renderPage(VARIETY_ONE)

    const before = await section()
    expect(screen.queryByLabelText('Emoji')).not.toBeInTheDocument()
    await user.click(within(before).getByRole('button', { name: 'Editar catálogo' }))

    expect(await screen.findByLabelText('Emoji')).toHaveValue('🍪')
    expect(screen.getByLabelText('% índica')).toHaveValue('70')
    expect(screen.getByLabelText('Aroma/sabor')).toHaveValue('Galletita y vainilla')
    expect(screen.getByRole('switch', { name: 'Mostrar en el catálogo' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Guardá el catálogo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  test('saving puts the four values, closes the form, toasts and asks the catalog again', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderPage(VARIETY_ONE, {
      'PUT /catalog/varieties/1': () => json(200, CATALOG),
    })
    await user.click(within(await section()).getByRole('button', { name: 'Editar catálogo' }))
    await user.click(screen.getByRole('switch', { name: 'Mostrar en el catálogo' }))
    const aroma = screen.getByLabelText('Aroma/sabor')
    await user.clear(aroma)
    await user.type(aroma, 'Cítrico')
    await user.clear(screen.getByLabelText('Emoji'))
    await user.click(screen.getByRole('button', { name: 'Guardá el catálogo' }))

    expect(await screen.findByText('Catálogo guardado')).toBeInTheDocument()
    expect(screen.queryByLabelText('Emoji')).not.toBeInTheDocument()
    expect(putOf(fetchMock)).toEqual({
      url: '/catalog/varieties/1',
      body: { shown: false, emoji: null, indica_share: 70, aroma: 'Cítrico' },
    })
    await waitFor(() => expect(reads(fetchMock, 'GET /catalog')).toBe(2))
  })

  test('a too-long aroma is refused under its own field and keeps everything typed', async () => {
    const user = userEvent.setup()
    renderPage(VARIETY_ONE, {
      'PUT /catalog/varieties/1': () => json(422, { code: 'catalog.aroma_too_long' }),
    })
    await user.click(within(await section()).getByRole('button', { name: 'Editar catálogo' }))
    await user.type(screen.getByLabelText('Emoji'), 'x')
    await user.clear(screen.getByLabelText('% índica'))
    await user.type(screen.getByLabelText('% índica'), '40')
    await user.type(screen.getByLabelText('Aroma/sabor'), ' larguísimo')
    await user.click(screen.getByRole('button', { name: 'Guardá el catálogo' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('El aroma es demasiado largo')
    expect(alert.closest('label')).toHaveTextContent('Aroma/sabor')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByLabelText(/^Aroma\/sabor/)).toHaveValue('Galletita y vainilla larguísimo')
    expect(screen.getByLabelText(/^Emoji/)).toHaveValue('🍪x')
    expect(screen.getByLabelText(/^% índica/)).toHaveValue('40')
  })

  test.each([
    ['catalog.emoji_invalid', 'Emoji', 'Poné exactamente un emoji'],
    ['catalog.indica_share_invalid', '% índica', 'El porcentaje de índica va de 0 a 100'],
  ])('%s is shown under %s only', async (code, label, message) => {
    const user = userEvent.setup()
    renderPage(VARIETY_ONE, { 'PUT /catalog/varieties/1': () => json(422, { code }) })
    await user.click(within(await section()).getByRole('button', { name: 'Editar catálogo' }))
    await user.type(screen.getByLabelText('Aroma/sabor'), '!')
    await user.click(screen.getByRole('button', { name: 'Guardá el catálogo' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(message)
    expect(alert.closest('label')).toHaveTextContent(label)
  })

  test('an index that is not whole digits is refused under its field without asking the server', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderPage(VARIETY_ONE)
    await user.click(within(await section()).getByRole('button', { name: 'Editar catálogo' }))
    await user.clear(screen.getByLabelText('% índica'))
    await user.type(screen.getByLabelText('% índica'), '7,5')
    await user.click(screen.getByRole('button', { name: 'Guardá el catálogo' }))

    const alert = await screen.findByRole('alert')
    expect(alert.closest('label')).toHaveTextContent('% índica')
    expect(writes(fetchMock)).toEqual([])
  })

  test('a variety that is gone while saving shows "That is gone."', async () => {
    const user = userEvent.setup()
    renderPage(VARIETY_ONE, { 'PUT /catalog/varieties/1': () => json(404, { code: 'catalog.variety_not_found' }) })
    await user.click(within(await section()).getByRole('button', { name: 'Editar catálogo' }))
    await user.click(screen.getByRole('button', { name: 'Guardá el catálogo' }))

    expect(await screen.findByText('That is gone.')).toBeInTheDocument()
  })

  test('Back closes the form', async () => {
    const user = userEvent.setup()
    const { router } = renderPage(VARIETY_ONE)
    await user.click(within(await section()).getByRole('button', { name: 'Editar catálogo' }))
    await screen.findByLabelText('Emoji')

    await act(() => router.navigate(-1))

    expect(screen.queryByLabelText('Emoji')).not.toBeInTheDocument()
  })

  test('typed text is asked about before leaving; keeping stays, discarding closes without saving', async () => {
    const user = userEvent.setup()
    const { router, fetchMock } = renderPage(VARIETY_ONE)
    await user.click(within(await section()).getByRole('button', { name: 'Editar catálogo' }))
    await user.type(screen.getByLabelText('Aroma/sabor'), ' y menta')
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(await screen.findByText('Discard the change?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'No, keep typing' }))
    expect(screen.getByLabelText('Aroma/sabor')).toHaveValue('Galletita y vainilla y menta')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.click(await screen.findByRole('button', { name: 'Yes, discard it' }))

    await waitFor(() => expect(router.state.location.state).toBeNull())
    expect(writes(fetchMock)).toEqual([])
  })

  test('closing an untouched form does not ask', async () => {
    const user = userEvent.setup()
    const { router } = renderPage(VARIETY_ONE)
    await user.click(within(await section()).getByRole('button', { name: 'Editar catálogo' }))
    await user.click(await screen.findByRole('button', { name: 'Close' }))

    await waitFor(() => expect(router.state.location.state).toBeNull())
    expect(screen.queryByText('Discard the change?')).not.toBeInTheDocument()
  })

  test('a reload with the form open reopens it with the saved values', async () => {
    renderPage(VARIETY_ONE, {}, { form: 'catalog' })

    expect(await screen.findByLabelText('Aroma/sabor')).toHaveValue('Galletita y vainilla')
    expect(screen.getByLabelText('Emoji')).toHaveValue('🍪')
  })

  test('the form never carries a maxLength: the length rule is the server\'s', async () => {
    renderPage(VARIETY_ONE, {}, { form: 'catalog' })
    await screen.findByLabelText('Aroma/sabor')

    for (const input of screen.getAllByRole('textbox')) expect(input).not.toHaveAttribute('maxLength')
  })
})
