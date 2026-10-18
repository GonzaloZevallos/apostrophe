/**
 * The design registry (`scripts/design/screens.json`, the one copy) as the mobile check
 * reads it: which screens the phone walk visits, and the closed vocabulary of names a
 * `Violation.screen` may carry (registry screens plus the forms, sheets and shared
 * states the walk adds, `STATE_NAMES`). The file is read as static JSON; it is parsed,
 * not cast, so a malformed registry fails here and says so.
 */

import registryJson from '../../../scripts/design/screens.json' with { type: 'json' }

/** A screen the built app cannot show yet (`route: null`). */
export const SKIP_NO_ROUTE = 'not built yet: route is null'
/** The standard governs phone widths only; a computer layout is out of its scope. */
export const SKIP_COMPUTER_VIEWPORT = 'computer layout: viewport width of 900 px or more'
/** Both themes run in every cell, so a dark twin of a registry entry would repeat its walk. */
export const SKIP_THEME_TWIN = 'dark twin: every cell already runs both themes'
/** The computer breakpoint, in CSS px (design README, accounts.md). */
export const COMPUTER_MIN_WIDTH = 900

/** One step of a registry entry, as `scripts/design/comparisons.mjs` runs it. */
export type RegistryStep =
  | { click: string }
  | { press: string }
  | { select: { label: string; index: number } }
  | { fill: { label: string; value: string } }
  | { wait: string }
  | { offline: true }

export interface RegistryScreen {
  screen: string
  route: string | null
  path: string
  viewport: readonly [number, number] | null
  signedOut: boolean
  theme: string | null
  steps: readonly RegistryStep[]
}

/**
 * The forms, sheets and shared `Estados` states the walk visits beside the registry's
 * routes. The `states-*` subtasks append their names here, one per line.
 */
export const STATE_NAMES: readonly string[] = [
  // Sales and collections (`states-sales`).
  'NuevaVentaConLinea',
  'ElegirCliente',
  'NuevoClienteEnVenta',
  'DescartarVenta',
  'VentaAsignarCliente',
  'VentaBorrar',
  'CobroDesdeClientes',
  'CobroDesdeInicio',
  'CobroBorrar',
  'VentasFechas',
  // Getting in and the shared Estados (`states-getting-in`).
  'EntrarFreno',
  'InvitacionMuerta',
  'ResetMuerto',
  'EstadosReintento',
  'EstadosGoneAviso',
  // Records areas (`states-records`).
  'ClientesBusqueda',
  'ClienteNuevo',
  'ClienteEditar',
  'EntradaStockDesdeStock',
  'EntradaStockEditar',
  'EntradaStockConfirmarCambios',
  'EntradaStockConfirmarBorrado',
  'PrecioNuevoFormulario',
  'PrecioConfirmarBorrado',
  'VariedadNuevaFormulario',
  'VariedadRenombrar',
  'VariedadUmbral',
  'CatalogoAtributos',
  'GastoDesdeMas',
  'GastoDesdeGastos',
  'GastoEditar',
  'GastoConfirmarBorrado',
  'ConfiguracionCategoriaRenombrar',
  'ConfiguracionCategoriaConfirmarBorrado',
  'ConfiguracionContrasena',
]

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${what} is not an object`)
  }
  return Object.fromEntries(Object.entries(value))
}

function parseViewport(value: unknown, screen: string): readonly [number, number] | null {
  if (value === undefined) return null
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  ) {
    return [value[0], value[1]]
  }
  throw new Error(`${screen}: viewport is not [width, height]`)
}

function parseStep(value: unknown, screen: string): RegistryStep {
  const where = `${screen}: step`
  const step = asRecord(value, where)
  const keys = Object.keys(step)
  const only = keys.length === 1 ? keys[0] : undefined
  if (only === 'click' || only === 'wait' || only === 'press') {
    const text = step[only]
    if (typeof text !== 'string' || text === '') throw new Error(`${where} ${only} is not text`)
    if (only === 'press') return { press: text }
    return only === 'click' ? { click: text } : { wait: text }
  }
  if (only === 'select') {
    const select = asRecord(step['select'], `${where} select`)
    const { label, index } = select
    if (typeof label !== 'string' || typeof index !== 'number' || !Number.isInteger(index) || index < 0) {
      throw new Error(`${where} select needs a label and a non-negative integer index`)
    }
    return { select: { label, index } }
  }
  if (only === 'fill') {
    const fill = asRecord(step['fill'], `${where} fill`)
    const { label, value: text } = fill
    if (typeof label !== 'string' || typeof text !== 'string') {
      throw new Error(`${where} fill needs a label and a value`)
    }
    return { fill: { label, value: text } }
  }
  if (only === 'offline') {
    if (step['offline'] !== true) throw new Error(`${where} offline is not true`)
    return { offline: true }
  }
  throw new Error(`${where} is not a click, press, fill, select, wait or offline`)
}

function parseSteps(value: unknown, screen: string): readonly RegistryStep[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error(`${screen}: steps is not a list`)
  return value.map((step: unknown) => parseStep(step, screen))
}

/** The registry's screens, validated; `stateNames` are checked against them for repeats. */
export function parseRegistry(
  raw: unknown,
  stateNames: readonly string[] = [],
): readonly RegistryScreen[] {
  const screens = asRecord(raw, 'registry')['screens']
  if (!Array.isArray(screens)) throw new Error('registry has no screens list')
  const seen = new Set<string>(stateNames)
  if (seen.size !== stateNames.length) throw new Error('a state name is a repeat')
  return screens.map((item: unknown, index): RegistryScreen => {
    const row = asRecord(item, `screen #${index}`)
    const name = row['screen']
    if (typeof name !== 'string' || name === '') throw new Error(`screen #${index} has no name`)
    if (seen.has(name)) throw new Error(`${name} is a repeat of another screen or state name`)
    seen.add(name)
    const route = row['route']
    if (route !== null && typeof route !== 'string') throw new Error(`${name}: route is not a string or null`)
    const path = row['path']
    if (typeof path !== 'string') throw new Error(`${name}: path is not a string`)
    const theme = row['tema']
    return {
      screen: name,
      route,
      path,
      viewport: parseViewport(row['viewport'], name),
      signedOut: row['signed_out'] === true,
      theme: typeof theme === 'string' ? theme : null,
      steps: parseSteps(row['steps'], name),
    }
  })
}

