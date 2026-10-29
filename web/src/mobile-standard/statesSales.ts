/** Sales and collections (`sales.md`, `payments.md`): the forms, sheets and dialogs the walk visits. Nothing here saves. */

import { CUSTOMER, CUSTOMERS, HOME, SALE, SALE_NEW, SALES } from '../routes.ts'
import { common } from './copy.ts'
import { CUSTOMERS_TEXT } from '../copy/customers.ts'
import { SALES_TEXT } from '../copy/sales.ts'
import type { WalkState } from './states.ts'

export const SALES_STATES: readonly WalkState[] = [
  {
    screen: 'NuevaVentaConLinea',
    route: SALE_NEW,
    steps: [
      { fill: { label: SALES_TEXT.lineVariety(1), value: 'Golden Cookies' } },
      { fill: { label: SALES_TEXT.lineGrams(1), value: '10' } },
      { click: common('common:addAnotherVariety') },
    ],
    visible: '$ 120.000',
  },
  {
    // The same form once Cash is chosen: Save is drawn as the primary button, not the secondary one.
    screen: 'NuevaVentaConLineaYPago',
    route: SALE_NEW,
    steps: [
      { fill: { label: SALES_TEXT.lineVariety(1), value: 'Golden Cookies' } },
      { fill: { label: SALES_TEXT.lineGrams(1), value: '10' } },
      { click: common('common:addAnotherVariety') },
      { click: common('common:cashMethod') },
    ],
    visible: '$ 120.000',
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
      { fill: { label: SALES_TEXT.lineVariety(1), value: 'Sir Jack' } },
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
