/**
 * New sale's two date reads, defined once: the Products answer (`GET /api/products?on=`) and the
 * Pricing settings (`GET /pricing-settings`), under the frozen `sale-form` keys. Both come fresh on
 * every mount and every date change (`gcTime: 0`, `staleTime: Infinity`, no refetch on focus or
 * reconnect), and a date change keeps the previous answer as placeholder data while the new one
 * comes, so nothing an earlier mount cached ever surfaces. `NuevaVenta.tsx` and `useNewSaleReads`
 * both spread these, so the two never differ.
 */

import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { get } from '../api/client'
import { keys } from '../api/keys'
import type { PricingSettings as ApiPricingSettings } from '../api/pricingSettings'
import type { Variety } from '../screens/Variedades'
import type { PricingSettings } from './pricing'

export function saleFormProductsQuery(date: string) {
  return queryOptions({
    queryKey: keys.saleFormVarieties(date),
    queryFn: () => get<Variety[]>(`/api/products?on=${encodeURIComponent(date)}`),
    // A date change keeps the form's varieties (names, options) while that day's prices
    // come; no figure of the previous day is ever shown.
    placeholderData: keepPreviousData,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

/** The switches come with each day's prices: on opening and on every date change. */
export function saleFormPricingSettingsQuery(date: string) {
  return queryOptions({
    queryKey: keys.saleFormPricingSettings(date),
    queryFn: () => get<ApiPricingSettings>('/pricing-settings'),
    placeholderData: keepPreviousData,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

/** The API's Pricing settings as `pricing.ts` takes them. */
export function pricingSettingsOf(api: ApiPricingSettings): PricingSettings {
  return { bulk: api.is_bulk_pricing, vip: api.is_vip_customers }
}
