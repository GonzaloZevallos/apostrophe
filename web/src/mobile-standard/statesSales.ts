/** Sales and collections (`sales.md`, `payments.md`): the forms, sheets and dialogs the walk visits. Nothing here reaches the backend: a save is answered by its stub. */

import { CUSTOMER, CUSTOMERS, HOME, SALE, SALE_NEW, SALES } from '../routes.ts'
import { common, emptyState } from './copy.ts'
import { DETECTED_COUNTRY_BUTTON } from './countryField.ts'
import { CUSTOMERS_TEXT } from '../copy/customers.ts'
import { EXPENSES_TEXT } from '../copy/expenses.ts'
import { NO_PRICE_HINT, SALES_TEXT } from '../copy/sales.ts'
import { DAY_BEFORE_PIN } from './pin.ts'
import { SAMPLE_TYPED_CUSTOMER, SAMPLE_TYPES } from './statesRecords.ts'
import type { Expense } from '../api/expenses.ts'
import type { WalkState } from './states.ts'

/** The sale in progress the strip states and `DescartarGastoEnVenta` share: line 1's Product, its grams and the Total they make. */
export const SALE_IN_PROGRESS_LINE = { product: 'Sir Jack', grams: '5', total: '$ 55.000' }

/** The toast `sale/expense-returned` waits for. */
export const EXPENSE_RECORDED = SALES_TEXT.expenseRecorded

/** The create's answer: the expense the form sends, as the server would store it. */
export const RECORDED_EXPENSE_BODY = {
  id: 9001,
  spent_on: '2026-01-01',
  category_id: 1,
  amount: 1500,
  detail: 'Cinta',
  payment_method: null,
} satisfies Expense

/** Line 1 with a Product and its grams, then the Expense tile: the strip is over the form. The first tap is a click on the text, as the registry rows say it (a row's step text must be a copy value). */
const TO_THE_STRIP = [
  { click: common('common:pickAVariety') },
  { press: SALE_IN_PROGRESS_LINE.product },
  { fill: { label: SALES_TEXT.lineGrams(1), value: SALE_IN_PROGRESS_LINE.grams } },
  { click: SALES_TEXT.expense },
] as const

/** Twelve listed Products, so a line's Product list shows its search. Seeded for this state's reads only. */
const TWELVE_PRODUCTS = Array.from({ length: 12 }, (_unused, index) => ({
  id: 100 + index,
  name: `Variedad ${index + 1}`,
  archived: false,
  current_price: null,
}))

/**
 * The shape of one `GET /sales` row, as `Sale` (`api/sales.ts`) spells it. Not imported: this core
 * is compiled under `tsconfig.node.json`, whose `nodenext` resolution refuses `api/sales.ts`'s own
 * extensionless imports (`npm --prefix web run typecheck` with the import in place: `src/api/sales.ts(11,31):
 * error TS2835 ... Did you mean './client.js'?`, and once those are fixed the same error spreads through
 * `sales/pricing.ts` to `screens/Variedades`). The real `Sale` check is `UNKNOWN_PAYMENT_SALES satisfies readonly Sale[]` in `states.test.ts`, which tsconfig.app compiles.
 */
interface StubSale {
  id: number
  number: number
  date: string
  customer: { id: number; name: string; vip: boolean } | null
  shipping_charged: number
  note: string | null
  payment: 'paid' | 'owing' | 'none'
  total: number
  lines: {
    product_id: number
    product_name: string
    quantity: number
    pricing_rule: 'list'
    customer_type_name: string | null
    price_per_gram: number
    line_total: number
  }[]
  still_owing: boolean
  payment_state: 'paid' | 'unpaid' | 'part_paid' | null
  still_owed: number | null
  payment_method: { id: number; name: string; icon: string } | null
}

/** One ordinary line every stub sale below carries. */
const ORDINARY_LINE: StubSale['lines'][number] = {
  product_id: 1,
  product_name: 'Golden Cookies',
  quantity: 1000,
  pricing_rule: 'list',
  customer_type_name: null,
  price_per_gram: 10,
  line_total: 10000,
}

/** The sale whose payment facts cannot be reconciled: both fields null, so its card draws the degraded chip line. */
export const UNKNOWN_PAYMENT_ROW = {
  id: 9004,
  number: 4,
  date: '2026-09-16',
  customer: { id: 9004, name: 'Dora Vega', vip: false },
  shipping_charged: 0,
  note: null,
  payment: 'owing',
  total: 10000,
  lines: [ORDINARY_LINE],
  still_owing: true,
  payment_state: null,
  still_owed: null,
  payment_method: null,
} satisfies StubSale

