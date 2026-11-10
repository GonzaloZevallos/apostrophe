/**
 * Parses what a person types for money and for grams (plan, "Input"): the only
 * place in the front that turns typed text into a number for either. Grams never
 * travel further as a JS number: a parsed amount leaves the front only as the
 * decimal string the API takes (plan, invariants).
 */

import type { MoneyFormat } from './money'

export type ParseResult<T> = { ok: true; value: T } | { ok: false }

// Either properly dot-grouped ("11.000", "1.234.567") or plain digits ("11000").
const WHOLE_RE = /^\d{1,3}(\.\d{3})+$|^\d+$/
const GROUPED_RE = /^\d{1,3}(\.\d{3})+$/
const PLAIN_RE = /^\d+$/
const DOT_FRACTION_RE = /^(\d+)\.(\d+)$/
// A comma or a dot, then at most two decimal digits.
const GRAMS_RE = /^\d+([.,]\d{1,2})?$/
// The same shape, with an optional leading minus — only an adjustment's grams may be
// negative (stock.md: "An adjustment may be positive or negative").
const SIGNED_GRAMS_RE = /^-?\d+([.,]\d{1,2})?$/

/** An amount a person typed, in currency units. A refusal says whether it was for more decimals than
 * the business keeps, which the field answers with `tooManyDecimalsMessage` and not with its generic
 * "enter a valid amount". */
export type MoneyParse = { ok: true; value: number } | { ok: false; tooManyDecimals: boolean }

const INVALID: MoneyParse = { ok: false, tooManyDecimals: false }
const TOO_MANY: MoneyParse = { ok: false, tooManyDecimals: true }

function positive(whole: string, fraction: string, decimals: number): MoneyParse {
  const value = Number(fraction === '' ? whole : `${whole}.${fraction}`)
  if (!Number.isSafeInteger(Math.round(value * 10 ** decimals)) || value <= 0) return INVALID
  return { ok: true, value }
}

/** The one place typed money text becomes a number, for every amount field (plan, "Input").
 * With 0 decimals: whole amounts, a dot as the thousands separator, nothing else. With decimals: a
 * comma is the separator; a single dot followed by 1..decimals digits is too (phone keyboards that
 * offer only a dot); a dot followed by exactly three digits is thousands and never decimals; more
 * digits than the business keeps is refused as `tooManyDecimals`; a dot after the comma is invalid.
 * Zero and negatives are refused. The server's `money_within` stays the authority. */
export function parseMoneyInput(input: string, format: MoneyFormat): MoneyParse {
  const text = input.trim()
  const { decimals } = format
  if (decimals === 0) {
    if (!WHOLE_RE.test(text)) return INVALID
    return positive(text.replace(/\./g, ''), '', 0)
  }
  const commaAt = text.indexOf(',')
  if (commaAt !== -1) {
    const whole = text.slice(0, commaAt)
    const fraction = text.slice(commaAt + 1)
    if (!WHOLE_RE.test(whole) || !PLAIN_RE.test(fraction)) return INVALID
    if (fraction.length > decimals) return TOO_MANY
    return positive(whole.replace(/\./g, ''), fraction, decimals)
  }
  if (GROUPED_RE.test(text)) return positive(text.replace(/\./g, ''), '', decimals)
  if (PLAIN_RE.test(text)) return positive(text, '', decimals)
  const split = DOT_FRACTION_RE.exec(text)
  if (split === null) return INVALID
  const [, whole = '', fraction = ''] = split
  if (fraction.length > decimals) return TOO_MANY
  return positive(whole, fraction, decimals)
}

/** The keyboard an amount field opens: digits only while the business keeps no decimals, one that
 * can type the separator otherwise (`CODING_STANDARDS.md` §10, Phone 3). */
export function moneyInputMode(format: MoneyFormat): 'numeric' | 'decimal' {
  return format.decimals === 0 ? 'numeric' : 'decimal'
}

/** An amount as an amount field shows it for editing, and the only prefill: no thousands dots, a
 * comma and exactly the business's decimals (`11000,50`). */
export function formatMoneyInput(amount: number, format: MoneyFormat): string {
  return amount.toFixed(format.decimals).replace('.', ',')
}

/** What a person typed into the amount field, read leniently as whole pesos: the one place
 * typed money text becomes a number. Everything from the first comma on is cents and goes;
 * with no comma, a last dot followed by one or two digits is cents too (a dot followed by
 * three is a thousands separator). Then only digits stay. No digit left gives `null`.
 *
 * After a `'delete'` edit the text is the figure the field itself showed, with a digit
 * missing ("$ 20.00" from "$ 20.000"), so its dots are thousands whatever follows them and
 * the cents rule does not apply. */
export function readMoneyInput(text: string, edit: 'insert' | 'delete' = 'insert'): number | null {
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
