/**
 * Where a restore from an archived variety's page lands (ADR-0032 amendment): the next
 * archived variety by name, otherwise the previous one, otherwise `null` (none is left), or
 * `'unknown'` when the archived list is not in the cache. The only code that picks a landing.
 */

import type { Variety } from '../Variedades'
import { varietiesByName } from './varietiesByName'

export type Landing = number | null | 'unknown'

export function restoreLanding(archived: readonly Variety[] | undefined, restoredId: number): Landing {
  if (archived === undefined) return 'unknown'
  const others = varietiesByName(archived)
  const at = others.findIndex((variety) => variety.id === restoredId)
  if (at === -1) return others[0]?.id ?? null
  const remaining = others.filter((variety) => variety.id !== restoredId)
  return (remaining[at] ?? remaining[at - 1])?.id ?? null
}
