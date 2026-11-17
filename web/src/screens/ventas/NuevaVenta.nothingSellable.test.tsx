/**
 * `NuevaVenta`'s hint for "nothing is sellable on the sale's date", at the screen seam
 * (Testing Library, `fetch` faked with the Products answers held by the test): it shows on the
 * open line's Product field from a successful answer for the date shown only — never while the
 * answer loads, is refetched after a date change, or failed — and it never blocks saving.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SheetRouterProvider } from '../../components/useSheetStack'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import { SALE_NEW } from '../../routes'
import { withPaymentMethods } from '../../test-payment-methods'
import { pickProduct, productField } from './lineProduct'
import NuevaVenta from './NuevaVenta'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02', money: { symbol: '$', decimals: 0 } }
const PRICE = { id: 9, effective_from: '2026-09-01', list_price: 1000, bulk_price: null, bulk_minimum: null }
const PRICED = [{ id: 1, name: 'Rosa', archived: false, current_price: PRICE }]
const UNPRICED = [{ id: 1, name: 'Rosa', archived: false, current_price: null }]

const NO_PRICE = 'Add a price to a product so you can sell'
const NO_PRODUCTS = 'No products yet. Add them in the Products tab.'

/** Every Products GET waits for the test to answer it, keyed by its path. */
let pending: Map<string, (response: Response) => void>

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function answer(date: string, body: unknown): void {
  const resolve = pending.get(`/api/products?on=${date}`)
  if (resolve === undefined) throw new Error(`nobody asked for the Products of ${date}`)
  pending.delete(`/api/products?on=${date}`)
  act(() => resolve(json(200, body)))
}

beforeEach(() => {
  pending = new Map()
  vi.stubGlobal(
    'fetch',
    vi.fn(withPaymentMethods((path: string) =>
      path === '/pricing-settings'
        ? Promise.resolve(json(200, { is_bulk_pricing: true, is_vip_customers: true }))
        : new Promise<Response>((resolve) => {
            pending.set(path, resolve)
          }),
    )),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderForm(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [{ element: <MoneyFormatProvider format={ME.money}><Outlet context={ME} /></MoneyFormatProvider>, children: [{ path: SALE_NEW, element: <NuevaVenta /> }] }],
    { initialEntries: [SALE_NEW] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )
}

async function openWith(body: unknown): Promise<void> {
  renderForm()
  await waitFor(() => expect(pending.has('/api/products?on=2026-10-02')).toBe(true))
  answer('2026-10-02', body)
  await screen.findByRole('button', { name: 'Save sale' })
}

function changeDate(date: string): void {
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: date } })
}

test('with nothing priced the hint shows on first open, tied to the Product field, and Save sale stays enabled', async () => {
  await openWith(UNPRICED)

  const hint = screen.getByText(NO_PRICE)
  expect(screen.getAllByText(NO_PRICE)).toHaveLength(1)
  expect(hint.closest('p')).toHaveAttribute('id', 'nueva-venta-sin-vendible')
  expect(productField(1).getAttribute('aria-describedby')).toContain('nueva-venta-sin-vendible')
  expect(screen.getByRole('button', { name: 'Save sale' })).toBeEnabled()
})

test('with no Products the hint reads the empty-set sentence once while the list is closed', async () => {
  await openWith([])

  expect(screen.getAllByText(NO_PRODUCTS)).toHaveLength(1)
  expect(productField(1).getAttribute('aria-describedby')).toContain('nueva-venta-sin-vendible')
  expect(screen.getByRole('button', { name: 'Save sale' })).toBeEnabled()
})

