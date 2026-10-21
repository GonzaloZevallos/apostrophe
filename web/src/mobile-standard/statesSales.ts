/** Sales and collections (`sales.md`, `payments.md`): the forms, sheets and dialogs the walk visits. Nothing here saves. */

import { CUSTOMER, CUSTOMERS, HOME, SALE, SALE_NEW, SALES } from '../routes.ts'
import { COMMON_TEXT } from '../copy/common.ts'
import type { WalkState } from './states.ts'

export const SALES_STATES: readonly WalkState[] = [
  {
    screen: 'NuevaVentaConLinea',
    route: SALE_NEW,
    steps: [
      { fill: { label: 'Variedad línea 1', value: 'Golden Cookies' } },
      { fill: { label: 'Gramos línea 1', value: '10' } },
      { click: COMMON_TEXT.addAnotherVariety },
    ],
    visible: '$ 120.000',
  },
  {
    screen: 'ElegirCliente',
    route: SALE_NEW,
    steps: [{ click: 'Elegir cliente' }, { fill: { label: 'Buscar', value: 'Nico' } }],
    visible: 'Nico Parra',
  },
  {
    screen: 'NuevoClienteEnVenta',
    route: SALE_NEW,
    steps: [{ click: 'Elegir cliente' }, { click: COMMON_TEXT.newCustomer }],
    visible: 'Crear cliente',
  },
  {
    screen: 'DescartarVenta',
    route: SALE_NEW,
    steps: [
      { fill: { label: 'Variedad línea 1', value: 'Sir Jack' } },
      { fill: { label: 'Gramos línea 1', value: '5' } },
      { press: COMMON_TEXT.close },
    ],
    visible: '¿Descartás la venta?',
  },
  {
    screen: 'VentaAsignarCliente',
    route: SALES,
    steps: [{ click: 'Sin cliente' }, { click: 'Asignar cliente' }],
    visible: 'Elegir cliente',
  },
  {
    screen: 'VentaBorrar',
    route: SALE.replace(':id', '{owing_sale}'),
    steps: [{ click: 'Borrar venta' }],
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
    steps: [{ click: 'Borrar cobro' }],
    visible: COMMON_TEXT.yesDelete,
  },
  {
    screen: 'VentasFechas',
    route: SALES,
    steps: [{ click: 'Fechas' }],
    visible: 'Hasta',
  },
]
