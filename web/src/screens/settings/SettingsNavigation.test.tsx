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
import { testT } from '../../i18n/testing'
import {
  EXPENSE_CATEGORIES,
  HOME,
  SETTINGS,
  SETTINGS_CUSTOMER_TYPES,
  SETTINGS_PAYMENTS,
  SETTINGS_PAYMENT_METHODS,
  SETTINGS_PAYMENT_METHODS_ARCHIVED,
  SETTINGS_PRICES,
  type Viewport,
} from '../../routes'
import { stubViewport } from '../../test-viewport'
import { isSettingsSearchState } from './useSettingsSearchEntry'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02', money: { symbol: '$', decimals: 0 } }

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

const BUSINESS = { users: [{ email: 'u0@x.com' }], selectable_languages: ['en'] }
const PRICING = { is_bulk_pricing: false, is_vip_customers: false }

function serve() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const path = String(input)
      if (path.includes('/auth/me')) return Promise.resolve(json(ME))
      if (path.includes('/pricing-settings')) return Promise.resolve(json(PRICING))
      if (path.includes('/business')) return Promise.resolve(json(BUSINESS))
      return Promise.resolve(json([]))
    }),
  )
}

async function open(path: string, viewport: Viewport = 'phone') {
  serve()
  stubViewport(viewport)
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

test("the computer's Settings list has no Expense categories row", async () => {
  await open(SETTINGS, 'computer')

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

const SEARCH_LABEL = testT('settings:search.label')
const CANCEL = testT('common:cancel')

function field(): HTMLElement {
  return screen.getByRole('searchbox', { name: SEARCH_LABEL })
}

async function groupsAreShown(): Promise<void> {
  await screen.findByRole('heading', { level: 2, name: testT('settings:groups.business') })
  expect(screen.queryByRole('button', { name: CANCEL })).not.toBeInTheDocument()
}

test('a tap on the search field and then typing push one history entry', async () => {
  await open(SETTINGS)
  const before = window.history.length

  await userEvent.click(field())
  await userEvent.type(field(), 'pay')

  expect(window.history.length).toBe(before + 1)
  expect(await screen.findByRole('button', { name: CANCEL })).toBeInTheDocument()
})

test('Cancel and back each return to the groups with search closed', async () => {
  await open(SETTINGS)

  await userEvent.type(field(), 'pay')
  await userEvent.click(await screen.findByRole('button', { name: CANCEL }))
  await groupsAreShown()
  expect(field()).toHaveValue('')

  await userEvent.type(field(), 'pay')
  await screen.findByRole('button', { name: CANCEL })
  await act(() => router.navigate(-1))
  await groupsAreShown()
  expect(field()).toHaveValue('')
})

test('a result opens its page with enteredFrom settings, and back lands on the groups with search closed', async () => {
  await open(SETTINGS)
  const before = window.history.length

  await userEvent.type(field(), 'pay')
  await userEvent.click(await screen.findByRole('link', { name: /^Payment methods/ }))

  await waitFor(() => expect(router.state.location.pathname).toBe(SETTINGS_PAYMENT_METHODS))
  expect(router.state.location.state).toMatchObject({ enteredFrom: 'settings' })
  expect(window.history.length).toBe(before + 1)

  await act(() => router.navigate(-1))
  await groupsAreShown()
  expect(router.state.location.pathname).toBe(SETTINGS)
  expect(field()).toHaveValue('')
})

test('a reload on a search entry shows the groups', async () => {
  serve()
  stubViewport('phone')
  await act(() => router.navigate(SETTINGS, { state: { settingsSearch: true } }))
  expect(isSettingsSearchState(router.state.location.state)).toBe(true)
  render(<App />)
  await screen.findByRole('main')

  await waitFor(() => expect(isSettingsSearchState(router.state.location.state)).toBe(false))
  await groupsAreShown()
})
