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
/** The computer breakpoint, in CSS px (design README, accounts.md). */
export const COMPUTER_MIN_WIDTH = 900

export interface RegistryScreen {
  screen: string
  route: string | null
  path: string
  viewport: readonly [number, number] | null
  signedOut: boolean
  theme: string | null
}

/**
 * The forms, sheets and shared `Estados` states the walk visits beside the registry's
 * routes. The `states-*` subtasks append their names here, one per line.
 */
export const STATE_NAMES: readonly string[] = []

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
    }
  })
}

/** Why the phone walk leaves a screen out, or `null` when it visits it. The one place that decides. */
function skipReason(screen: RegistryScreen): string | null {
  if (screen.route === null) return SKIP_NO_ROUTE
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
