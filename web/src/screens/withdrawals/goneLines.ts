/**
 * `goneLines`: the keys of the withdrawal form's lines that name a variety which is neither
 * listed (unarchived) nor one the stored withdrawal already has a line on. After a save is
 * refused with `variety.archived`, these are the lines to tell "gone". Lines are identified by
 * their own `key`, never by position or by variety. An empty line names nothing, so it is never
 * flagged.
 */

export function goneLines(
  lines: readonly { key: number; varietyId: string }[],
  listedIds: ReadonlySet<string>,
  keptIds: ReadonlySet<string>,
): number[] {
  return lines
    .filter(
      (line) => line.varietyId !== '' && !listedIds.has(line.varietyId) && !keptIds.has(line.varietyId),
    )
    .map((line) => line.key)
}
