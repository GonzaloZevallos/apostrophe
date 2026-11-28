/**
 * `SettingsLayout` through the real route table (`App` over `router.tsx`, `fetch` faked): at 900 px
 * and up the Settings list stands beside the open page and marks its row (`activeSettingsRow`); the
 * pane tells a page entered from the list to drop its Close; the phone keeps its pages as they
 * were. The route tree never branches on width, so a value typed in a page survives crossing 900.
 */

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import App from '../../App'
import { queryClient } from '../../queryClient'
import { router } from '../../router'
import {
  EXPENSE_CATEGORIES,
  EXPENSES,
  HOME,
  SCREENS,
  SETTINGS,
  SETTINGS_BUSINESS,
  SETTINGS_CUSTOMER_TYPES,
  SETTINGS_PAYMENT_METHODS_ARCHIVED,
  SETTINGS_PRICES,
  type Viewport,
} from '../../routes'
import { flipViewport, stubViewport } from '../../test-viewport'
import { testT } from '../../i18n/testing'
import { SETTINGS_ROWS, type SettingsRow } from './settingsRows'

function nameOf(row: SettingsRow): string {
  return `${testT(row.labelKey)} ${testT(row.descriptionKey)}`
}

const PRICES_ROW = ((): SettingsRow => {
  const found = SETTINGS_ROWS.find((row) => row.labelKey === 'settings:rows.prices.label')
  if (found === undefined) throw new Error('no prices row')
  return found
})()

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02', money: { symbol: '$', decimals: 0 } }
const BUSINESS = { name: 'La Huerta', language: 'en', selectable_languages: ['en'], users: [{ email: 'ana@x.com' }] }

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function serve(customerTypesOn = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/auth/me')) return Promise.resolve(json(ME))
      if (url.includes('/business')) return Promise.resolve(json(BUSINESS))
      if (url.includes('/pricing-settings')) {
        return Promise.resolve(json({ is_vip_customers: customerTypesOn, is_bulk_pricing: true }))
      }
      if (url.includes('/expenses')) return Promise.resolve(json({ categories: [], total: 0 }))
      if (url.endsWith('/pinned-catalog')) {
        return Promise.resolve(json({ token_saved_on: null, own_chat: null, channel_chat: null, can_publish: false, publish_blocked_by: 'not_tested', status: null }))
      }
      return Promise.resolve(json([]))
    }),
  )
}

async function open(path: string, viewport: Viewport = 'computer', customerTypesOn = true) {
  serve(customerTypesOn)
  stubViewport(viewport)
  await act(() => router.navigate(path))
  render(<App />)
  await screen.findByRole('main')
}

function marked(): HTMLElement[] {
  // The shell's own rail marks the Settings screen too: only the list's rows count here.
  return screen.queryAllByRole('link', { current: 'page' }).filter((link) => link.closest('nav') === null)
}

afterEach(async () => {
  cleanup()
  vi.unstubAllGlobals()
  queryClient.clear()
  await act(() => router.navigate(HOME))
})

const PAGES = SCREENS.filter((entry) => entry.path.startsWith(`${SETTINGS}/`))

test.each(PAGES.flatMap((entry) => (['phone', 'computer'] as const).map((viewport) => [entry.path, viewport] as const)))(
  '%s shows its title under one main at the %s width',
  async (path, viewport) => {
    await open(path, viewport)
    const entry = SCREENS.find((candidate) => candidate.path === path)
    if (entry === undefined) throw new Error(`no screen ${path}`)
    const main = await screen.findByRole('main')
    await waitFor(() => expect(within(main).getAllByText(testT(entry.titleKey)).length).toBeGreaterThan(0))
    expect(screen.getAllByRole('main')).toHaveLength(1)
  },
)

test.each(SETTINGS_ROWS.filter((row) => row.key !== 'language'))(
  'the $key row, clicked at 900 px, opens its page beside the list with only itself marked',
  async (row) => {
    await open(SETTINGS)
    await userEvent.click(await screen.findByRole('link', { name: nameOf(row) }))

    await waitFor(() => expect(marked()).toHaveLength(1))
    expect(marked()[0]).toHaveTextContent(testT(row.labelKey))
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getByRole('link', { name: /^Business name/ })).toBeInTheDocument()
  },
)

