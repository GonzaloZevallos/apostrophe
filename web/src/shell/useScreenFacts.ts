/**
 * `useScreenFacts`: what the record behind the leaf says about its chrome (GH-135, ADR-0041).
 * Only a leaf under a variety's path (`/varieties/:id…`) has facts; any other gets
 * `{ archived: 'unknown', varietyName: null }`.
 *
 * Source order, never fetching (every observer is `enabled: false`, so the page's own query
 * is the only request) and never `placeholderData` or `keepPreviousData`, so another id's
 * data is never read:
 *   1. the detail query `keys.variety(id)`, once it has succeeded;
 *   2. otherwise the list caches: `keys.varieties()` holding the id means not archived,
 *      `keys.archivedVarieties()` holding it means archived (each also gives the name);
 *   3. otherwise `'unknown'`, which `resolveParent` reads as the live parent.
 */

import { useQuery } from '@tanstack/react-query'
import { useMatches } from 'react-router'
import { get } from '../api/client'
import { keys } from '../api/keys'
import type { VarietyDetail } from '../api/varieties'
import type { Screen, ScreenFacts } from '../routes'
import type { Variety } from '../screens/Variedades'

const UNKNOWN: ScreenFacts = { archived: 'unknown', varietyName: null }

const UNDER_A_VARIETY: ReadonlySet<Screen['id']> = new Set<Screen['id']>([
  'variety',
  'variety-prices',
  'variety-entries',
  'variety-price-new',
])

/** The params of the deepest match that has any: the leaf route's `:id` and the like. */
export function leafParams(matches: readonly { params: Readonly<Record<string, string | undefined>> }[]): Record<string, string> {
  const last = matches[matches.length - 1]
  const params: Record<string, string> = {}
  for (const [name, value] of Object.entries(last?.params ?? {})) {
    if (value !== undefined) params[name] = value
  }
  return params
}

export function useScreenFacts(leaf: Screen): ScreenFacts {
  const rawId = leafParams(useMatches()).id
  const id = UNDER_A_VARIETY.has(leaf.id) && rawId !== undefined && /^[0-9]+$/.test(rawId) ? rawId : null
  const known = id !== null
  const detail = useQuery({
    queryKey: keys.variety(id ?? ''),
    queryFn: () => get<VarietyDetail>(`/varieties/${id}`),
    enabled: false,
  })
  const live = useQuery({
    queryKey: keys.varieties(),
    queryFn: () => get<Variety[]>('/varieties'),
    enabled: false,
  })
  const archived = useQuery({
    queryKey: keys.archivedVarieties(),
    queryFn: () => get<Variety[]>('/varieties?archived=true'),
    enabled: false,
  })
  if (!known) return UNKNOWN
  if (detail.status === 'success') {
    return { archived: detail.data.archived ? 'yes' : 'no', varietyName: detail.data.name }
  }
  const wanted = Number(id)
  const inLive = live.data?.find((variety) => variety.id === wanted)
  if (inLive !== undefined) return { archived: 'no', varietyName: inLive.name }
  const inArchived = archived.data?.find((variety) => variety.id === wanted)
  if (inArchived !== undefined) return { archived: 'yes', varietyName: inArchived.name }
  return UNKNOWN
}
