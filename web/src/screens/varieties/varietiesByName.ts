/** Varieties sorted by name, the one order Variedades lists them in and the first of which a
 * computer selects on opening the list. A presentation order only; nothing is decided by it. */

import type { Variety } from '../Variedades'

export function varietiesByName(varieties: readonly Variety[]): Variety[] {
  return [...varieties].sort(
    (a, b) => a.name.localeCompare(b.name, 'es' as const, { sensitivity: 'base' as const }) || a.id - b.id,
  )
}
