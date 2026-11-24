/**
 * The computer register's Product results table at the component seam (Testing Library, `fetch`
 * faked). The wrapper calls the real `useSaleDraft` and shows the draft's lines; it is local to
 * this file.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { STOCK_TEXT } from '../../copy/stock'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import { useSaleDraft } from '../../sales/useSaleDraft'
import ProductResultsTable from './ProductResultsTable'

const price = (list: number) => ({ id: 1, effective_from: '2026-09-01', list_price: list, bulk_price: null, bulk_minimum: null })
const product = (id: number, name: string, list: number | null) => ({
  id,
  name,
  archived: false,
  current_price: list === null ? null : price(list),
})

const TODAY = '2026-10-02'
const OTHER_DAY = '2026-09-28'
const PRODUCTS = [
  product(1, 'Rosa', 1000),
  product(2, 'Árbol', 500),
  product(3, 'Sin precio', null),
  product(4, 'Tulipán', 300),
]

const stockRow = (productId: number, quantity: number, status: string) => ({
  product_id: productId,
  quantity,
  status,
  sold_out_since: null,
  threshold: null,
  days_left: null,
})
const STOCK = [stockRow(1, 12.5, 'ok'), stockRow(2, 3, 'low'), stockRow(3, -2, 'sold_out')]
const FAILURE = 'The products could not load. Reload this screen to try again.'

let productsByDate: Map<string, unknown>
let stockRows: unknown[]
let broken: Set<string>
let held: Set<string>
let gates: Map<string, () => void>

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function answerOf(path: string): Response {
  if (path === '/pricing-settings') return json(200, { is_bulk_pricing: true, is_vip_customers: true })
  if (path === '/stock') return json(200, { total: 0, products: stockRows, entries: [] })
  const body = productsByDate.get(new URL(path, 'http://x').searchParams.get('on') ?? '')
  return body === undefined ? json(500, {}) : json(200, body)
}

beforeEach(() => {
  productsByDate = new Map([[TODAY, PRODUCTS]])
  stockRows = STOCK
  broken = new Set()
  held = new Set()
  gates = new Map()
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const path = String(input)
      const read = path === '/pricing-settings' ? 'settings' : path === '/stock' ? 'stock' : 'products'
      if (broken.has(read)) return Promise.resolve(json(500, {}))
      if (held.has(read)) {
        return new Promise<Response>((resolve) => {
          gates.set(read, () => resolve(answerOf(path)))
        })
      }
      return Promise.resolve(answerOf(path))
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function Harness({ customerTypeId = null }: { customerTypeId?: number | null }) {
  const draft = useSaleDraft({ today: TODAY })
  return (
    <MoneyFormatProvider format={{ symbol: '$', decimals: 0 }}>
      <button type="button" onClick={() => draft.setDate(OTHER_DAY)}>
        change date
      </button>
      <output aria-label="lines">{JSON.stringify(draft.state.lines)}</output>
      <ProductResultsTable draft={draft} customerTypeId={customerTypeId} />
    </MoneyFormatProvider>
  )
}

function renderTable() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>,
  )
}

const input = () => screen.getByRole('combobox', { name: 'Search products' })
const grid = () => screen.getByRole('grid')
const bodyRows = () => within(grid()).queryAllByRole('row').filter((row) => row.hasAttribute('aria-selected'))
const names = () => bodyRows().map((row) => within(row).getAllByRole('gridcell')[0]?.textContent ?? '')
const selectedName = () => {
  const selected = bodyRows().filter((row) => row.getAttribute('aria-selected') === 'true')
  expect(selected).toHaveLength(1)
  return within(selected[0] as HTMLElement).getAllByRole('gridcell')[0]?.textContent
}
const lines = (): { productId: number; quantityHundredths: number }[] =>
  JSON.parse(screen.getByLabelText('lines').textContent ?? '[]')

async function ready() {
  renderTable()
  await waitFor(() => expect(bodyRows().length).toBeGreaterThan(0))
}

function release(read: string) {
  const open = gates.get(read)
  if (open === undefined) throw new Error(`${read} was not asked for`)
  gates.delete(read)
  act(() => open())
}

test('the search is focused on mount and the rows come in name order with their prices', async () => {
  await ready()
  expect(input()).toHaveFocus()
  expect(names()).toEqual(['Árbol', 'Rosa', 'Sin precio', 'Tulipán'])
  const rosa = bodyRows()[1] as HTMLElement
  expect(within(rosa).getAllByRole('gridcell')[2]?.textContent).toMatch(/1\.000/)
  expect(within(bodyRows()[2] as HTMLElement).getByText('No price')).toBeInTheDocument()
  expect(screen.getByText('↑ ↓ to move, Enter to add.')).toBeInTheDocument()
  expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Product', 'Stock', 'Price', 'Add'])
  expect(grid()).toHaveAttribute('aria-busy', 'false')
})

test('arrows move the selection and stop at both ends', async () => {
  const user = userEvent.setup()
  await ready()
  expect(selectedName()).toBe('Árbol')
  await user.keyboard('{ArrowUp}')
  expect(selectedName()).toBe('Árbol')
  await user.keyboard('{ArrowDown}{ArrowDown}')
  expect(selectedName()).toBe('Sin precio')
  await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
  expect(selectedName()).toBe('Tulipán')
  await user.keyboard('{ArrowUp}')
  expect(selectedName()).toBe('Sin precio')
  expect(input()).toHaveFocus()
})

test('names that fold equal keep the order Árbol, arbol, Arbol by the name as typed', async () => {
  productsByDate.set(TODAY, [product(1, 'arbol', 100), product(2, 'Árbol', 100), product(3, 'Arbol', 100)])
  await ready()
  expect(names()).toEqual(['Arbol', 'arbol', 'Árbol'])
})

test('three adds by typing and Enter keep the focus, empty the search and select the first row', async () => {
  const user = userEvent.setup()
  await ready()
  for (const text of ['ros', 'tul', 'arb']) {
    await user.keyboard(`${text}{Enter}`)
    expect(input()).toHaveValue('')
    expect(input()).toHaveFocus()
    expect(selectedName()).toBe('Árbol')
    expect(bodyRows()).toHaveLength(4)
  }
  expect(lines().map((line) => line.productId)).toEqual([1, 4, 2])
})

test('typing selects the first match, and Enter adds it', async () => {
  const user = userEvent.setup()
  await ready()
  await user.keyboard('{ArrowDown}')
  expect(selectedName()).toBe('Rosa')
  await user.keyboard('u')
  expect(names()).toEqual(['Tulipán'])
  expect(selectedName()).toBe('Tulipán')
  await user.clear(input())
  expect(selectedName()).toBe('Árbol')
  await user.keyboard('r{Enter}')
  expect(lines().map((line) => line.productId)).toEqual([2])
})

test('Enter on a Product already in the sale raises its line and adds no second one', async () => {
  const user = userEvent.setup()
  await ready()
  await user.keyboard('rosa{Enter}')
  const first = lines()
  expect(first).toHaveLength(1)
  await user.keyboard('rosa{Enter}')
  const second = lines()
  expect(second).toHaveLength(1)
  expect((second[0] as { quantityHundredths: number }).quantityHundredths).toBeGreaterThan(
    (first[0] as { quantityHundredths: number }).quantityHundredths,
  )
})

test('a Product with no price shows No price in words and Enter on it adds nothing', async () => {
  const user = userEvent.setup()
  await ready()
  await user.keyboard('sin{Enter}')
  expect(selectedName()).toBe('Sin precio')
  expect(within(bodyRows()[0] as HTMLElement).getByText('No price')).toBeInTheDocument()
  expect(input()).toHaveValue('sin')
  expect(lines()).toEqual([])
})

const cellsOf = (name: string) => {
  const row = bodyRows().find((candidate) => within(candidate).getAllByRole('gridcell')[0]?.textContent === name)
  if (row === undefined) throw new Error(`no row for ${name}`)
  return within(row).getAllByRole('gridcell')
}
const stockCell = (name: string) => cellsOf(name)[1] as HTMLElement

test('the Stock cell is the bare figure: ok shows no word, low and sold out add theirs, a negative keeps its sign', async () => {
  await ready()
  expect(stockCell('Rosa').textContent).toBe('12,5')
  expect(stockCell('Árbol').textContent).toBe(`3${STOCK_TEXT.statusLow}`)
  expect(stockCell('Sin precio').textContent).toBe(`-2${STOCK_TEXT.statusSoldOut}`)
  expect(stockCell('Rosa')).toHaveClass('cifra-n')
})

test('a no entries row shows 0 and its word, and a Product with no stock row shows an empty cell', async () => {
  stockRows = [stockRow(1, 0, 'no_entries')]
  await ready()
  expect(stockCell('Rosa').textContent).toBe(`0${STOCK_TEXT.statusNoEntries}`)
  expect(stockCell('Árbol').textContent).toBe('')
  expect(stockCell('Tulipán').textContent).toBe('')
})

test('a date change holds the table with aria-busy and no rows until the answer, keeping text and focus', async () => {
  const user = userEvent.setup()
  productsByDate.set(OTHER_DAY, [product(2, 'Árbol', 700), product(4, 'Tulipán', 300)])
  await ready()
  await user.keyboard('a')
  held.add('products')
  held.add('settings')
  await user.click(screen.getByRole('button', { name: 'change date' }))
  await waitFor(() => expect(grid()).toHaveAttribute('aria-busy', 'true'))
  expect(bodyRows()).toHaveLength(0)
  expect(within(grid()).getByText('Loading products…')).toBeInTheDocument()
  expect(grid().textContent).not.toMatch(/\d|\$/)
  await user.click(input())
  await user.keyboard('{Enter}')
  expect(lines()).toEqual([])
  held.clear()
  release('products')
  release('settings')
  await waitFor(() => expect(grid()).toHaveAttribute('aria-busy', 'false'))
  expect(names()).toEqual(['Árbol', 'Tulipán'])
  expect(bodyRows()[0]?.textContent).toMatch(/700/)
  expect(input()).toHaveValue('a')
  expect(input()).toHaveFocus()
})

test('when a new answer drops the selected Product the selection moves to the first row and Enter adds it', async () => {
  const user = userEvent.setup()
  productsByDate.set(OTHER_DAY, [product(2, 'Árbol', 700), product(4, 'Tulipán', 300)])
  await ready()
  await user.keyboard('{ArrowDown}')
  expect(selectedName()).toBe('Rosa')
  await user.click(screen.getByRole('button', { name: 'change date' }))
  await waitFor(() => expect(names()).toEqual(['Árbol', 'Tulipán']))
  expect(selectedName()).toBe('Árbol')
  await user.click(input())
  await user.keyboard('{Enter}')
  expect(lines().map((line) => line.productId)).toEqual([2])
})

test.each([['products'], ['settings'], ['stock']])(
  'a rejected %s read shows the failure line and no rows, and Enter adds nothing',
  async (read) => {
    const user = userEvent.setup()
    broken.add(read)
    renderTable()
    await waitFor(() => expect(within(grid()).getByText(FAILURE)).toBeInTheDocument())
    expect(grid()).toHaveAttribute('aria-busy', 'false')
    expect(bodyRows()).toHaveLength(0)
    expect(within(grid()).getByText(FAILURE).closest('td')).toHaveAttribute('colspan', '4')
    expect(screen.getByText('↑ ↓ to move, Enter to add.')).toBeInTheDocument()
    await user.keyboard('r{Enter}')
    expect(lines()).toEqual([])
  },
)

test('one read failed while the other is still pending: aria-busy stays true and the failure line shows', async () => {
  broken.add('products')
  held.add('settings')
  renderTable()
  await waitFor(() => expect(gates.has('settings')).toBe(true))
  await waitFor(() => expect(within(grid()).getByText(FAILURE)).toBeInTheDocument())
  expect(grid()).toHaveAttribute('aria-busy', 'true')
  expect(bodyRows()).toHaveLength(0)
})

test('after Stock fails, a window focus and an online event keep the failure line and ask for Stock no more', async () => {
  broken.add('stock')
  renderTable()
  await waitFor(() => expect(within(grid()).getByText(FAILURE)).toBeInTheDocument())
  const stockCalls = () => vi.mocked(fetch).mock.calls.filter(([url]) => String(url) === '/stock').length
  const before = stockCalls()
  act(() => {
    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('online'))
  })
  await act(async () => {
    await Promise.resolve()
  })
  expect(within(grid()).getByText(FAILURE)).toBeInTheDocument()
  expect(stockCalls()).toBe(before)
})

test('no products at all shows the no-products line over the four columns, with no link', async () => {
  productsByDate.set(TODAY, [])
  renderTable()
  const line = await within(grid()).findByText('No products yet.')
  expect(line.closest('td')).toHaveAttribute('colspan', '4')
  expect(within(grid()).queryByRole('link')).toBeNull()
  expect(bodyRows()).toHaveLength(0)
  expect(screen.getByText('↑ ↓ to move, Enter to add.')).toBeInTheDocument()
})

test('a search with no match shows the no-match line, and clearing it brings the rows back', async () => {
  const user = userEvent.setup()
  await ready()
  await user.keyboard('zzz')
  expect(within(grid()).getByText('No product matches that search.')).toBeInTheDocument()
  expect(bodyRows()).toHaveLength(0)
  expect(input()).toHaveFocus()
  await user.clear(input())
  expect(bodyRows()).toHaveLength(4)
  expect(within(grid()).queryByText('No product matches that search.')).toBeNull()
})

test('aria-controls always resolves and aria-activedescendant resolves or is absent', async () => {
  const user = userEvent.setup()
  renderTable()
  expect(document.getElementById(input().getAttribute('aria-controls') ?? '')).toBe(grid())
  expect(input()).not.toHaveAttribute('aria-activedescendant')
  await waitFor(() => expect(bodyRows().length).toBeGreaterThan(0))
  const active = () => document.getElementById(input().getAttribute('aria-activedescendant') ?? '')
  expect(active()).toBe(bodyRows()[0])
  await user.keyboard('{ArrowDown}')
  expect(active()).toBe(bodyRows()[1])
  await user.keyboard('zzz')
  expect(bodyRows()).toHaveLength(0)
  expect(input()).not.toHaveAttribute('aria-activedescendant')
  expect(document.getElementById(input().getAttribute('aria-controls') ?? '')).toBe(grid())
})

test('Escape with text clears it and is consumed; on an empty search it goes up', async () => {
  const user = userEvent.setup()
  await ready()
  const onDocument = vi.fn()
  const onWindow = vi.fn()
  await user.keyboard('ro{ArrowDown}')
  document.addEventListener('keydown', onDocument)
  window.addEventListener('keydown', onWindow)
  try {
    const notPrevented = fireEvent.keyDown(input(), { key: 'Escape' })
    expect(notPrevented).toBe(false)
    expect(onDocument).not.toHaveBeenCalled()
    expect(onWindow).not.toHaveBeenCalled()
    expect(input()).toHaveValue('')
    expect(selectedName()).toBe('Árbol')
    expect(input()).toHaveFocus()
    const emptyNotPrevented = fireEvent.keyDown(input(), { key: 'Escape' })
    expect(emptyNotPrevented).toBe(true)
    expect(onDocument).toHaveBeenCalledTimes(1)
    expect(onWindow).toHaveBeenCalledTimes(1)
  } finally {
    document.removeEventListener('keydown', onDocument)
    window.removeEventListener('keydown', onWindow)
  }
})

test('keys while composing move nothing and add nothing', async () => {
  await ready()
  fireEvent.keyDown(input(), { key: 'ArrowDown', isComposing: true })
  expect(selectedName()).toBe('Árbol')
  fireEvent.keyDown(input(), { key: 'Enter', isComposing: true })
  expect(lines()).toEqual([])
})

test('clicking a row selects it without adding and keeps the focus in the search, and the arrows go on from it', async () => {
  const user = userEvent.setup()
  await ready()
  await user.click(within(bodyRows()[2] as HTMLElement).getAllByRole('gridcell')[0] as HTMLElement)
  expect(input()).toHaveFocus()
  expect(selectedName()).toBe('Sin precio')
  expect(lines()).toEqual([])
  await user.keyboard('{ArrowDown}')
  expect(selectedName()).toBe('Tulipán')
})

test('the selected row is kept in view with scrollIntoView nearest', async () => {
  const user = userEvent.setup()
  await ready()
  await user.keyboard('{ArrowDown}')
  expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest' })
})

const addButton = (name: string) => screen.getByRole('button', { name: `Add ${name}` })

test('an Add click on the third row adds its line, empties the search, selects the first row and keeps focus in the search', async () => {
  const user = userEvent.setup()
  await ready()
  await user.keyboard('{ArrowDown}')
  await user.click(addButton('Tulipán'))
  expect(lines().map((line) => line.productId)).toEqual([4])
  expect(input()).toHaveValue('')
  expect(input()).toHaveFocus()
  expect(selectedName()).toBe('Árbol')
})

test('an Add click after a search adds the clicked Product and clears the search', async () => {
  const user = userEvent.setup()
  await ready()
  await user.keyboard('ro')
  await user.click(addButton('Rosa'))
  expect(lines().map((line) => line.productId)).toEqual([1])
  expect(input()).toHaveValue('')
  expect(bodyRows()).toHaveLength(4)
})

test('an Add click on a Product already in the sale raises its line and adds no second one', async () => {
  const user = userEvent.setup()
  await ready()
  await user.click(addButton('Rosa'))
  const first = lines()
  await user.click(addButton('Rosa'))
  const second = lines()
  expect(second).toHaveLength(1)
  expect((second[0] as { quantityHundredths: number }).quantityHundredths).toBeGreaterThan(
    (first[0] as { quantityHundredths: number }).quantityHundredths,
  )
})

test('the Add button of a No price row is aria-disabled: a click adds nothing and focus stays in the search', async () => {
  const user = userEvent.setup()
  await ready()
  expect(addButton('Sin precio')).toHaveAttribute('aria-disabled', 'true')
  expect(addButton('Rosa')).toHaveAttribute('aria-disabled', 'false')
  await user.click(addButton('Sin precio'))
  expect(lines()).toEqual([])
  expect(input()).toHaveFocus()
})

test('a click elsewhere on a row selects it without adding', async () => {
  const user = userEvent.setup()
  await ready()
  await user.click(stockCell('Tulipán'))
  expect(selectedName()).toBe('Tulipán')
  expect(lines()).toEqual([])
})

test('the Add buttons are out of the tab order: Tab from the search leaves the table', async () => {
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Harness />
      <button type="button">after the table</button>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(bodyRows().length).toBeGreaterThan(0))
  for (const row of bodyRows()) {
    expect(within(row).getByRole('button')).toHaveAttribute('tabindex', '-1')
  }
  expect(input()).toHaveFocus()
  await user.tab()
  expect(screen.getByRole('button', { name: 'after the table' })).toHaveFocus()
})
