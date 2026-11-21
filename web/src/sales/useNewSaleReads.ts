/**
 * What New sale's Product list reads: the Products and the Pricing settings for the sale's date
 * (`saleFormQueries.ts`, the same options `NuevaVenta.tsx` uses), the suggestions, asked once
 * through `useSaleSuggestions(openedOn)` and never with the editable date, and the Stock.
 *
 * `status` is the one thing the list decides its state from (`docs/product/sale-in-progress.md`):
 * - `failed`: the Products or the Pricing settings read failed, or is paused because the phone is
 *   offline (that one is a `NetworkError`);
 * - `loading`: no list has loaded since the last failure and some read is still pending;
 * - `refreshing`: a list has loaded and the sale's date's Products or switches are still coming;
 * - `ready`: everything is in.
 * A failed suggestions or Stock read counts as settled: no suggestions, no stock text.
 */

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { NetworkError } from '../api/client'
import { keys } from '../api/keys'
import { useSaleSuggestions } from '../api/saleSuggestions'
import { readStock, type StockView } from '../api/stock'
import type { Variety } from '../screens/Variedades'
import type { PricingSettings } from './pricing'
import { pricingSettingsOf, saleFormPricingSettingsQuery, saleFormProductsQuery } from './saleFormQueries'

export type NewSaleStatus = 'loading' | 'refreshing' | 'failed' | 'ready'

export interface NewSaleReads {
  status: NewSaleStatus
  /** The last Products answer, or `null` while none has come. During a date change it is the
   * previous date's list: only `status === 'ready'` says it is the sale's date's. */
  products: readonly Variety[] | null
  /** The switches of the sale's date, or `null` until they arrive. */
  settings: PricingSettings | null
  /** The suggested Most sold ids, or `null` while that read is pending. */
  mostSoldIds: readonly number[] | null
  /** The Stock rows, or `null` while that read is pending or once it failed. */
  stock: StockView['products'] | null
  /** Why `status` is `'failed'`: a `NetworkError` for the network (or an offline phone), else the
   * Products or Pricing settings error. `null` otherwise. A failed suggestions read is never one. */
  failed: Error | null
}

/** Re-read only a query that is in error (ADR 20261121: the one exception to "no background retry").
 * Per observer: no query-level option (`networkMode`, `gcTime`, `retry`, `staleTime`) is touched. */
function rereadAfterError(query: { state: { status: string } }): 'always' | false {
  return query.state.status === 'error' ? 'always' : false
}

export function useNewSaleReads({ date, openedOn }: { date: string; openedOn: string }): NewSaleReads {
  const productsQuery = useQuery({
    ...saleFormProductsQuery(date),
    refetchOnReconnect: rereadAfterError,
    refetchOnWindowFocus: rereadAfterError,
  })
  const settingsQuery = useQuery({
    ...saleFormPricingSettingsQuery(date),
    refetchOnReconnect: rereadAfterError,
    refetchOnWindowFocus: rereadAfterError,
  })
  const suggestions = useSaleSuggestions(openedOn)
  const stockQuery = useQuery({ queryKey: keys.stock(), queryFn: readStock })
  const [loaded, setLoaded] = useState(false)

  const readError =
    (productsQuery.isError && !productsQuery.isFetching ? productsQuery.error : null) ??
    (settingsQuery.isError && !settingsQuery.isFetching ? settingsQuery.error : null)
  const offline = productsQuery.fetchStatus === 'paused' || settingsQuery.fetchStatus === 'paused'
  const failed = readError ?? (offline ? new NetworkError() : null)

  const mostSoldIds = suggestions === null ? null : suggestions.most_sold_product_ids
  // The previous date's answers (kept while the new ones come) are not the sale's date's.
  const dateComing =
    productsQuery.isPending ||
    productsQuery.isPlaceholderData ||
    settingsQuery.isPending ||
    settingsQuery.isPlaceholderData
  const pending = dateComing || mostSoldIds === null || stockQuery.isPending

  // Set in this render, never from an effect: `loaded` is true from a first full load until a
  // failure, so a `keepPreviousData` list brought back after a failure is not taken for a loaded one.
  const loadedNow = failed !== null ? false : pending ? loaded : true
  if (loadedNow !== loaded) setLoaded(loadedNow)

  const status: NewSaleStatus =
    failed !== null ? 'failed' : !loadedNow ? 'loading' : pending ? 'refreshing' : 'ready'

  return {
    status,
    products: productsQuery.data ?? null,
    // The previous date's switches are not the date's: they would price the new date's rows.
    settings:
      settingsQuery.data === undefined || settingsQuery.isPlaceholderData
        ? null
        : pricingSettingsOf(settingsQuery.data),
    mostSoldIds,
    stock: stockQuery.data === undefined ? null : stockQuery.data.products,
    failed,
  }
}
