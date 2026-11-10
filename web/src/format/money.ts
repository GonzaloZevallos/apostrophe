/**
 * Formats money and grams for display (`formato.ts`: money in the business's own Money format
 * with a dot as the thousands separator, grams with a comma and up to two decimals). Parsing
 * what a person types is `parse.ts`'s job; this module only turns a number the backend already
 * answered into the display format — it never rounds a value the front goes on to compute with.
 * Money checks against `money.vectors.json`, the file the Catalog's pytest reads too.
 */

const WHOLE_FMT = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

/** How a business shows money: its symbol and decimals (the Money format). The stored scale never
 * reaches the front. */
export interface MoneyFormat {
  symbol: string
  decimals: number
}

/** An amount in currency units: the JSON number the API answers, or the decimal string a vector
 * or a caller holding more digits than a number keeps spells out. */
export type MoneyAmount = number | string

/** The business's money writers. `money` is the app's form (`$ 11.000`), `attached` the one for
 * the Catalog and for an amount inside a sentence (`$11.000`), `signed` puts U+2212 before a
 * negative figure (`−$ 4.500`), `magnitude` drops the sign, `keepTogether` keeps a spaced
 * amount on one line. */
export interface MoneyFormatter {
  readonly format: MoneyFormat
  money(amount: MoneyAmount): string
  attached(amount: MoneyAmount): string
  signed(amount: MoneyAmount): string
  magnitude(amount: MoneyAmount): string
  keepTogether(text: string): string
}

const MINUS = '\u2212'
const NO_BREAK_SPACE = '\u00a0'

/** The digits of an amount as `{ negative, whole, fraction }`, read from the shortest decimal text
 * that names it (`1.005` stays `1.005`, which a product by 100 would not), exponent expanded. */
function digitsOf(amount: MoneyAmount): { negative: boolean; whole: string; fraction: string } {
  const text = String(amount).trim()
  const parts = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(text)
  if (parts === null) throw new RangeError(`Not an amount: ${text}`)
  const [, sign = '', integer = '0', decimals = '', exponent = '0'] = parts
  const shift = Number(exponent)
  let digits = integer + decimals
  let point = integer.length + shift
  if (point < 0) {
    digits = '0'.repeat(-point) + digits
    point = 0
  } else if (point > digits.length) {
    digits += '0'.repeat(point - digits.length)
  }
  return { negative: sign === '-', whole: digits.slice(0, point) || '0', fraction: digits.slice(point) }
}

/** Dots between thousands, from four digits up, by hand. */
function grouped(whole: string): string {
  const groups: string[] = []
  let rest = whole
  while (rest.length > 3) {
    groups.unshift(rest.slice(-3))
    rest = rest.slice(0, -3)
  }
  groups.unshift(rest)
  return groups.join('.')
}

/** The magnitude's figure at `decimals`, half up (away from zero for the sign): a comma and
 * exactly `decimals` digits, whole units with dots. `negative` is true only when the shown
 * figure is not zero, so `-0.4` at 0 decimals never writes `-0`. */
function figureOf(amount: MoneyAmount, decimals: number): { negative: boolean; figure: string } {
  const { negative, whole, fraction } = digitsOf(amount)
  const kept = fraction.slice(0, decimals).padEnd(decimals, '0')
  let scaled = (whole + kept).split('').map(Number)
  if (Number(fraction.charAt(decimals) || '0') >= 5) {
    let at = scaled.length - 1
    while (at >= 0 && scaled[at] === 9) scaled[at--] = 0
    if (at < 0) scaled = [1, ...scaled]
    else scaled[at] = (scaled[at] ?? 0) + 1
  }
  const text = scaled.join('').padStart(decimals + 1, '0')
  const wholeText = text.slice(0, text.length - decimals).replace(/^0+(?=\d)/, '')
  const decimalText = decimals === 0 ? '' : `,${text.slice(text.length - decimals)}`
  return { negative: negative && /[1-9]/.test(text), figure: `${grouped(wholeText)}${decimalText}` }
}

function escapedForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** The money writers for one business's Money format, in integer arithmetic only: no `Intl`, no
 * `toFixed`, no `float` product. A figure that is not whole is shown at the business's decimals,
 * half up away from zero. */
export function moneyFormatter(format: MoneyFormat): MoneyFormatter {
  const keepPattern = new RegExp(`${escapedForRegExp(format.symbol)} (?=\\d)`, 'g')
  const written = (amount: MoneyAmount, gap: string): string => {
    const { negative, figure } = figureOf(amount, format.decimals)
    return `${format.symbol}${gap}${negative ? '-' : ''}${figure}`
  }
  const magnitude = (amount: MoneyAmount): string => `${format.symbol} ${figureOf(amount, format.decimals).figure}`
  return {
    format,
    money: (amount) => written(amount, ' '),
    attached: (amount) => written(amount, ''),
    signed: (amount) => (figureOf(amount, format.decimals).negative ? `${MINUS}${magnitude(amount)}` : magnitude(amount)),
    magnitude,
    keepTogether: (text) => text.replace(keepPattern, () => `${format.symbol}${NO_BREAK_SPACE}`),
  }
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
