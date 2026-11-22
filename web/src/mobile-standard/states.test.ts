import { afterEach, describe, expect, it, vi } from 'vitest'
import { STATES } from './allStates.ts'
import { MissingKeyError } from '../i18n/resolve.ts'
import { GONE_NOTICE } from '../api/refusals.ts'
import { recordExpense } from '../api/expenses.ts'
import { HOME, SALE_NEW } from '../routes.ts'
import { STATE_NAMES, WALKABLE } from './registry.ts'
import { common, emptyState, refusal } from './copy.ts'
import { CUSTOMERS_TEXT } from '../copy/customers.ts'
import { PENDING_TAPS } from './pending.ts'
import { offendersAsProblems, stateNameProblems, type WalkState } from './states.ts'
import { isConvertedRow } from '../i18n/step.ts'
import { SALES_TEXT } from '../copy/sales.ts'
import { EXPENSES_TEXT } from '../copy/expenses.ts'
import { NO_PRICE_HINT } from '../copy/sales.ts'
import { DAY_BEFORE_PIN } from './pin.ts'
import { EXPENSE_RECORDED, SALE_IN_PROGRESS_LINE } from './statesSales.ts'

describe('the walked states name no key yet', () => {
  it('has no key-shaped click, press, wait or fill.label in any state', () => {
    expect(STATES.filter((state) => isConvertedRow(state)).map((state) => state.screen)).toEqual([])
  })
})

describe('a walked state that holds a read', () => {
  it('holds GET /phone-countries in the Phone country loading state, so the Selector is read busy', () => {
    const state = STATES.find((candidate) => candidate.screen === 'customer/country-selector-loading')
    expect(state?.holds?.test('http://api.test/phone-countries')).toBe(true)
    expect(state?.holds?.test('http://api.test/phone-countries/x')).toBe(false)
    expect(state?.holds?.test('http://api.test/other')).toBe(false)
  })

  it('holds nothing in the open and locked states, which are read loaded', () => {
    for (const name of ['customer/country-selector-open', 'customer/country-selector-locked']) {
      expect(STATES.find((candidate) => candidate.screen === name)?.holds, name).toBeUndefined()
    }
  })
})

describe('the walked states of the Customers search', () => {
  const state = (screen: string): WalkState => {
    const found = STATES.find((candidate) => candidate.screen === screen)
    if (found === undefined) throw new Error(`${screen} is not walked`)
    return found
  }

  it('ends the no-match state on the existing no-match line, and the cleared state on a customer who owes nothing', () => {
    expect(state('customer/search-no-match').visible).toBe(emptyState('emptyStates:customersList'))
    expect(state('customer/search-cleared-to-all').visible).toBe('Mica Solano')
    expect(state('customer/search-cleared-to-all').steps).toContainEqual({ click: common('common:customerSegmentAll') })
    expect(state('customer/search-cleared-to-all').steps.at(-1)).toEqual({ fill: { label: CUSTOMERS_TEXT.searchCustomer, value: '' } })
  })

  it('finds a debtor by search', () => {
    expect(state('customer/search-answered').visible).toBe('Tincho Aguirre')
  })
})

describe('the walked states and their names', () => {
  it('names every walked state once, and walks every name', () => {
    expect(stateNameProblems(STATES, STATE_NAMES)).toEqual([])
  })

  it('reports a state missing from the names, a name never walked and a repeat', () => {
    const state: WalkState = { screen: 'Uno', route: HOME, steps: [], visible: 'x' }
    expect(stateNameProblems([state, state], ['Dos'])).toEqual([
      'Uno is walked but not in STATE_NAMES',
      'Uno is walked but not in STATE_NAMES',
      'Dos is in STATE_NAMES but never walked',
      'Uno is walked twice',
    ])
  })

  it('gives every state a route starting at a slash and a visible text', () => {
    for (const state of STATES) {
      expect(state.route.startsWith(HOME), state.screen).toBe(true)
      expect(state.visible, state.screen).not.toBe('')
    }
  })
})

