/**
 * `useSettingsRowContext`, the two reads the Settings rows depend on, `/business` (shared with
 * the Users group through `businessQueryOptions`) and `/pricing-settings`, as the plain context
 * `settingsRows.ts` asks for. Each value is `undefined` until its read has answered and after a
 * failed one, so a conditional row never shows early. It never calls `useLoading`: only the screen
 * that owns the `ContentArea` does, with `isPending`.
 */

import { useQuery } from '@tanstack/react-query'
import { businessQueryOptions } from '../../api/business'
import { pricingSettingsQueryOptions } from '../../api/pricingSettings'
import type { SettingsRowContext } from './settingsRows'

interface SettingsRowContextRead {
  readonly ctx: SettingsRowContext
  readonly userCount: number | undefined
  readonly isPending: boolean
}

export function useSettingsRowContext(): SettingsRowContextRead {
  const business = useQuery(businessQueryOptions())
  const pricing = useQuery(pricingSettingsQueryOptions())

  return {
    ctx: {
      selectableLanguages: business.data?.selectable_languages,
      isCustomerTypesOn: pricing.data?.is_vip_customers,
    },
    userCount: business.data?.users.length,
    isPending: business.isPending || pricing.isPending,
  }
}
