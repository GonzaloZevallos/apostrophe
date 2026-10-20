/**
 * `Gastos` at the screen seam (CODING_STANDARDS §10): through the real data router,
 * Testing Library, the API faked at `fetch` by a small stateful store so a save, an
 * edit and a delete change what the next monthly view answers. Covers the month in the
 * URL, the totals, the record action, editing and deleting in place with their toasts,
 * the form's refusals, and inline category creation.
 */

import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import { EXPENSES, EXPENSE_CATEGORIES } from '../routes'
import { expectIconAndTextRule } from '../test/iconAndTextRule'
import { FLOWER_NOTICE } from './Gastos'
import { CATEGORY_GONE } from './expenses/ExpenseForm'
import { type FetchImpl, ME, jsonResponse, renderExpenses } from '../test/renderExpenses'

interface Row {
  id: number
  spent_on: string
  category_id: number
  amount: number
  detail: string
}

const CATEGORIES = [
  { id: 1, name: 'Packaging' },
  { id: 2, name: 'Otros' },
]

const SEED: Row[] = [
  { id: 9, spent_on: '2026-10-01', category_id: 1, amount: 4500, detail: 'Bolsas' },
  { id: 8, spent_on: '2026-09-28', category_id: 1, amount: 1200, detail: 'Cinta vieja' },
]

/** A stand-in for the expenses API: the month's view is always computed from `rows`. */
function store(rows: Row[], overrides?: FetchImpl) {
  const categories = [...CATEGORIES]
  const impl: FetchImpl = async (url, init) => {
    const method = init?.method ?? 'GET'
    if (overrides !== undefined) {
      try {
        return await overrides(url, init)
      } catch (caught) {
        if (!(caught instanceof RangeError)) throw caught
      }
    }
    const view = /^\/expenses\?month=(\d{4}-\d{2})$/.exec(url)
    if (view !== null && method === 'GET') {
      const month = view[1] ?? ''
      const inMonth = rows.filter((row) => row.spent_on.startsWith(month))
      const groups = [...categories]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((category) => {
          const expenses = inMonth.filter((row) => row.category_id === category.id)
          return {
            id: category.id,
            name: category.name,
            subtotal: expenses.reduce((sum, row) => sum + row.amount, 0),
            expenses,
          }
        })
        .filter((group) => group.expenses.length > 0)
      return jsonResponse(200, {
        month,
        total: groups.reduce((sum, group) => sum + group.subtotal, 0),
        categories: groups,
      })
    }
    if (url === '/expense-categories' && method === 'GET') return jsonResponse(200, categories)
    if (url === '/expense-categories' && method === 'POST') {
      const created = { id: 3, name: JSON.parse(String(init?.body)).name as string }
      categories.push(created)
      return jsonResponse(201, created)
    }
    if (url === EXPENSES && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as Omit<Row, 'id'>
      const row = { id: 100 + rows.length, ...body }
      rows.push(row)
      return jsonResponse(201, row)
    }
    const one = /^\/expenses\/(\d+)$/.exec(url)
    if (one !== null && method === 'PUT') {
      const index = rows.findIndex((row) => row.id === Number(one[1]))
      const body = JSON.parse(String(init?.body)) as Omit<Row, 'id'>
      rows[index] = { id: Number(one[1]), ...body }
      return jsonResponse(200, rows[index])
    }
    if (one !== null && method === 'DELETE') {
      rows.splice(
        rows.findIndex((row) => row.id === Number(one[1])),
        1,
      )
      return new Response(null, { status: 204 })
    }
    throw new Error(`unexpected ${method} ${url}`)
  }
  return impl
}

/** Answers `body` for a request the store would otherwise answer. */
function failing(match: (url: string, method: string) => boolean, make: () => Response): FetchImpl {
  return async (url, init) => {
    if (match(url, init?.method ?? 'GET')) return make()
    throw new RangeError('not mine')
  }
}

