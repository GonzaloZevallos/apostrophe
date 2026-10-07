/**
 * `GET /pricing-settings` and `PUT /pricing-settings` (`pricing-settings.md`): which of
 * Precio por cantidad and Clientes VIP the business uses. The screens read it to hide a
 * rule that is off; only Configuración → Precios writes it. The read is recomputed on each
 * mount (`staleTime: 0`, `gcTime: 0`), so a screen that reloads its prices also picks up
 * the switches a partner changed; a save's own answer becomes the query's data.
 */

import { queryOptions, type QueryClient } from '@tanstack/react-query'
import { get, put } from './client'
import { keys } from './keys'

export interface PricingSettings {
  is_bulk_pricing: boolean
  is_vip_customers: boolean
}

export function pricingSettingsQueryOptions() {
  return queryOptions({
    queryKey: keys.pricingSettings(),
    queryFn: () => get<PricingSettings>('/pricing-settings'),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function savePricingSettings(body: PricingSettings): Promise<PricingSettings> {
  return put<PricingSettings>('/pricing-settings', body)
}

export function writePricingSettings(queryClient: QueryClient, view: PricingSettings): void {
  queryClient.setQueryData(pricingSettingsQueryOptions().queryKey, view)
}
