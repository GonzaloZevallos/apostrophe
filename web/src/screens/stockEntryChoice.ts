/**
 * `entryVarietyChoice`: the one pure decision of what the Stock entry's Variety Selector gets.
 * `options` is always the listed Varieties and nothing else; the stored Variety of an edited
 * entry that is no longer listed travels as `selected`, named from the archived list, and is
 * never offered. The archived list only names a stored choice: when it fails the field says so
 * (`failed`) instead of waiting for it, and saving still sends the stored id.
 */

import type { SelectorOption } from '../components/Selector'
import type { Variety } from './Variedades'
import { varietiesByName } from './varieties/varietiesByName'

/** The part of a query this decision reads. */
export interface VarietyList {
  status: 'pending' | 'error' | 'success'
  data: readonly Pick<Variety, 'id' | 'name'>[] | undefined
}

export interface EntryVarietyChoice {
  kind: 'loading' | 'ready' | 'failed'
  options: SelectorOption[]
  selected?: { value: string; label: string }
}

export function entryVarietyChoice(
  entryProductId: number | undefined,
  listed: VarietyList,
  archived: VarietyList,
): EntryVarietyChoice {
  const listedData = listed.data
  if (listedData === undefined) return { kind: 'loading', options: [] }
  const options = varietiesByName(listedData).map((v) => ({
    value: String(v.id),
    label: v.name,
  }))
  if (entryProductId === undefined || listedData.some((v) => v.id === entryProductId)) {
    return { kind: 'ready', options }
  }
  const stored = archived.data?.find((v) => v.id === entryProductId)
  if (stored !== undefined) {
    return { kind: 'ready', options, selected: { value: String(stored.id), label: stored.name } }
  }
  if (archived.status === 'error') return { kind: 'failed', options }
  if (archived.status === 'pending') return { kind: 'loading', options }
  return { kind: 'ready', options }
}
