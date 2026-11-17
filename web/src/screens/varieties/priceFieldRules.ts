/**
 * Which field of a price entry a refusal code is about, and the messages of those fields.
 * A price has one code for several rules, so the code alone picks the field: a repeated date
 * under "Rige desde", a rule of the amounts under "Precio de lista", a grams refusal under
 * "Mínimo en gramos". Kept apart from `PriceFields` so that file exports only components.
 */

import { tooManyDecimalsMessage } from '../../api/amountRefusal'
import type { PricingSettings } from '../../api/pricingSettings'
import { VARIETY_REFUSAL_TEXT, type RefusalCode } from '../../api/refusals'
import type { MoneyFormat } from '../../format/money'
import { parseGrams, parseMoneyInput } from '../../format/parse'
import { GRAMS_INVALID } from '../../copy/stock'
import { VARIETIES_TEXT } from '../../copy/varieties'
import type { Refusal } from '../../i18n/refusalKeys'

export const DUPLICATE_DATE_MESSAGE = VARIETIES_TEXT.yaCargasteUnPrecio
export const PRICE_INVALID_MESSAGE = VARIETIES_TEXT.revisaLosPreciosCargados

export type PriceField = 'effectiveFrom' | 'listPrice' | 'bulkPrice' | 'bulkMinimum' | 'vipPrice' | 'form'
export type PriceErrors = Partial<Record<PriceField, string>>

export interface PriceValues {
  listPrice: string
  bulkPrice: string
  bulkMinimum: string
  vipPrice: string
}

type FieldOfCode = { field: PriceField; message: Refusal | string }

/** The fields the refusal codes are about; the decimals refusal says what the business's decimals allow. */
function fieldsOfCodes(format: MoneyFormat): Partial<Record<RefusalCode, FieldOfCode>> {
  return {
    'variety.duplicate_effective_date': { field: 'effectiveFrom', message: DUPLICATE_DATE_MESSAGE },
    'variety.price_entry_invalid': { field: 'listPrice', message: PRICE_INVALID_MESSAGE },
    'grams.invalid': { field: 'bulkMinimum', message: GRAMS_INVALID },
    'money.too_many_decimals': { field: 'listPrice', message: tooManyDecimalsMessage(format) },
    'variety.vip_price_not_below_list': {
      field: 'vipPrice',
      message: VARIETY_REFUSAL_TEXT['variety.vip_price_not_below_list'] ?? PRICE_INVALID_MESSAGE,
    },
  }
}

export function fieldOfCode(code: string, format: MoneyFormat): FieldOfCode | undefined {
  return (fieldsOfCodes(format) as Record<string, FieldOfCode | undefined>)[code]
}

/** What a refused amount says: the decimals rule when it was typed with too many, the price message otherwise. */
function refusalOf(parsed: { ok: false; tooManyDecimals: boolean } | { ok: true }, format: MoneyFormat): string {
  return !parsed.ok && parsed.tooManyDecimals ? tooManyDecimalsMessage(format) : PRICE_INVALID_MESSAGE
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
export function readPriceValues(values: PriceValues, settings: PricingSettings, format: MoneyFormat): PriceRead {
  const { listPrice, bulkPrice, bulkMinimum, vipPrice } = values
  const money = parseMoneyInput(listPrice, format)
  const hasBulk = settings.is_bulk_pricing && (bulkPrice.trim() !== '' || bulkMinimum.trim() !== '')
  const hasVip = settings.is_vip_customers && vipPrice.trim() !== ''
  const vipMoney = parseMoneyInput(vipPrice, format)
  const bulkMoney = parseMoneyInput(bulkPrice, format)
  const bulkGrams = parseGrams(bulkMinimum)
  const errors: PriceErrors = {}
  if (!money.ok) errors.listPrice = refusalOf(money, format)
  if (hasBulk && !bulkMoney.ok) errors.bulkPrice = refusalOf(bulkMoney, format)
  if (hasBulk && !bulkGrams.ok) errors.bulkMinimum = GRAMS_INVALID
  if (hasVip && !vipMoney.ok) errors.vipPrice = refusalOf(vipMoney, format)
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
