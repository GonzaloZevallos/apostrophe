/**
 * The sale preview (plan, invariants): line totals and special-price rates are
 * computed only here, in integer hundredths of a gram, with no `Math.round`,
 * `toFixed` or float multiplication on grams anywhere in this module. It mirrors
 * `app/sales/domain/pricing.py` exactly (gift, then special price, then the lowest of
 * list, bulk — measured per line, never summed across a sale — and the Customer's type
 * price; a type-bulk tie is stored as the type, a tie with list cannot arise), so a rule change there is caught here too, through the one matrix both sides run
 * (`pricing-matrix.json`, read by this module's tests and by `tests/sales/test_pricing_matrix.py`).
 *
 * The matrix's `repricing` pairs (before/after `totals` entries) pin `priceSale` and
 * `linesRepriced` on both sides. The matrix has no date key, so a date change is a different
 * quote on the same lines; it still spells the type rule `vip`, which the runners map to `type`.
 *
 * What the API answers after a save, an assign or a delete always wins (plan,
 * invariants): nothing here runs again once a sale is saved.
 */

import type { PaymentMethod } from '../api/payments'
import { noPriceMessage, OWING_HINT } from '../copy/sales'
import type { MoneyFormat } from '../format/money'
import { parseMoneyInput } from '../format/parse'
import type { Variety } from '../screens/Variedades'

/** `'vip'` is only read, from lines saved before customer types; a new line priced by a type's
 * price is `'type'` and carries the type's name (ADR-0059). */
export type PricingRule = 'list' | 'bulk' | 'vip' | 'type' | 'gift' | 'special'

/** CONTEXT.md: Bulk price, Bulk minimum. `minimumHundredths` is the bulk minimum in
 * hundredths of a gram, the same unit every grams figure in this module uses. */
export interface BulkQuote {
  price: number
  minimumHundredths: number
}

/** CONTEXT.md: Current price — a variety's list price, and optionally a bulk price
 * lower than it and optionally a VIP price lower than it, on the sale's date. `null` means the variety has no price that day. */
export interface PriceQuote {
  listPrice: number
  bulk: BulkQuote | null
  /** The price per gram the Customer's type has in this entry, or `null` for none. Never 0 as a
   * stand-in. The shared matrix still names it `vipPrice`. */
  vipPrice: number | null
}

/** CONTEXT.md: Pricing settings — which of Precio por cantidad and Clientes VIP the
 * business uses. */
export interface PricingSettings {
  bulk: boolean
  vip: boolean
}

export interface LinePricing {
  rule: PricingRule
  pricePerGram: number
  lineTotal: number
}

export abstract class SaleRuleBroken extends Error {}

export class NonPositiveGrams extends SaleRuleBroken {
  constructor() {
    super('a line needs grams above zero')
  }
}

export class GiftWithSpecialPrice extends SaleRuleBroken {
  constructor() {
    super('a line cannot be both a gift and have a special price')
  }
}

export class InvalidSpecialPrice extends SaleRuleBroken {
  constructor() {
    super('a special price must be above zero')
  }
}

export class NoPriceThatDay extends SaleRuleBroken {
  constructor() {
    super("the variety has no price on the sale's date")
  }
}

export interface LineInput {
  gift: boolean
  specialPrice: number | null
  /** Whether the Customer has a type (the shared matrix still names it `customerIsVip`). */
  customerIsVip: boolean
  settings: PricingSettings
  quote: PriceQuote | null
  gramsHundredths: number
}

/** `pricePerGram x grams`, rounded to the whole peso, half up: `(price*h + 50) / 100`
 * truncated — the same integer formula as `line_total` in the domain, never
 * `Math.round`. */
export function lineTotal(pricePerGram: number, gramsHundredths: number): number {
  return Math.trunc((pricePerGram * gramsHundredths + 50) / 100)
}

/** The price per gram implied by a special price's whole-peso total, half up. Shown
 * for reference only: it never feeds back into a total (ADR-0003), the same as
 * `special_rate` in the domain. */
export function specialRate(total: number, gramsHundredths: number): number {
  return Math.trunc((200 * total + gramsHundredths) / (2 * gramsHundredths))
}

/** Prices one sale line preview, mirroring `price_line` (app/sales/domain/pricing.py)
 * exactly. Refuses grams <= 0, a gift combined with a special price, a special price
 * <= 0, and a missing quote with no special price to replace it. */
