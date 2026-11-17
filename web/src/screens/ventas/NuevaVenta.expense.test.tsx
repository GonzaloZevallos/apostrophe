/**
 * The Expense row and the expense Sheet over `NuevaVenta`, through a real data router with `fetch`
 * faked and the location read from `router.state.location`: the sale stays mounted under the Sheet,
 * every exit is `sheet.close()`, and a save leaves the seller on New sale at depth 0.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { choosePaid, choosePaymentMethod } from '../../components/selectorTestKit'
import { SheetRouterProvider, sheetDepth } from '../../components/useSheetStack'
import FlashProvider from '../../flash/FlashProvider'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import { SALES, SALE_NEW } from '../../routes'
import { flipViewport, stubViewport } from '../../test-viewport'
import { withPaymentMethods } from '../../test-payment-methods'
import NuevaVenta from './NuevaVenta'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02', money: { symbol: '$', decimals: 0 } }
const ROSA = {
  id: 1,
  name: 'Rosa',
  current_price: { id: 9, effective_from: '2026-09-01', list_price: 1000, bulk_price: null, bulk_minimum: null },
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const ANA = { id: 7, name: 'Ana', phone: null, phone_display: null, vip: false }

let posts: string[] = []
/** Answers the held `POST /sales` of a test that saves a sale. */
let answerSale: ((response: Response) => void) | null = null
let client: QueryClient

beforeEach(() => {
  stubViewport('phone')
  posts = []
  answerSale = null
  vi.stubGlobal(
    'fetch',
    vi.fn(
      withPaymentMethods((path: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET'
        if (method === 'GET' && path === '/api/products?on=2026-10-02') return Promise.resolve(jsonResponse(200, [ROSA]))
        if (method === 'GET' && path.startsWith('/expense-categories')) {
          return Promise.resolve(jsonResponse(200, [{ id: 1, name: 'Packaging' }]))
        }
        if (method === 'GET' && path === '/customers') return Promise.resolve(jsonResponse(200, [ANA]))
        if (method === 'GET' && path === '/pricing-settings') {
          return Promise.resolve(jsonResponse(200, { is_bulk_pricing: false, is_vip_customers: false }))
        }
        if (method === 'POST' && path === '/sales') {
          return new Promise<Response>((resolve) => {
            answerSale = resolve
          })
        }
        if (method === 'POST' && path === '/expenses') {
          posts.push(path)
          return Promise.resolve(jsonResponse(201, { id: 1 }))
        }
        return Promise.reject(new Error(`unexpected request: ${method} ${path}`))
      }),
    ),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function renderSale() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client = queryClient
  const router = createMemoryRouter(
    [
      { path: SALES, element: <h1>Lista de ventas</h1> },
      {
        element: (
          <FlashProvider>
            <MoneyFormatProvider format={ME.money}>
              <Outlet context={ME} />
            </MoneyFormatProvider>
          </FlashProvider>
        ),
        children: [{ path: SALE_NEW, element: <NuevaVenta /> }],
      },
    ],
    { initialEntries: [SALES, SALE_NEW], initialIndex: 1 },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )
  return router
}

const tile = () => screen.findByRole('button', { name: 'Expense' })
const strip = () => screen.queryByRole('button', { name: /^Sale in progress/ })
const depth = (router: ReturnType<typeof renderSale>) => sheetDepth(router.state.location.state)

async function chooseRosa(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Line 1 product/ }))
  await user.click(await screen.findByRole('button', { name: /Rosa/ }))
  await user.type(screen.getByLabelText('Line 1 grams'), '3')
}

async function saveExpense(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /^Category/ }))
  await user.click(await screen.findByRole('button', { name: 'Packaging' }))
  await user.type(screen.getByLabelText('Amount'), '500')
  await user.type(screen.getByLabelText('Details'), 'Cinta')
  await user.click(screen.getByRole('button', { name: 'Save the expense' }))
}

test('the tile opens the Add expense dialog over a mounted sale, with no strip and no customer sheet', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await user.type(await screen.findByLabelText('Note'), 'para Ana')
  await user.click(await tile())

  expect(await screen.findByRole('dialog', { name: 'Add expense' })).toBeInTheDocument()
  expect(depth(router)).toBe(1)
  expect(strip()).not.toBeInTheDocument()
  expect(screen.queryByText('Search')).not.toBeInTheDocument()
})

test('with a Product chosen the strip reads the total and its Back closes the sheet with the sale intact', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await chooseRosa(user)
  await user.type(await screen.findByLabelText('Note'), 'para Ana')
  await user.click(await tile())

  const back = await screen.findByRole('button', { name: 'Sale in progress, 1 product, $ 3.000. Back' })
  await user.click(back)

  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add expense' })).not.toBeInTheDocument())
  expect(depth(router)).toBe(0)
  expect(router.state.location.pathname).toBe(SALE_NEW)
  expect(screen.getByLabelText('Note')).toHaveValue('para Ana')
  expect(screen.getByLabelText('Line 1 grams')).toHaveValue('3')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Expense' })).toHaveFocus())
})