describe('a state that lists its offenders as a registry row', () => {
  const rows = WALKABLE.map((row) => row.screen)

  it('names only walked registry rows', () => {
    expect(offendersAsProblems(STATES, rows)).toEqual([])
  })

  it('is only the New sale states whose page the walk ends on, as NuevaVenta', () => {
    const borrowing = STATES.filter((state) => state.offendersAs !== undefined)
    expect(borrowing.map((state) => [state.screen, state.offendersAs])).toEqual([
      ['new-sale/nothing-priced', 'NuevaVenta'],
      ['new-sale/date-change-refetching', 'NuevaVenta'],
      ['sale/expense-returned', 'NuevaVenta'],
    ])
  })

  it('refuses a state naming a row that is not walked, a walked state, or a name no one has', () => {
    const state = (offendersAs: string): WalkState => ({
      screen: 'Uno',
      route: HOME,
      steps: [],
      visible: 'x',
      offendersAs,
    })
    for (const name of ['sale/expense-strip', 'NoExiste']) {
      expect(offendersAsProblems([state(name)], rows), name).toEqual([
        `Uno lists its offenders as ${name}, which is not a walked registry row`,
      ])
    }
    expect(offendersAsProblems([state('NuevaVenta')], rows)).toEqual([])
  })
})

describe('a walked state that holds a refetch after its steps', () => {
  const refetching = STATES.filter((state) => state.refetch !== undefined)

  it('is only the Customers search held and new-sale/date-change-refetching', () => {
    expect(refetching.map((state) => state.screen)).toEqual(['new-sale/date-change-refetching', 'customer/search-held'])
  })

  it('holds GET /api/customers across a longer search, after the first search answered', () => {
    const found = STATES.find((state) => state.screen === 'customer/search-held')
    expect(found?.refetch?.holds.test('/api/customers')).toBe(true)
    expect(found?.refetch?.holds.test('/api/payments/debtors')).toBe(false)
    expect(found?.refetch?.steps).toEqual([{ fill: { label: CUSTOMERS_TEXT.searchCustomer, value: 'Nicol' } }])
    expect(found?.visible).toBe('Nico Parra')
  })

  it('holds the customers and debtors reads of the first Customers load, and nothing else', () => {
    const holds = STATES.find((state) => state.screen === 'ClientesBusqueda')?.holds
    expect(holds?.test('/api/customers')).toBe(true)
    expect(holds?.test('/api/payments/debtors')).toBe(true)
    expect(holds?.test('/api/customers/1')).toBe(false)
    expect(holds?.test('/api/payments')).toBe(false)
  })

  it('holds GET /api/products and not /api/settings, and changes the date to the day before the pin', () => {
    const refetch = refetching.find((state) => state.screen === 'new-sale/date-change-refetching')?.refetch
    expect(refetch?.holds.test('/api/products')).toBe(true)
    expect(refetch?.holds.test('/api/settings')).toBe(false)
    expect(refetch?.steps).toEqual([{ fill: { label: 'Date', value: DAY_BEFORE_PIN } }])
  })

  it('walks the nothing-priced hint on arrival, with no step of its own', () => {
    for (const name of ['new-sale/nothing-priced', 'new-sale/date-change-refetching']) {
      const found = STATES.find((state) => state.screen === name)
      expect(found?.steps, name).toEqual([])
      expect(found?.visible, name).toBe(NO_PRICE_HINT)
    }
  })
})

