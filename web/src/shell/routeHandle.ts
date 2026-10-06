/**
 * What a gated leaf route is, in one word (ADR on navigation, "Chrome and back: one
 * rule"): a tab `root`, a `detail` with a parent to go back to, or a `form`. `Shell`
 * alone reads it, through `useMatches()`, to decide the bar, the sidebar, "+ Nueva
 * venta" and the back link; no other component compares a pathname or reads this.
 *
 * A parent is one place (`{label, to}`), or two when phone and computer differ
 * (`{phone, computer}`: only the Configuración list, "‹ Más" against "‹ Inicio").
 * Which one shows is CSS's job (`styles/app.css`), never a viewport read, so
 * `parentOf` hands back both, each tagged with the viewport it is for.
 */

export interface ParentLink {
  label: string
  to: string
}

export type Parent = ParentLink | { phone: ParentLink; computer: ParentLink }

export type RouteHandle =
  | { kind: 'root' }
  | { kind: 'detail'; parent: Parent }
  | { kind: 'form' }

export interface ViewportParent extends ParentLink {
  /** `undefined`: the same on both. */
  viewport?: 'phone' | 'computer'
}

export function parentOf(handle: RouteHandle): ViewportParent[] {
  if (handle.kind !== 'detail') return []
  const { parent } = handle
  if ('phone' in parent) {
    return [
      { ...parent.phone, viewport: 'phone' },
      { ...parent.computer, viewport: 'computer' },
    ]
  }
  return [parent]
}

/** The deepest match's handle wins: a layout route's absence of one never overrides
 * a child's. Anything that is not a `RouteHandle` (no handle at all) is `undefined`. */
export function handleOf(matches: readonly { handle: unknown }[]): RouteHandle | undefined {
  for (const match of [...matches].reverse()) {
    if (isRouteHandle(match.handle)) return match.handle
  }
  return undefined
}

export function isRouteHandle(value: unknown): value is RouteHandle {
  if (typeof value !== 'object' || value === null || !('kind' in value)) return false
  return value.kind === 'root' || value.kind === 'detail' || value.kind === 'form'
}
