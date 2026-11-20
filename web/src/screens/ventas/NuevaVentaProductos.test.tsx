/**
 * New sale's Product list at the component seam (Testing Library, `fetch` faked). The harness
 * lives here and is not exported: `useSaleDraft`, `useNewSaleReads`, a Customer type the test sets
 * (`'pending'` stands for a Customer read in flight), a date control and a typed-quantity button.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import { useNewSaleReads } from '../../sales/useNewSaleReads'
import { useSaleDraft } from '../../sales/useSaleDraft'
import NuevaVentaProductos from './NuevaVentaProductos'

type Price = { id: number; effective_from: string; list_price: number; bulk_price: number | null; bulk_minimum: number | null }
const price = (list: number, bulk: number | null = null, minimum: number | null = null): Price => ({
  id: 1,
  effective_from: '2026-09-01',
  list_price: list,
  bulk_price: bulk,
  bulk_minimum: minimum,
})
const product = (id: number, name: string, current_price: Price | null) => ({ id, name, archived: false, current_price })

const TODAY = '2026-10-02'
const LATER = '2026-10-05'
const PRODUCTS = [
  product(1, 'Rosa', price(1000, 800, 10)),
  product(2, 'Árbol', price(500)),
  product(3, 'Sin precio', null),
  product(4, 'Tulipán', price(300)),
]

let productsByDate: Map<string, unknown>
let requests: string[]
let stockRows: { product_id: number; quantity: number }[]
let suggestionIds: number[]
/** The reads the test holds back (`products`, `settings`, `suggestions`), and what releases each one. */
let held: Set<string>
let gates: Map<string, () => void>

function readOf(path: string): string | null {
  if (path === '/pricing-settings') return 'settings'
  if (path.startsWith('/api/sales/suggestions')) return 'suggestions'
  if (path.startsWith('/api/products')) return 'products'
  return null
}

function release(read: string): void {
  const open = gates.get(read)
  if (open === undefined) throw new Error(`${read} was not asked for`)
  gates.delete(read)
  act(() => open())
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  productsByDate = new Map([[TODAY, PRODUCTS]])
  requests = []
  stockRows = [
    { product_id: 1, quantity: 1.5 },
    { product_id: 2, quantity: -3.5 },
    { product_id: 4, quantity: 0 },
  ]
  suggestionIds = [1, 99, 2, 3, 4]
  held = new Set()
  gates = new Map()
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const path = String(input)
      requests.push(path)
      const read = readOf(path)
      if (read !== null && held.has(read)) {
        return new Promise<Response>((resolve) => {
          gates.set(read, () => resolve(answerOf(path)))
        })
      }
      return Promise.resolve(answerOf(path))
    }),
  )
})

function answerOf(path: string): Response {
  if (path === '/pricing-settings') return json(200, { is_bulk_pricing: true, is_vip_customers: true })
  if (path === '/stock') {
    return json(200, { total: 0, entries: [], products: stockRows.map((row) => ({ ...row, status: 'ok' })) })
  }
  if (path.startsWith('/api/sales/suggestions')) {
    return json(200, { recent_customer_ids: [], most_sold_product_ids: suggestionIds, last_payment_method_id: null })
  }
  const date = new URL(path, 'http://x').searchParams.get('on') ?? ''
  const body = productsByDate.get(date)
  return body === undefined ? json(500, {}) : json(200, body)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function Harness({ initialCustomer = null, format = { symbol: '$', decimals: 0 } }: {
  initialCustomer?: number | null | 'pending'
  format?: { symbol: string; decimals: number }
}) {
  const draft = useSaleDraft({ today: TODAY })
  const [customer, setCustomer] = useState<number | null | 'pending'>(initialCustomer)
  const reads = useNewSaleReads({ date: draft.state.date, openedOn: draft.state.openedOn })
  return (
    <MoneyFormatProvider format={format}>
      <button type="button" onClick={() => draft.setDate(LATER)}>change date</button>
      <button type="button" onClick={() => draft.typeQuantity(1, '0.35')}>type 0.35</button>
      <button type="button" onClick={() => draft.typeQuantity(1, '2.5')}>type 2.5</button>
      <button type="button" onClick={() => draft.typeQuantity(1, 'abc')}>type bad</button>
      <button type="button" onClick={() => draft.typeQuantity(1, '10')}>type 10</button>
      <button type="button" onClick={() => setCustomer(null)}>customer arrives</button>
      <button type="button" onClick={() => setCustomer(7)}>customer typed</button>
      <output aria-label="totals">{JSON.stringify(draft.state.lines)}</output>
      <div role="region" aria-label="list under test">
        <NuevaVentaProductos {...reads} customerTypeId={customer} draft={draft} />
      </div>
    </MoneyFormatProvider>
  )
}

function renderList(props: Parameters<typeof Harness>[0] = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness {...props} />
    </QueryClientProvider>,
  )
}

