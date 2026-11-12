/** Sales and collections (`sales.md`, `payments.md`): the forms, sheets and dialogs the walk visits. Nothing here saves. */

import { CUSTOMER, CUSTOMERS, HOME, SALE, SALE_NEW, SALES } from '../routes.ts'
import { common } from './copy.ts'
import { DETECTED_COUNTRY_BUTTON } from './countryField.ts'
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
