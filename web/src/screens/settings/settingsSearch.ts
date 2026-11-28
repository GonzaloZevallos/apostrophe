/**
 * The Settings search: which shown rows a text finds. It walks the output of `shownRowsByGroup`,
 * so a hidden or pending row is never found, and it matches row labels only, never a group heading
 * or a description. The text is folded like the Selector's (`foldForSearch`) and looked for with
 * `includes`. A text that is empty, only spaces or folds to nothing finds no row: `matchesQuery`
 * would match every label on it, so it is not used here.
 */

import { foldForSearch } from '../../components/selectorSearch'
import type { CopyKey } from '../../i18n/resources.generated'
import type { SettingsRow, ShownGroup } from './settingsRows'

export interface SettingsSearchResult {
  readonly row: SettingsRow
  readonly groupLabelKey: CopyKey
}

/** The rows whose resolved label holds the trimmed `text`, in registry order, each with its group's label key. */
export function searchSettingsRows(
  groups: readonly ShownGroup[],
  resolve: (key: CopyKey) => string,
  text: string,
): readonly SettingsSearchResult[] {
  const needle = foldForSearch(text.trim())
  if (needle === '') return []
  return groups.flatMap((group) =>
    group.rows
      .filter((row) => foldForSearch(resolve(row.labelKey)).includes(needle))
      .map((row) => ({ row, groupLabelKey: group.labelKey })),
  )
}