/** `GET /sales` for the unknown-payment state: a paid, an unpaid, a part-paid and an unknown-payment sale, each for its own customer. */
export const UNKNOWN_PAYMENT_SALES = [
  {
    id: 9001,
    number: 1,
    date: '2026-09-16',
    customer: { id: 9001, name: 'Ana Ruiz', vip: false },
    shipping_charged: 0,
    note: null,
    payment: 'paid',
    total: 10000,
    lines: [ORDINARY_LINE],
    still_owing: false,
    payment_state: 'paid',
    still_owed: 0,
    payment_method: { id: 1, name: 'Cash', icon: 'banknote' },
  },
  {
    id: 9002,
    number: 2,
    date: '2026-09-16',
    customer: { id: 9002, name: 'Beto Sosa', vip: false },
    shipping_charged: 0,
    note: null,
    payment: 'owing',
    total: 10000,
    lines: [ORDINARY_LINE],
    still_owing: true,
    payment_state: 'unpaid',
    still_owed: 10000,
    payment_method: null,
  },
  {
    id: 9003,
    number: 3,
    date: '2026-09-16',
    customer: { id: 9003, name: 'Caro Paz', vip: false },
    shipping_charged: 0,
    note: null,
    payment: 'owing',
    total: 10000,
    lines: [ORDINARY_LINE],
    still_owing: true,
    payment_state: 'part_paid',
    still_owed: 4000,
    payment_method: null,
  },
  UNKNOWN_PAYMENT_ROW,
] satisfies readonly StubSale[]

