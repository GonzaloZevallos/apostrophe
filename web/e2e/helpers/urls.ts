/** A URL assertion built from `paths`, never from a literal route path. */
export function endsWith(path: string): RegExp {
  return new RegExp(`${path}$`)
}
