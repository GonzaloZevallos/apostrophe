/**
 * What New sale's Product list reads: the Products and the Pricing settings for the sale's date
 * (`saleFormQueries.ts`, the same options `NuevaVenta.tsx` uses) and the suggestions, asked once
 * through `useSaleSuggestions(openedOn)` and never with the editable date.
 */

import { useQuery } from '@tanstack/react-query'
import { useSaleSuggestions } from '../api/saleSuggestions'
import type { Variety } from '../screens/Variedades'
import type { PricingSettings } from './pricing'
import { pricingSettingsOf, saleFormPricingSettingsQuery, saleFormProductsQuery } from './saleFormQueries'

export interface NewSaleReads {
  /** The last Products answer, or `null` while none has come. During a date change it is the
   * previous date's list: `productsForDate` says whether it is the sale's date's. */
  products: readonly Variety[] | null
  /** The Products answer is the sale's date's, not the previous one kept while it comes. */
  productsForDate: boolean
  /** The switches of the sale's date, or `null` until they arrive. */
  settings: PricingSettings | null
  /** The suggested Most sold ids, or `null` while that read is pending. */
  mostSoldIds: readonly number[] | null
  /** The Products or Pricing settings error, or `null`. A failed suggestions read is never one. */
  failed: Error | null
}

export function useNewSaleReads({ date, openedOn }: { date: string; openedOn: string }): NewSaleReads {
  const productsQuery = useQuery(saleFormProductsQuery(date))
  const settingsQuery = useQuery(saleFormPricingSettingsQuery(date))
  const suggestions = useSaleSuggestions(openedOn)
  return {
    products: productsQuery.data ?? null,
    productsForDate: productsQuery.isSuccess && !productsQuery.isPlaceholderData,
    // The previous date's switches are not the date's: they would price the new date's rows.
    settings:
      settingsQuery.data === undefined || settingsQuery.isPlaceholderData
        ? null
        : pricingSettingsOf(settingsQuery.data),
    mostSoldIds: suggestions === null ? null : suggestions.most_sold_product_ids,
    failed: productsQuery.error ?? settingsQuery.error ?? null,
  }
}
