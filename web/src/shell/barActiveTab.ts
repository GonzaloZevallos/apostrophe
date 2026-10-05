/**
 * Which bar entry a route says is current. A screen reached from Más (Gastos, the
 * expense form, Análisis) declares `handle: { tab: 'more' }`, and the deepest match
 * that declares one wins, as `handle.chrome` does. Only the bottom bar reads it: the
 * side rail marks its entry by path alone, since Gastos and Análisis have entries of
 * their own there (`Shell.tsx`).
 */

/** The deepest `handle.tab` of the match chain, or `undefined` when no route declares one. */
export function barActiveTab(matches: readonly { handle: unknown }[]): string | undefined {
  for (const match of [...matches].reverse()) {
    const { handle } = match
    if (typeof handle === 'object' && handle !== null && 'tab' in handle) {
      const tab = handle.tab
      if (typeof tab === 'string') return tab
    }
  }
  return undefined
}