/** `{name}` in a route or a step value: one of the seeded facts. A name no fact has is an error. */
export function resolvePlaceholders(
  template: string,
  facts: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = facts[name]
    if (value === undefined) throw new Error(`no seeded fact named ${name}`)
    return String(value)
  })
}

/** Why the phone walk leaves a screen out, or `null` when it visits it. The one place that decides. */
function skipReason(screen: RegistryScreen): string | null {
  if (screen.route === null) return SKIP_NO_ROUTE
  if (screen.theme !== null) return SKIP_THEME_TWIN
  if (screen.viewport !== null && screen.viewport[0] >= COMPUTER_MIN_WIDTH) return SKIP_COMPUTER_VIEWPORT
  return null
}

export function walkableScreens(screens: readonly RegistryScreen[]): RegistryScreen[] {
  return screens.filter((screen) => skipReason(screen) === null)
}

export function skippedScreens(
  screens: readonly RegistryScreen[],
): { screen: string; reason: string }[] {
  return screens.flatMap((screen) => {
    const reason = skipReason(screen)
    return reason === null ? [] : [{ screen: screen.screen, reason }]
  })
}

export const REGISTRY: readonly RegistryScreen[] = parseRegistry(registryJson, STATE_NAMES)
export const WALKABLE: readonly RegistryScreen[] = walkableScreens(REGISTRY)

/** Every name a `Violation.screen` may carry. */
export const SCREEN_NAMES: ReadonlySet<string> = new Set([
  ...REGISTRY.map((screen) => screen.screen),
  ...STATE_NAMES,
])

/**
 * The seeded facts file (`scripts/design/mobile_seed.py`) as the placeholders see it: the
 * ids and tokens plus `email`. Parsed, not cast: a missing `ids` or `email` fails here and says so.
 */
export function parseFacts(raw: unknown): Record<string, string | number> {
  const facts = asRecord(raw, 'facts')
  const email = facts['email']
  if (typeof email !== 'string' || email === '') throw new Error('facts: email is not text')
  const ids = asRecord(facts['ids'], 'facts: ids')
  const out: Record<string, string | number> = {}
  for (const [name, value] of Object.entries(ids)) {
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new Error(`facts: ids.${name} is not text or a number`)
    }
    out[name] = value
  }
  return { ...out, email }
}