export const SALES_STATES: readonly WalkState[] = [
  {
    screen: 'NuevaVentaConLinea',
    route: SALE_NEW,
    steps: [
      { press: `${SALES_TEXT.lineVariety(1)} ${common('common:pickAVariety')}` },
      { press: 'Golden Cookies' },
      { fill: { label: SALES_TEXT.lineGrams(1), value: '10' } },
      { click: common('common:addAnotherVariety') },
    ],
    visible: '$ 120.000',
  },
  {
    // The same form once Paid and Cash are chosen: Save is drawn as the primary button, not the secondary one.
    screen: 'NuevaVentaConLineaYPago',
    route: SALE_NEW,
    steps: [
      { press: `${SALES_TEXT.lineVariety(1)} ${common('common:pickAVariety')}` },
      { press: 'Golden Cookies' },
      { fill: { label: SALES_TEXT.lineGrams(1), value: '10' } },
      { click: common('common:addAnotherVariety') },
      { click: common('common:paid') },
      { press: common('common:paymentMethod') },
      { press: common('common:cashMethod') },
    ],
    visible: '$ 120.000',
  },
  {
    // Paid chosen and the Payment method list open: the form is inert beneath it.
    screen: 'new-sale/method-selector-open',
    route: SALE_NEW,
    steps: [{ click: common('common:paid') }, { press: common('common:paymentMethod') }],
    visible: common('common:transfer'),
  },
  {
    // The business's methods list failed on a server error: the open field says so; a tap on it reads again.
    screen: 'new-sale/method-selector-failed',
    route: SALE_NEW,
    steps: [{ click: common('common:paid') }, { press: common('common:paymentMethod') }],
    visible: emptyState('emptyStates:selectorPaymentMethodsFailed'),
    reads: [{ path: /^\/api\/payment-methods$/, status: 500 }],
  },
  {
    // The connection dropped while the methods list was read: Estados' "Sin conexión" notice, the form stays.
    screen: 'new-sale/method-selector-offline',
    route: SALE_NEW,
    steps: [{ click: common('common:paid') }],
    visible: common('common:offline'),
    reads: [{ path: /^\/api\/payment-methods$/, status: 0, offline: true }],
  },
  {
    // Saved with a method archived meanwhile: the form stays, the field keeps the method and says it is gone.
    screen: 'new-sale/method-no-longer-available',
    route: SALE_NEW,
    steps: [
      { press: `${SALES_TEXT.lineVariety(1)} ${common('common:pickAVariety')}` },
      { press: 'Golden Cookies' },
      { fill: { label: SALES_TEXT.lineGrams(1), value: '10' } },
      { click: common('common:addAnotherVariety') },
      { click: common('common:paid') },
      { press: common('common:paymentMethod') },
      { press: common('common:cashMethod') },
      { click: SALES_TEXT.saveSale },
    ],
    visible: common('common:paymentMethodUnavailable'),
    writes: [{ method: 'POST', path: /^\/sales$/, status: 404, body: { code: 'payment_method.unavailable' } }],
  },
  {
    screen: 'new-sale/line-variety-selector-open',
    route: SALE_NEW,
    steps: [{ press: `${SALES_TEXT.lineVariety(1)} ${common('common:pickAVariety')}` }],
    visible: 'Variedad 1',
    reads: [{ path: /^\/api\/products$/, status: 200, body: TWELVE_PRODUCTS }],
  },
  {
    // No product has a price: line 1 is open on arrival with the hint, so no picker is opened.
    screen: 'new-sale/nothing-priced',
    route: SALE_NEW,
    steps: [],
    visible: NO_PRICE_HINT,
    reads: [{ path: /^\/api\/products$/, status: 200, body: TWELVE_PRODUCTS }],
    offendersAs: 'NuevaVenta',
  },
  {
    // The same form with the Products read again after the date changed: the hint must keep its room while it loads.
    screen: 'new-sale/date-change-refetching',
    route: SALE_NEW,
    steps: [],
    visible: NO_PRICE_HINT,
    reads: [{ path: /^\/api\/products$/, status: 200, body: TWELVE_PRODUCTS }],
    refetch: {
      holds: /^\/api\/products$/,
      steps: [{ fill: { label: common('common:date'), value: DAY_BEFORE_PIN } }],
    },
    offendersAs: 'NuevaVenta',
  },
  {
    screen: 'ElegirCliente',
    route: SALE_NEW,
    steps: [{ click: SALES_TEXT.pickCustomer }, { fill: { label: SALES_TEXT.search, value: 'Nico' } }],
    visible: 'Nico Parra',
  },
  {
    screen: 'NuevoClienteEnVenta',
    route: SALE_NEW,
    steps: [{ click: SALES_TEXT.pickCustomer }, { click: common('common:newCustomer') }],
    visible: SALES_TEXT.createCustomer,
  },
  {
    // The Phone country list open inside Pick a customer's new-customer sheet.
    screen: 'sale/customer-country-selector-open',
    route: SALE_NEW,
    steps: [
      { click: SALES_TEXT.pickCustomer },
      { click: common('common:newCustomer') },
      { press: DETECTED_COUNTRY_BUTTON },
    ],
    visible: CUSTOMERS_TEXT.phoneCountryOther,
  },
  {
    screen: 'DescartarVenta',
    route: SALE_NEW,
    steps: [
      { press: `${SALES_TEXT.lineVariety(1)} ${common('common:pickAVariety')}` },
      { press: SALE_IN_PROGRESS_LINE.product },
      { fill: { label: SALES_TEXT.lineGrams(1), value: SALE_IN_PROGRESS_LINE.grams } },
      { press: common('common:close') },
    ],
    visible: SALES_TEXT.discardSale,
  },
  {
    // A typed Expense over New sale, with no Product chosen (so no strip: the strip's own layout is
    // walked where it is drawn). Close asks first; the detail is the common "loses what you entered".
    screen: 'sale/expense-discard',
    route: SALE_NEW,
    steps: [
      { click: SALES_TEXT.expense },
      { fill: { label: EXPENSES_TEXT.details, value: 'Cinta' } },
      { activate: common('common:close') },
    ],
    visible: EXPENSES_TEXT.discardTheExpense,
  },
  {
    // The same question over a sale with a line, so the "Sale in progress" strip is on screen: the version with the strip.
    screen: 'DescartarGastoEnVenta',
    route: SALE_NEW,
    steps: [
      { press: `${SALES_TEXT.lineVariety(1)} ${common('common:pickAVariety')}` },
      { press: SALE_IN_PROGRESS_LINE.product },
      { fill: { label: SALES_TEXT.lineGrams(1), value: SALE_IN_PROGRESS_LINE.grams } },
      { click: SALES_TEXT.expense },
      { fill: { label: common('common:amount'), value: '1500' } },
      // The strip's Back, not Close: the sale form's own Close is also a button under the Sheet and a step cannot tell the two apart.
      { press: SALES_TEXT.saleInProgressName(SALES_TEXT.products(1), SALE_IN_PROGRESS_LINE.total) },
    ],
    visible: EXPENSES_TEXT.discardTheExpense,
  },
  {
    // The Expense over a sale in progress, settled: the strip reads "Sale in progress · 1 product · total · Back".
    // The wait reads text, not an accessible name, so it waits on the total figure: a figure, never a loading
    // label, and the strip's own figure is drawn only once repricing has settled. Repricing is never walked.
    screen: 'sale/expense-strip',
    route: SALE_NEW,
    steps: TO_THE_STRIP,
    visible: SALE_IN_PROGRESS_LINE.total,
  },
  {
    // The same sale, an Expense saved and the way back: New sale with the toast and line 1 still there.
    // The required fields of the expense form (`ExpenseForm`): Category (`common:category`, a Selector), Amount
    // (`common:amount`) and Details (`EXPENSES_TEXT.details`); Date starts at today. Save is `EXPENSES_TEXT.saveTheExpense`.
    screen: 'sale/expense-returned',
    route: SALE_NEW,
    steps: [
      ...TO_THE_STRIP,
      { click: EXPENSES_TEXT.pickACategory },
      { press: 'Packaging' },
      { fill: { label: common('common:amount'), value: '1500' } },
      { fill: { label: EXPENSES_TEXT.details, value: 'Cinta' } },
      { click: EXPENSES_TEXT.saveTheExpense },
      // Line 1's total is on New sale again: the sale is intact.
      { wait: SALE_IN_PROGRESS_LINE.total },
    ],
    visible: EXPENSE_RECORDED,
    // The walk ends on New sale itself, so the page is NuevaVenta's: its listed offenders are that row's.
    offendersAs: 'NuevaVenta',
    writes: [{ method: 'POST', path: /^\/expenses$/, status: 201, body: RECORDED_EXPENSE_BODY }],
  },
  {
    screen: 'VentaAsignarCliente',
    route: SALES,
    steps: [{ click: SALES_TEXT.noCustomer }, { click: SALES_TEXT.assignCustomer }],
    visible: SALES_TEXT.pickCustomer,
  },
  {
    screen: 'VentaBorrar',
    route: SALE.replace(':id', '{owing_sale}'),
    steps: [{ click: SALES_TEXT.deleteSale }],
    visible: common('common:yesDelete'),
  },
  {
    screen: 'CobroDesdeClientes',
    route: CUSTOMERS,
    steps: [{ click: 'Nico Parra' }, { click: common('common:recordPayment') }],
    visible: common('common:save'),
  },
  {
    screen: 'CobroDesdeInicio',
    route: HOME,
    steps: [{ click: 'Nico Parra' }, { click: common('common:recordPayment') }],
    visible: common('common:save'),
  },
  {
    screen: 'payment/method-selector-failed',
    route: CUSTOMERS,
    steps: [
      { click: 'Nico Parra' },
      { click: common('common:recordPayment') },
      { press: common('common:paymentMethod') },
    ],
    visible: emptyState('emptyStates:selectorPaymentMethodsFailed'),
    reads: [{ path: /^\/api\/payment-methods$/, status: 500 }],
  },
  {
    screen: 'payment/method-selector-offline',
    route: CUSTOMERS,
    steps: [{ click: 'Nico Parra' }, { click: common('common:recordPayment') }],
    visible: common('common:offline'),
    reads: [{ path: /^\/api\/payment-methods$/, status: 0, offline: true }],
  },
  {
    screen: 'payment/method-no-longer-available',
    route: CUSTOMERS,
    steps: [
      { click: 'Nico Parra' },
      { click: common('common:recordPayment') },
      { fill: { label: common('common:amount'), value: '1000' } },
      { press: common('common:paymentMethod') },
      { press: common('common:cashMethod') },
      { click: common('common:save') },
    ],
    visible: common('common:paymentMethodUnavailable'),
    writes: [{ method: 'POST', path: /^\/customers\/\d+\/payments$/, status: 404, body: { code: 'payment_method.unavailable' } }],
  },
  {
    screen: 'CobroBorrar',
    route: CUSTOMER.replace(':id', '{debtor}'),
    steps: [{ click: CUSTOMERS_TEXT.deletePayment }],
    visible: common('common:yesDelete'),
  },
  {
    // The card showing the bar and its +, nothing opened over it. The customer is a stub with no payment rows: the sample debtor's card also draws a "Delete payment" button, whose touch-action cell is listed under ClienteFicha and CobroBorrar only, and no offender entry may be added.
    screen: 'customer/card-with-bar',
    route: CUSTOMER.replace(':id', '{debtor}'),
    steps: [],
    visible: `${CUSTOMERS_TEXT.newSaleTo}${SAMPLE_TYPED_CUSTOMER.name}`,
    reads: [
      { path: /^\/api\/customer-types$/, status: 200, body: SAMPLE_TYPES },
      { path: /^\/customers\/\d+$/, status: 200, body: SAMPLE_TYPED_CUSTOMER },
      { path: /^\/customers\/\d+\/account$/, status: 200, body: { balance: 0, owing_since: null, standing: 'settled', rows: [] } },
    ],
  },
  {
    screen: 'VentasFechas',
    route: SALES,
    steps: [{ click: SALES_TEXT.dates }],
    visible: SALES_TEXT.to,
  },
  {
    // The Sales list with a sale whose payment cannot be shown, so the walk visits the degraded chip line beside the other three.
    // The stub answers `/sales` for any date range. The wait is the sale's own customer: the degraded sentence lives in the `sales:` namespace the browserless core cannot load.
    screen: 'sales/unknown-payment',
    route: SALES,
    steps: [],
    visible: UNKNOWN_PAYMENT_ROW.customer.name,
    reads: [{ path: /^\/sales$/, status: 200, body: UNKNOWN_PAYMENT_SALES }],
    offendersAs: 'Ventas',
  },
]
