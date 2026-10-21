/**
 * Test harness for the expense screens: the real data router (`createMemoryRouter`)
 * with the gated layout's flash provider and `Shell`, `Gastos` and the form route
 * mounted as `router.tsx` mounts them, `fetch` faked, and a stand-in for Más (the
 * screen that opens the form in the app, built by another subtask).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import InAppLink from '../../components/InAppLink'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { vi } from 'vitest'
import type { Me } from '../../api/me'
import FlashProvider from '../../flash/FlashProvider'
import { EXPENSES, EXPENSE_NEW, MORE, relative } from '../../routes'
import Shell from '../../shell/Shell'
import Gastos from '../Gastos'
import ExpenseNewRoute from './ExpenseNewRoute'
import { EXPENSES_TEXT } from '../../copy/expenses'

export const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>

/** Renders the app at `initialEntries` (the last one is current). */
export function renderExpenses(initialEntries: string[], fetchImpl: FetchImpl) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl))
  const router = createMemoryRouter(
    [
      {
        element: (
          <FlashProvider>
            <Outlet context={ME} />
          </FlashProvider>
        ),
        children: [
          {
            element: <Shell />,
            children: [
              {
                path: relative(MORE),
                handle: { screen: 'more' },
                element: (
                  <main>
                    <span>{EXPENSES_TEXT.moreScreen}</span>
                    <InAppLink to={EXPENSE_NEW}>
                      {EXPENSES_TEXT.addExpenseFromMore}
                    </InAppLink>
                  </main>
                ),
              },
              { path: relative(EXPENSES), element: <Gastos />, handle: { screen: 'expenses' } },
              {
                path: relative(EXPENSE_NEW),
                element: <ExpenseNewRoute />,
                handle: { screen: 'expense-new' },
              },
            ],
          },
        ],
      },
    ],
    { initialEntries, initialIndex: initialEntries.length - 1 },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}
