const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** The first `count` graphemes of a word, so a flag, a ZWJ sequence or a skin-tone emoji is never split. */
function firstGraphemes(word: string, count: number): string[] {
  const kept: string[] = []
  for (const { segment } of graphemes.segment(word)) {
    if (kept.length === count) break
    kept.push(segment)
  }
  return kept
}

/**
 * A name's initials by the drawing's rule, counted in graphemes: two or more words give the first
 * character of each of the first two ("La Huerta" → "LH"); one word gives its first two ("Zeta" → "ZE");
 * a one-character name gives that character. A letter is upper-cased; any other character is shown as is.
 */
export function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter((word) => word !== '')
  const [first, second] = words
  if (first === undefined) return ''
  const kept =
    second === undefined
      ? firstGraphemes(first, 2)
      : firstGraphemes(first, 1).concat(firstGraphemes(second, 1))
  return kept.map((grapheme) => grapheme.toUpperCase()).join('')
}
