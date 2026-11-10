/**
 * Parses what a person types for money and for grams (plan, "Input"): the only
 * place in the front that turns typed text into a number for either. Grams never
 * travel further as a JS number: a parsed amount leaves the front only as the
 * decimal string the API takes (plan, invariants).
 */

import { currentMoneyFormat } from './money'

export type ParseResult<T> = { ok: true; value: T } | { ok: false }

// The whole part is either properly dot-grouped ("11.000", "1.234.567") or plain digits
// ("11000"); a decimal comma follows only when the Business has decimals, with at most that many.
function moneyPattern(decimals: number): RegExp {
  const cents = decimals === 0 ? '' : `(,\\d{1,${decimals}})?`
  return new RegExp(`^(\\d{1,3}(\\.\\d{3})+|\\d+)${cents}$`)
}
// A comma or a dot, then at most two decimal digits.
const GRAMS_RE = /^\d+([.,]\d{1,2})?$/
// The same shape, with an optional leading minus — only an adjustment's grams may be
// negative (stock.md: "An adjustment may be positive or negative").
const SIGNED_GRAMS_RE = /^-?\d+([.,]\d{1,2})?$/

/** An amount in currency units: a dot as the thousands separator and, up to the Business's
 * decimals, a comma for the decimals (`1.250,5`). Rejects more decimals than the Business has,
 * a negative sign, zero and anything that is not digits, dots and one comma. */
export function parseMoney(input: string): ParseResult<number> {
  const parsed = parseNonNegativeMoney(input)
  return parsed.ok && parsed.value > 0 ? parsed : { ok: false }
}

/** The same reading as `parseMoney`, but zero is a value: for an amount that is `0` by default and
 * valid to save so (shipping charged). */
export function parseNonNegativeMoney(input: string): ParseResult<number> {
  const trimmed = input.trim()
  if (!moneyPattern(currentMoneyFormat().decimals).test(trimmed)) return { ok: false }
  const value = Number(trimmed.replace(/\./g, '').replace(',', '.'))
  if (!Number.isSafeInteger(Math.round(value * 10 ** currentMoneyFormat().decimals))) return { ok: false }
  return { ok: true, value }
}

/** What a person typed into the amount field, read leniently: the one place typed money text
 * becomes a number. With decimals, the field always shows exactly that many, so the digits
 * typed are the smallest units (`"US$ 10,005"` reads 100,05). With none, everything from the
 * first comma on is cents and goes; with no comma, a last dot followed by one or two digits is
 * cents too (a dot followed by three is a thousands separator). Then only digits stay. No digit
 * left gives `null`.
 *
 * After a `'delete'` edit the text is the figure the field itself showed, with a digit
 * missing ("$ 20.00" from "$ 20.000"), so its dots are thousands whatever follows them and
 * the cents rule does not apply. */
export function readMoneyInput(text: string, edit: 'insert' | 'delete' = 'insert'): number | null {
  const { decimals, symbol } = currentMoneyFormat()
  if (decimals > 0) {
    const digits = (text.startsWith(symbol) ? text.slice(symbol.length) : text).replace(/\D/g, '')
    return digits === '' ? null : Number(digits) / 10 ** decimals
  }
  const commaAt = text.indexOf(',')
  const noCents = commaAt === -1 ? text : text.slice(0, commaAt)
  const whole = commaAt === -1 && edit === 'insert' ? noCents.replace(/\.\d{1,2}$/, '') : noCents
  const digits = whole.replace(/\D/g, '')
  return digits === '' ? null : Number(digits)
}

/** Grams with a comma or a dot, at most two decimals. Returned as the decimal string
 * the API takes, never as a float the front goes on to compute with. */
export function parseGrams(input: string): ParseResult<string> {
  const trimmed = input.trim()
  if (!GRAMS_RE.test(trimmed)) return { ok: false }
  const normalized = trimmed.replace(',', '.')
  if (Number(normalized) <= 0) return { ok: false }
  return { ok: true, value: normalized }
}

/** The same shape as `parseGrams`, but a leading minus is allowed — for a stock
 * entry's own grams field, where only an adjustment may go negative (the backend is
 * the one that refuses a negative amount on every other origin, `stock.grams_invalid`:
 * this parser only rejects what no origin could ever carry, zero or empty input). */
export function parseSignedGrams(input: string): ParseResult<string> {
  const trimmed = input.trim()
  if (!SIGNED_GRAMS_RE.test(trimmed)) return { ok: false }
  const normalized = trimmed.replace(',', '.')
  if (Number(normalized) === 0) return { ok: false }
  return { ok: true, value: normalized }
}
