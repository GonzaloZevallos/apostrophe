/**
 * Which field of a price entry a refusal code is about, and the messages of those fields.
 * A price has one code for several rules, so the code alone picks the field: a repeated date
 * under "Rige desde", a rule of the amounts under "Precio de lista", a grams refusal under
 * "Mínimo en gramos". Kept apart from `PriceFields` so that file exports only components.
 */

import type { PricingSettings } from '../../api/pricingSettings'
import { VARIETY_REFUSAL_TEXT, type RefusalCode } from '../../api/refusals'
import { parseGrams, parseMoney } from '../../format/parse'
import { GRAMS_INVALID } from '../stockMessages'

export const DUPLICATE_DATE_MESSAGE = 'Ya cargaste un precio con esa fecha'
export const PRICE_INVALID_MESSAGE = 'Revisá los precios cargados'

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
  'grams.invalid': { field: 'bulkMinimum', message: GRAMS_INVALID },
  'variety.vip_price_not_below_list': {
    field: 'vipPrice',
    message: VARIETY_REFUSAL_TEXT['variety.vip_price_not_below_list'] ?? PRICE_INVALID_MESSAGE,
  },
}

export function fieldOfCode(code: string): { field: PriceField; message: string } | undefined {
  return (FIELD_OF_CODE as Record<string, { field: PriceField; message: string } | undefined>)[code]
}

/** What a price entry carries besides its date: the amounts that were typed and are in force. */
export interface PriceAmounts {
  list_price: number
  bulk_price: number | undefined
  bulk_minimum: string | undefined
  vip_price: number | undefined
}

export type PriceRead = { ok: true; amounts: PriceAmounts } | { ok: false; errors: PriceErrors }

/** Reads what was typed under the pricing switches: a rule that is off has no field and
 * nothing about it is sent. A bad amount is an error under its field and nothing is read. */
export function readPriceValues(values: PriceValues, settings: PricingSettings): PriceRead {
  const { listPrice, bulkPrice, bulkMinimum, vipPrice } = values
  const money = parseMoney(listPrice)
  const hasBulk = settings.is_bulk_pricing && (bulkPrice.trim() !== '' || bulkMinimum.trim() !== '')
  const hasVip = settings.is_vip_customers && vipPrice.trim() !== ''
  const vipMoney = parseMoney(vipPrice)
  const bulkMoney = parseMoney(bulkPrice)
  const bulkGrams = parseGrams(bulkMinimum)
  const errors: PriceErrors = {}
  if (!money.ok) errors.listPrice = PRICE_INVALID_MESSAGE
  if (hasBulk && !bulkMoney.ok) errors.bulkPrice = PRICE_INVALID_MESSAGE
  if (hasBulk && !bulkGrams.ok) errors.bulkMinimum = GRAMS_INVALID
  if (hasVip && !vipMoney.ok) errors.vipPrice = PRICE_INVALID_MESSAGE
  if (!money.ok || (hasBulk && (!bulkMoney.ok || !bulkGrams.ok)) || (hasVip && !vipMoney.ok)) {
    return { ok: false, errors }
  }
  return {
    ok: true,
    amounts: {
      list_price: money.value,
      bulk_price: hasBulk && bulkMoney.ok ? bulkMoney.value : undefined,
      bulk_minimum: hasBulk && bulkGrams.ok ? bulkGrams.value : undefined,
      vip_price: hasVip && vipMoney.ok ? vipMoney.value : undefined,
    },
  }
}
