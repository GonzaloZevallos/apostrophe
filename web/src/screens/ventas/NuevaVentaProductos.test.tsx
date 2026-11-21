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
  // A second, independent draft over a longer suggestion list: the rows change, a line added the same way is the same.
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
    // Only the search field, whose visually hidden label is the one text; nothing the list reads shows.
    expect(screen.getByRole('region', { name: 'list under test' }).textContent).toBe('Search products')
    expect(screen.getByRole('searchbox', { name: 'Search products' })).toBeInTheDocument()
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

const field = () => screen.getByRole('searchbox', { name: 'Search products' })
const search = async (text: string) => {
  await screen.findByRole('heading', { name: /Most sold|Results/ })
  await userEvent.clear(field())
  await userEvent.type(field(), text)
}
/** The rows' leading names, given the names the test expects (a row's text is its name, then price and steps). */
const names = (expected: string[]) =>
  screen.getAllByRole('listitem').map((item) => expected.find((name) => (item.textContent ?? '').startsWith(name)) ?? item.textContent)

test('the search field is a search keyboard field with its label, placeholder and no clear control', async () => {
  renderList()
  const input = await screen.findByRole('searchbox', { name: 'Search products' })
  expect(input).toHaveAttribute('type', 'search')
  expect(input).toHaveAttribute('inputmode', 'search')
  expect(input).toHaveAttribute('enterkeyhint', 'search')
  expect(input).toHaveAttribute('autocomplete', 'off')
  expect(input).toHaveAttribute('placeholder', 'Search by name')
  expect(screen.queryByRole('button', { name: /scan|barcode|clear/i })).toBeNull()
  expect(screen.queryByRole('combobox')).toBeNull()
})

test('the match ignores case and accents and the results follow the name order, not the Most sold order', async () => {
  productsByDate.set(TODAY, [...PRODUCTS, product(5, 'Lirio', price(250))])
  renderList()
  await search('I')
  expect(await screen.findByRole('heading', { name: 'Results · 3' })).toBeInTheDocument()
  expect(names(['Lirio', 'Sin precio', 'Tulipán'])).toEqual(['Lirio', 'Sin precio', 'Tulipán'])
  await search('TULIPAN')
  expect(await screen.findByRole('heading', { name: 'Results · 1' })).toBeInTheDocument()
  expect(names(['Tulipán'])).toEqual(['Tulipán'])
  await search('árb')
  expect(await screen.findByRole('heading', { name: 'Results · 1' })).toBeInTheDocument()
  expect(names(['Árbol'])).toEqual(['Árbol'])
})

test('names that differ only by case or accent keep a pinned order: fold, then raw name, then id', async () => {
  productsByDate.set(TODAY, [product(2, 'Árbol', price(500)), product(5, 'arbol', price(1)), product(6, 'ARBOL', price(2)), product(7, 'arbol', price(3))])
  suggestionIds = [2]
  renderList()
  await search('arbol')
  expect(await screen.findByRole('heading', { name: 'Results · 4' })).toBeInTheDocument()
  const rows = screen.getAllByRole('listitem')
  expect(rows.map((item) => item.querySelector('mark')?.textContent)).toEqual(['ARBOL', 'arbol', 'arbol', 'Árbol'])
  expect(within(rows[1] as HTMLElement).getByText(/\$\s?1$/)).toBeInTheDocument()
  expect(within(rows[2] as HTMLElement).getByText(/\$\s?3$/)).toBeInTheDocument()
})

test('no match shows "Results · 0" and nothing else', async () => {
  renderList()
  await search('zzz')
  expect(await screen.findByRole('heading', { name: 'Results · 0' })).toBeInTheDocument()
  expect(screen.getAllByRole('heading')).toHaveLength(1)
  expect(screen.queryByRole('listitem')).toBeNull()
  expect(screen.queryByRole('button', { name: /^Add / })).toBeNull()
  expect(screen.getByRole('region', { name: 'list under test' }).textContent).toBe('Search productsResults · 0')
})

test('the mark holds exactly the characters the seller wrote, and the name is unchanged', async () => {
  renderList()
  await search('arb')
  const found = await row('Árbol')
  const mark = within(found).getByText('Árb')
  expect(mark.tagName).toBe('MARK')
  expect(found.querySelectorAll('mark')).toHaveLength(1)
  expect((found.textContent ?? '').startsWith('Árbol')).toBe(true)
  expect(screen.getByRole('button', { name: 'Add Árbol' })).toBeInTheDocument()
})

test('only the first match in a name is marked', async () => {
  productsByDate.set(TODAY, [product(8, 'Ana banana', price(100))])
  suggestionIds = [8]
  renderList()
  await search('an')
  const found = await row('Ana banana')
  expect(found.querySelectorAll('mark')).toHaveLength(1)
  expect(within(found).getByText('An').tagName).toBe('MARK')
})

test('a query of only spaces counts as empty: the sections and the hint stay', async () => {
  productsByDate.set(TODAY, [product(1, 'Rosa', null)])
  suggestionIds = [1]
  renderList()
  await search('   ')
  expect(screen.getByRole('heading', { name: 'Most sold' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /^Results/ })).toBeNull()
  expect(screen.getByText('Add a price to a product so you can sell')).toBeInTheDocument()
  expect(screen.queryByRole('mark')).toBeNull()
})

