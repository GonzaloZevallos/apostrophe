/**
 * New sale's one leave guard over the phone Expense Sheet (ADR-20261114), through a real data router
 * at phone width with `fetch` faked and `console.warn` spied: which question each exit asks, that
 * "No" keeps everything, that a clean, undone or saved Expense asks nothing, and that never more
 * than one alertdialog is on screen.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
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

/** What `POST /expenses` answers; a test swaps it to refuse or to answer 401. */
let expenseAnswer: () => Response = () => jsonResponse(201, { id: 1 })
let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  stubViewport('phone')
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  expenseAnswer = () => jsonResponse(201, { id: 1 })
  vi.stubGlobal(
    'fetch',
    vi.fn(
      withPaymentMethods((path: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET'
        if (method === 'GET' && path === '/api/products?on=2026-10-02') return Promise.resolve(jsonResponse(200, [ROSA]))
        if (method === 'GET' && path.startsWith('/expense-categories')) {
          return Promise.resolve(jsonResponse(200, [{ id: 1, name: 'Packaging' }]))
        }
        if (method === 'GET' && path === '/customers') return Promise.resolve(jsonResponse(200, []))
        if (method === 'GET' && path === '/pricing-settings') {
          return Promise.resolve(jsonResponse(200, { is_bulk_pricing: false, is_vip_customers: false }))
        }
        if (method === 'POST' && path === '/expenses') return Promise.resolve(expenseAnswer())
        return Promise.reject(new Error(`unexpected request: ${method} ${path}`))
      }),
    ),
  )
})

afterEach(() => {
  expect(screen.queryAllByRole('alertdialog').length).toBeLessThanOrEqual(1)
  expect(warn).not.toHaveBeenCalled()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function renderSale() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
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

type Router = ReturnType<typeof renderSale>
type User = ReturnType<typeof userEvent.setup>

const tile = () => screen.findByRole('button', { name: 'Expense' })
const depth = (router: Router) => sheetDepth(router.state.location.state)
const EXPENSE_Q = 'Discard the expense?'
const SALE_Q = 'Discard the sale?'
const STAYS = 'Your sale in progress stays as it is.'
const LOSES = 'What you entered is lost: nothing has been saved yet.'
const STRIP_BACK = 'Sale in progress, 1 product, $ 3.000. Back'

async function chooseRosa(user: User) {
  await user.click(await screen.findByRole('button', { name: /Line 1 product/ }))
  await user.click(await screen.findByRole('button', { name: /Rosa/ }))
  await user.type(screen.getByLabelText('Line 1 grams'), '3')
}

/** Opens the Expense over the sale, with Details typed so the Expense differs from how it opened. */
async function openChanged(user: User, text = 'Cinta') {
  await user.click(await tile())
  await user.type(await screen.findByLabelText('Details'), text)
}

async function pickCategoryAndAmount(user: User) {
  await user.click(await screen.findByRole('button', { name: /^Category/ }))
  await user.click(await screen.findByRole('button', { name: 'Packaging' }))
  await user.type(screen.getByLabelText('Amount'), '500')
}

async function fillAndSave(user: User) {
  await pickCategoryAndAmount(user)
  await user.type(screen.getByLabelText('Details'), 'Cinta')
  await user.click(screen.getByRole('button', { name: 'Save the expense' }))
}

const close = () => within(screen.getByRole('dialog', { name: 'Add expense' })).getByRole('button', { name: 'Close' })
const asked = (name: string) => screen.findByRole('alertdialog', { name })
const noQuestion = () => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
const sheetGone = () =>
  waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add expense' })).not.toBeInTheDocument())

/** The texts every alertdialog showed from now until `stop()`. */
function watchQuestions() {
  const seen = new Set<string>()
  const watch = new MutationObserver(() => {
    for (const dialog of screen.queryAllByRole('alertdialog')) seen.add(dialog.textContent ?? '')
  })
  watch.observe(document.body, { childList: true, subtree: true, characterData: true })
  return {
    stop: () => {
      watch.disconnect()
      return seen
    },
  }
}

test('a 401 on save shows the form error, navigates nowhere, adds no second dialog, and Close then asks', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await openChanged(user)
  expenseAnswer = () => jsonResponse(401, { detail: 'no', code: 'auth.unauthenticated' })
  await fillAndSave(user)
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(SALE_NEW)
  expect(depth(router)).toBe(1)
  noQuestion()
  await user.click(close())
  await asked(EXPENSE_Q)
  expect(depth(router)).toBe(1)
})

test('Close with a changed Expense asks, says the sale stays while the strip shows, and No keeps everything', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await chooseRosa(user)
  await user.type(screen.getByLabelText('Note'), 'para Ana')
  await openChanged(user)
  await user.click(close())
  const question = await asked(EXPENSE_Q)
  expect(within(question).getByText(STAYS)).toBeInTheDocument()

  await user.click(within(question).getByRole('button', { name: 'No, keep entering' }))
  await waitFor(() => noQuestion())
  expect(screen.getByLabelText('Details')).toHaveValue('Cinta')
  expect(screen.getByRole('dialog', { name: 'Add expense' })).toBeInTheDocument()
  expect(depth(router)).toBe(1)
  expect(screen.getByLabelText('Note')).toHaveValue('para Ana')
})