const click = async (name: string | RegExp) => userEvent.click(await screen.findByRole('button', { name }))
/** The list item whose text starts with the Product's name (the name is the row's first text). */
async function row(name: string): Promise<HTMLElement> {
  return waitFor(() => {
    const found = screen.getAllByRole('listitem').find((item) => (item.textContent ?? '').startsWith(name))
    if (found === undefined) throw new Error(`no row for ${name}`)
    return found
  })
}

test('Most sold keeps the suggestion order, drops an unreturned id and shows stock as it is', async () => {
  renderList()
  expect(await screen.findByRole('heading', { name: 'Most sold' })).toBeInTheDocument()
  const items = screen.getAllByRole('listitem')
  expect(items).toHaveLength(4)
  ;['Rosa', 'Árbol', 'Sin precio', 'Tulipán'].forEach((name, index) => {
    expect(items[index]?.textContent ?? '').toMatch(new RegExp(`^${name}`))
  })
  expect(within(await row('Rosa')).getByText('1,5 in stock')).toBeInTheDocument()
  expect(within(await row('Árbol')).getByText('-3,5 in stock')).toBeInTheDocument()
  expect(within(await row('Tulipán')).getByText('0 in stock')).toBeInTheDocument()
})

test('a Product with no price says "No price" and has no "+"', async () => {
  renderList()
  const unpriced = await row('Sin precio')
  expect(within(unpriced).getByText('No price')).toBeInTheDocument()
  expect(within(unpriced).queryByRole('button')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Add Sin precio' })).toBeNull()
})

test('steps a line, "−" from 1 removes it and the Product goes back to Most sold', async () => {
  renderList()
  await click('Add Árbol')
  expect(await screen.findByRole('heading', { name: 'In the sale · 1' })).toBeInTheDocument()
  const group = screen.getByRole('group', { name: 'Árbol' })
  await userEvent.click(within(group).getByRole('button', { name: 'Add one Árbol' }))
  expect(within(group).getByText('2')).toBeInTheDocument()
  await userEvent.click(within(group).getByRole('button', { name: 'Remove one Árbol' }))
  expect(within(group).getByText('1')).toBeInTheDocument()
  await userEvent.click(within(group).getByRole('button', { name: 'Remove one Árbol' }))
  expect(screen.queryByRole('group', { name: 'Árbol' })).toBeNull()
  expect(await screen.findByRole('button', { name: 'Add Árbol' })).toBeInTheDocument()
})

test('typed quantities show on the row, a rejected one keeps the last, 1.5 − 1 leaves 0,5', async () => {
  renderList()
  await click('Add Rosa')
  const group = screen.getByRole('group', { name: 'Rosa' })
  await userEvent.click(screen.getByRole('button', { name: 'type 0.35' }))
  expect(within(group).getByText('0,35')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'type bad' }))
  expect(within(group).getByText('0,35')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'type 2.5' }))
  expect(within(group).getByText('2,5')).toBeInTheDocument()
  await userEvent.click(within(group).getByRole('button', { name: 'Remove one Rosa' }))
  expect(within(group).getByText('1,5')).toBeInTheDocument()
  await userEvent.click(within(group).getByRole('button', { name: 'Remove one Rosa' }))
  expect(within(group).getByText('0,5')).toBeInTheDocument()
  // One line per Product: adding twice never adds a second line.
  expect(screen.getAllByRole('group', { name: 'Rosa' })).toHaveLength(1)
})

