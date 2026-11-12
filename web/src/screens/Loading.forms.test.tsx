/**
 * The forms that wait on a list before they can draw their fields, with the answer held: the sheet
 * body (the content area on a phone) carries `aria-busy="true"` while it waits and loses it once
 * the answer arrives (CODING_STANDARDS §10 item 7). The new expense waits on its categories; the
 * new customer waits on the pricing settings, then on the customer types when that switch is on.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { SheetRouterProvider } from '../components/useSheetStack'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { router as appRouter } from '../router'
import { CUSTOMER_NEW, EXPENSE_NEW } from '../routes'
import { renderWithViewport, stubViewport } from '../test-viewport'
import { type FetchImpl, jsonResponse, renderExpenses } from './expenses/renderExpenses'

const ME = { email: 'a@b.com', business_name: 'Business', today: '2026-10-03', shown_language: 'en', money: { symbol: '$', decimals: 0 } }

let release: () => void
let gate: Promise<void>

beforeEach(() => {
  gate = new Promise<void>((resolve) => {
    release = resolve
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the new expense', () => {
  test('the sheet is busy while the categories are on their way, and clear once they answer', async () => {
    stubViewport('phone')
    const api: FetchImpl = async (url) => {
      if (url.startsWith('/expense-categories')) {
        await gate
        return jsonResponse(200, [{ id: 1, name: 'Packaging' }])
      }
      return jsonResponse(404, {})
    }
    renderExpenses([EXPENSE_NEW], api)

    const dialog = await screen.findByRole('dialog', { name: 'Add expense' })
    expect(dialog).toHaveAttribute('aria-busy', 'true')
    release()
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Add expense' })).not.toHaveAttribute('aria-busy'))
  })
})

describe('the new customer', () => {
  function renderCustomerNew(pricing: unknown, pricingHeld: boolean) {
    const table: Record<string, () => Response | Promise<Response>> = {
      'GET /auth/me': () => jsonResponse(200, ME),
      'GET /pricing-settings': () => (pricingHeld ? gate : Promise.resolve()).then(() => jsonResponse(200, pricing)),
      'GET /api/customer-types': () => gate.then(() => jsonResponse(200, [])),
    }
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        const answer = table[`${init?.method ?? 'GET'} ${url}`]
        return Promise.resolve(answer === undefined ? jsonResponse(404, {}) : answer())
      }),
    )
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(appRouter.routes, { initialEntries: [CUSTOMER_NEW] })
    renderWithViewport('phone', () =>
      render(
        <QueryClientProvider client={queryClient}>
          <SheetRouterProvider router={router}>
            <RouterProvider router={router} />
          </SheetRouterProvider>
        </QueryClientProvider>,
      ),
    )
  }

  const form = () => screen.getByRole('dialog', { name: 'New customer' })

  test('the sheet is busy until the pricing settings answer, and clear when the field stays off', async () => {
    renderCustomerNew({ is_bulk_pricing: false, is_vip_customers: false }, true)

    expect(await screen.findByRole('dialog', { name: 'New customer' })).toHaveAttribute('aria-busy', 'true')
    release()
    await waitFor(() => expect(form()).not.toHaveAttribute('aria-busy'))
  })

  test('with Clientes VIP on, the sheet is busy while the customer types are on their way', async () => {
    renderCustomerNew({ is_bulk_pricing: false, is_vip_customers: true }, false)

    expect(await screen.findByRole('dialog', { name: 'New customer' })).toHaveAttribute('aria-busy', 'true')
    release()
    await waitFor(() => expect(form()).not.toHaveAttribute('aria-busy'))
  })
})
