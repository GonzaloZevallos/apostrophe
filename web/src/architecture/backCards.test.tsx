/**
 * Guard 1 (GH-166): every `kind: 'card'` screen of the registry is rendered through the real
 * route table, `Shell` included, with the API faked at `fetch`, and shows exactly one control
 * named "‹ <parent>" and none named "Volver". The wait is `findAllByRole`, never a timer
 * (ADR-0038). `GoneScreen`'s "Volver a …" is not a back and is not counted.
 *
 * A card that is not rendered yet is in `CARDS_EXEMPT` with its reason; the list is a2's to empty,
 * and an entry whose card is no longer a card fails.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import Boton from '../components/Boton'
import { SheetRouterProvider } from '../components/useSheetStack'
import WITHDRAWAL from '../api/fixtures/withdrawal.json'
import { router } from '../router'
import { SALE as SALE_PATH, SCREENS, pathTo, type ScreenId } from '../routes'
import { HISTORY, SETTINGS_ON, VARIETY_ROW, jsonResponse } from '../screens/varieties/renderVarieties'
import Shell from '../shell/Shell'
import { CARDS_EXEMPT } from './backExempt'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }

afterEach(() => {
  vi.unstubAllGlobals()
})

const SALE = {
  id: 1,
  date: '2026-10-01',
  customer: null,
  shipping_charged: 0,
  note: null,
  payment: 'cash',
  total: 11000,
  still_owing: false,
  total_grams: 1,
  lines: [
    {
      variety_id: 1,
      variety_name: '24K Gold',
      grams: 1,
      pricing_rule: 'list',
      price_per_gram: 11000,
      line_total: 11000,
      cost: { costed: 5000, pending_grams: 0 },
    },
  ],
}

const CUSTOMER = {
  id: 1,
  name: 'Ana Pérez',
  phone: null,
  channel: null,
  vip: false,
  balance: 0,
  owing_since: null,
  standing: 'settled',
}

const ACCOUNT = { balance: 0, owing_since: null, standing: 'settled', rows: [] }

/** What only a card's loaded screen shows, awaited before its backs are counted, so a card
 * left in its not-found state (`GoneScreen`) cannot pass for the real one. */
const LOADED: Partial<Record<ScreenId, string>> = {
  sale: 'Líneas',
  customer: 'Ana Pérez',
  settings: 'Configuración',
  variety: '24K Gold',
  'variety-prices': 'Precios',
  'variety-entries': 'Entradas',
  stock: 'Todas las entradas',
  catalog: 'Sir Jack',
  'varieties-archived': 'Archivada',
  withdrawal: 'Zkittlez',
}

const CATALOG = {
  text: '**24K Gold**',
  header: '',
  footer: '',
  varieties: [{ id: 2, name: 'Sir Jack', emoji: '👑', indica_share: null, aroma: null, shown: false, state: 'hidden' }],
}

const STOCK = {
  total: 18,
  varieties: [{ variety_id: 1, grams: 18, status: 'ok', sold_out_since: null, threshold: null, days_left: null }],
  entries: [],
}

const ARCHIVED = { ...VARIETY_ROW, id: 2, name: 'Sir Jack', archived: true }

/** The API faked at `fetch`: the session, a sale, a customer and variety 1 with its prices;
 * anything else is not found. */
function fakeApi(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url}`
      const answers: Record<string, unknown> = {
        'GET /auth/me': ME,
        'GET /pricing-settings': SETTINGS_ON,
        'GET /varieties/1': VARIETY_ROW,
        'GET /varieties/1/prices': HISTORY,
        'GET /sales/1': SALE,
        'GET /customers/1': CUSTOMER,
        'GET /customers/1/account': ACCOUNT,
        'GET /stock': STOCK,
        'GET /stock?archived=true': STOCK,
        'GET /stock/varieties/1/movements': [],
        'GET /stock/withdrawals/1': WITHDRAWAL,
        'GET /varieties': [VARIETY_ROW],
        'GET /varieties?archived=true': [ARCHIVED],
        'GET /catalog': CATALOG,
        'GET /catalog/archived': [],
      }
      return Promise.resolve(key in answers ? jsonResponse(200, answers[key]) : jsonResponse(404, { detail: 'No existe' }))
    }),
  )
}

const cards = SCREENS.filter((entry) => entry.kind === 'card')
const exempt = new Set<string>(CARDS_EXEMPT.map((entry) => entry.id))

function backs(): HTMLElement[] {
  return [...screen.queryAllByRole('button', { name: /^‹ / }), ...screen.queryAllByRole('link', { name: /^‹ / })]
}

test('the exemption list names only cards, each with a reason', () => {
  for (const entry of CARDS_EXEMPT) {
    expect(cards.map((card) => card.id), entry.id).toContain(entry.id)
    expect(entry.reason.length).toBeGreaterThan(0)
  }
})

test('every card that is rendered says what its loaded screen shows', () => {
  const rendered = cards.filter((card) => !exempt.has(card.id)).map((card) => card.id)
  expect(Object.keys(LOADED).sort()).toEqual([...rendered].sort())
})

test.each(cards.filter((card) => !exempt.has(card.id)).map((card) => [card.id, card.path] as const))(
  '%s: exactly one "‹ <parent>" and no "Volver"',
  async (id, path) => {
    fakeApi()
    const memory = createMemoryRouter(router.routes, { initialEntries: [pathTo(path, { id: 1 })] })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SheetRouterProvider router={memory}>
          <RouterProvider router={memory} />
        </SheetRouterProvider>
      </QueryClientProvider>,
    )

    expect((await screen.findAllByText(LOADED[id] ?? '')).length).toBeGreaterThan(0)
    await screen.findAllByRole('button', { name: /^‹ / })

    expect(backs()).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Volver' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Volver' })).not.toBeInTheDocument()
  },
)

test('the count catches a card that draws its own back next to the shell\'s', async () => {
  const memory = createMemoryRouter(
    [
      {
        element: <Outlet context={ME} />,
        children: [
          {
            element: <Shell />,
            children: [
              {
                path: SALE_PATH,
                handle: { screen: 'sale' },
                element: (
                  <Boton variant="back" onClick={() => undefined}>
                    ‹ Ventas
                  </Boton>
                ),
              },
            ],
          },
        ],
      },
    ],
    { initialEntries: [pathTo(SALE_PATH, { id: 1 })] },
  )
  render(<RouterProvider router={memory} />)

  await screen.findAllByRole('button', { name: /^‹ / })

  expect(backs()).toHaveLength(2)
})
