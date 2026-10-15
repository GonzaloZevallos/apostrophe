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
import { router } from '../router'
import { SALE, SCREENS, pathTo } from '../routes'
import { HISTORY, SETTINGS_ON, VARIETY_ROW, jsonResponse } from '../screens/varieties/renderVarieties'
import Shell from '../shell/Shell'
import { CARDS_EXEMPT } from './backExempt'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }

afterEach(() => {
  vi.unstubAllGlobals()
})

/** The API faked at `fetch`: the session, and variety 1 with its prices; anything else is not found. */
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

test.each(cards.filter((card) => !exempt.has(card.id)).map((card) => [card.id, card.path] as const))(
  '%s: exactly one "‹ <parent>" and no "Volver"',
  async (_id, path) => {
    fakeApi()
    const memory = createMemoryRouter(router.routes, { initialEntries: [pathTo(path, { id: 1 })] })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SheetRouterProvider router={memory}>
          <RouterProvider router={memory} />
        </SheetRouterProvider>
      </QueryClientProvider>,
    )

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
                path: SALE,
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
    { initialEntries: [pathTo(SALE, { id: 1 })] },
  )
  render(<RouterProvider router={memory} />)

  await screen.findAllByRole('button', { name: /^‹ / })

  expect(backs()).toHaveLength(2)
})
