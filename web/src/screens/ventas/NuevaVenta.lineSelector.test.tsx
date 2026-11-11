/**
 * A New sale line's Product field is the required Selector (`selector.md`), at the screen seam:
 * the real app and router, `fetch` faked. Covers the 12+ Products case, the list's own history
 * entry from both entry points ("+ New sale" and New sale to a Customer), the customer Sheet
 * that never mounts under a list, a date change under an open list, and the loading, failed,
 * gone-Product and no-Products states.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { choosePaid, choosePaymentMethod } from '../../components/selectorTestKit'
import { afterEach, expect, test, vi } from 'vitest'
import App from '../../App'
import { newSaleFor } from '../../components/feedback'
import { sheetDepth } from '../../components/useSheetStack'
import { queryClient } from '../../queryClient'
import { HOME, SALES, SALE_NEW } from '../../routes'
import { router } from '../../router'
import { pickProduct, productField } from './lineProduct'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02', money: { symbol: '$', decimals: 0 } }
const ANA = { id: 7, name: 'Ana', phone: '+5491100000001', vip: false }

function price(list: number) {
  return { id: 9, effective_from: '2026-09-01', list_price: list, bulk_price: null, bulk_minimum: null, vip_price: null }
}

const ROSA = { id: 1, name: 'Rosa', archived: false, current_price: price(1000) }
const TULIPAN = { id: 2, name: 'Tulipán', archived: false, current_price: price(1500) }
const TWELVE = Array.from({ length: 12 }, (_unused, index) => ({
  id: 100 + index,
  name: `Item ${String(index + 1).padStart(2, '0')}`,
  archived: false,
  current_price: price(100 * (index + 1)),
}))

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

interface Stubs {
  /** The answer to `GET /api/products?on=<date>`, by date. */
  products: (date: string) => Response
}

function stubFetch({ products }: Stubs): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((path: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (method === 'GET' && path === '/auth/me') return Promise.resolve(jsonResponse(200, ME))
    if (method === 'GET' && path.startsWith('/api/products?on=')) {
      return Promise.resolve(products(path.slice('/api/products?on='.length)))
    }
    if (method === 'GET' && path === '/pricing-settings') {
      return Promise.resolve(jsonResponse(200, { is_bulk_pricing: false, is_vip_customers: false }))
    }
    if (method === 'GET' && path === '/customers')return Promise.resolve(jsonResponse(200, [ANA]))
    if (method === 'GET' && path === '/customers/7') return Promise.resolve(jsonResponse(200, ANA))
    const url = path.split('?')[0]
    if (method === 'GET' && url === '/sales') return Promise.resolve(jsonResponse(200, []))
    return Promise.reject(new Error(`unexpected request: ${method} ${path}`))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

type Entry = 'plus' | 'customer'

/** "+ New sale" (from Sales) or New sale to a Customer, the two ways the form is reached. */
async function openSale(entry: Entry): Promise<void> {
  await act(() => router.navigate(SALES))
  await act(() => router.navigate(SALE_NEW, entry === 'customer' ? { state: newSaleFor('7') } : undefined))
  render(<App />)
  await screen.findByText('New sale')
  await screen.findByLabelText('Line 1 grams')
  if (entry === 'customer') await screen.findByText('Ana')
}

function depth(): number {
  return sheetDepth(router.state.location.state)
}

async function openList(user: ReturnType<typeof userEvent.setup>, n = 1): Promise<HTMLElement> {
  await waitFor(() => expect(productField(n)).toBeEnabled())
  await user.click(productField(n))
  return screen.findByRole('dialog', { name: `Line ${n} product options` })
}

afterEach(async () => {
  vi.unstubAllGlobals()
  queryClient.clear()
  await act(() => router.navigate(HOME))
})

test('with 12+ Products the line searches and picks through the Selector, and the figures follow', async () => {
  const user = userEvent.setup()
  stubFetch({ products: () => jsonResponse(200, TWELVE) })
  await openSale('plus')

  const list = await openList(user)
  await user.type(within(list).getByRole('searchbox', { name: 'Search' }), 'Item 07')
  expect(within(list).getAllByRole('button', { name: /^Item/ })).toHaveLength(1)
  await user.click(within(list).getByRole('button', { name: /^Item 07/ }))
  await waitFor(() => expect(list).not.toBeInTheDocument())

  const group = screen.getByRole('group', { name: /^Line 1 product/ })
  expect(within(group).queryByRole('combobox')).not.toBeInTheDocument()
  expect(within(group).queryAllByRole('radio')).toHaveLength(0)
  expect(document.querySelector('select')).toBeNull()
  expect(productField(1)).toHaveTextContent('Item 07')

  await user.type(screen.getByLabelText('Line 1 grams'), '10')
  expect(await screen.findByText('list')).toBeInTheDocument()
  expect(screen.getByText('$ 700 x g')).toBeInTheDocument()
  expect(screen.getAllByText('$ 7.000').length).toBeGreaterThanOrEqual(1)
})

test('a pick on a clean form never asks to discard; a back from the dirty form does', async () => {
  const user = userEvent.setup()
  stubFetch({ products: () => jsonResponse(200, [ROSA, TULIPAN]) })
  await openSale('plus')

  await pickProduct(user, 1, 'Rosa')
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(depth()).toBe(0)

  await act(() => router.navigate(-1))
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText('Discard the sale?')).toBeInTheDocument()
})

test.each<Entry>(['plus', 'customer'])(
  'with the list open, Close and back each close only the list and the sale is kept (%s)',
  async (entry) => {
    const user = userEvent.setup()
    stubFetch({ products: () => jsonResponse(200, [ROSA, TULIPAN]) })
    await openSale(entry)
    await user.type(screen.getByLabelText('Line 1 grams'), '3')
    const path = router.state.location.pathname
    expect(depth()).toBe(0)

    const list = await openList(user)
    expect(depth()).toBe(1)
    await user.click(within(list).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(list).not.toBeInTheDocument())
    expect(depth()).toBe(0)
    expect(router.state.location.pathname).toBe(path)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Line 1 grams')).toHaveValue('3')

    const again = await openList(user)
    expect(depth()).toBe(1)
    await act(() => router.navigate(-1))
    await waitFor(() => expect(again).not.toBeInTheDocument())
    expect(depth()).toBe(0)
    expect(router.state.location.pathname).toBe(path)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Line 1 grams')).toHaveValue('3')
    if (entry === 'customer') expect(screen.getByText('Ana')).toBeInTheDocument()
  },
)

test('an open Product list never mounts the customer Sheet; opening it afterwards shows only it', async () => {
  const user = userEvent.setup()
  stubFetch({ products: () => jsonResponse(200, [ROSA, TULIPAN]) })
  await openSale('plus')

  const list = await openList(user)
  expect(screen.queryByRole('button', { name: 'No customer' })).not.toBeInTheDocument()
  await user.click(within(list).getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(list).not.toBeInTheDocument())

  await user.click(screen.getByRole('button', { name: 'Pick a customer' }))
  expect(await screen.findByRole('button', { name: 'No customer' })).toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: 'Line 1 product options' })).not.toBeInTheDocument()
})

