import type { Location } from 'react-router'

/** Whether `location` is still the entry the browser's history is on. A browser router keeps
 * each pushed entry's `key` in `history.state`; with no key there (the first entry of a load,
 * or a memory router, which never touches `window.history`) there is nothing newer to protect. */
export function isStillCurrent(location: Pick<Location, 'key'>, historyState: unknown): boolean {
  const key = (historyState as { key?: unknown } | null)?.key
  return typeof key !== 'string' || key === location.key
}
