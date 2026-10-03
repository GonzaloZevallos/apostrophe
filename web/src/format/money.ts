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

/** `-2000` → `"$ 2.000"`: the one place a signed balance's magnitude is shown
 * (plan, "Front": "A negative amount is shown as its magnitude by one format
 * helper ... the only place a sign is dropped, and it never decides a label").
 * A caller still picks the "A favor" / "Te debe" wording itself, from
 * `standing` or an account row's own `kind` — never from this function. */
export function formatMoneyMagnitude(pesos: number): string {
  return formatMoney(Math.abs(pesos))
}

/** `-4500` → `"− $ 4.500"` with U+2212 (minus sign, not a hyphen): the only way
 * Ganancia and Caja show a negative figure (plan, invariants: "Ganancia and Caja
 * render through formatSignedMoney") — never hidden, floored or shown as a plain
 * hyphen. A non-negative amount formats exactly as `formatMoney`. */
export function formatSignedMoney(pesos: number): string {
  const rounded = Math.round(pesos)
  return rounded < 0 ? `−${formatMoney(Math.abs(rounded))}` : formatMoney(rounded)
}
