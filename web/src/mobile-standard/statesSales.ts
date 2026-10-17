/** Sales and collections (`sales.md`, `payments.md`): the forms, sheets and dialogs the walk visits. Nothing here saves. */

import type { WalkState } from './states.ts'

export const SALES_STATES: readonly WalkState[] = [
  {
    screen: 'NuevaVentaConLinea',
    route: '/ventas/nueva',
    steps: [
      { fill: { label: 'Variedad línea 1', value: 'Golden Cookies' } },
      { fill: { label: 'Gramos línea 1', value: '10' } },
      { click: 'Agregar otra variedad' },
    ],
    visible: '$ 120.000',
  },
  {
    screen: 'ElegirCliente',
    route: '/ventas/nueva',
    steps: [{ click: 'Elegir cliente' }, { fill: { label: 'Buscar', value: 'Nico' } }],
    visible: 'Nico Parra',
  },
  {
    screen: 'NuevoClienteEnVenta',
    route: '/ventas/nueva',
    steps: [{ click: 'Elegir cliente' }, { click: 'Nuevo cliente' }],
    visible: 'Crear cliente',
  },
  {
    screen: 'DescartarVenta',
    route: '/ventas/nueva',
    steps: [
      { fill: { label: 'Variedad línea 1', value: 'Sir Jack' } },
      { fill: { label: 'Gramos línea 1', value: '5' } },
      { click: 'Volver' },
    ],
    visible: '¿Descartás la venta?',
  },
  {
    screen: 'VentaAsignarCliente',
    route: '/ventas',
    steps: [{ click: 'Sin cliente' }, { click: 'Asignar cliente' }],
    visible: 'Elegir cliente',
  },
  {
    screen: 'VentaBorrar',
    route: '/ventas/{owing_sale}',
    steps: [{ click: 'Borrar venta' }],
    visible: 'Sí, borrala',
  },
  {
    screen: 'CobroDesdeClientes',
    route: '/clientes',
    steps: [{ click: 'Nico Parra' }, { click: 'Registrar cobro' }],
    visible: 'Guardar',
  },
  {
    screen: 'CobroDesdeInicio',
    route: '/',
    steps: [{ click: 'Nico Parra' }, { click: 'Registrar cobro' }],
    visible: 'Guardar',
  },
  {
    screen: 'CobroBorrar',
    route: '/clientes/{debtor}',
    steps: [{ click: 'Borrar cobro' }],
    visible: 'Sí, borralo',
  },
  {
    screen: 'VentasFechas',
    route: '/ventas',
    steps: [{ click: 'Fechas' }],
    visible: 'Hasta',
  },
]