async function fillAndSave(detail: string, amount: string): Promise<void> {
  await userEvent.selectOptions(await screen.findByLabelText('Category'), 'Packaging')
  await userEvent.type(screen.getByLabelText('Amount'), amount)
  await userEvent.type(screen.getByLabelText('Detail'), detail)
  await userEvent.click(screen.getByRole('button', { name: 'Save expense' }))
}

function subtotalOf(category: string): string {
  const name = screen.getByText(category, { selector: '.gastos__categoria-nombre' })
  return name.nextElementSibling?.textContent ?? ''
}

function subtotalsShown(): number[] {
  return screen
    .getAllByText(/^\$ /, { selector: '.gastos__categoria-subtotal' })
    .map((node) => Number((node.textContent ?? '').replace(/\D/g, '')))
}

function totalNumber(): number {
  return Number(totalShown().replace(/\D/g, ''))
}

/** October, two expenses in Packaging and one in Otros, so a subtotal is not the total. */
const MULTI: Row[] = [
  { id: 1, spent_on: '2026-10-01', category_id: 1, amount: 4500, detail: 'Bolsas' },
  { id: 2, spent_on: '2026-10-02', category_id: 1, amount: 1500, detail: 'Cinta' },
  { id: 3, spent_on: '2026-10-02', category_id: 2, amount: 700, detail: 'Varios' },
]

function expectTotalIsSumOfSubtotals(): void {
  expect(totalNumber()).toBe(subtotalsShown().reduce((sum, value) => sum + value, 0))
}