test('a date change with the list open keeps the list open', async () => {
  const user = userEvent.setup()
  const fetchMock = stubFetch({ products: () => jsonResponse(200, [ROSA, TULIPAN]) })
  await openSale('plus')
  const list = await openList(user)

  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-01' } })
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([path]) => path === '/api/products?on=2026-10-01')).toBe(true),
  )
  await act(async () => {
    await Promise.resolve()
  })

  expect(list).toBeInTheDocument()
  expect(depth()).toBe(1)
  expect(screen.getByRole('dialog', { name: 'Line 1 product options' })).toBeInTheDocument()
})

test('a failed Products load keeps the field busy and disabled, and never reads as an empty set', async () => {
  stubFetch({ products: () => jsonResponse(500, { detail: 'boom', code: 'server.error' }) })
  await openSale('plus')

  const field = await screen.findByRole('button', { name: /^Line 1 product/ })
  await waitFor(() => expect(field).toHaveAttribute('aria-busy', 'true'))
  expect(field).toBeDisabled()
  expect(screen.queryByText('No products yet. Add them in the Products tab.')).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: 'Line 1 product options' })).not.toBeInTheDocument()
})

test('a Product no longer offered keeps its name with the mark, is not offered, and still blocks saving', async () => {
  const user = userEvent.setup()
  const fetchMock = stubFetch({
    products: (date) => jsonResponse(200, date === '2026-10-02' ? [ROSA, TULIPAN] : [TULIPAN]),
  })
  await openSale('plus')
  await pickProduct(user, 1, 'Rosa')
  await user.type(screen.getByLabelText('Line 1 grams'), '2')

  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-01' } })
  await waitFor(() => expect(productField(1)).toHaveTextContent('no longer available'))
  expect(productField(1)).toHaveTextContent('Rosa')

  const list = await openList(user)
  expect(within(list).queryByRole('button', { name: /^Rosa/ })).not.toBeInTheDocument()
  expect(within(list).getByRole('button', { name: /^Tulipán/ })).toBeInTheDocument()
  await user.click(within(list).getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(list).not.toBeInTheDocument())

  await user.click(screen.getByRole('button', { name: 'Add another product' }))
  expect(await screen.findByRole('button', { name: /^Line 1: Rosa/ })).toBeInTheDocument()
  await choosePaid(user)
  await choosePaymentMethod(user, 'Cash')
  await user.click(screen.getByRole('button', { name: 'Save sale' }))

  expect(await screen.findAllByText('Rosa has no price for that date')).not.toHaveLength(0)
  expect(fetchMock.mock.calls.some(([path, init]) => path === '/sales' && (init as RequestInit)?.method === 'POST')).toBe(
    false,
  )
})

test('with no Products the open list names where they are made, and closing it keeps the sale', async () => {
  const user = userEvent.setup()
  stubFetch({ products: () => jsonResponse(200, []) })
  await openSale('plus')
  await user.type(screen.getByLabelText('Line 1 grams'), '4')

  const list = await openList(user)
  expect(within(list).getByText('No products yet. Add them in the Products tab.')).toBeInTheDocument()
  expect(within(list).queryByRole('button', { name: /create|new|add/i })).not.toBeInTheDocument()
  await user.click(within(list).getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(list).not.toBeInTheDocument())

  expect(depth()).toBe(0)
  expect(screen.getByLabelText('Line 1 grams')).toHaveValue('4')
})

test('adding a line focuses its Product field and does not open the list', async () => {
  const user = userEvent.setup()
  stubFetch({ products: () => jsonResponse(200, [ROSA, TULIPAN]) })
  await openSale('plus')
  await pickProduct(user, 1, 'Rosa')
  await user.type(screen.getByLabelText('Line 1 grams'), '2')

  await user.click(screen.getByRole('button', { name: 'Add another product' }))

  const field = await screen.findByRole('button', { name: /^Line 2 product/ })
  await waitFor(() => expect(document.activeElement).toBe(field))
  expect(screen.queryByRole('dialog', { name: 'Line 2 product options' })).not.toBeInTheDocument()
  expect(depth()).toBe(0)
})
