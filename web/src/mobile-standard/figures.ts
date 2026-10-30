/**
 * What the `tabular-figures` rule calls a figure: the whole trimmed text of an element is
 * money as `format/money.ts` prints it (`$ 11.000`, `− $ 4.500`), grams (`3,5 g`), a
 * percentage (`42 %`, `42%`) or Days left (`12 days`). Dates, times, phone numbers and a
 * count inside a sentence never match, because every pattern is anchored to the whole text
 * and there is no exemption list.
 *
 * The patterns are plain sources so the page-side collector, which `page.evaluate`
 * serialises and which cannot import, rebuilds them with `new RegExp`.
 */

const MINUS = '[−-]?\\s?'
/** Dot-grouped whole number: `0`, `350`, `11.000`, `1.234.567`. */
const WHOLE = '\\d{1,3}(?:\\.\\d{3})*|\\d+'

export const FIGURE_SOURCES: readonly string[] = [
  `^${MINUS}\\$[ \\u00a0]?(?:${WHOLE})$`,
  `^${MINUS}(?:${WHOLE})(?:,\\d{1,2})? g$`,
  `^${MINUS}\\d+(?:[.,]\\d+)? ?%$`,
  '^\\d+ days?$',
]

const PATTERNS = FIGURE_SOURCES.map((source) => new RegExp(source))

/** Whether the whole trimmed text is a figure the rule covers. */
export function isFigure(text: string): boolean {
  const whole = text.trim()
  return PATTERNS.some((pattern) => pattern.test(whole))
}
