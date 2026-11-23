/**
 * Settings navigation on the real router (`App` with `fetch` faked): Expense categories lives
 * only in Payments and expenses, as its second row, and a Settings group's "Close" with nothing
 * in history goes to the group's own parent in the route list, never to a fixed screen.
 */

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import App from '../../App'
import { queryClient } from '../../queryClient'
import { router } from '../../router'
import {
  EXPENSE_CATEGORIES,
  HOME,
  SETTINGS,
  SETTINGS_CUSTOMER_TYPES,
  SETTINGS_PAYMENTS,
  SETTINGS_PAYMENT_METHODS,
  SETTINGS_PAYMENT_METHODS_ARCHIVED,
  SETTINGS_PRICES,
} from '../../routes'
import { stubViewport } from '../../test-viewport'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02', money: { symbol: '$', decimals: 0 } }

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function serve() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const path = String(input)
      if (path.includes('/auth/me')) return Promise.resolve(json(ME))
      return Promise.resolve(json([]))
    }),
  )
}

async function open(path: string) {
  serve()
  stubViewport('phone')
  await act(() => router.navigate(path))
  render(<App />)
  await screen.findByRole('main')
}

afterEach(async () => {
  cleanup()
  vi.unstubAllGlobals()
  queryClient.clear()
  await act(() => router.navigate(HOME))
})

test('the Settings list has no Expense categories row', async () => {
  await open(SETTINGS)

  const list = await screen.findByRole('navigation', { name: 'Settings' })
  expect(within(list).getByRole('link', { name: 'Payments and expenses' })).toBeInTheDocument()
  expect(within(list).queryByRole('link', { name: 'Expense categories' })).not.toBeInTheDocument()
})

test('Payments and expenses lists Payment methods, then Expense categories, and the second opens its screen', async () => {
  await open(SETTINGS_PAYMENTS)

  const group = await screen.findByRole('navigation', { name: 'Payments and expenses' })
  const links = within(group).getAllByRole('link')
  expect(links.map((link) => link.textContent)).toEqual([expect.stringContaining('Payment methods'), expect.stringContaining('Expense categories')])

  await userEvent.click(within(group).getByRole('link', { name: /^Expense categories/ }))

  await waitFor(() => expect(router.state.location.pathname).toBe(EXPENSE_CATEGORIES))
})

test('Close on Expense categories, opened with nothing in history, lands on Payments and expenses', async () => {
  await open(EXPENSE_CATEGORIES)

  await userEvent.click(await screen.findByRole('button', { name: 'Close' }))

  await waitFor(() => expect(router.state.location.pathname).toBe(SETTINGS_PAYMENTS))
})

test('Close on Expense categories, opened from the group, goes back through history to the group', async () => {
  await open(SETTINGS_PAYMENTS)
  const group = await screen.findByRole('navigation', { name: 'Payments and expenses' })
  await userEvent.click(within(group).getByRole('link', { name: /^Expense categories/ }))
  await waitFor(() => expect(router.state.location.pathname).toBe(EXPENSE_CATEGORIES))

  await userEvent.click(await screen.findByRole('button', { name: 'Close' }))

  await waitFor(() => expect(router.state.location.pathname).toBe(SETTINGS_PAYMENTS))
})

test('Close on Customer types, with nothing in history, lands on Prices', async () => {
  await open(SETTINGS_CUSTOMER_TYPES)

  await userEvent.click(await screen.findByRole('button', { name: 'Close' }))

  await waitFor(() => expect(router.state.location.pathname).toBe(SETTINGS_PRICES))
})

test('Close on Archived payment methods, with nothing in history, lands on Payment methods', async () => {
  await open(SETTINGS_PAYMENT_METHODS_ARCHIVED)

  await userEvent.click(await screen.findByRole('button', { name: 'Close' }))

  await waitFor(() => expect(router.state.location.pathname).toBe(SETTINGS_PAYMENT_METHODS))
})