function totalShown(): string {
  const label = screen.getByText('You spent this month')
  return label.nextElementSibling?.textContent ?? ''
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('shows the month, its total, each category with its subtotal, the expenses and the flower line', async () => {
  renderExpenses([EXPENSES], store([...SEED]))

  expect(await screen.findByText('October 2026')).toBeInTheDocument()
  expect(await screen.findByText('$ 4.500', { selector: '.cifra-xl' })).toBeInTheDocument()
  expect(screen.getByText('1 expense in 1 category')).toBeInTheDocument()
  expect(subtotalOf('Packaging')).toBe('$ 4.500')
  expect(screen.getByText('Bolsas')).toBeInTheDocument()
  // The September expense is not in October's view.
  expect(screen.queryByText('Cinta vieja')).not.toBeInTheDocument()
  expect(screen.getByText(FLOWER_NOTICE)).toBeInTheDocument()
})

test('an empty month shows $ 0, no categories, the flower line and the record action', async () => {
  renderExpenses([EXPENSES], store([]))

  expect(await screen.findByText('$ 0', { selector: '.cifra-xl' })).toBeInTheDocument()
  expect(screen.queryByText('By category')).not.toBeInTheDocument()
  expect(screen.queryByText('Packaging')).not.toBeInTheDocument()
  expect(screen.getByText(FLOWER_NOTICE)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Add expense' })).toBeInTheDocument()
})

test('opens on the month in ?month= and moving between months writes it without piling history', async () => {
  const router = renderExpenses([EXPENSES + '?month=2026-09'], store([...SEED]))

  expect(await screen.findByText('September 2026')).toBeInTheDocument()
  expect(await screen.findByText('Cinta vieja')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Next month' }))
  expect(await screen.findByText('October 2026')).toBeInTheDocument()
  expect(router.state.location.search).toBe('?month=2026-10')
  expect(await screen.findByText('Bolsas')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))
  expect(await screen.findByText('September 2026')).toBeInTheDocument()
  expect(router.state.location.search).toBe('?month=2026-09')
})

test('a bad ?month= opens on the current month', async () => {
  renderExpenses([EXPENSES + '?month=2026-13'], store([...SEED]))

  expect(await screen.findByText('October 2026')).toBeInTheDocument()
})

test('records from Gastos on a past month: back to that month with the expense shown, toasting once', async () => {
  const rows = [...SEED]
  const router = renderExpenses([EXPENSES + '?month=2026-09'], store(rows))
  await screen.findByText('Cinta vieja')

  await userEvent.click(screen.getByRole('link', { name: 'Add expense' }))
  // The form's date is today (October), so the new expense lands in October;
  // move it into September to show the month the screen came from.
  const date = await screen.findByLabelText('Date')
  await userEvent.clear(date)
  await userEvent.type(date, '2026-09-30')
  await fillAndSave('Cinta nueva', '1000')

  expect(await screen.findByText('Cinta nueva')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(EXPENSES)
  expect(router.state.location.search).toBe('?month=2026-09')
  expect(screen.getByText('September 2026')).toBeInTheDocument()
  expect(await screen.findAllByText('Expense saved')).toHaveLength(1)
  expect(totalShown()).toBe('$ 2.200')
  expect(fetch).toHaveBeenCalledWith(EXPENSES, expect.objectContaining({ method: 'POST' }))
})

test('the record action opens the form with today\'s date', async () => {
  renderExpenses([EXPENSES], store([...SEED]))

  await userEvent.click(await screen.findByRole('link', { name: 'Add expense' }))

  expect(await screen.findByLabelText('Date')).toHaveValue(ME.today)
})

test('editing an expense sends a PUT, toasts in place and the totals follow', async () => {
  renderExpenses([EXPENSES], store([...SEED]))

  await userEvent.click(await screen.findByText('Bolsas'))
  const amount = await screen.findByLabelText('Amount')
  await userEvent.clear(amount)
  await userEvent.type(amount, '5000')
  await userEvent.click(screen.getByRole('button', { name: 'Save expense' }))

  expect(await screen.findAllByText('Expense saved')).toHaveLength(1)
  expect(fetch).toHaveBeenCalledWith('/expenses/9', expect.objectContaining({ method: 'PUT' }))
  expect(await screen.findByText('$ 5.000', { selector: '.cifra-xl' })).toBeInTheDocument()
  expect(totalShown()).toBe('$ 5.000')
  expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument()
})

test('closing the edit with changes asks before discarding; an untouched close is immediate', async () => {
  renderExpenses([EXPENSES], store([...SEED]))

  await userEvent.click(await screen.findByText('Bolsas'))
  await userEvent.click(await screen.findByRole('button', { name: 'Close' }))
  expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument()

  await userEvent.click(screen.getByText('Bolsas'))
  await userEvent.type(await screen.findByLabelText('Detail'), ' x')
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(await screen.findByText('Discard the changes?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'No, keep editing' }))
  expect(screen.getByLabelText('Detail')).toHaveValue('Bolsas x')
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, discard them' }))
  expect(screen.queryByLabelText('Detail')).not.toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalledWith('/expenses/9', expect.objectContaining({ method: 'PUT' }))
})

test('the edit form follows the icon and text rule: delete icon-only, create-category with its icon', async () => {
  renderExpenses([EXPENSES], store([...SEED]))

  await userEvent.click(await screen.findByText('Bolsas'))
  const del = await screen.findByRole('button', { name: 'Delete expense' })
  expect(del).toHaveClass('boton-icono')
  await userEvent.click(screen.getByRole('button', { name: 'Create a new category' }))
  expect(screen.getByRole('button', { name: 'Create category' }).querySelector('svg')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
  expectIconAndTextRule(document.querySelector<HTMLElement>('.gasto-form') ?? document.body)
})

test('deleting names its date, category and amount, toasts in place, and the empty category goes', async () => {
  renderExpenses([EXPENSES], store([...SEED]))

  await userEvent.click(await screen.findByText('Bolsas'))
  await userEvent.click(await screen.findByRole('button', { name: 'Delete expense' }))

  const dialog = screen.getByText('Delete the expense?').closest('.panel')
  expect(dialog).not.toBeNull()
  expect(within(dialog as HTMLElement).getByText(/\$ 4\.500 expense in Packaging from 01\/10/)).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))

  expect(await screen.findAllByText('Expense deleted')).toHaveLength(1)
  expect(await screen.findByText('$ 0', { selector: '.cifra-xl' })).toBeInTheDocument()
  expect(screen.queryByText('Packaging')).not.toBeInTheDocument()
})

test('editing an expense that is already gone shows the gone notice and closes the form', async () => {
  renderExpenses(
    [EXPENSES],
    store(
      [...SEED],
      failing(
        (url, method) => url === '/expenses/9' && method === 'PUT',
        () => jsonResponse(404, { detail: 'no expense', code: 'expense.not_found' }),
      ),
    ),
  )

  await userEvent.click(await screen.findByText('Bolsas'))
  await userEvent.click(await screen.findByRole('button', { name: 'Save expense' }))

  const notice = await screen.findByText("That's gone. The list is up to date.")
  expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument()
  // The floating slot the success toasts use.
  expect(notice.closest('.aviso-flotante')).not.toBeNull()
})

test('deleting an expense that is already gone shows the gone notice', async () => {
  renderExpenses(
    [EXPENSES],
    store(
      [...SEED],
      failing(
        (url, method) => url === '/expenses/9' && method === 'DELETE',
        () => jsonResponse(404, { detail: 'no expense', code: 'expense.not_found' }),
      ),
    ),
  )

  await userEvent.click(await screen.findByText('Bolsas'))
  await userEvent.click(await screen.findByRole('button', { name: 'Delete expense' }))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))

  expect(await screen.findByText("That's gone. The list is up to date.")).toBeInTheDocument()
  expect(screen.queryByText('Expense deleted')).not.toBeInTheDocument()
})

test('a dropped network on delete shows "Offline", never the gone notice', async () => {
  renderExpenses(
    [EXPENSES],
    store(
      [...SEED],
      async (url, init) => {
        if (url === '/expenses/9' && init?.method === 'DELETE') throw new TypeError('network error')
        throw new RangeError('not mine')
      },
    ),
  )

  await userEvent.click(await screen.findByText('Bolsas'))
  await userEvent.click(await screen.findByRole('button', { name: 'Delete expense' }))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))

  expect(await screen.findByText('No connection: check your internet and try again.')).toBeInTheDocument()
  expect(screen.queryByText("That's gone. The list is up to date.")).not.toBeInTheDocument()
  // The confirmation stays open so the user can retry once back online.
  expect(screen.getByRole('button', { name: 'Yes, delete it' })).toBeInTheDocument()
})

