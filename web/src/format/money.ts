/**
 * Formats money and grams for display (`formato.ts`: whole pesos with a dot as the
 * thousands separator, grams with a comma and up to two decimals). Parsing what a
 * person types is `parse.ts`'s job; this module only turns a number the backend
 * already answered into the fixed display format — it never rounds a value the front
 * goes on to compute with (plan, invariants: grams are only formatted, never
 * computed with).
 */

const MONEY_FMT = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
const GRAMS_FMT = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })

/** `11000` → `"$ 11.000"`. */
export function formatMoney(pesos: number): string {
  return `$ ${MONEY_FMT.format(Math.round(pesos))}`
}

/** `3.5` → `"3,5 g"`. Takes the `GramsOut` float the API answers, or the decimal
 * string a form field holds before it is sent. */
export function formatGrams(grams: number | string): string {
  const value = typeof grams === 'string' ? Number(grams) : grams
  return `${GRAMS_FMT.format(value)} g`
}