export function priceLine(input: LineInput): LinePricing {
  const { gift, specialPrice, customerIsVip, settings, quote, gramsHundredths } = input
  if (gramsHundredths <= 0) throw new NonPositiveGrams()
  if (gift && specialPrice !== null) throw new GiftWithSpecialPrice()
  if (gift) return { rule: 'gift', pricePerGram: 0, lineTotal: 0 }
  if (specialPrice !== null) {
    if (specialPrice <= 0) throw new InvalidSpecialPrice()
    return {
      rule: 'special',
      pricePerGram: specialRate(specialPrice, gramsHundredths),
      lineTotal: specialPrice,
    }
  }
  if (quote === null) throw new NoPriceThatDay()
  // Start from list; bulk replaces it only when strictly lower; the type's price replaces
  // whatever is best when not higher, so a type-bulk tie is stored as the type.
  let best: { rule: PricingRule; price: number } = { rule: 'list', price: quote.listPrice }
  if (settings.bulk && quote.bulk !== null && gramsHundredths >= quote.bulk.minimumHundredths) {
    if (quote.bulk.price < best.price) best = { rule: 'bulk', price: quote.bulk.price }
  }
  if (settings.vip && customerIsVip && quote.vipPrice !== null) {
    if (quote.vipPrice <= best.price) best = { rule: 'type', price: quote.vipPrice }
  }
  return {
    rule: best.rule,
    pricePerGram: best.price,
    lineTotal: lineTotal(best.price, gramsHundredths),
  }
}

/** One already-priced line, as `saleTotals` needs it: just enough to add up the
 * sale's merchandise and split sold grams from gifted grams. */
export interface LineForTotals {
  gift: boolean
  gramsHundredths: number
  lineTotal: number
}

export interface SaleTotals {
  goods: number
  shippingCharged: number
  total: number
  gramsSoldHundredths: number
  gramsGiftedHundredths: number
}

/** The sale's total preview: the stored/previewed line totals summed, plus shipping
 * charged once — never line totals recomputed from price times grams (ADR-0003) —
 * and the grams sold vs. gifted, both in hundredths. */
export function saleTotals(lines: readonly LineForTotals[], shippingCharged: number): SaleTotals {
  let goods = 0
  let gramsSoldHundredths = 0
  let gramsGiftedHundredths = 0
  for (const line of lines) {
    goods += line.lineTotal
    if (line.gift) gramsGiftedHundredths += line.gramsHundredths
    else gramsSoldHundredths += line.gramsHundredths
  }
  return {
    goods,
    shippingCharged,
    total: goods + shippingCharged,
    gramsSoldHundredths,
    gramsGiftedHundredths,
  }
}

// What `format/parse.ts`'s `parseGrams` already guarantees before a value reaches
// here: digits, at most one dot, at most two decimals. Checked again at the door
// rather than trusted silently, so a caller that skips `parse.ts` gets a thrown error
// instead of a silent `NaN` that would slip past `priceLine`'s `gramsHundredths <= 0`
// check (`NaN <= 0` is `false`).
const VALID_GRAMS_RE = /^\d+(\.\d{1,2})?$/

/** Converts grams already validated by `format/parse.ts` (`"3.5"`, `"3"`, at most two
 * decimals) into integer hundredths, working on the decimal string's digits — never by
 * multiplying a float gram value, the same way the backend's `Grams.of` works on a
 * `Decimal` rather than a float. */
export function toHundredths(grams: string): number {
  if (!VALID_GRAMS_RE.test(grams)) {
    throw new Error('toHundredths expects grams already validated by parse.ts')
  }
  const [whole = '0', fraction = ''] = grams.split('.')
  const hundredths = `${fraction}00`.slice(0, 2)
  return Number(whole) * 100 + Number(hundredths)
}

/** The wire quantity of an integer count of hundredths of a gram (`350` -> `'3.5'`, `300` -> `'3'`,
 * `5` -> `'0.05'`), built from the number's digits: never `toFixed` and never a float division.
 * Refuses anything that is not a safe integer of 0 or more, as `toHundredths` refuses unvalidated text.
 * It does not check the largest quantity a line takes: that limit lives in `saleDraft.ts`, which
 * imports this module. */
export function quantityOfHundredths(hundredths: number): string {
  if (!Number.isSafeInteger(hundredths) || hundredths < 0) {
    throw new Error('quantityOfHundredths expects a safe integer of hundredths, 0 or more')
  }
  const digits = String(hundredths).padStart(3, '0')
  const whole = digits.slice(0, -2)
  const fraction = digits.slice(-2).replace(/0+$/, '')
  return fraction === '' ? whole : `${whole}.${fraction}`
}