test('the hint is plain text that wraps: no status role, no live region, no truncation', async () => {
  await openWith(UNPRICED)

  const hint = screen.getByText(NO_PRICE).closest('p') as HTMLElement
  expect(hint).not.toHaveAttribute('role')
  expect(hint).not.toHaveAttribute('aria-live')
  expect(hint).not.toHaveAttribute('style')
  expect(hint.innerHTML).not.toMatch(/nowrap|ellipsis|clamp|truncate/)
  expect(hint.className).not.toMatch(/nowrap|ellipsis|clamp|truncate/)
  expect(hint.querySelector('a, button')).toBeNull()
  expect(hint.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
})

test('something priced on the date gives no hint', async () => {
  await openWith(PRICED)

  expect(screen.queryByText(NO_PRICE)).not.toBeInTheDocument()
  expect(screen.queryByText(NO_PRODUCTS)).not.toBeInTheDocument()
  expect(productField(1).getAttribute('aria-describedby') ?? '').not.toContain('nueva-venta-sin-vendible')
})

test('no hint while the Products load', async () => {
  renderForm()
  await waitFor(() => expect(pending.size).toBe(1))

  expect(screen.queryByText(NO_PRICE)).not.toBeInTheDocument()
  expect(screen.queryByText(NO_PRODUCTS)).not.toBeInTheDocument()
})

test('a date change from a priced day to an unpriced one shows no hint until the answer arrives, then the hint', async () => {
  await openWith(PRICED)

  changeDate('2026-10-01')

  await waitFor(() => expect(pending.has('/api/products?on=2026-10-01')).toBe(true))
  expect(screen.queryByText(NO_PRICE)).not.toBeInTheDocument()
  expect(screen.queryByText(NO_PRODUCTS)).not.toBeInTheDocument()

  answer('2026-10-01', UNPRICED)

  expect(await screen.findByText(NO_PRICE)).toBeInTheDocument()
  expect(screen.getAllByText(NO_PRICE)).toHaveLength(1)
})

test('a date change from an unpriced day to a priced one drops the hint at once and shows none after the answer', async () => {
  await openWith(UNPRICED)
  expect(screen.getByText(NO_PRICE)).toBeInTheDocument()

  changeDate('2026-10-01')

  await waitFor(() => expect(pending.has('/api/products?on=2026-10-01')).toBe(true))
  for (const copy of screen.queryAllByText(NO_PRICE, { ignore: false })) expect(copy).not.toBeVisible()
  expect(screen.queryAllByText(NO_PRICE, { ignore: false }).length).toBeLessThanOrEqual(1)
  expect(productField(1).getAttribute('aria-describedby') ?? '').not.toContain('nueva-venta-sin-vendible')

  answer('2026-10-01', PRICED)

  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument())
  expect(screen.queryByText(NO_PRICE)).not.toBeInTheDocument()
  expect(productField(1).getAttribute('aria-describedby') ?? '').not.toContain('nueva-venta-sin-vendible')
})

test('a failed Products answer gives no hint, and never reads as "No products yet"', async () => {
  renderForm()
  await waitFor(() => expect(pending.has('/api/products?on=2026-10-02')).toBe(true))
  const resolve = pending.get('/api/products?on=2026-10-02') as (response: Response) => void
  act(() => resolve(json(500, { detail: 'boom', code: 'server.error' })))

  await waitFor(() => expect(productField(1)).toBeInTheDocument())
  expect(screen.queryByText(NO_PRICE)).not.toBeInTheDocument()
  expect(screen.queryByText(NO_PRODUCTS)).not.toBeInTheDocument()
})

test('opening a second line moves the single hint to it', async () => {
  const user = userEvent.setup()
  await openWith(UNPRICED)
  await pickProduct(user, 1, 'Rosa')
  await user.type(screen.getByLabelText('Line 1 grams'), '2')

  await user.click(screen.getByRole('button', { name: 'Add another product' }))

  expect(await screen.findByRole('button', { name: /^Line 2 product/ })).toBeInTheDocument()
  expect(screen.getAllByText(NO_PRICE)).toHaveLength(1)
  expect(productField(2).getAttribute('aria-describedby')).toContain('nueva-venta-sin-vendible')
  const collapsed = screen.getByRole('button', { name: /^Line 1/ })
  expect(collapsed.getAttribute('aria-describedby') ?? '').not.toContain('nueva-venta-sin-vendible')
  expect(collapsed).not.toHaveTextContent(NO_PRICE)
})

test('with no Products the sentence is on screen once when the list opens, on the phone', async () => {
  const user = userEvent.setup()
  await openWith([])
  expect(screen.getAllByText(NO_PRODUCTS)).toHaveLength(1)

  await user.click(productField(1))

  expect(await screen.findByRole('dialog', { name: 'Line 1 product options' })).toBeInTheDocument()
  expect(screen.getAllByText(NO_PRODUCTS)).toHaveLength(1)
  expect(screen.getByText(NO_PRODUCTS).closest('#nueva-venta-sin-vendible')).toBeNull()
})

