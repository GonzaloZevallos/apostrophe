/**
 * Formats money and grams for display (`formato.ts`: the Business's symbol and exactly its
 * decimals, a decimal comma and dots for thousands; grams with a comma and up to two
 * decimals). Parsing what a
 * person types is `parse.ts`'s job; this module only turns a number the backend
 * already answered into the fixed display format — it never rounds a value the front
 * goes on to compute with (plan, invariants: grams are only formatted, never
 * computed with).
 */

const WHOLE_FMT = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

/** How a Business writes money (Money format): the symbol before the figure and how many
 * decimals it carries. The API answers it on `GET /auth/me` and never carries a scale. */
export interface MoneyFormat {
  symbol: string
  decimals: number
}

const DEFAULT_MONEY_FORMAT: MoneyFormat = { symbol: '$', decimals: 0 }

let current: MoneyFormat = DEFAULT_MONEY_FORMAT

/** The one module-level format every screen writes money with: set from `me` by the signed-in
 * shell and by a successful save of Currency and decimals (ADR-0083). */
export function setMoneyFormat(format: MoneyFormat): void {
  current = { symbol: format.symbol, decimals: format.decimals }
}

export function currentMoneyFormat(): MoneyFormat {
  return current
}

/** Back to `$` and 0 decimals: what a signed-out page and every test start from. */
export function resetMoneyFormat(): void {
  current = DEFAULT_MONEY_FORMAT
}

function withDotThousands(whole: number): string {
  return String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** The magnitude of an amount in currency units as the smallest units of `decimals`,
 * half away from zero. */
function scaledMagnitude(amount: number, decimals: number): number {
  return Math.round(Math.abs(amount) * 10 ** decimals)
}

function writtenMagnitude(scaled: number, decimals: number): string {
  const factor = 10 ** decimals
  const whole = withDotThousands(Math.floor(scaled / factor))
  if (decimals === 0) return whole
  return `${whole},${String(scaled % factor).padStart(decimals, '0')}`
}

/** `11000` → `"US$ 11.000,50"`-style text in an explicit format: what the Currency and decimals
 * Example shows from values that are not saved yet. It validates nothing; `formatMoney` is
 * this with the Business's own format. */
export function formatMoneyIn(amount: number, format: MoneyFormat): string {
  const scaled = scaledMagnitude(amount, format.decimals)
  const sign = amount < 0 && scaled !== 0 ? '-' : ''
  return `${format.symbol} ${sign}${writtenMagnitude(scaled, format.decimals)}`
}

/** `11000` → `"$ 11.000"` at 0 decimals, `"US$ 11.000,50"` at 2; a figure with more
 * decimals than the Business shows is rounded half away from zero. */
export function formatMoney(amount: number): string {
  return formatMoneyIn(amount, current)
}

/** `350` → `"3,5"`: a quantity from whole hundredths, in integer arithmetic only: the
 * whole part with dot thousands, then a comma and up to two decimals with the trailing
 * zero dropped. It carries no unit; a caller adds the one its copy holds. */
export function formatQuantity(hundredths: number): string {
  const sign = hundredths < 0 ? '-' : ''
  const magnitude = Math.abs(hundredths)
  const whole = Math.trunc(magnitude / 100)
  const rest = magnitude % 100
  const decimals = rest === 0 ? '' : `,${String(rest).padStart(2, '0').replace(/0$/, '')}`
  return `${sign}${WHOLE_FMT.format(whole)}${decimals}`
}

/** Keeps every "$ 11.000" in a sentence on one line: the space after the symbol becomes a
 * no-break space, so a narrow phone wraps before the symbol and never between it and
 * the number. The text a person reads is the same; only where it may break changes. */
export function keepMoneyTogether(text: string): string {
  const { symbol } = current
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`${escaped} (?=\\d)`, 'g'), () => `${symbol}\u00a0`)
}

/** `3.5` → `"3,5 g"`. Takes the `QuantityOut` float the API answers, or the decimal
 * string a form field holds before it is sent. */
export function formatGrams(grams: number | string): string {
  return `${formatQuantity(Math.round(Number(grams) * 100))} g`
}

const GRAMS_INPUT_FMT = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2, useGrouping: false })

/** `3.5` → `"3,5"`: the grams as a person types them into a field, with the comma and
 * no unit or thousands dots, so `parseGrams` reads it back. */
export function formatGramsInput(grams: number): string {
  return GRAMS_INPUT_FMT.format(grams)
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
  return pesos < 0 && scaledMagnitude(pesos, current.decimals) !== 0 ? `−${formatMoney(Math.abs(pesos))}` : formatMoney(Math.abs(pesos))
}
