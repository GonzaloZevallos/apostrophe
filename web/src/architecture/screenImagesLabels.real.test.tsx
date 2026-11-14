/**
 * The real `scripts/design/screens.json`, row by row: every `fill` and `select` label of a row
 * must name exactly one control on that row's screen, rendered fresh in its own `it` with the API
 * faked at `fetch` (`judgeLabel`'s rule; the capture in `scripts/design/comparisons.mjs`, exact
 * and strict, is the final proof). The table is closed: a row with a fill or select and no entry
 * fails by name, and an entry for a row with none fails too. There is no allowlist and no skip.
 *
 * Every entry renders its screen through a router at the row's route: the Entrar and Nueva venta
 * rows through the app's own router (`App`, `router.tsx`), the two onboarding rows through the
 * onboarding routes as `onboarding/Steps.test.tsx` builds them. No entry is `formOnly`: none
 * needed a form rendered alone.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider, type RouteObject } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadBundle } from '../../scripts/i18n/loadBundle.ts'
import type { Me } from '../api/me'
import type { OnboardingProgress, StepSlug, StepState } from '../api/onboarding'
import App from '../App'
import { SheetRouterProvider } from '../components/useSheetStack'
import { MoneyFormatProvider } from '../format/MoneyFormatProvider'
import { parseRegistry, STATE_NAMES } from '../mobile-standard/registry'
import registryJson from '../../../scripts/design/screens.json' with { type: 'json' }
import { queryClient } from '../queryClient'
import { router } from '../router'
import { HOME, LOGIN, ONBOARDING_STOCK, ONBOARDING_VARIETY, SALE_NEW } from '../routes'
import Listo from '../screens/onboarding/Listo'
import OnboardingLayout from '../screens/onboarding/OnboardingLayout'
import { OnboardingEntry, OnboardingStepRoute } from '../screens/onboarding/OnboardingRoutes'
import { productField } from '../screens/ventas/lineProduct'
import { SHOWN_EN } from '../test/shownLanguage'
import { withPaymentMethods } from '../test-payment-methods'
import { judgeLabel, rowLabels, rowsWithoutEntry } from './screenImagesLabels'

const ROWS = parseRegistry(registryJson, STATE_NAMES)
const LABELS = rowLabels(ROWS, loadBundle('en'))

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const ME: Me = {
  email: 'ana@x.com',
  business_name: 'La Huerta',
  today: '2026-10-02',
  shown_language: SHOWN_EN,
  money: { symbol: '$', decimals: 0 },
}

// ---- the app's own router: Entrar, Nueva venta ----

async function renderEntrar(): Promise<void> {
  vi.stubGlobal('fetch', vi.fn())
  await act(() => router.navigate(LOGIN))
  render(<App />)
  await screen.findByRole('button', { name: 'Sign in' })
}

async function renderNuevaVenta(): Promise<void> {
  const rosa = {
    id: 1,
    name: 'Sir Jack',
    current_price: { id: 9, effective_from: '2026-09-01', list_price: 1000, bulk_price: null, bulk_minimum: null },
  }
  const answers = vi.fn((path: string) => {
    if (path === '/auth/me') return Promise.resolve(json(ME))
    if (path === `/api/products?on=${ME.today}`) return Promise.resolve(json([rosa]))
    return Promise.reject(new Error(`unexpected request: ${path}`))
  })
  vi.stubGlobal('fetch', withPaymentMethods(answers))
  await act(() => router.navigate(SALE_NEW))
  render(<App />)
  await screen.findByText('New sale')
  await waitFor(() => expect(productField(1)).toBeEnabled())
}

// ---- the onboarding routes: the capture's two onboarding rows ----

const ORDER: StepSlug[] = ['variety', 'stock', 'header_footer', 'bot', 'partner', 'categories']
const MANGO = { id: 7, name: 'Mango Bomb' }

/** A Business with one Product and no price yet; `stock_target` aims step 2 at it. */
function progress(stockTarget: boolean): OnboardingProgress {
  const states: StepState[] = stockTarget ? ['done'] : []
  return {
    offered: true,
    over: false,
    count: states.length,
    resume: stockTarget ? 'stock' : 'variety',
    steps: ORDER.map((step, index) => ({ step, state: states[index] ?? 'pending' })),
    can_skip_rest: false,
    products_count: 1,
    stock_entries_count: 0,
    price_target: null,
    priced_target: null,
    stock_target: stockTarget ? MANGO : null,
  }
}

