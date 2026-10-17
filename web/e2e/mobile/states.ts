/**
 * The forms, sheets and dialogs the phone walk visits beside the registry's routes
 * (GH-80). A state is a name, a starting route, steps in the registry's own vocabulary
 * (click, fill, wait, offline) and exactly one assertion that a named element is
 * visible: when it is not, the walk records `unreachable` for that cell, never a pass.
 * No state may let a write reach the backend: nothing here saves, and the harness route
 * aborts or stubs every write anyway (invariant 6).
 *
 * Each `states-*` subtask owns one group below and adds its group to `STATES`; its names
 * go to `STATE_NAMES` in `src/mobile-standard/registry.ts`, which `stateNameProblems`
 * checks against this list.
 */

import type { RegistryScreen, RegistryStep } from '../../src/mobile-standard/registry.ts'

export interface WalkState {
  name: string
  route: string
  steps: readonly RegistryStep[]
  /** The one assertion: this text is on screen once the steps ran. */
  visible: string
}

/** Sales and collections (`sales.md`, `payments.md`). */
const SALES_STATES: readonly WalkState[] = [
  {
    name: 'NuevaVentaConLinea',
    route: '/ventas/nueva',
    steps: [
      { fill: { label: 'Variedad línea 1', value: 'Golden Cookies' } },
      { fill: { label: 'Gramos línea 1', value: '10' } },
      { click: 'Agregar otra variedad' },
    ],
    visible: '$ 120.000',
  },
  {
    name: 'ElegirCliente',
    route: '/ventas/nueva',
    steps: [{ click: 'Elegir cliente' }, { fill: { label: 'Buscar', value: 'Nico' } }],
    visible: 'Nico Parra',
  },
  {
    name: 'NuevoClienteEnVenta',
    route: '/ventas/nueva',
    steps: [{ click: 'Elegir cliente' }, { click: 'Nuevo cliente' }],
    visible: 'Crear cliente',
  },
  {
    name: 'DescartarVenta',
    route: '/ventas/nueva',
    steps: [
      { fill: { label: 'Variedad línea 1', value: 'Sir Jack' } },
      { fill: { label: 'Gramos línea 1', value: '5' } },
      { click: 'Volver' },
    ],
    visible: '¿Descartás la venta?',
  },
  {
    name: 'VentaAsignarCliente',
    route: '/ventas',
    steps: [{ click: 'Sin cliente' }, { click: 'Asignar cliente' }],
    visible: 'Elegir cliente',
  },
  {
    name: 'VentaBorrar',
    route: '/ventas/{owing_sale}',
    steps: [{ click: 'Borrar venta' }],
    visible: 'Sí, borrala',
  },
  {
    name: 'CobroDesdeClientes',
    route: '/clientes',
    steps: [{ click: 'Nico Parra' }, { click: 'Registrar cobro' }],
    visible: 'Guardar',
  },
  {
    name: 'CobroDesdeInicio',
    route: '/',
    steps: [{ click: 'Nico Parra' }, { click: 'Registrar cobro' }],
    visible: 'Guardar',
  },
  {
    name: 'CobroBorrar',
    route: '/clientes/{debtor}',
    steps: [{ click: 'Borrar cobro' }],
    visible: 'Sí, borralo',
  },
  {
    name: 'VentasFechas',
    route: '/ventas',
    steps: [{ click: 'Fechas' }],
    visible: 'Hasta',
  },
]

export const STATES: readonly WalkState[] = [...SALES_STATES]

/** A state as the walk runs it: a signed-in registry-shaped screen whose last step is its assertion. */
export function stateScreens(states: readonly WalkState[] = STATES): RegistryScreen[] {
  return states.map((state) => ({
    screen: state.name,
    route: state.route,
    path: state.route,
    viewport: null,
    signedOut: false,
    theme: null,
    steps: [...state.steps, { wait: state.visible }],
  }))
}

/** What is wrong between this list and the vocabulary's `STATE_NAMES`; empty when they agree. */
export function stateNameProblems(
  states: readonly WalkState[],
  names: readonly string[],
): string[] {
  const own = new Set(states.map((state) => state.name))
  const problems: string[] = []
  if (own.size !== states.length) problems.push('a state name is a repeat')
  for (const name of own) if (!names.includes(name)) problems.push(`${name} is not in STATE_NAMES`)
  for (const name of names) if (!own.has(name)) problems.push(`${name} has no state`)
  return problems
}