test('with no Products on the computer the hint steps aside while the dropdown shows the sentence, and comes back', async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(min-width: 900px)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  )
  const user = userEvent.setup()
  await openWith([])
  expect(screen.getAllByText(NO_PRODUCTS)).toHaveLength(1)

  await user.click(productField(1))

  await waitFor(() => expect(productField(1)).toHaveAttribute('aria-expanded', 'true'))
  expect(screen.getAllByText(NO_PRODUCTS)).toHaveLength(1)
  expect(screen.getByText(NO_PRODUCTS).closest('#nueva-venta-sin-vendible')).toBeNull()

  await user.click(productField(1))

  await waitFor(() => expect(productField(1)).toHaveAttribute('aria-expanded', 'false'))
  expect(screen.getAllByText(NO_PRODUCTS)).toHaveLength(1)
  expect(screen.getByText(NO_PRODUCTS).closest('#nueva-venta-sin-vendible')).not.toBeNull()
})

/** Every copy of the sentence in the markup, hidden or not, and never more than one. */
function copies(sentence: string): HTMLElement[] {
  const found = screen.queryAllByText(sentence, { ignore: false })
  expect(found.length).toBeLessThanOrEqual(1)
  return found
}

test('a date change from a priced day to another priced one keeps no sentence while the answer is held', async () => {
  await openWith(PRICED)

  changeDate('2026-10-01')

  await waitFor(() => expect(pending.has('/api/products?on=2026-10-01')).toBe(true))
  expect(copies(NO_PRICE)).toHaveLength(0)
  expect(copies(NO_PRODUCTS)).toHaveLength(0)

  answer('2026-10-01', PRICED)

  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument())
  expect(copies(NO_PRICE)).toHaveLength(0)
})

test('a date change from an unpriced day keeps the hint\'s space as one hidden, undescribed copy, then the real hint returns', async () => {
  await openWith(UNPRICED)

  changeDate('2026-10-01')

  await waitFor(() => expect(pending.has('/api/products?on=2026-10-01')).toBe(true))
  const [kept] = copies(NO_PRICE)
  expect(kept).toBeDefined()
  expect(kept).not.toBeVisible()
  const keptParagraph = kept?.closest('p') as HTMLElement
  expect(keptParagraph).not.toHaveAttribute('id')
  expect(keptParagraph).toHaveAttribute('aria-hidden', 'true')
  expect(productField(1).getAttribute('aria-describedby') ?? '').not.toContain('nueva-venta-sin-vendible')

  answer('2026-10-01', UNPRICED)

  await waitFor(() => {
    const found = copies(NO_PRICE)
    expect(found).toHaveLength(1)
    expect(found[0]).toBeVisible()
  })
  const real = copies(NO_PRICE)[0]?.closest('p')
  expect(real).toHaveAttribute('id', 'nueva-venta-sin-vendible')
  expect(real).not.toHaveAttribute('aria-hidden')
  expect(productField(1).getAttribute('aria-describedby')).toContain('nueva-venta-sin-vendible')
})

test('with no Products and the list open while a date change is held, the sentence is on screen at most once, and the space returns when the list closes', async () => {
  const user = userEvent.setup()
  await openWith([])
  changeDate('2026-10-01')
  await waitFor(() => expect(pending.has('/api/products?on=2026-10-01')).toBe(true))
  expect(copies(NO_PRODUCTS)).toHaveLength(1)
  expect(copies(NO_PRODUCTS)[0]).not.toBeVisible()

  await user.click(productField(1))

  const list = await screen.findByRole('dialog', { name: 'Line 1 product options' })
  expect(copies(NO_PRODUCTS)).toHaveLength(1)
  expect(screen.getByText(NO_PRODUCTS).closest('p.nueva-venta__sin-vendible')).toBeNull()

  await user.click(within(list).getByRole('button', { name: 'Close' }))

  await waitFor(() => expect(list).not.toBeInTheDocument())
  expect(copies(NO_PRODUCTS)).toHaveLength(1)
  expect(copies(NO_PRODUCTS)[0]).not.toBeVisible()
})

test('a date change from an unpriced day whose answer fails leaves no sentence, visible or hidden', async () => {
  await openWith(UNPRICED)

  changeDate('2026-10-01')

  await waitFor(() => expect(pending.has('/api/products?on=2026-10-01')).toBe(true))
  expect(copies(NO_PRICE)).toHaveLength(1)
  const resolve = pending.get('/api/products?on=2026-10-01') as (response: Response) => void
  pending.delete('/api/products?on=2026-10-01')
  act(() => resolve(json(500, { detail: 'boom', code: 'server.error' })))

  await waitFor(() => expect(copies(NO_PRICE)).toHaveLength(0))
  expect(productField(1).getAttribute('aria-describedby') ?? '').not.toContain('nueva-venta-sin-vendible')
})