test('the strip Back asks, and Yes closes only the Expense with focus on the tile and the sale unchanged', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await chooseRosa(user)
  await user.type(screen.getByLabelText('Note'), 'para Ana')
  await openChanged(user)
  await user.click(await screen.findByRole('button', { name: STRIP_BACK }))
  const question = await asked(EXPENSE_Q)
  await user.click(within(question).getByRole('button', { name: 'Yes, discard it' }))

  await sheetGone()
  expect(depth(router)).toBe(0)
  expect(router.state.location.pathname).toBe(SALE_NEW)
  expect(screen.getByLabelText('Note')).toHaveValue('para Ana')
  expect(screen.getByLabelText('Line 1 grams')).toHaveValue('3')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Expense' })).toHaveFocus())
  noQuestion()
})

test('the system back asks with the common detail when no Product is chosen, and Yes returns at depth 0', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await openChanged(user)
  await act(() => router.navigate(-1))
  const question = await asked(EXPENSE_Q)
  expect(within(question).getByText(LOSES)).toBeInTheDocument()
  await user.click(within(question).getByRole('button', { name: 'Yes, discard it' }))
  await sheetGone()
  expect(depth(router)).toBe(0)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Expense' })).toHaveFocus())
})

test('a clean Expense over a touched sale closes without asking', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await chooseRosa(user)
  await user.click(await tile())
  await user.click(await screen.findByRole('button', { name: STRIP_BACK }))
  await sheetGone()
  noQuestion()
  expect(depth(router)).toBe(0)
})

test('undoing the change makes the Expense clean again: Close asks nothing', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await openChanged(user, 'C')
  await user.clear(screen.getByLabelText('Details'))
  await user.click(close())
  await sheetGone()
  noQuestion()
  expect(depth(router)).toBe(0)
})

test('a rejected save keeps the Expense changed, so Close asks', async () => {
  const user = userEvent.setup()
  renderSale()
  await user.click(await tile())
  expenseAnswer = () => jsonResponse(500, { detail: 'boom' })
  await fillAndSave(user)
  await screen.findByRole('alert')
  await user.click(close())
  await asked(EXPENSE_Q)
})

test('a successful save asks nothing, even after a re-render, and leaving with an untouched sale does not ask', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await user.click(await tile())
  await fillAndSave(user)
  await waitFor(() => expect(depth(router)).toBe(0))
  // A forced re-render of New sale that leaves the sale untouched.
  await user.type(screen.getByLabelText('Note'), 'x')
  await user.clear(screen.getByLabelText('Note'))
  await act(() => router.navigate(SALES))
  expect(await screen.findByRole('heading', { name: 'Lista de ventas' })).toBeInTheDocument()
  noQuestion()
})

test('after a successful save, leaving with a touched sale asks about the sale only', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await chooseRosa(user)
  await user.click(await tile())
  await fillAndSave(user)
  await waitFor(() => expect(depth(router)).toBe(0))
  await act(() => router.navigate(SALES))
  await asked(SALE_Q)
  expect(screen.queryByText(EXPENSE_Q)).not.toBeInTheDocument()
})

test('a save while the question shows leaves no question and says Expense recorded', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await chooseRosa(user)
  await user.click(await tile())
  await pickCategoryAndAmount(user)
  await user.type(screen.getByLabelText('Details'), 'Cinta')
  await user.click(close())
  await asked(EXPENSE_Q)
  fireEvent.click(screen.getByRole('button', { name: 'Save the expense' }))

  expect(await screen.findByText('Expense recorded')).toBeInTheDocument()
  await waitFor(() => expect(depth(router)).toBe(0))
  await waitFor(() => noQuestion())
})

