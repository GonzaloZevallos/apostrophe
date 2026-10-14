/**
 * Which field of a price entry a refusal code is about, and the messages of those fields.
 * A price has one code for several rules, so the code alone picks the field: a repeated date
 * under "Rige desde", a rule of the amounts under "Precio de lista", a grams refusal under
 * "Mínimo en gramos". Kept apart from `PriceFields` so that file exports only components.
 */

import { VARIETY_REFUSAL_TEXT, type RefusalCode } from '../../api/refusals'

export const DUPLICATE_DATE_MESSAGE = 'Ya cargaste un precio con esa fecha'
export const PRICE_INVALID_MESSAGE = 'Revisá los precios cargados'
export const GRAMS_INVALID_MESSAGE = 'Revisá los gramos cargados'

export type PriceField = 'effectiveFrom' | 'listPrice' | 'bulkPrice' | 'bulkMinimum' | 'vipPrice' | 'form'
export type PriceErrors = Partial<Record<PriceField, string>>

export interface PriceValues {
  listPrice: string
  bulkPrice: string
  bulkMinimum: string
  vipPrice: string
}

const FIELD_OF_CODE: Partial<Record<RefusalCode, { field: PriceField; message: string }>> = {
  'variety.duplicate_effective_date': { field: 'effectiveFrom', message: DUPLICATE_DATE_MESSAGE },
  'variety.price_entry_invalid': { field: 'listPrice', message: PRICE_INVALID_MESSAGE },
  'grams.invalid': { field: 'bulkMinimum', message: GRAMS_INVALID_MESSAGE },
  'variety.vip_price_not_below_list': {
    field: 'vipPrice',
    message: VARIETY_REFUSAL_TEXT['variety.vip_price_not_below_list'] ?? PRICE_INVALID_MESSAGE,
  },
}

export function fieldOfCode(code: string): { field: PriceField; message: string } | undefined {
  return (FIELD_OF_CODE as Record<string, { field: PriceField; message: string } | undefined>)[code]
}
