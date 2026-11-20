/**
 * The two date-keyed reads New sale's form is built on, as query options so the screen and the
 * computer's Products results table read the same cache entries: the Products with their prices on
 * a date, and the pricing settings that come with that day's prices.
 */

import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { get } from '../api/client'
import { keys } from '../api/keys'
import type { PricingSettings as ApiPricingSettings } from '../api/pricingSettings'
import type { Variety } from '../screens/Variedades'

export function saleFormProductsQueryOptions(date: string) {
  return queryOptions({
    queryKey: keys.saleFormVarieties(date),
    queryFn: () => get<Variety[]>(`/api/products?on=${encodeURIComponent(date)}`),
    // A date change keeps the form's varieties (names, options) while that day's prices
    // come; no figure of the previous day is ever shown (`repricing` below).
    placeholderData: keepPreviousData,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

// The switches come with each day's prices: on opening and on every date change.
export function saleFormPricingSettingsQueryOptions(date: string) {
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
