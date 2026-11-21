/**
 * New sale's Product list at the component seam (Testing Library, `fetch` faked). The harness
 * lives here and is not exported: `useSaleDraft`, `useNewSaleReads`, a Customer type the test sets
 * (`'pending'` stands for a Customer read in flight), a date control and a typed-quantity button.
 */

import { focusManager, onlineManager, QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import ContentArea from '../../components/ContentArea'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import { MOST_SOLD_ROWS } from '../../sales/productList'
import { saleFormProductsQuery } from '../../sales/saleFormQueries'
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
const THIRD = '2026-10-09'
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
/** The reads the test holds back (`products`, `settings`, `suggestions`, `stock`), and what releases each one. */
let held: Set<string>
/** The reads the test makes fail: the network dropping, or a 500. */
let broken: Map<string, 'network' | 'server'>
let gates: Map<string, () => void>

function readOf(path: string): string | null {
  if (path === '/pricing-settings') return 'settings'
  if (path === '/stock') return 'stock'
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
  broken = new Map()
  gates = new Map()
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const path = String(input)
      requests.push(path)
      const read = readOf(path)
      const failure = read === null ? undefined : broken.get(read)
      if (failure === 'network') return Promise.reject(new TypeError('Failed to fetch'))
      if (failure === 'server') return Promise.resolve(json(500, {}))
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
  onlineManager.setOnline(true)
  focusManager.setFocused(undefined)
})

/** A second observer of the sale's date's Products, armed as `NuevaVenta.tsx` arms it. */
function SecondObserver({ date }: { date: string }) {
  useQuery(saleFormProductsQuery(date))
  return null
}

function Harness({ initialCustomer = null, format = { symbol: '$', decimals: 0 }, second = false }: {
  initialCustomer?: number | null | 'pending'
  format?: { symbol: string; decimals: number }
  second?: boolean
}) {
  const draft = useSaleDraft({ today: TODAY })
  const [customer, setCustomer] = useState<number | null | 'pending'>(initialCustomer)
  const reads = useNewSaleReads({ date: draft.state.date, openedOn: draft.state.openedOn })
  return (
    <MoneyFormatProvider format={format}>
      <button type="button" onClick={() => draft.setDate(LATER)}>change date</button>
      <button type="button" onClick={() => draft.setDate(THIRD)}>change to third date</button>
      <button type="button" onClick={() => draft.typeQuantity(1, '0.35')}>type 0.35</button>
      <button type="button" onClick={() => draft.typeQuantity(1, '2.5')}>type 2.5</button>
      <button type="button" onClick={() => draft.typeQuantity(1, 'abc')}>type bad</button>
      <button type="button" onClick={() => draft.typeQuantity(1, '10')}>type 10</button>
      <button type="button" onClick={() => setCustomer(null)}>customer arrives</button>
      <button type="button" onClick={() => setCustomer('pending')}>customer pending</button>
      <button type="button" onClick={() => setCustomer(7)}>customer typed</button>
      {second ? <SecondObserver date={draft.state.date} /> : null}
      <output aria-label="totals">{JSON.stringify(draft.state.lines)}</output>
      <ContentArea as="main" aria-label="list under test">
        <NuevaVentaProductos {...reads} customerTypeId={customer} draft={draft} />
      </ContentArea>
    </MoneyFormatProvider>
  )
}

function renderList(props: Parameters<typeof Harness>[0] = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <Harness {...props} />
    </QueryClientProvider>,
  )
  return { ...rendered, queryClient }
}

const area = () => screen.getByRole('main', { name: 'list under test' })
const isBusy = () => area().getAttribute('aria-busy') === 'true'
/** What the list shows and the tests never want during a load: a digit, a Money symbol, a heading,
 * the empty wording or the hint. */
