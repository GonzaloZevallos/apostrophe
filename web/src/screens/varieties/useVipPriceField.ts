/**
 * Whether the "VIP price" field of a Price entry shows: Customer types is on AND the Business
 * has its VIP type (`GET /api/customer-types` lists one with `is_vip`), because the price is
 * saved as a row of that type. Until the list answers the field is hidden. Returns the settings
 * the form works under, with the VIP switch narrowed to that, so the field and what is sent
 * agree.
 */

import { useCustomerTypes } from '../../api/customerTypes'
import type { PricingSettings } from '../../api/pricingSettings'

export function useVipPriceSettings(settings: PricingSettings): PricingSettings {
  const types = useCustomerTypes()
  const hasVipType = types.data?.some((type) => type.is_vip) === true
  return { ...settings, is_vip_customers: settings.is_vip_customers && hasVipType }
}