test('navigating to Sales with a touched sale asks about the sale: No keeps both, Yes leaves with no second question', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await chooseRosa(user)
  await openChanged(user)
  await act(() => router.navigate(SALES))
  const question = await asked(SALE_Q)
  expect(screen.queryByText(EXPENSE_Q)).not.toBeInTheDocument()
  await user.click(within(question).getByRole('button', { name: 'No, keep entering' }))
  await waitFor(() => noQuestion())
  expect(screen.getByLabelText('Details')).toHaveValue('Cinta')
  expect(router.state.location.pathname).toBe(SALE_NEW)

  await act(() => router.navigate(SALES))
  await user.click(within(await asked(SALE_Q)).getByRole('button', { name: 'Yes, discard it' }))
  expect(await screen.findByRole('heading', { name: 'Lista de ventas' })).toBeInTheDocument()
  noQuestion()
})

test('navigating to Sales with an untouched sale and a changed Expense asks about the expense', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await openChanged(user)
  await act(() => router.navigate(SALES))
  await asked(EXPENSE_Q)
  expect(screen.queryByText(SALE_Q)).not.toBeInTheDocument()
})

test('navigating to Sales with neither changed leaves without asking', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await user.click(await tile())
  await screen.findByRole('dialog', { name: 'Add expense' })
  await act(() => router.navigate(SALES))
  expect(await screen.findByRole('heading', { name: 'Lista de ventas' })).toBeInTheDocument()
  noQuestion()
})

test('a back while the Close question shows resets it, keeps the wording, and the Sheet stays at depth 1', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await chooseRosa(user)
  await openChanged(user)
  await user.click(close())
  await asked(EXPENSE_Q)
  const watch = watchQuestions()
  await act(() => router.navigate(-1))
  await waitFor(() => noQuestion())
  for (const text of watch.stop()) {
    expect(text).toContain(EXPENSE_Q)
    expect(text).toContain(STAYS)
  }
  expect(depth(router)).toBe(1)
  expect(screen.getByLabelText('Details')).toHaveValue('Cinta')
})

test('a back while the Sales question shows resets it without changing the wording', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await chooseRosa(user)
  await openChanged(user)
  await act(() => router.navigate(SALES))
  await asked(SALE_Q)
  const watch = watchQuestions()
  await act(() => router.navigate(-1))
  await waitFor(() => noQuestion())
  for (const text of watch.stop()) expect(text).toContain(SALE_Q)
  expect(depth(router)).toBe(1)
  expect(router.state.location.pathname).toBe(SALE_NEW)
})

test('a double back to the same entry resets once and the Sheet stays at depth 1', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await openChanged(user)
  await act(async () => {
    void router.navigate(-1)
    void router.navigate(-1)
  })
  await waitFor(() => expect(depth(router)).toBe(1))
  expect(router.state.location.pathname).toBe(SALE_NEW)
  expect(screen.getByRole('dialog', { name: 'Add expense' })).toBeInTheDocument()
  expect(screen.getByLabelText('Details')).toHaveValue('Cinta')
})

test('Escape counts as No: the question goes, the Expense and the history stay', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await openChanged(user)
  await user.click(close())
  await asked(EXPENSE_Q)
  const before = router.state.historyAction
  await user.keyboard('{Escape}')
  await waitFor(() => noQuestion())
  expect(depth(router)).toBe(1)
  expect(router.state.historyAction).toBe(before)
  expect(screen.getByLabelText('Details')).toHaveValue('Cinta')
})

test('a question shown with no second back stays up', async () => {
  const user = userEvent.setup()
  renderSale()
  await openChanged(user)
  await user.click(close())
  await asked(EXPENSE_Q)
  await new Promise((resolve) => setTimeout(resolve, 150))
  expect(screen.getByRole('alertdialog', { name: EXPENSE_Q })).toBeInTheDocument()
})

test('switching to computer width with a typed Expense drops it, and reopening starts clean', async () => {
  const user = userEvent.setup()
  const router = renderSale()
  await openChanged(user)
  flipViewport('computer')
  await waitFor(() => expect(depth(router)).toBe(0))
  noQuestion()
  flipViewport('phone')
  await user.click(await tile())
  expect(await screen.findByLabelText('Details')).toHaveValue('')
  await user.click(close())
  await sheetGone()
  noQuestion()
})