function expectNoFigures(symbol = '$') {
  const text = area().textContent ?? ''
  expect(text).not.toMatch(/\d/)
  expect(text).not.toContain(symbol)
  expect(text).not.toMatch(/No price|in stock|Add a price|No products yet/)
  expect(within(area()).queryByRole('heading')).toBeNull()
}
const searched = (prefix: string) => requests.filter((path) => path.startsWith(prefix)).length

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

test('a pending Customer keeps the names, stock and steppers, marks the prices and prices them once it arrives', async () => {
  renderList({ initialCustomer: 'pending' })
  expect(await screen.findByRole('heading', { name: 'Most sold' })).toBeInTheDocument()
  const arbol = await row('Árbol')
  expect(within(arbol).getByText('-3,5 in stock')).toBeInTheDocument()
  expect(within(arbol).queryByText(/\$|No price/)).toBeNull()
  expect(screen.queryByRole('button', { name: /^Add (Rosa|Árbol|Tulipán)$/ })).toBeNull()
  await waitFor(() => expect(isBusy()).toBe(true))
  await userEvent.click(screen.getByRole('button', { name: 'customer arrives' }))
  expect(await within(await row('Árbol')).findByText(/500/)).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Add Árbol' })).toBeInTheDocument()
  expect(isBusy()).toBe(false)
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
  // A second, independent draft over a longer suggestion list: the rows change, a line added the same way is the same.
  productsByDate.set(TODAY, [...PRODUCTS, product(5, 'Lirio', price(250))])
  suggestionIds = [1, 2, 3, 4, 5]
  renderList()
  await click('Add Árbol')
  expect(screen.getAllByRole('listitem').filter((item) => (item.textContent ?? '').startsWith('Lirio'))).toHaveLength(1)
  expect(screen.getByLabelText('totals').textContent).toBe(totals)
})

test.each(['products', 'settings', 'suggestions', 'stock'])(
  'while the %s read is held the list is the skeleton: busy, no figure, no wording, then the list shows',
  async (read) => {
    held = new Set([read])
    renderList()
    await waitFor(() => expect(gates.has(read)).toBe(true))
    // Every other read has answered by now: only this one keeps the skeleton up.
    await waitFor(() => expect(requests.length).toBeGreaterThanOrEqual(4))
    await act(async () => undefined)
    expect(isBusy()).toBe(true)
    expect(within(area()).getAllByRole('listitem', { hidden: true })).toHaveLength(MOST_SOLD_ROWS)
    expect(within(area()).queryByRole('listitem')).toBeNull()
    expect(within(area()).queryByRole('button')).toBeNull()
    expect(area().textContent).toBe('')
    expectNoFigures()
    release(read)
    expect(await screen.findByRole('heading', { name: 'Most sold' })).toBeInTheDocument()
    expect(within(await row('Árbol')).getByText(/500/)).toBeInTheDocument()
    expect(isBusy()).toBe(false)
  },
)

test('the skeleton shows no symbol of the Business money format either', async () => {
  held = new Set(['products'])
  renderList({ format: { symbol: '€', decimals: 2 } })
  await waitFor(() => expect(gates.has('products')).toBe(true))
  expectNoFigures('€')
  release('products')
  expect(within(await row('Árbol')).getByText(/€\s?500,00/)).toBeInTheDocument()
})

