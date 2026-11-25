/**
 * The only place the Selector folds text for its search. A query is plain text: it is folded
 * (lower case, accents removed, so `ñ` matches `n`) and looked for with `includes`, never built
 * into a pattern, so a name or a query holding `.*+?()[]` means those characters and nothing else.
 */

/** Lower case (`toLowerCase`: the locale ban keeps `toLocale*` out), then NFD, then every combining mark removed. */
export function foldForSearch(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
}

/** Whether `label` holds the trimmed `query`; an empty query matches every label. */
export function matchesQuery(label: string, query: string): boolean {
  const needle = foldForSearch(query.trim())
  return needle === '' || foldForSearch(label).includes(needle)
}

/** New sale's one search order: the folded name, then the name as typed, then the id. Compares with
 * `<` and `>` (the locale ban keeps `localeCompare` out), so the order never depends on a locale. */
export function byFoldedName<T extends { id: number; name: string }>(a: T, b: T): number {
  const [x, y] = [foldForSearch(a.name), foldForSearch(b.name)]
  if (x !== y) return x < y ? -1 : 1
  if (a.name !== b.name) return a.name < b.name ? -1 : 1
  return a.id - b.id
}

const MARK = /^\p{M}$/u

/** Where the trimmed `query` sits in `label`, as `[start, end)` indices into the ORIGINAL label, or
 * `null` for a query that folds to nothing or is not found; it is found exactly when `matchesQuery`
 * finds it. The label is folded one code point at a time (the same `foldForSearch`), keeping for
 * each folded character the code point it came from, so the match maps back through the accent
 * removal; the end then takes in the marks that follow (`e` in `e` + U+0301 covers both), and a range
 * never cuts a surrogate pair. Text, never a pattern. A label whose lower case depends on the
 * neighbouring characters (a Greek final sigma) cannot be mapped that way: it gives the whole label. */
export function matchRange(label: string, query: string): [number, number] | null {
  const needle = foldForSearch(query.trim())
  if (needle === '') return null
  let folded = ''
  const starts: number[] = []
  const ends: number[] = []
  let at = 0
  for (const character of label) {
    const next = at + character.length
    const piece = foldForSearch(character)
    for (let index = 0; index < piece.length; index += 1) {
      starts.push(at)
      ends.push(next)
    }
    folded += piece
    at = next
  }
  if (folded !== foldForSearch(label)) return matchesQuery(label, query) ? [0, label.length] : null
  const found = folded.indexOf(needle)
  if (found === -1) return null
  const start = starts[found]
  let end = ends[found + needle.length - 1]
  if (start === undefined || end === undefined) return null
  for (const character of label.slice(end)) {
    if (!MARK.test(character)) break
    end += character.length
  }
  return [start, end]
}