describe('the walk reads the shared words from the English bundle', () => {
  const state = (screen: string): WalkState => {
    const found = STATES.find((candidate) => candidate.screen === screen)
    if (found === undefined) throw new Error(`${screen} is not walked`)
    return found
  }

  it('waits on the retry and the gone notice as the screens say them', () => {
    expect(state('EstadosReintento').visible).toBe('Something went wrong. Try again.')
    expect(state('EstadosGoneAviso').visible).toBe(refusal(GONE_NOTICE))
    expect(refusal(GONE_NOTICE)).toBe('That is gone. The list is up to date.')
    expect(state('EstadosGoneAviso').steps).toContainEqual({ click: 'Yes, delete it' })
  })

  it('taps the payment form by the words the form shows', () => {
    const payment = PENDING_TAPS.find((tap) => tap.screen === 'CobroDesdeClientes')
    expect(payment?.steps).toEqual([
      { click: 'Nico Parra' },
      { click: 'Record payment' },
      { fill: { label: 'Amount', value: '1000' } },
      { press: 'Payment method' },
      { press: 'Cash' },
    ])
    expect(payment?.button).toBe('Save')
  })

  it('leaves no unfilled placeholder in any state or pending tap', () => {
    const dump = JSON.stringify({ STATES, PENDING_TAPS }, (_key, value: unknown) => (value instanceof RegExp ? value.source : value))
    expect(dump).not.toContain('{{')
    expect(dump).not.toContain('common:')
  })

  it('refuses a key the English bundle does not have', () => {
    expect(() => common('common:noSuchWord' as Parameters<typeof common>[0])).toThrow(MissingKeyError)
  })
})

describe('the walked states of an expense over a sale in progress', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const state = (screen: string): WalkState => {
    const found = STATES.find((candidate) => candidate.screen === screen)
    if (found === undefined) throw new Error(`${screen} is not walked`)
    return found
  }
  const toStrip = [
    { click: 'Pick a product' },
    { press: SALE_IN_PROGRESS_LINE.product },
    { fill: { label: SALES_TEXT.lineGrams(1), value: SALE_IN_PROGRESS_LINE.grams } },
    { click: SALES_TEXT.expense },
  ]

  it('opens the Expense over line 1 and waits for the strip, saving nothing and stubbing no read', () => {
    const strip = state('sale/expense-strip')
    expect(strip.route).toBe(SALE_NEW)
    expect(strip.steps).toEqual(toStrip)
    expect(strip.visible).toBe(SALE_IN_PROGRESS_LINE.total)
    expect(strip.writes).toBeUndefined()
    expect(strip.reads).toBeUndefined()
  })

  it('fills the required fields, saves, and waits for the sale to be intact under "Expense recorded"', () => {
    const returned = state('sale/expense-returned')
    expect(returned.steps.slice(0, toStrip.length)).toEqual(toStrip)
    expect(returned.steps.slice(toStrip.length)).toEqual([
      { click: EXPENSES_TEXT.pickACategory },
      { press: 'Packaging' },
      { fill: { label: 'Amount', value: '1500' } },
      { fill: { label: EXPENSES_TEXT.details, value: 'Cinta' } },
      { click: EXPENSES_TEXT.saveTheExpense },
      { wait: SALE_IN_PROGRESS_LINE.total },
    ])
    expect(returned.visible).toBe(SALES_TEXT.expenseRecorded)
    expect(returned.visible).toBe(EXPENSE_RECORDED)
    expect(returned.reads).toBeUndefined()
  })

  it('stubs one POST on the path the client really sends to record an expense, and nothing else', async () => {
    const sent: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string) => {
        sent.push(path)
        return Promise.resolve(new Response('{}', { status: 201 }))
      }),
    )
    await recordExpense({ spent_on: '2026-01-01', category_id: 1, amount: 1, detail: 'x' })
    const sentPath = new URL(sent[0] ?? '', 'http://api.test').pathname
    const stubs = state('sale/expense-returned').writes ?? []
    expect(stubs).toHaveLength(1)
    expect(stubs[0]?.method).toBe('POST')
    expect(stubs[0]?.status).toBe(201)
    expect(stubs[0]?.path.test(sentPath)).toBe(true)
    // It answers that one create and no other call on the same resource.
    expect(stubs[0]?.path.test(`${sentPath}/3`)).toBe(false)
    expect(stubs[0]?.path.test(`${sentPath}-categories`)).toBe(false)
    expect(stubs[0]?.body).toMatchObject({ id: expect.any(Number) as number, detail: 'Cinta' })
  })

  it('shows a settled figure or toast as its visible text, never a loading label', () => {
    for (const name of ['sale/expense-strip', 'sale/expense-returned']) {
      expect(state(name).visible, name).not.toMatch(/loading|saving|…/i)
    }
  })
})
