/** Sales and collections (`sales.md`, `payments.md`): the forms, sheets and dialogs the walk visits. Nothing here saves. */

import { CUSTOMER, CUSTOMERS, HOME, SALE, SALE_NEW, SALES } from '../routes.ts'
import { common, emptyState } from './copy.ts'
import { CUSTOMERS_TEXT } from '../copy/customers.ts'
import { SALES_TEXT } from '../copy/sales.ts'
import type { WalkState } from './states.ts'

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
    screen: 'DescartarVenta',
    route: SALE_NEW,
    steps: [
      { press: `${SALES_TEXT.lineVariety(1)} ${common('common:pickAVariety')}` },
      { press: 'Sir Jack' },
      { fill: { label: SALES_TEXT.lineGrams(1), value: '5' } },
      { press: common('common:close') },
    ],
    visible: SALES_TEXT.discardSale,
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
    screen: 'VentasFechas',
    route: SALES,
    steps: [{ click: SALES_TEXT.dates }],
    visible: SALES_TEXT.to,
  },
]