test('a Customer change marks the price with no flash of the old figure, keeps the quantity, then re-prices', async () => {
  const typed = { ...price(500), type_prices: [{ customer_type_id: 7, price: 350 }] }
  productsByDate.set(TODAY, [product(2, 'Árbol', typed)])
  suggestionIds = [2]
  renderList()
  await click('Add Árbol')
  await userEvent.click(screen.getByRole('button', { name: 'Add one Árbol' }))
  const line = await row('Árbol')
  expect(within(line).getByText(/500/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'customer pending' }))
  const marked = await row('Árbol')
  expect(within(marked).queryByText(/500|350|\$|No price/)).toBeNull()
  expect(within(marked).getByText('2')).toBeInTheDocument()
  expect(isBusy()).toBe(true)
  expect(within(marked).getByRole('button', { name: 'Add one Árbol' })).toBeEnabled()
  await userEvent.click(screen.getByRole('button', { name: 'customer typed' }))
  const priced = await row('Árbol')
  expect(within(priced).getByText(/350/)).toBeInTheDocument()
  expect(within(priced).queryByText(/500/)).toBeNull()
  expect(within(priced).getByText('2')).toBeInTheDocument()
  expect(isBusy()).toBe(false)
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

test('the hint is hidden while the list loads or refreshes, and back when the figures are in', async () => {
  productsByDate.set(TODAY, [product(1, 'Rosa', null)])
  productsByDate.set(LATER, [])
  held = new Set(['products'])
  renderList()
  await waitFor(() => expect(gates.has('products')).toBe(true))
  expect(screen.queryByText('Add a price to a product so you can sell')).toBeNull()
  release('products')
  expect(await screen.findByText('Add a price to a product so you can sell')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'customer pending' }))
  expect(screen.queryByText('Add a price to a product so you can sell')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'customer arrives' }))
  expect(await screen.findByText('Add a price to a product so you can sell')).toBeInTheDocument()
  held = new Set(['products'])
  await userEvent.click(screen.getByRole('button', { name: 'change date' }))
  await waitFor(() => expect(gates.has('products')).toBe(true))
  expect(isBusy()).toBe(true)
  expect(screen.queryByText('Add a price to a product so you can sell')).toBeNull()
  release('products')
  expect(await screen.findByText('No products yet. Add them in the Products tab.')).toBeInTheDocument()
})

test('a date change keeps the lines and their steppers, marks the prices and lets a "+" raise the quantity', async () => {
  productsByDate.set(LATER, [product(1, 'Rosa', price(1200, 900, 10)), product(2, 'Árbol', price(700))])
  renderList()
  await click('Add Rosa')
  held = new Set(['products'])
  await userEvent.click(screen.getByRole('button', { name: 'change date' }))
  await waitFor(() => expect(gates.has('products')).toBe(true))
  const line = await row('Rosa')
  expect(isBusy()).toBe(true)
  expect(within(line).queryByText(/\$|\d{3}|No price/)).toBeNull()
  expect(within(line).getByText('1,5 in stock')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Add (Árbol|Tulipán)$/ })).toBeNull()
  await userEvent.click(within(line).getByRole('button', { name: 'Add one Rosa' }))
  expect(within(line).getByText('2')).toBeInTheDocument()
  release('products')
  expect(await within(await row('Rosa')).findByText(/1\.200/)).toBeInTheDocument()
  expect(within(await row('Rosa')).getByText('2')).toBeInTheDocument()
  expect(isBusy()).toBe(false)
})

test('a 500 on products shows the generic error, not busy, and no list', async () => {
  broken.set('products', 'server')
  renderList()
  expect(await within(area()).findByRole('alert')).toHaveTextContent('Something went wrong. Try again.')
  expect(within(area()).queryByRole('status')).toBeNull()
  expect(isBusy()).toBe(false)
  expect(within(area()).queryByRole('listitem', { hidden: true })).toBeNull()
  expect(within(area()).queryByRole('heading')).toBeNull()
})

test('a 500 on the Pricing settings shows the generic error too', async () => {
  broken.set('settings', 'server')
  renderList()
  expect(await within(area()).findByRole('alert')).toHaveTextContent('Something went wrong. Try again.')
  expect(isBusy()).toBe(false)
})

test('a network failure shows the no-connection state, not busy', async () => {
  broken.set('products', 'network')
  renderList()
  expect(await within(area()).findByRole('status')).toHaveTextContent('Offline: check your internet and try again.')
  expect(within(area()).queryByRole('alert')).toBeNull()
  expect(isBusy()).toBe(false)
  expect(within(area()).queryByRole('heading')).toBeNull()
})

