/**
 * The sale preview (plan, invariants): line totals and special-price rates are
 * computed only here, in integer hundredths of a gram, with no `Math.round`,
 * `toFixed` or float multiplication on grams anywhere in this module. It mirrors
 * `app/sales/domain/pricing.py` exactly (first rule that applies wins: gift, special
 * price, VIP, bulk — measured per line, never summed across a sale — then list), so
 * a rule change there is caught here too, through the one matrix both sides run
 * (`pricing-matrix.json`, read by this module's tests and by `tests/sales/test_pricing_matrix.py`).
 *
 * What the API answers after a save, an assign or a delete always wins (plan,
 * invariants): nothing here runs again once a sale is saved.
 */

export type PricingRule = 'list' | 'bulk' | 'vip' | 'gift' | 'special'

/** CONTEXT.md: Bulk price, Bulk minimum. `minimumHundredths` is the bulk minimum in
 * hundredths of a gram, the same unit every grams figure in this module uses. */
export interface BulkQuote {
  price: number
  minimumHundredths: number
}

/** CONTEXT.md: Current price — a variety's list price, and optionally a bulk price
 * lower than it, on the sale's date. `null` means the variety has no price that day. */
export interface PriceQuote {
  listPrice: number
  bulk: BulkQuote | null
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
  vip: boolean
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
  const { gift, specialPrice, vip, quote, gramsHundredths } = input
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
  if (vip && quote.bulk !== null) {
    const price = quote.bulk.price
    return { rule: 'vip', pricePerGram: price, lineTotal: lineTotal(price, gramsHundredths) }
  }
  if (quote.bulk !== null && gramsHundredths >= quote.bulk.minimumHundredths) {
    const price = quote.bulk.price
    return { rule: 'bulk', pricePerGram: price, lineTotal: lineTotal(price, gramsHundredths) }
  }
  return {
    rule: 'list',
    pricePerGram: quote.listPrice,
    lineTotal: lineTotal(quote.listPrice, gramsHundredths),
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

/** The inverse of `toHundredths`, for handing a sum of hundredths (`saleTotals`'s
 * grams sold/gifted) to `format/money.ts`'s `formatGrams`. Display only: this value
 * is never computed with again. */
export function fromHundredths(hundredths: number): number {
  return hundredths / 100
}

/** Turns a bulk minimum's grams as the API answers them (`GramsOut`: a JSON number
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

/** The two errors `validateSale` checks, each on its own field (plan: the only
 * screen-side checks before saving; every other refusal comes back from the API). */
export type SaleError = { field: 'customer' | `line:${string}`; message: string }

export interface LineValidation {
  id: string
  varietyName: string
  gift: boolean
  specialPrice: number | null
  quote: PriceQuote | null
}

export type PaymentChoice = 'cash' | 'transfer' | 'owing'

/** The two rules the sale screen checks before saving (sales.md criterion 7):
 * Debiendo needs a customer, and every line that is priced from the day's prices
 * (not a gift, no special price) needs one. Any other refusal comes back from the
 * API, with its own code. */
export function validateSale(input: {
  method: PaymentChoice | null
  hasCustomer: boolean
  lines: readonly LineValidation[]
}): SaleError[] {
  const errors: SaleError[] = []
  for (const line of input.lines) {
    const pricedFromTheDay = !line.gift && line.specialPrice === null
    if (pricedFromTheDay && line.quote === null) {
      errors.push({
        field: `line:${line.id}`,
        message: `${line.varietyName} no tiene precio para esa fecha`,
      })
    }
  }
  if (input.method === 'owing' && !input.hasCustomer) {
    errors.push({ field: 'customer', message: 'Para dejar debiendo elegí un cliente' })
  }
  return errors
}