/** The inverse of `toHundredths`, for handing a sum of hundredths (`saleTotals`'s
 * grams sold/gifted) to `format/money.ts`'s `formatGrams`. Display only: this value
 * is never computed with again. */
export function fromHundredths(hundredths: number): number {
  return hundredths / 100
}

/** Turns a bulk minimum's grams as the API answers them (`QuantityOut`: a JSON number
 * the backend guarantees carries at most two decimals) into hundredths, for building
 * the `BulkQuote` the live preview prices against. Goes through the decimal string
 * `Number.prototype.toString()`'s own shortest-round-trip algorithm produces —
 * which, for a value already guaranteed to have at most two decimals, reproduces
 * those exact digits — and then `toHundredths`, the same string-digit arithmetic
 * every other grams conversion here uses. Never `toFixed` (which rounds by scaling
 * the float: exactly the imprecision this module exists to avoid) and never a float
 * multiplication (plan, invariants). This is the only place in the front that may
 * turn the API's grams into hundredths — a screen never calls `toFixed` on a grams
 * value itself. */
export function hundredthsOfApiGrams(apiGrams: number): number {
  return toHundredths(String(apiGrams))
}

/** The price the Customer's type has in the entry, from the current price's `type_prices`; `null`
 * for a Customer with no type or a type with no price in it. */
export function typePriceOf(variety: Variety, typeId: number | null): number | null {
  if (typeId === null) return null
  const found = variety.current_price?.type_prices?.find((price) => price.customer_type_id === typeId)
  return found === undefined ? null : found.price
}

export function quoteOf(variety: Variety, typeId: number | null): PriceQuote | null {
  const price = variety.current_price
  if (price === null) return null
  const bulk =
    price.bulk_price !== null && price.bulk_minimum !== null
      ? { price: price.bulk_price, minimumHundredths: hundredthsOfApiGrams(price.bulk_minimum) }
      : null
  return { listPrice: price.list_price, bulk, vipPrice: typePriceOf(variety, typeId) }
}

/** One line of a sale as typed: what `priceSale` needs, nothing more. */
export interface SaleLineInput {
  id: string
  productId: number
  gramsHundredths: number
  gift: boolean
  specialPrice: number | null
}

/** A line's pricing plus the Customer type that priced it: set only for the `type` rule. */
export interface PricedSaleLine {
  id: string
  gift: boolean
  gramsHundredths: number
  pricing: (LinePricing & { customerTypeId: number | null }) | null
}

export interface PricedSale {
  lines: PricedSaleLine[]
  totals: SaleTotals
}

/** Prices every line of a sale against `products` (the day's list, so no date here) and adds
 * the totals. A line that breaks a sale rule (no price that day, grams not above zero, ...)
 * is left unpriced (`pricing: null`) and adds 0 grams and $0 to the totals, as the screen does;
 * any other error (e.g. a malformed bulk minimum from `quoteOf`) is a data fault and propagates.
 * A missing product only means no quote: a Gift or a Special price is still priced. */
export function priceSale(input: {
  lines: readonly SaleLineInput[]
  customerTypeId: number | null
  pricingSettings: PricingSettings
  products: readonly Variety[]
  shippingCharged: number
}): PricedSale {
  const { lines, customerTypeId, pricingSettings, products, shippingCharged } = input
  const priced: PricedSaleLine[] = lines.map((line) => {
    const { id, gift, specialPrice, gramsHundredths } = line
    const product = products.find((candidate) => candidate.id === line.productId)
    const quote = product === undefined ? null : quoteOf(product, customerTypeId)
    try {
      const pricing = priceLine({
        gift,
        specialPrice,
        customerIsVip: customerTypeId !== null,
        settings: pricingSettings,
        quote,
        gramsHundredths,
      })
      return {
        id,
        gift,
        gramsHundredths,
        pricing: { ...pricing, customerTypeId: pricing.rule === 'type' ? customerTypeId : null },
      }
    } catch (error) {
      if (error instanceof SaleRuleBroken) return { id, gift, gramsHundredths, pricing: null }
      throw error
    }
  })
  const totals = saleTotals(
    priced.map((line) =>
      line.pricing === null
        ? { gift: line.gift, gramsHundredths: 0, lineTotal: 0 }
        : { gift: line.gift, gramsHundredths: line.gramsHundredths, lineTotal: line.pricing.lineTotal },
    ),
    shippingCharged,
  )
  return { lines: priced, totals }
}

const RULE_PRICED: readonly PricingRule[] = ['list', 'bulk', 'type']