test('while searching the hint and both sections are hidden, and they come back unchanged once cleared', async () => {
  productsByDate.set(TODAY, [...PRODUCTS, product(5, 'Lirio', price(250))])
  renderList()
  await click('Add Rosa')
  await screen.findByRole('heading', { name: 'In the sale · 1' })
  const before = screen.getAllByRole('listitem').map((item) => item.textContent)
  const headings = screen.getAllByRole('heading').map((heading) => heading.textContent)
  await userEvent.type(field(), 'lir')
  expect(screen.queryByRole('heading', { name: /^In the sale/ })).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Most sold' })).toBeNull()
  expect(screen.queryByText('Add a price to a product so you can sell')).toBeNull()
  await userEvent.clear(field())
  expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual(headings)
  expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(before)
})

test('the hint is hidden while searching', async () => {
  productsByDate.set(TODAY, [product(1, 'Rosa', null)])
  suggestionIds = [1]
  renderList()
  expect(await screen.findByText('Add a price to a product so you can sell')).toBeInTheDocument()
  await userEvent.type(field(), 'ro')
  expect(screen.queryByText('Add a price to a product so you can sell')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Results · 1' })).toBeInTheDocument()
})

test('a priced Product outside Most sold shows its price and "Add <name>"', async () => {
  productsByDate.set(TODAY, [...PRODUCTS, product(5, 'Lirio', price(250))])
  renderList()
  await search('lir')
  const found = await row('Lirio')
  expect(within(found).getByText(/250/)).toBeInTheDocument()
  expect(within(found).getByRole('button', { name: 'Add Lirio' })).toBeInTheDocument()
})

test('a match already in the sale shows its stepper, its quantity and the line\'s own price', async () => {
  renderList()
  await click('Add Rosa')
  await userEvent.click(screen.getByRole('button', { name: 'type 10' }))
  await userEvent.type(field(), 'ros')
  const found = await row('Rosa')
  expect(within(found).getByText(/800/)).toBeInTheDocument()
  expect(within(found).queryByText(/1\.000/)).toBeNull()
  expect(within(found).getByText('10')).toBeInTheDocument()
  expect(within(found).getByRole('button', { name: 'Remove one Rosa' })).toBeInTheDocument()
  expect(within(found).getByRole('button', { name: 'Add one Rosa' })).toBeInTheDocument()
  expect(within(found).queryByRole('button', { name: 'Add Rosa' })).toBeNull()
  expect(screen.getAllByRole('group', { name: 'Rosa' })).toHaveLength(1)
})

test('an unpriced match says "No price" and has no "+"', async () => {
  renderList()
  await search('sin')
  const found = await row('Sin precio')
  expect(within(found).getByText('No price')).toBeInTheDocument()
  expect(within(found).queryByRole('button')).toBeNull()
})

test('tapping "Add <name>" in the results keeps the search text and moves to the stepper', async () => {
  productsByDate.set(TODAY, [...PRODUCTS, product(5, 'Lirio', price(250))])
  renderList()
  await search('lir')
  await userEvent.click(await screen.findByRole('button', { name: 'Add Lirio' }))
  expect(await screen.findByRole('button', { name: 'Add one Lirio' })).toBeInTheDocument()
  expect(field()).toHaveValue('lir')
  expect(screen.getByRole('button', { name: 'Add one Lirio' })).toHaveFocus()
  expect(screen.getByRole('heading', { name: 'Results · 1' })).toBeInTheDocument()
  expect(screen.getAllByRole('group', { name: 'Lirio' })).toHaveLength(1)
  expect(screen.getByLabelText('totals').textContent).toContain('"productId":5')
})

test('typing leaves the Sale in progress unchanged', async () => {
  renderList()
  await click('Add Árbol')
  const totals = screen.getByLabelText('totals').textContent
  await userEvent.type(field(), 'rb')
  await userEvent.clear(field())
  await userEvent.type(field(), 'zzz')
  expect(screen.getByLabelText('totals').textContent).toBe(totals)
})

test('a line whose Product is gone never matches and comes back once the search is cleared', async () => {
  productsByDate.set(LATER, [product(2, 'Árbol', price(700))])
  renderList()
  await click('Add Rosa')
  await userEvent.click(screen.getByRole('button', { name: 'change date' }))
  await screen.findByRole('group', { name: 'no longer available' })
  await userEvent.type(field(), 'no longer')
  expect(await screen.findByRole('heading', { name: 'Results · 0' })).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'no longer available' })).toBeNull()
  await userEvent.clear(field())
  expect(await screen.findByRole('group', { name: 'no longer available' })).toBeInTheDocument()
})

test('while the reads are held the field shows and keeps its text, and no results or count do', async () => {
  held = new Set(['products'])
  renderList()
  await waitFor(() => expect(gates.has('products')).toBe(true))
  await userEvent.type(field(), 'ros')
  expect(field()).toHaveValue('ros')
  expect(screen.queryByRole('heading')).toBeNull()
  expect(screen.queryByText(/Results/)).toBeNull()
  release('products')
  expect(await screen.findByRole('heading', { name: 'Results · 1' })).toBeInTheDocument()
  expect(field()).toHaveValue('ros')
})
