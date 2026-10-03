/**
 * Parses what a person types for money and for grams (plan, "Input"): the only
 * place in the front that turns typed text into a number for either. Grams never
 * travel further as a JS number: a parsed amount leaves the front only as the
 * decimal string the API takes (plan, invariants).
 */

export type ParseResult<T> = { ok: true; value: T } | { ok: false }

// Either properly dot-grouped ("11.000", "1.234.567") or plain digits ("11000"): never
// a decimal point, which money never carries (`formato.ts`: whole pesos only).
const MONEY_RE = /^\d{1,3}(\.\d{3})+$|^\d+$/
// A comma or a dot, then at most two decimal digits.
const GRAMS_RE = /^\d+([.,]\d{1,2})?$/
// The same shape, with an optional leading minus — only an adjustment's grams may be
// negative (stock.md: "An adjustment may be positive or negative").
const SIGNED_GRAMS_RE = /^-?\d+([.,]\d{1,2})?$/

/** Whole pesos with a dot as the thousands separator. Rejects a decimal amount, a
 * negative sign, zero and anything that is not digits and dots. */
export function parseMoney(input: string): ParseResult<number> {
  const trimmed = input.trim()
  if (!MONEY_RE.test(trimmed)) return { ok: false }
  const value = Number(trimmed.replace(/\./g, ''))
  if (!Number.isSafeInteger(value) || value <= 0) return { ok: false }
  return { ok: true, value }
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