async function renderOnboarding(path: string, stockTarget: boolean): Promise<void> {
  const answers: Record<string, unknown> = {
    'GET /onboarding-progress': progress(stockTarget),
    // Bulk price on: the capture's row types into it.
    'GET /pricing-settings': { is_bulk_pricing: true, is_vip_customers: false },
    'GET /api/products': [{ id: 7, name: 'Mango Bomb', current_price: null }],
    'GET /stock': { total: 0, products: [], entries: [] },
  }
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const answer = answers[`${init?.method ?? 'GET'} ${String(input)}`]
      return Promise.resolve(answer === undefined ? json({}, 404) : json(answer))
    }),
  )
  const slugPaths: Record<'variety' | 'stock', string> = { variety: 'variety', stock: 'stock' }
  const routes: RouteObject[] = [
    {
      element: (
        <MoneyFormatProvider format={ME.money}>
          <Outlet context={ME} />
        </MoneyFormatProvider>
      ),
      children: [
        { index: true, element: <span>home</span> },
        {
          path: 'onboarding',
          element: <OnboardingLayout />,
          children: [
            { index: true, element: <OnboardingEntry /> },
            ...(['variety', 'stock'] as const).map((slug) => ({
              path: slugPaths[slug],
              element: <OnboardingStepRoute slug={slug} />,
            })),
            { path: 'done', element: <Listo /> },
          ],
        },
      ],
    },
  ]
  const memory = createMemoryRouter(routes, { initialEntries: [HOME, path], initialIndex: 1 })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SheetRouterProvider router={memory}>
        <RouterProvider router={memory} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )
  await screen.findByRole('button', { name: /^(Save the product|Save the entry)$/ })
}

/** One entry per row with a `fill` or `select`, keyed by the row's `screen`: how that row's screen is rendered. */
const ENTRIES: Record<string, () => Promise<void>> = {
  Entrar: renderEntrar,
  EntrarOscuro: renderEntrar,
  VentaGuardada: renderNuevaVenta,
  VentaGuardadaOscuro: renderNuevaVenta,
  OnboardingVariedad: () => renderOnboarding(ONBOARDING_STOCK, true),
  OnboardingPrecio: () => renderOnboarding(ONBOARDING_VARIETY, false),
}

afterEach(async () => {
  vi.unstubAllGlobals()
  queryClient.clear()
  await act(() => router.navigate(HOME))
})

describe('every fill and select label of scripts/design/screens.json', () => {
  it('has a row with a label, so the walk is not vacuous', () => {
    expect(LABELS.length).toBeGreaterThan(0)
  })

  it('has a render entry for each row that has one, and no entry for a row that has none', () => {
    expect(rowsWithoutEntry(LABELS, Object.keys(ENTRIES))).toEqual([])
    const rowsWithLabels = new Set(LABELS.map((found) => found.screen))
    expect(Object.keys(ENTRIES).filter((screenName) => !rowsWithLabels.has(screenName))).toEqual([])
  })

  const screens = [...new Set(LABELS.map((found) => found.screen))]
  it.each(screens)('%s: names exactly one control on its rendered screen, with the whole text', async (screenName) => {
    const render_ = ENTRIES[screenName]
    if (render_ === undefined) throw new Error(`${screenName}: has a fill or select and no render entry`)
    await render_()
    const problems = LABELS.filter((found) => found.screen === screenName).flatMap((found) => {
      const verdict = judgeLabel(document.body, found.label)
      return verdict.problem === null ? [] : [`${found.screen} step ${found.step} ${found.kind}: ${verdict.problem}`]
    })
    expect(problems).toEqual([])
  })
})
