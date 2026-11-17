/**
 * Test harness for the expense screens: the real data router (`createMemoryRouter`)
 * with the gated layout's flash provider and `Shell`, `Gastos` and the form route
 * mounted as `router.tsx` mounts them, `fetch` faked, and a stand-in for Analysis that holds
 * the real Expenses card (the phone's entry that opens the form).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { expect, vi } from 'vitest'
import type { Me } from '../../api/me'
import type { ShownLanguage } from '../../api/language'
import FlashProvider from '../../flash/FlashProvider'
import { ANALYSIS, EXPENSES, EXPENSE_NEW, relative } from '../../routes'
import Shell from '../../shell/Shell'
import Gastos from '../Gastos'
import ExpenseNewRoute from './ExpenseNewRoute'
import ExpensesCard from '../analisis/ExpensesCard'
import ContentArea from '../../components/ContentArea'
import { SheetRouterProvider } from '../../components/useSheetStack'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'

/** What the Analysis stand-in says, so a test can tell it is the screen the form went back to. */
export const ANALYSIS_SCREEN = 'Analysis screen'

export const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02', shown_language: 'en' as ShownLanguage, money: { symbol: '$', decimals: 0 } }

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>

/** Renders the app at `initialEntries` (the last one is current). */
export function renderExpenses(initialEntries: string[], fetchImpl: FetchImpl, me: Me = ME) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl))
  const router = createMemoryRouter(
    [
      {
        element: (
          <FlashProvider>
            <MoneyFormatProvider format={me.money}><Outlet context={me} /></MoneyFormatProvider>
          </FlashProvider>
        ),
        children: [
          {
            element: <Shell />,
            children: [
              {
                path: relative(ANALYSIS),
                handle: { screen: 'analysis' },
                element: (
                  <ContentArea as="main">
                    <span>{ANALYSIS_SCREEN}</span>
                    <ExpensesCard />
                  </ContentArea>
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
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )
  return router
}

/** The Category field's button, found by its name (the Selector's field). */
export async function categoryField(): Promise<HTMLElement> {
  return screen.findByRole('button', { name: /^Category/ })
}

/**
 * Chooses a Category the way a person does: opens the field, then picks the option, in the
 * computer's dropdown (`option`) or the phone's list (a button in the list).
 */
export async function chooseCategory(name: string): Promise<void> {
  await userEvent.click(await categoryField())
  const option = screen.queryByRole('option', { name }) ?? (await screen.findByRole('button', { name }))
  await userEvent.click(option)
  await waitFor(() => expect(option).not.toBeInTheDocument())
}
