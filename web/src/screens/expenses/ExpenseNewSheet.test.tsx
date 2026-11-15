/**
 * `ExpenseNewSheet` at the route seam (plan, subtask `expense-new-sheet`): the route hosts it, so
 * it is rendered through the real router. The sheet takes its blocker from the host and calls no
 * leave guard of its own: with the Category list open and then the form left, no second blocker
 * may warn or error. The words are literal English, so this file imports no copy module.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import { EXPENSE_NEW, ANALYSIS } from '../../routes'
import { stubViewport } from '../../test-viewport'
import ExpenseNewSheet from './ExpenseNewSheet'
import { type FetchImpl, ANALYSIS_SCREEN, ME, categoryField, jsonResponse, renderExpenses } from './renderExpenses'

const api: FetchImpl = async (url, init) => {
  const method = init?.method ?? 'GET'
  if (url.startsWith('/expense-categories') && method === 'GET') {
    return jsonResponse(200, [{ id: 1, name: 'Packaging' }])
  }
  throw new Error(`unexpected ${method} ${url}`)
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('typing, opening the list, backing out of it and then out of the form raises no warning or error and asks once', async () => {
  stubViewport('phone')
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const router = renderExpenses([ANALYSIS, EXPENSE_NEW], api)

  await userEvent.type(await screen.findByLabelText('Details'), 'Cinta')
  await userEvent.click(await categoryField())
  await screen.findByRole('dialog', { name: 'Category options' })

  await act(() => router.navigate(-1))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Category options' })).toBeNull())
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

  await act(() => router.navigate(-1))
  const question = await screen.findByRole('alertdialog')
  expect(question).toHaveTextContent('Discard the expense?')
  expect(router.state.location.pathname).toBe(EXPENSE_NEW)

  await userEvent.click(screen.getByRole('button', { name: 'Yes, discard it' }))
  expect(await screen.findByText(ANALYSIS_SCREEN)).toBeInTheDocument()

  expect(warn).not.toHaveBeenCalled()
  expect(error).not.toHaveBeenCalled()
})

test('a leaveConfirm node is drawn in the aside, beside the dialog and not inside it', async () => {
  stubViewport('phone')
  vi.stubGlobal('fetch', vi.fn(api))
  const router = createMemoryRouter(
    [
      {
        element: <Outlet context={ME} />,
        children: [
          {
            path: '/',
            element: (
              <ExpenseNewSheet
                computer={false}
                leaveConfirm={<div role="alertdialog" aria-label="Probe" />}
                onClose={() => undefined}
                onSaved={() => undefined}
                onDirtyChange={() => undefined}
              />
            ),
          },
        ],
      },
    ],
    { initialEntries: ['/'] },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MoneyFormatProvider format={{ symbol: '$', decimals: 0 }}>
        <RouterProvider router={router} />
      </MoneyFormatProvider>
    </QueryClientProvider>,
  )

  const dialog = await screen.findByRole('dialog', { name: 'Add expense' })
  expect(screen.getByRole('alertdialog', { name: 'Probe' })).toBeInTheDocument()
  expect(within(dialog).queryByRole('alertdialog', { name: 'Probe' })).not.toBeInTheDocument()
})
