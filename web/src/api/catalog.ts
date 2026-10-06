/**
 * `GET /catalog` and the one query that reads it (ADR-0022). This is the only module
 * that names the catalog query key or sets its options (`architecture/forbiddenApis.ts`
 * refuses any other that does): every reader mounts `catalogQueryOptions()`, so the
 * catalog is recomputed by the server on each mount and never replayed from a cache.
 */

import { queryOptions, type QueryClient } from '@tanstack/react-query'
import { get } from './client'
import { keys } from './keys'

export type CatalogVarietyState = 'in' | 'hidden' | 'no_price' | 'sold_out' | 'no_entries'

export interface CatalogVariety {
  id: number
  name: string
  emoji: string | null
  indica_share: number | null
  aroma: string | null
  shown: boolean
  state: CatalogVarietyState
}

export interface Catalog {
  text: string | null
  header: string
  footer: string
  varieties: CatalogVariety[]
}

/** Always stale and never kept once nobody watches it: each mount asks the server again,
 * and neither a focus nor a reconnect recomputes it behind the seller's back. */
export function catalogQueryOptions() {
  return queryOptions({
    queryKey: keys.catalog(),
    queryFn: () => get<Catalog>('/catalog'),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

/** A save's own answer becomes the query's data, so the screen shows what the server said. */
export function writeCatalog(queryClient: QueryClient, view: Catalog): void {
  queryClient.setQueryData(catalogQueryOptions().queryKey, view)
}
