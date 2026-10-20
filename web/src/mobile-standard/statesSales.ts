/** Sales and collections (`sales.md`, `payments.md`): the forms, sheets and dialogs the walk visits. Nothing here saves. */

import { CLOSE, SAVE, WORD_YES_DELETE_IT } from '../copy/common.ts'
import * as customers from '../copy/customers.ts'
import * as sales from '../copy/sales.ts'
import { CUSTOMER, CUSTOMERS, HOME, SALE, SALE_NEW, SALES } from '../routes.ts'
import type { WalkState } from './states.ts'

export const SALES_STATES: readonly WalkState[] = [
  {
    screen: 'NuevaVentaConLinea',
    route: SALE_NEW,
    steps: [
      { fill: { label: sales.varietyOfLine(1), value: 'Golden Cookies' } },
      { fill: { label: sales.gramsOfLine(1), value: '10' } },
      { click: sales.ADD_VARIETY },
    ],
    visible: '$ 120.000',
  },
  {
    screen: 'ElegirCliente',
    route: SALE_NEW,
    steps: [{ click: sales.CHOOSE_CUSTOMER }, { fill: { label: sales.SEARCH, value: 'Nico' } }],
    visible: 'Nico Parra',
  },
  {
    screen: 'NuevoClienteEnVenta',
    route: SALE_NEW,
    steps: [{ click: sales.CHOOSE_CUSTOMER }, { click: customers.NEW_CUSTOMER }],
    visible: customers.CREATE_CUSTOMER,
  },
  {
    screen: 'DescartarVenta',
    route: SALE_NEW,
    steps: [
      { fill: { label: sales.varietyOfLine(1), value: 'Sir Jack' } },
      { fill: { label: sales.gramsOfLine(1), value: '5' } },
      { press: CLOSE },
    ],
    visible: sales.DISCARD_SALE_QUESTION,
  },
  {
    screen: 'VentaAsignarCliente',
    route: SALES,
    steps: [{ click: sales.NO_CUSTOMER }, { click: sales.ASSIGN_CUSTOMER }],
    visible: sales.CHOOSE_CUSTOMER,
  },
  {
    screen: 'VentaBorrar',
    route: SALE.replace(':id', '{owing_sale}'),
    steps: [{ click: sales.DELETE_SALE }],
    visible: WORD_YES_DELETE_IT,
  },
  {
    screen: 'CobroDesdeClientes',
    route: CUSTOMERS,
    steps: [{ click: 'Nico Parra' }, { click: customers.RECORD_PAYMENT }],
    visible: SAVE,
  },
  {
    screen: 'CobroDesdeInicio',
    route: HOME,
    steps: [{ click: 'Nico Parra' }, { click: customers.RECORD_PAYMENT }],
    visible: SAVE,
  },
  {
    screen: 'CobroBorrar',
    route: CUSTOMER.replace(':id', '{debtor}'),
    steps: [{ activate: customers.DELETE_PAYMENT }],
    visible: customers.CONFIRM_DELETE,
  },
  {
    screen: 'VentasFechas',
    route: SALES,
    steps: [{ click: sales.PERIOD_DATES }],
    visible: sales.TO,
  },
]
