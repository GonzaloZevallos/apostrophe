/**
 * The locale ban (ADR-0049): no non-test file under `web/src` calls the `to`-`Locale` family
 * of methods or builds a date or relative-time formatter from `Intl`. They answer in the
 * browser's language, so a figure or a date would change with the reader's device; every
 * format lives in `web/src/format/` and writes its own words. `Intl`'s number formatter is
 * not banned: the thousands and decimal marks are fixed by its first argument.
 *
 * `findLocaleCalls(source)` reads the file as text with comments blanked, so a comment that
 * names the ban is not a call; a string that names one is, the rule being about the name.
 * This file builds its patterns from parts so it, under the ban like every other, never
 * spells a banned name.
 */

// Built from parts so this file, which is under the ban like every other, never spells one.
const LOCALE = 'Locale'
const BANNED: readonly RegExp[] = [
  new RegExp(String.raw`\bto${LOCALE}\w*`, 'g'),
  new RegExp(String.raw`\bIntl\s*\.\s*(?:DateTime|RelativeTime)Format\b`, 'g'),
]

function blankComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (comment, lead: string) => lead + ' '.repeat(comment.length - lead.length))
}

/** The lines of every banned name in one file. */
export function findLocaleCalls(source: string): number[] {
  const code = blankComments(source)
  const lines: number[] = []
  for (const pattern of BANNED) {
    for (const match of code.matchAll(pattern)) lines.push(code.slice(0, match.index).split('\n').length)
  }
  return lines.sort((a, b) => a - b)
}