test('a 500 on suggestions shows no error, no Most sold heading, and a line still adds and prices', async () => {
  broken.set('suggestions', 'server')
  renderList()
  await waitFor(() => expect(isBusy()).toBe(false))
  await waitFor(() => expect(searched('/api/sales/suggestions')).toBe(1))
  await act(async () => undefined)
  expect(within(area()).queryByRole('alert')).toBeNull()
  expect(within(area()).queryByRole('status')).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Most sold' })).toBeNull()
  expect(within(area()).queryByRole('listitem', { hidden: true })).toBeNull()
})

test('a failed suggestions read and a failed Stock read are silent: the lines add, price and show no stock', async () => {
  suggestionIds = []
  broken.set('stock', 'server')
  renderList()
  await waitFor(() => expect(searched('/api/products')).toBe(1))
  await waitFor(() => expect(isBusy()).toBe(false))
  await act(async () => undefined)
  expect(within(area()).queryByRole('alert')).toBeNull()
  expect(within(area()).queryByRole('status')).toBeNull()
  expect(area().textContent).toBe('')
})

test('a Stock 500 shows the list with no stock text and no error', async () => {
  broken.set('stock', 'server')
  renderList()
  const arbol = await row('Árbol')
  expect(within(arbol).getByText(/500/)).toBeInTheDocument()
  expect(area().textContent ?? '').not.toContain('in stock')
  expect(within(area()).queryByRole('alert')).toBeNull()
  expect(within(area()).queryByRole('status')).toBeNull()
  expect(isBusy()).toBe(false)
  await userEvent.click(screen.getByRole('button', { name: 'Add Árbol' }))
  expect(await screen.findByRole('heading', { name: 'In the sale · 1' })).toBeInTheDocument()
})

test('a suggestions 500 leaves the list working with no suggestions: a typed quantity prices', async () => {
  broken.set('suggestions', 'server')
  productsByDate.set(TODAY, [product(1, 'Rosa', price(1000))])
  renderList()
  await waitFor(() => expect(isBusy()).toBe(false))
  await act(async () => undefined)
  expect(within(area()).queryByRole('alert')).toBeNull()
  expect(screen.getByLabelText('totals').textContent).toBe('[]')
})

test('a read after a failure shows the skeleton again, then the list, never the old date', async () => {
  renderList()
  await row('Rosa')
  await userEvent.click(screen.getByRole('button', { name: 'change date' }))
  expect(await within(area()).findByRole('alert')).toBeInTheDocument()
  expect(isBusy()).toBe(false)
  held = new Set(['products'])
  productsByDate.set(THIRD, [product(1, 'Rosa', price(1111))])
  await userEvent.click(screen.getByRole('button', { name: 'change to third date' }))
  await waitFor(() => expect(gates.has('products')).toBe(true))
  await waitFor(() => expect(isBusy()).toBe(true))
  expect(within(area()).queryByRole('alert')).toBeNull()
  expect(within(area()).getAllByRole('listitem', { hidden: true })).toHaveLength(MOST_SOLD_ROWS)
  expect(area().textContent ?? '').not.toMatch(/Rosa|Árbol|Tulipán/)
  expectNoFigures()
  release('products')
  expect(await within(await row('Rosa')).findByText(/1\.111/)).toBeInTheDocument()
  expect(isBusy()).toBe(false)
})

test('after a failure, a reconnect reads again and the list replaces the notice with the entered quantities', async () => {
  renderList()
  await click('Add Árbol')
  await userEvent.click(screen.getByRole('button', { name: 'Add one Árbol' }))
  productsByDate.set(LATER, [product(2, 'Árbol', price(700))])
  broken.set('products', 'server')
  await userEvent.click(screen.getByRole('button', { name: 'change date' }))
  expect(await within(area()).findByRole('alert')).toBeInTheDocument()
  broken.clear()
  act(() => {
    onlineManager.setOnline(false)
    onlineManager.setOnline(true)
  })
  const line = await row('Árbol')
  expect(await within(line).findByText(/700/)).toBeInTheDocument()
  expect(within(line).getByText('2')).toBeInTheDocument()
  expect(within(area()).queryByRole('alert')).toBeNull()
  expect(isBusy()).toBe(false)
})

