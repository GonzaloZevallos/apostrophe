/** Sales and collections (`sales.md`, `payments.md`): the forms, sheets and dialogs the walk visits. Nothing here saves. */

import { CUSTOMER, CUSTOMERS, HOME, SALE, SALE_NEW, SALES } from '../routes.ts'
import { COMMON_TEXT } from '../copy/common.ts'
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
      { click: COMMON_TEXT.addAnotherVariety },
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
    steps: [{ click: SALES_TEXT.pickCustomer }, { click: COMMON_TEXT.newCustomer }],
    visible: SALES_TEXT.createCustomer,
  },
  {
    screen: 'DescartarVenta',
    route: SALE_NEW,
    steps: [
      { fill: { label: SALES_TEXT.lineVariety(1), value: 'Sir Jack' } },
      { fill: { label: SALES_TEXT.lineGrams(1), value: '5' } },
      { press: COMMON_TEXT.close },
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
    visible: COMMON_TEXT.yesDelete,
  },
  {
    screen: 'CobroDesdeClientes',
    route: CUSTOMERS,
    steps: [{ click: 'Nico Parra' }, { click: COMMON_TEXT.recordPayment }],
    visible: COMMON_TEXT.save,
  },
  {
    screen: 'CobroDesdeInicio',
    route: HOME,
    steps: [{ click: 'Nico Parra' }, { click: COMMON_TEXT.recordPayment }],
    visible: COMMON_TEXT.save,
  },
  {
    screen: 'CobroBorrar',
    route: CUSTOMER.replace(':id', '{debtor}'),
    steps: [{ click: CUSTOMERS_TEXT.deletePayment }],
    visible: COMMON_TEXT.yesDelete,
  },
  {
    screen: 'VentasFechas',
    route: SALES,
    steps: [{ click: SALES_TEXT.dates }],
    visible: SALES_TEXT.to,
  },
]
