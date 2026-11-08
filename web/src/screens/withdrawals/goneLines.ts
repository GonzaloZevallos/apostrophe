/**
 * The withdrawal form's rules about archived varieties (`stock.md`, "Sacar del stock"), with
 * no cache and no network: who a fresh list makes guilty, what a line's Selector gets, and
 * whether a preselected variety survives. The form wires them to its state.
 */

import type { SelectorOption } from '../../components/Selector'
import { varietiesByName } from '../varieties/varietiesByName'

export interface LineRef {
  key: number
  varietyId: string
}

export interface NamedLineRef extends LineRef {
  varietyName: string
}

export interface ListedVariety {
  id: number
  name: string
}

/**
 * The keys of the lines whose variety is absent from a fresh list and not on the stored
 * withdrawal: those are the ones a refusal can be about. A stored line is never guilty
 * (an edit may keep it), and a line with no variety yet has nothing to be guilty of.
 */
export function guiltyKeys(
  lines: readonly LineRef[],
  freshIds: ReadonlySet<string>,
  storedIds: ReadonlySet<string>,
): Set<number> {
  const guilty = new Set<number>()
  for (const line of lines) {
    if (line.varietyId === '') continue
    if (!freshIds.has(line.varietyId) && !storedIds.has(line.varietyId)) guilty.add(line.key)
  }
  return guilty
}

/** What a line's Variety Selector gets: `options` is the listed Varieties and nothing else. */
export interface LineChoice {
  options: SelectorOption[]
  /** The line's Variety when it is not listed, with the name it was shown by: marked, never offered. */
  selected?: { value: string; label: string }
}

/**
 * The listed Varieties as options, in name order, and, for a line whose Variety is not listed
 * (a stored line archived since, or a line a refusal found archived), `selected` with the name
 * the line carries. An unlisted Variety is never an option. A name never seen gives no
 * `selected`: an id is not something to show.
 */
export function lineChoice(line: NamedLineRef, listed: readonly ListedVariety[]): LineChoice {
  const options = varietiesByName(listed).map((variety) => ({ value: String(variety.id), label: variety.name }))
  if (line.varietyId === '' || line.varietyName === '') return { options }
  if (options.some((option) => option.value === line.varietyId)) return { options }
  return { options, selected: { value: line.varietyId, label: line.varietyName } }
}

/** The variety `?variety=` chooses, or `''` when it is not offered (archived or unknown). */
export function preselected(initialId: string, listedIds: ReadonlySet<string>): string {
  return listedIds.has(initialId) ? initialId : ''
}
