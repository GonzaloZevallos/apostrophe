/** Varieties sorted by name, the one order Variedades lists them in and the first of which a
 * computer selects on opening the list. A presentation order only; nothing is decided by it. */

export function varietiesByName<T extends { id: number; name: string }>(varieties: readonly T[]): T[] {
  return [...varieties].sort(
    (a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }) || a.id - b.id,
  )
}