test('after a failure, a focus event reads again and the list replaces the notice with the entered quantities', async () => {
  renderList()
  await click('Add Árbol')
  productsByDate.set(LATER, [product(2, 'Árbol', price(700))])
  broken.set('products', 'server')
  await userEvent.click(screen.getByRole('button', { name: 'change date' }))
  expect(await within(area()).findByRole('alert')).toBeInTheDocument()
  broken.clear()
  act(() => {
    focusManager.setFocused(false)
    focusManager.setFocused(true)
  })
  const line = await row('Árbol')
  expect(await within(line).findByText(/700/)).toBeInTheDocument()
  expect(within(line).getByText('1')).toBeInTheDocument()
  expect(within(area()).queryByRole('alert')).toBeNull()
})

test('a focus event or a reconnect on a loaded list sends no products, settings or suggestions request', async () => {
  renderList()
  await row('Rosa')
  await act(async () => undefined)
  // The Stock read keeps the app's defaults (it re-reads on focus, as it did in the component);
  // what must not move is a date read or the suggestions.
  const dateReads = () => requests.filter((path) => path !== '/stock')
  const before = dateReads()
  act(() => {
    focusManager.setFocused(false)
    focusManager.setFocused(true)
    onlineManager.setOnline(false)
    onlineManager.setOnline(true)
  })
  await act(async () => undefined)
  expect(dateReads()).toEqual(before)
})

test('a failed read that fails again on focus keeps the notice and asks once per event', async () => {
  broken.set('products', 'server')
  renderList()
  expect(await within(area()).findByRole('alert')).toBeInTheDocument()
  const before = searched('/api/products')
  act(() => {
    focusManager.setFocused(false)
    focusManager.setFocused(true)
  })
  await waitFor(() => expect(searched('/api/products')).toBe(before + 1))
  expect(await within(area()).findByRole('alert')).toBeInTheDocument()
  expect(isBusy()).toBe(false)
})

test('an offline phone at mount shows no connection with no products request, and the list once it is back', async () => {
  onlineManager.setOnline(false)
  renderList()
  expect(await within(area()).findByRole('status')).toHaveTextContent('Offline: check your internet and try again.')
  expect(isBusy()).toBe(false)
  expect(searched('/api/products')).toBe(0)
  act(() => onlineManager.setOnline(true))
  expect(await screen.findByRole('heading', { name: 'Most sold' })).toBeInTheDocument()
  expect(within(await row('Árbol')).getByText(/500/)).toBeInTheDocument()
  expect(within(area()).queryByRole('status')).toBeNull()
})

test('a second observer of the same Products read keeps its options: the list overrides only its own observer', async () => {
  const { queryClient } = renderList({ second: true })
  await row('Rosa')
  const query = queryClient.getQueryCache().find({ queryKey: saleFormProductsQuery(TODAY).queryKey })
  if (query === undefined) throw new Error('the Products query is not cached')
  expect(query.options.gcTime).toBe(0)
  expect(query.options.networkMode).not.toBe('always')
  expect(query.options.retry).toBe(false)
  expect(query.options.staleTime).toBe(Infinity)
  const reconnect = query.observers.map((observer) => observer.options.refetchOnReconnect)
  const onFocus = query.observers.map((observer) => observer.options.refetchOnWindowFocus)
  expect(query.observers).toHaveLength(2)
  expect(reconnect.filter((option) => option === false)).toHaveLength(1)
  expect(onFocus.filter((option) => option === false)).toHaveLength(1)
  expect(reconnect.filter((option) => typeof option === 'function')).toHaveLength(1)
})
