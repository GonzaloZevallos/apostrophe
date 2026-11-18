/** Sales and collections (`sales.md`, `payments.md`): the forms, sheets and dialogs the walk visits. Nothing here reaches the backend: a save is answered by its stub. */

import { CUSTOMER, CUSTOMERS, HOME, SALE, SALE_NEW, SALES } from '../routes.ts'
import { common, emptyState } from './copy.ts'
import { DETECTED_COUNTRY_BUTTON } from './countryField.ts'
import { CUSTOMERS_TEXT } from '../copy/customers.ts'
import { EXPENSES_TEXT } from '../copy/expenses.ts'
import { NO_PRICE_HINT, SALES_TEXT } from '../copy/sales.ts'
import { DAY_BEFORE_PIN } from './pin.ts'
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
    // The card with the bar and its +, nothing opened over it: the screen the bar's capture rows and the Phone rule's "Chrome" are about.
    screen: 'customer/card-with-bar',
    route: CUSTOMER.replace(':id', '{debtor}'),
    steps: [],
    visible: `${CUSTOMERS_TEXT.newSaleTo}Nico Parra`,
  },
  {
    screen: 'VentasFechas',
    route: SALES,
    steps: [{ click: SALES_TEXT.dates }],
    visible: SALES_TEXT.to,
  },
]