test('the system back closes the sheet, and a fireEvent-only open takes focus back too', async () => {
  const router = renderSale()
  fireEvent.click(await tile())
  await screen.findByRole('dialog', { name: 'Add expense' })
  await act(() => router.navigate(-1))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add expense' })).not.toBeInTheDocument())
  expect(depth(router)).toBe(0)
  expect(screen.getByRole('button', { name: 'Expense' })).toHaveFocus()
})

test('saving over a touched sale ends at depth 0 on New sale, says Expense recorded, and one Back asks about the sale', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await chooseRosa(user)
  await user.click(await tile())
  await saveExpense(user)

  expect(await screen.findByText('Expense recorded')).toBeInTheDocument()
  await waitFor(() => expect(depth(router)).toBe(0))
  expect(router.state.location.pathname).toBe(SALE_NEW)
  expect(posts).toHaveLength(1)

  await act(() => router.navigate(-1))
  expect(await screen.findByRole('alertdialog', { name: 'Discard the sale?' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(SALE_NEW)
})

test('with grams but no Product there is no strip and the toast says Expense saved', async () => {
  const user = userEvent.setup()
  renderSale()
  await user.type(await screen.findByLabelText('Line 1 grams'), '3')
  await user.click(await tile())
  await screen.findByRole('dialog', { name: 'Add expense' })
  expect(strip()).not.toBeInTheDocument()
  await saveExpense(user)
  expect(await screen.findByText('Expense saved')).toBeInTheDocument()
})

test('from the sheet, the Category list closes on one Back and the sheet stays at depth 1', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await user.click(await tile())
  await user.click(await screen.findByRole('button', { name: /^Category/ }))
  await screen.findByRole('dialog', { name: 'Category options' })
  expect(depth(router)).toBe(2)
  await act(() => router.navigate(-1))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Category options' })).not.toBeInTheDocument())
  expect(depth(router)).toBe(1)
  expect(screen.getByRole('dialog', { name: 'Add expense' })).toBeInTheDocument()
})

test('resizing to the computer with the sheet open pops it and keeps the sale', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await user.type(await screen.findByLabelText('Note'), 'para Ana')
  await user.click(await tile())
  await screen.findByRole('dialog', { name: 'Add expense' })
  flipViewport('computer')
  await waitFor(() => expect(depth(router)).toBe(0))
  expect(screen.queryByRole('dialog', { name: 'Add expense' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Note')).toHaveValue('para Ana')
})

test('there is no Expense row at computer width, and nothing warns', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  stubViewport('computer')
  renderSale()
  await screen.findByLabelText('Note')
  expect(screen.queryByRole('button', { name: 'Expense' })).not.toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Other things to record' })).not.toBeInTheDocument()
  expect(warn).not.toHaveBeenCalled()
})

test('with the sale save in flight the Expense row is inert and a tap on the tile opens nothing', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await chooseRosa(user)
  await choosePaid(user)
  await choosePaymentMethod(user, 'Cash')
  expect(await screen.findByText('list')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save sale' }))
  await waitFor(() => expect(answerSale).not.toBeNull())

  await waitFor(() => expect(screen.getByRole('navigation', { name: 'Other things to record' })).toHaveAttribute('inert'))
  await user.click(screen.getByRole('button', { name: 'Expense' }))
  expect(screen.queryByRole('dialog', { name: 'Add expense' })).not.toBeInTheDocument()
  expect(depth(router)).toBe(0)

  await act(async () => {
    answerSale?.(jsonResponse(422, { detail: 'no', code: 'sale.shipping_negative' }))
  })
  await waitFor(() =>
    expect(screen.getByRole('navigation', { name: 'Other things to record' })).not.toHaveAttribute('inert'),
  )
})

test("the form's own Close returns to New sale at depth 0 with the whole sale intact and focus on the tile", async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await chooseRosa(user)
  await user.click(await screen.findByRole('button', { name: 'Pick a customer' }))
  await user.click(await screen.findByRole('button', { name: /Ana/ }))
  await user.clear(screen.getByLabelText('Shipping'))
  await user.type(screen.getByLabelText('Shipping'), '200')
  await user.type(screen.getByLabelText('Note'), 'para Ana')
  expect(screen.getAllByText('$ 3.200').length).toBeGreaterThan(0)
  await user.click(await tile())

  const dialog = await screen.findByRole('dialog', { name: 'Add expense' })
  await user.click(within(dialog).getByRole('button', { name: 'Close' }))

  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add expense' })).not.toBeInTheDocument())
  expect(depth(router)).toBe(0)
  expect(router.state.location.pathname).toBe(SALE_NEW)
  expect(screen.getByLabelText('Line 1 grams')).toHaveValue('3')
  expect(screen.getByRole('button', { name: /Ana/ })).toBeInTheDocument()
  expect(screen.getByLabelText('Shipping')).toHaveValue('200')
  expect(screen.getByLabelText('Note')).toHaveValue('para Ana')
  expect(screen.getAllByText('$ 3.200').length).toBeGreaterThan(0)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Expense' })).toHaveFocus())
})

test('a save refreshes the expenses list and puts the focus back on the Expense tile', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  await chooseRosa(user)
  await user.click(await tile())
  await saveExpense(user)

  await waitFor(() => expect(depth(router)).toBe(0))
  expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['expenses'] }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Expense' })).toHaveFocus())
})