test('a bulk Product at 10 shows the bulk price as a line and the list price once removed', async () => {
  renderList()
  const listRow = await row('Rosa')
  expect(within(listRow).getByText(/1\.000/)).toBeInTheDocument()
  await click('Add Rosa')
  await userEvent.click(screen.getByRole('button', { name: 'type 10' }))
  const line = (await row('Rosa'))
  expect(within(line).getByText(/800/)).toBeInTheDocument()
  expect(screen.getByLabelText('totals').textContent).toContain('"quantityHundredths":1000')
  await userEvent.click(screen.getByRole('button', { name: 'type 0.35' }))
  await userEvent.click(within(screen.getByRole('group', { name: 'Rosa' })).getByRole('button', { name: 'Remove one Rosa' }))
  expect(screen.queryByRole('group', { name: 'Rosa' })).toBeNull()
  expect(within(await row('Rosa')).getByText(/1\.000/)).toBeInTheDocument()
})

test('nothing date-dependent renders while the Customer is pending, then it prices', async () => {
  renderList({ initialCustomer: 'pending' })
  await waitFor(() => expect(requests).toContain('/stock'))
  await waitFor(() => expect(requests.some((path) => path.startsWith('/api/sales/suggestions'))).toBe(true))
  expect(screen.queryByRole('heading')).toBeNull()
  expect(screen.queryByText(/\$|No price|in stock/)).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'customer arrives' }))
  expect(await screen.findByRole('heading', { name: 'Most sold' })).toBeInTheDocument()
  expect(within(await row('Árbol')).getByText(/500/)).toBeInTheDocument()
})

test('a date change re-prices without asking for suggestions again; a line that loses its price stays', async () => {
  productsByDate.set(LATER, [product(1, 'Rosa', null), product(2, 'Árbol', price(700)), product(4, 'Tulipán', price(300))])
  renderList()
  await click('Add Rosa')
  await click('Add Árbol')
  await userEvent.click(screen.getByRole('button', { name: 'change date' }))
  await waitFor(() => expect(requests).toContain(`/api/products?on=${LATER}`))
  const line = within(await row('Rosa'))
  expect(await line.findByText('No price')).toBeInTheDocument()
  expect(line.queryByRole('button', { name: 'Add one Rosa' })).toBeNull()
  expect(within(await row('Árbol')).getByText(/700/)).toBeInTheDocument()
  expect(requests.filter((path) => path.startsWith('/api/sales/suggestions'))).toHaveLength(1)
  await userEvent.click(line.getByRole('button', { name: 'Remove one Rosa' }))
  expect(screen.queryByRole('group', { name: 'Rosa' })).toBeNull()
})

test('a line whose Product the answer omits is "no longer available", priced "No price" and removable', async () => {
  productsByDate.set(LATER, [product(2, 'Árbol', price(700))])
  renderList()
  await click('Add Rosa')
  await userEvent.click(screen.getByRole('button', { name: 'change date' }))
  const group = await screen.findByRole('group', { name: 'no longer available' })
  expect(within(group.closest('li') as HTMLElement).getByText('No price')).toBeInTheDocument()
  expect(within(group).queryByRole('button', { name: /Add one/ })).toBeNull()
  await userEvent.click(within(group).getByRole('button', { name: 'Remove one no longer available' }))
  expect(screen.queryByRole('group')).toBeNull()
})

