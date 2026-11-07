/**
 * The only place the Selector folds text for its search. A query is plain text: it is folded
 * (lower case, accents removed, so `ñ` matches `n`) and looked for with `includes`, never built
 * into a pattern, so a name or a query holding `.*+?()[]` means those characters and nothing else.
 */

/** Lower case, then NFD, then every combining mark removed. */
export function foldForSearch(text: string): string {
  return text.toLocaleLowerCase('en').normalize('NFD').replace(/\p{M}/gu, '')
}

/** Whether `label` holds the trimmed `query`; an empty query matches every label. */
export function matchesQuery(label: string, query: string): boolean {
  const needle = foldForSearch(query.trim())
  return needle === '' || foldForSearch(label).includes(needle)
}
