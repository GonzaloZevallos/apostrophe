/**
 * The one unit stock is counted in (grams) and the quantity rules that go with it:
 * typed text becomes integer hundredths of a gram and back, working on digit strings
 * and integers — never by multiplying a parsed float.
 */

import type { SALE_BILL_TEXT } from '../copy/sales'

/** Integer hundredths of the stock unit (`350` is 3,5 g). Made only by `gramsToHundredths`
 * and `parseQuantityInput`, through `hundredthsOf`. */
export type Hundredths = number & { readonly brand: 'Hundredths' }

/** The stock unit: the copy key of its label and how many decimals a quantity keeps. */
export const STOCK_UNIT: { readonly labelKey: keyof typeof SALE_BILL_TEXT; readonly decimals: 2 } = {
  labelKey: 'unit',
  decimals: 2,
}

const QUANTITY_RE = /^(-?)(\d+)(?:[.,](\d{1,2}))?$/
const MAX_SAFE_DIGITS = String(Number.MAX_SAFE_INTEGER)

/** The one place a number becomes `Hundredths`. */
function hundredthsOf(value: number): Hundredths {
  return value as Hundredths
}

/** Digits of `text` as hundredths: the whole part joined to the fraction padded to two digits,
 * leading zeros stripped, the sign put back on the integer. `null` for any other shape. A figure
 * beyond a safe integer comes back as `inRange: false` (and is never a quantity). */
function hundredthsDigits(text: string): { value: number; inRange: boolean } | null {
  const match = QUANTITY_RE.exec(text)
  if (match === null) return null
  const [, sign = '', whole = '', fraction = ''] = match
  const digits = (whole + fraction.padEnd(2, '0')).replace(/^0+/, '')
  const inRange =
    digits.length < MAX_SAFE_DIGITS.length ||
    (digits.length === MAX_SAFE_DIGITS.length && digits <= MAX_SAFE_DIGITS)
  const magnitude = digits === '' ? 0 : Number(digits)
  return { value: sign === '-' && magnitude !== 0 ? -magnitude : magnitude, inRange }
}

/** `"11.5"` or `"11,5"` → `1150`; `"-3,5"` → `-350`. Assumes `parseSignedGrams`'s own shape:
 * an optional minus, digits, at most one separator and at most two decimal digits. Anything else
 * gives `NaN`, which no consumer accepts as a quantity. */
export function gramsToHundredths(text: string): Hundredths {
  const parsed = hundredthsDigits(text)
  return hundredthsOf(parsed === null ? Number.NaN : parsed.value)
}

export type QuantityParse = { kind: 'empty' } | { kind: 'value'; value: Hundredths } | { kind: 'invalid' }

/** What a person typed for a quantity: blank is `empty`; an optional minus, digits and at most
 * one `,` or `.` with 1-2 digits after it is a `value` (a dot is always the decimal here); anything
 * else, zero, `-0` and a value that is not a safe integer in hundredths is `invalid`. */
export function parseQuantityInput(text: string): QuantityParse {
  const trimmed = text.trim()
  if (trimmed === '') return { kind: 'empty' }
  const parsed = hundredthsDigits(trimmed)
  if (parsed === null || !parsed.inRange || parsed.value === 0) return { kind: 'invalid' }
  return { kind: 'value', value: hundredthsOf(parsed.value) }
}

/** `350` → `"3,5"`, `405` → `"4,05"`, `-50` → `"-0,5"`, `100000` → `"1000"`: integer arithmetic
 * only, no grouping, one or two decimals with a trailing zero trimmed. */
export function formatQuantityInput(hundredths: Hundredths): string {
  const magnitude = Math.abs(hundredths)
  const whole = Math.floor(magnitude / 100)
  const fraction = magnitude % 100
  const sign = hundredths < 0 ? '-' : ''
  if (fraction === 0) return `${sign}${whole}`
  const decimals = fraction % 10 === 0 ? String(fraction / 10) : String(fraction).padStart(2, '0')
  return `${sign}${whole},${decimals}`
}