test('a category removed mid-form keeps what was typed and empties Category', async () => {
  renderExpenses(
    [EXPENSES],
    store(
      [...SEED],
      failing(
        (url, method) => url === EXPENSES && method === 'POST',
        () => jsonResponse(404, { detail: 'no category', code: 'expense_category.not_found' }),
      ),
    ),
  )

  await userEvent.click(await screen.findByRole('link', { name: 'Add expense' }))
  await fillAndSave('Cinta para embalar', '1000')

  expect(await screen.findByText(CATEGORY_GONE)).toBeInTheDocument()
  expect(screen.getByLabelText('Category')).toHaveValue('')
  expect(screen.getByLabelText('Detail')).toHaveValue('Cinta para embalar')
})

test('a server error on the expense form shows the generic retry, never the refusal text', async () => {
  renderExpenses(
    [EXPENSES],
    store(
      [...SEED],
      failing(
        (url, method) => url === EXPENSES && method === 'POST',
        () => new Response('internal error', { status: 500 }),
      ),
    ),
  )

  await userEvent.click(await screen.findByRole('link', { name: 'Add expense' }))
  await fillAndSave('Cinta', '1000')

  expect(await screen.findByText(ERROR_GENERICO_MENSAJE)).toBeInTheDocument()
})

test('creating a category inside the expense form keeps what was typed and selects it', async () => {
  renderExpenses([EXPENSES], store([...SEED]))

  await userEvent.click(await screen.findByRole('link', { name: 'Add expense' }))
  await userEvent.type(await screen.findByLabelText('Detail'), 'Sustrato nuevo')
  await userEvent.click(screen.getByRole('button', { name: 'Create a new category' }))
  await userEvent.type(screen.getByLabelText('New category name'), 'Insumos')
  await userEvent.click(screen.getByRole('button', { name: 'Create category' }))

  await vi.waitFor(() => {
    expect(screen.getByLabelText('Category')).toHaveValue('3')
  })
  expect(screen.getByLabelText('Detail')).toHaveValue('Sustrato nuevo')
})