test('Settings with nothing chosen shows the prompt, no row is marked and there is one main', async () => {
  await open(SETTINGS)

  expect(await screen.findByText('Choose a setting')).toBeInTheDocument()
  await screen.findByRole('link', { name: /^Business name/ })
  expect(marked()).toHaveLength(0)
  expect(screen.getAllByRole('main')).toHaveLength(1)
})

test('a page chosen from the list has no Close', async () => {
  await open(SETTINGS)
  await userEvent.click(await screen.findByRole('link', { name: /^Business name/ }))

  await screen.findByLabelText('Business name')
  expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
})

test('the same page opened by its address keeps its Close', async () => {
  await open(SETTINGS_BUSINESS)

  await screen.findByLabelText('Business name')
  expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  expect(marked()).toHaveLength(1)
})

test('archived Payment methods, opened directly, marks Payment methods', async () => {
  await open(SETTINGS_PAYMENT_METHODS_ARCHIVED)

  await waitFor(() => expect(marked()).toHaveLength(1))
  expect(marked()[0]).toHaveTextContent('Payment methods')
})

test('Customer types with its toggle off renders its page and marks nothing', async () => {
  await open(SETTINGS_CUSTOMER_TYPES, 'computer', false)

  await within(await screen.findByRole('main')).findAllByText(testT('customerTypes:title'))
  await screen.findByRole('link', { name: /^Business name/ })
  expect(marked()).toHaveLength(0)
})

test('Prices → Customer types keeps Close, and Close returns to Prices, marked', async () => {
  await open(SETTINGS)
  await userEvent.click(await screen.findByRole('link', { name: nameOf(PRICES_ROW) }))
  await userEvent.click(await waitFor(() => within(screen.getByRole('main')).getByRole('link', { name: /Customer types/ })))

  await waitFor(() => expect(router.state.location.pathname).toBe(SETTINGS_CUSTOMER_TYPES))
  await userEvent.click(await screen.findByRole('button', { name: 'Close' }))

  await waitFor(() => expect(router.state.location.pathname).toBe(SETTINGS_PRICES))
  await waitFor(() => expect(marked().map((link) => link.textContent)).toEqual([nameOf(PRICES_ROW)]))
})

test('Expenses → Expense categories keeps Close, and Close returns to Expenses', async () => {
  await open(EXPENSES)
  await userEvent.click(await screen.findByRole('link', { name: /categories/i }))

  await waitFor(() => expect(router.state.location.pathname).toBe(EXPENSE_CATEGORIES))
  await userEvent.click(await screen.findByRole('button', { name: 'Close' }))

  await waitFor(() => expect(router.state.location.pathname).toBe(EXPENSES))
})

test('a dirty page asks before another row is opened', async () => {
  await open(SETTINGS_BUSINESS)
  const field = await screen.findByLabelText('Business name')
  await userEvent.type(field, ' Nueva')

  await userEvent.click(await screen.findByRole('link', { name: nameOf(PRICES_ROW) }))

  expect(await screen.findByText('Discard changes?')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(SETTINGS_BUSINESS)
})

test('a value typed in a page survives a resize from 899 to 900', async () => {
  await open(SETTINGS_BUSINESS, 'phone')
  const field = await screen.findByLabelText('Business name')
  await userEvent.type(field, ' Nueva')

  flipViewport('computer')

  expect(await screen.findByRole('link', { name: /^Business name/ })).toBeInTheDocument()
  expect(screen.getByLabelText('Business name')).toBe(field)
  expect(field).toHaveValue('La Huerta Nueva')
})

test('on the phone a group page keeps its own main and no list beside it', async () => {
  await open(SETTINGS_BUSINESS, 'phone')

  const main = await screen.findByRole('main')
  expect(main).toHaveClass('pantalla', 'ajustes-grupo')
  expect(screen.queryByRole('link', { name: /^Prices/ })).not.toBeInTheDocument()
})