/** Whether any line priced by a rule (list, bulk, type) in both results changed its price per
 * gram, rule or Customer type. Lines are matched by id, never by position; a line on one side
 * only, and any Gift, Special price or unpriced line, is not compared. Ids are unique within
 * each side: duplicates are outside the contract. */
export function linesRepriced(before: PricedSale, after: PricedSale): boolean {
  const earlier = new Map(before.lines.map((line) => [line.id, line]))
  for (const line of after.lines) {
    const was = earlier.get(line.id)
    if (was === undefined || was.pricing === null || line.pricing === null) continue
    if (!RULE_PRICED.includes(was.pricing.rule) || !RULE_PRICED.includes(line.pricing.rule)) continue
    if (
      was.pricing.pricePerGram !== line.pricing.pricePerGram ||
      was.pricing.rule !== line.pricing.rule ||
      was.pricing.customerTypeId !== line.pricing.customerTypeId
    ) {
      return true
    }
  }
  return false
}

/** The errors `validateSale` checks, each on its own field (plan: the only screen-side checks
 * before saving; every other refusal comes back from the API). The missing method carries no
 * wording: the field draws its own refusal from the Copy module. */
export type SaleError =
  | { field: 'customer' | `line:${string}`; message: string }
  | { field: 'method' }

export interface LineValidation {
  id: string
  varietyName: string
  gift: boolean
  specialPrice: number | null
  quote: PriceQuote | null
}

/** The wire payment of a sale (`PaidIn | OwingIn`, discriminated on `kind`). */
export type PaymentChoice = { kind: 'paid'; payment_method_id: PaymentMethod } | { kind: 'owing' }

/** The state of "how paid": Paid or Owing, or nothing chosen yet. */
export type PayState = 'paid' | 'owing'

/** The wire payment of a sale, derived from (state, method, total). A method held while the state
 * is not Paid is never sent; Paid with no method gives null (the screen allows that only at $0,
 * and the API refuses it otherwise); an unchosen state gives null. */
export function paymentChoiceOf(
  payState: PayState | null,
  method: PaymentMethod | null,
  // The total takes part in the rule `validateSale` applies, not in the value: Paid sends its
  // method whatever the total, and a $0 sale with no method sends none.
  _total: number,
): PaymentChoice | null {
  if (payState === 'owing') return { kind: 'owing' }
  if (payState === 'paid') return method === null ? null : { kind: 'paid', payment_method_id: method }
  return null
}

/** The state and method that give back `choice`: the exact inverse of `paymentChoiceOf`. It lets
 * `validateSale` judge the choice `effectiveChoice` (`saleDraft.ts`) gives. An unset choice above $0
 * is not refused by `validateSale` but by the API's `sale.payment_required`, as New sale does today. */
export function payStateOf(choice: PaymentChoice | null): { payState: PayState | null; method: PaymentMethod | null } {
  if (choice === null) return { payState: null, method: null }
  if (choice.kind === 'owing') return { payState: 'owing', method: null }
  return { payState: 'paid', method: choice.payment_method_id }
}

/** The change owed for what the Customer handed over: `null` when `receivedText` is empty or refused
 * by `parseMoneyInput`, or is below `total`; otherwise the difference in currency units (0 when equal).
 * Both amounts become integers at the format's decimals and are subtracted as integers. For display
 * only: it never goes into a request body. */
export function changeFor(receivedText: string, total: number, format: MoneyFormat): number | null {
  const parsed = parseMoneyInput(receivedText, format)
  if (!parsed.ok) return null
  const scale = 10 ** format.decimals
  const difference = Math.round(parsed.value * scale) - Math.round(total * scale)
  return difference < 0 ? null : difference / scale
}

/** The rules the sale screen checks before saving (sales.md): Owing needs a customer, Paid above
 * $0 needs a method, and every line that is priced from the day's prices (not a gift, no special
 * price) needs one. Any other refusal comes back from the API, with its own code. */
export function validateSale(input: {
  payState: PayState | null
  method: PaymentMethod | null
  total: number
  hasCustomer: boolean
  lines: readonly LineValidation[]
}): SaleError[] {
  const errors: SaleError[] = []
  for (const line of input.lines) {
    const pricedFromTheDay = !line.gift && line.specialPrice === null
    if (pricedFromTheDay && line.quote === null) {
      errors.push({
        field: `line:${line.id}`,
        message: noPriceMessage(line.varietyName),
      })
    }
  }
  if (input.payState === 'owing' && !input.hasCustomer) {
    errors.push({ field: 'customer', message: OWING_HINT })
  }
  if (input.payState === 'paid' && input.method === null && input.total > 0) {
    errors.push({ field: 'method' })
  }
  return errors
}
