import { afterEach, describe, expect, it, vi } from 'vitest'
import { STATES } from './allStates.ts'
import { MissingKeyError } from '../i18n/resolve.ts'
import { GONE_NOTICE } from '../api/refusals.ts'
import { recordExpense } from '../api/expenses.ts'
import { HOME, SALE_NEW } from '../routes.ts'
import { STATE_NAMES, WALKABLE } from './registry.ts'
import { common, emptyState, expenses, refusal } from './copy.ts'
import { CUSTOMERS_TEXT } from '../copy/customers.ts'
import { PENDING_TAPS } from './pending.ts'
import { offendersAsProblems, stateNameProblems, type WalkState } from './states.ts'
import { isConvertedRow } from '../i18n/step.ts'
import { SALES_TEXT } from '../copy/sales.ts'
import { EXPENSES_TEXT } from '../copy/expenses.ts'
import { NO_PRICE_HINT } from '../copy/sales.ts'
import { DAY_BEFORE_PIN } from './pin.ts'
import { EXPENSE_RECORDED, SALE_IN_PROGRESS_LINE, UNKNOWN_PAYMENT_SALES } from './statesSales.ts'
import type { Sale } from '../api/sales.ts'
import { moneyFormatter } from '../format/money.ts'
import { paymentView } from '../screens/ventas/salePayment.ts'

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

/** The path a read goes to, as the walk matches it: the request URL's pathname. */
const pathOf = (url: string): string => new URL(url).pathname

describe('the walked states of the Customers search', () => {
  const state = (screen: string): WalkState => {
    const found = STATES.find((candidate) => candidate.screen === screen)
    if (found === undefined) throw new Error(`${screen} is not walked`)
    return found
  }

  it('ends the no-match state on the customer no-match line, and the cleared state on a customer who owes nothing', () => {
    expect(state('customer/search-no-match').visible).toBe(emptyState('emptyStates:customersNoMatch', { name: 'Gelato' }))
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

  it('is only the New sale states whose page the walk ends on, as NuevaVenta, the unknown-payment Sales list, as Ventas, the cleared Customers search and the Customers notice state, as Clientes', () => {
    const borrowing = STATES.filter((state) => state.offendersAs !== undefined)
    expect(borrowing.map((state) => [state.screen, state.offendersAs])).toEqual([
      ['new-sale/nothing-priced', 'NuevaVenta'],
      ['new-sale/date-change-refetching', 'NuevaVenta'],
      ['sale/expense-returned', 'NuevaVenta'],
      ['sales/unknown-payment', 'Ventas'],
      ['customer/search-cleared-to-all', 'Clientes'],
      ['ClientesSinCifras', 'Clientes'],
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

  it('holds GET /customers across a longer search, after the first search answered', () => {
    const found = STATES.find((state) => state.screen === 'customer/search-held')
    expect(found?.refetch?.holds.test(pathOf('http://api.test/customers'))).toBe(true)
    expect(found?.refetch?.holds.test(pathOf('http://api.test/payments/debtors'))).toBe(false)
    expect(found?.refetch?.holds.test(pathOf('http://api.test/customers/1'))).toBe(false)
    expect(found?.refetch?.steps).toEqual([{ fill: { label: CUSTOMERS_TEXT.searchCustomer, value: 'Nicol' } }])
    expect(found?.visible).toBe('Nico Parra')
  })

  it('holds the customers and debtors reads of the first Customers load, and nothing else', () => {
    const holds = STATES.find((state) => state.screen === 'ClientesBusqueda')?.holds
    expect(holds?.test(pathOf('http://api.test/customers'))).toBe(true)
    expect(holds?.test(pathOf('http://api.test/payments/debtors'))).toBe(true)
    expect(holds?.test(pathOf('http://api.test/customers/1'))).toBe(false)
    expect(holds?.test(pathOf('http://api.test/payments'))).toBe(false)
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
    expect(state('EstadosGoneAviso').steps).toContainEqual({ click: 'Yes, void' })
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
      { fill: { label: expenses('expenses:form.detailsOptional'), value: 'Cinta' } },
      { click: expenses('expenses:form.saveWithAmount', { amount: '$ 1.500' }) },
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
    await recordExpense({ spent_on: '2026-01-01', category_id: 1, amount: 1, detail: 'x', payment_method_id: null })
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

describe('the walked state sales/unknown-payment', () => {
  it('stubs one sale for each way the chip can read, so the degraded line is really visited', () => {
    const money = moneyFormatter({ symbol: '$', decimals: 0 })
    const variants = UNKNOWN_PAYMENT_SALES.map((row) => paymentView(row.payment_state, row.still_owed, money).variant)
    expect([...variants].sort()).toEqual(['paid', 'part_paid', 'unknown', 'unpaid'])
  })

  it('holds rows the real Sale type accepts, so the stub cannot drift from the API', () => {
    const rows = UNKNOWN_PAYMENT_SALES satisfies readonly Sale[]
    expect(rows).toHaveLength(4)
  })

  it('gives each stub sale its own customer name, so a name finds one card', () => {
    const names = UNKNOWN_PAYMENT_SALES.map((row) => row.customer.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('keeps each row\'s still_owing and payment in agreement with its payment pair', () => {
    for (const row of UNKNOWN_PAYMENT_SALES) {
      expect(row.still_owing, row.customer.name).toBe(row.payment_state !== 'paid')
      expect(row.payment, row.customer.name).toBe(row.payment_state === 'paid' ? 'paid' : 'owing')
    }
  })

  it('refuses a row read as the unknown line when its pair is not null (rejects a wrong reading)', () => {
    const money = moneyFormatter({ symbol: '$', decimals: 0 })
    expect(paymentView('part_paid', null, money).variant).toBe('unknown')
    expect(paymentView('part_paid', 0, money).variant).toBe('unknown')
  })
})

describe('the walked states of the expense form', () => {
  const state = (screen: string): WalkState => {
    const found = STATES.find((candidate) => candidate.screen === screen)
    if (found === undefined) throw new Error(`${screen} is not walked`)
    return found
  }

  it('opens the How you paid list over the form and ends on a method in it', () => {
    expect(state('expense/method-selector-open').steps).toEqual([
      // The button is named by the label then the value shown (the empty wording on a new expense), never the label alone.
      { press: `${expenses('expenses:form.paymentMethod')} ${expenses('expenses:form.paymentMethodNone')}` },
    ])
    expect(state('expense/method-selector-open').visible).toBe(common('common:transfer'))
  })

  it('types a nine-digit amount and ends on the Save label that carries it', () => {
    expect(state('expense/amount-nine-digits').steps).toEqual([{ fill: { label: common('common:amount'), value: '123456789' } }])
    expect(state('expense/amount-nine-digits').visible).toBe('Save expense · $ 123.456.789')
  })
})
