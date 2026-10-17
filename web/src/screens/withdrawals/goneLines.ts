/**
 * The withdrawal form's rules about archived varieties (`stock.md`, "Sacar del stock"), with
 * no cache and no network: who a fresh list makes guilty, what a line's picker offers, and
 * whether a preselected variety survives. The form wires them to its state.
 */

export interface LineRef {
  key: number
  varietyId: string
}

export interface ListedVariety {
  id: number
  name: string
}

export interface Option {
  value: string
  label: string
  disabled: boolean
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

/**
 * The listed varieties, plus one disabled option for each variety a line holds that the
 * list does not (a stored line archived since, or a line a refusal found archived), named
 * from `names` so the line keeps showing what the seller chose. A name never seen leaves
 * the label empty: an id is not something to show.
 */
export function keptOptions(
  lines: readonly LineRef[],
  listed: readonly ListedVariety[],
  names: ReadonlyMap<string, string>,
): Option[] {
  const options: Option[] = listed.map((variety) => ({
    value: String(variety.id),
    label: variety.name,
    disabled: false,
  }))
  const offered = new Set(options.map((option) => option.value))
  for (const line of lines) {
    if (line.varietyId === '' || offered.has(line.varietyId)) continue
    offered.add(line.varietyId)
    options.push({ value: line.varietyId, label: names.get(line.varietyId) ?? '', disabled: true })
  }
  return options
}

/** The variety `?variety=` chooses, or `''` when it is not offered (archived or unknown). */
export function preselected(initialId: string, listedIds: ReadonlySet<string>): string {
  return listedIds.has(initialId) ? initialId : ''
}