test('links to the expense categories, now a Settings group, from its foot', async () => {
  renderExpenses([EXPENSES], store([...SEED]))

  const categories = await screen.findByRole('link', { name: 'Categories' })
  expect(categories).toHaveAttribute('href', EXPENSE_CATEGORIES)
  expect(EXPENSE_CATEGORIES).toBe(EXPENSE_CATEGORIES)
})

test('subtotals and the total stay equal to the sum shown after create, edit and delete', async () => {
  renderExpenses([EXPENSES], store([...MULTI]))

  await screen.findByText('Bolsas')
  expect(subtotalOf('Packaging')).toBe('$ 6.000')
  expect(subtotalOf('Otros')).toBe('$ 700')
  expect(totalShown()).toBe('$ 6.700')
  expectTotalIsSumOfSubtotals()

  // Create: another Packaging expense.
  await userEvent.click(screen.getByRole('link', { name: 'Add expense' }))
  await fillAndSave('Etiquetas', '300')
  await screen.findByText('Etiquetas')
  await vi.waitFor(() => expect(subtotalOf('Packaging')).toBe('$ 6.300'))
  expect(subtotalOf('Otros')).toBe('$ 700')
  expect(totalShown()).toBe('$ 7.000')
  expectTotalIsSumOfSubtotals()

  // Edit: Bolsas goes from 4.500 to 5.000.
  await userEvent.click(screen.getByText('Bolsas'))
  const amount = await screen.findByLabelText('Amount')
  await userEvent.clear(amount)
  await userEvent.type(amount, '5000')
  await userEvent.click(screen.getByRole('button', { name: 'Save expense' }))
  await vi.waitFor(() => expect(subtotalOf('Packaging')).toBe('$ 6.800'))
  expect(subtotalOf('Otros')).toBe('$ 700')
  expect(totalShown()).toBe('$ 7.500')
  expectTotalIsSumOfSubtotals()

  // Delete: the Otros expense, so its category disappears and Packaging is unchanged.
  await userEvent.click(screen.getByText('Varios'))
  await userEvent.click(await screen.findByRole('button', { name: 'Delete expense' }))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))
  await vi.waitFor(() => expect(screen.queryByText('Varios')).not.toBeInTheDocument())
  expect(screen.queryByText('Otros', { selector: '.gastos__categoria-nombre' })).not.toBeInTheDocument()
  expect(subtotalOf('Packaging')).toBe('$ 6.800')
  expect(totalShown()).toBe('$ 6.800')
  expectTotalIsSumOfSubtotals()
})

test('a duplicate category name inside the form is refused, keeping what was typed', async () => {
  renderExpenses(
    [EXPENSES],
    store(
      [...SEED],
      failing(
        (url, method) => url === '/expense-categories' && method === 'POST',
        () => jsonResponse(409, { detail: 'taken', code: 'expense_category.name_taken' }),
      ),
    ),
  )

  await userEvent.click(await screen.findByRole('link', { name: 'Add expense' }))
  await userEvent.type(await screen.findByLabelText('Detail'), 'Sustrato nuevo')
  await userEvent.click(screen.getByRole('button', { name: 'Create a new category' }))
  await userEvent.type(screen.getByLabelText('New category name'), 'Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Create category' }))

  expect(await screen.findByText('Check the details and try again.')).toBeInTheDocument()
  expect(screen.getByLabelText('New category name')).toHaveValue('Packaging')
  expect(screen.getByLabelText('Detail')).toHaveValue('Sustrato nuevo')
  expect(screen.getByLabelText('Category')).toHaveValue('')
})

test('if the categories cannot load, the edit overlay still has "Close"', async () => {
  renderExpenses(
    [EXPENSES],
    store(
      [...SEED],
      failing(
        (url, method) => url === '/expense-categories' && method === 'GET',
        () => new Response('boom', { status: 500 }),
      ),
    ),
  )

  await userEvent.click(await screen.findByText('Bolsas'))
  await userEvent.click(await screen.findByRole('button', { name: 'Close' }))

  expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
})