test('the hint shows for both kinds and follows the date', async () => {
  productsByDate.set(TODAY, [])
  productsByDate.set(LATER, [product(1, 'Rosa', null)])
  renderList()
  expect(await screen.findByText('No products yet. Add them in the Products tab.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'change date' }))
  expect(await screen.findByText('Add a price to a product so you can sell')).toBeInTheDocument()
  expect(screen.queryByText('No products yet. Add them in the Products tab.')).toBeNull()
})

test('a euro format shows two decimals', async () => {
  renderList({ format: { symbol: '€', decimals: 2 } })
  expect(within(await row('Árbol')).getByText(/€\s?500,00/)).toBeInTheDocument()
})

test('more visible rows leave the draft untouched', async () => {
  renderList()
  await click('Add Árbol')
  const totals = screen.getByLabelText('totals').textContent
  expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0)
  cleanup()
  // The same draft opens on a longer suggestion list: the rows change, the draft's lines do not.
  productsByDate.set(TODAY, [...PRODUCTS, product(5, 'Lirio', price(250))])
  suggestionIds = [1, 2, 3, 4, 5]
  renderList()
  await click('Add Árbol')
  expect(screen.getAllByRole('listitem').filter((item) => (item.textContent ?? '').startsWith('Lirio'))).toHaveLength(1)
  expect(screen.getByLabelText('totals').textContent).toBe(totals)
})

test('nothing renders while the products, settings or suggestions read is held, then the list shows', async () => {
  for (const read of ['products', 'settings', 'suggestions']) {
    cleanup()
    held = new Set([read])
    gates = new Map()
    renderList()
    await waitFor(() => expect(gates.has(read)).toBe(true))
    await waitFor(() => expect(requests).toContain('/stock'))
    await act(async () => undefined)
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.queryByRole('listitem')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Add / })).toBeNull()
    expect(screen.getByRole('region', { name: 'list under test' }).textContent).toBe('')
    expect(screen.getByRole('region', { name: 'list under test' }).textContent ?? '').not.toMatch(/\d|\$|No price|in stock|Add a price|No products yet/)
    release(read)
    expect(await screen.findByRole('heading', { name: 'Most sold' })).toBeInTheDocument()
    expect(within(await row('Árbol')).getByText(/500/)).toBeInTheDocument()
  }
})

test('a Customer going from pending to a type with its own price re-prices the row', async () => {
  const typed = { ...price(500), type_prices: [{ customer_type_id: 7, price: 350 }] }
  productsByDate.set(TODAY, [product(2, 'Árbol', typed)])
  suggestionIds = [2]
  renderList({ initialCustomer: 'pending' })
  await waitFor(() => expect(requests).toContain('/stock'))
  await act(async () => undefined)
  expect(screen.queryByRole('heading')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'customer typed' }))
  const priced = await row('Árbol')
  expect(within(priced).getByText(/350/)).toBeInTheDocument()
  expect(within(priced).queryByText(/500/)).toBeNull()
})

test('no Sales gives an empty body: no row, no heading, no hint', async () => {
  suggestionIds = []
  renderList()
  await waitFor(() => expect(requests.some((path) => path.startsWith('/api/sales/suggestions'))).toBe(true))
  await waitFor(() => expect(requests).toContain('/stock'))
  await act(async () => undefined)
  expect(screen.queryByRole('heading')).toBeNull()
  expect(screen.queryByRole('listitem')).toBeNull()
  expect(screen.queryByText('Add a price to a product so you can sell')).toBeNull()
})

test('a line above its Stock leaves the stock text unchanged', async () => {
  renderList()
  await click('Add Rosa')
  await userEvent.click(screen.getByRole('button', { name: 'type 2.5' }))
  const line = within(screen.getByRole('group', { name: 'Rosa' }).closest('li') as HTMLElement)
  expect(line.getByText('2,5')).toBeInTheDocument()
  expect(line.getByText('1,5 in stock')).toBeInTheDocument()
  await userEvent.click(line.getByRole('button', { name: 'Add one Rosa' }))
  expect(line.getByText('3,5')).toBeInTheDocument()
  expect(line.getByText('1,5 in stock')).toBeInTheDocument()
})
