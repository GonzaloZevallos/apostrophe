/**
 * `chromeOf`: the one place the shell's chrome is decided (GH-135, ADR-0041, invariant 1).
 * A back arrow, the rail's "+ Nueva venta" and the bar and rail marks all come from the
 * result, which `Shell` only renders; no component works them out from `kind`, `pane` or the
 * viewport.
 *
 * On a computer a two-pane detail (a customer's card, a variety's page) is drawn inside its
 * host's screen, so it takes the *host's* chrome and adds none of its own (navigation.md,
 * "Two panes and chrome"): a customer's card is Clientes (a root: the rail's "+ Nueva venta",
 * no arrow); a variety's page is Variedades, or Archivadas (a card: one "‹ Variedades", no
 * "+ Nueva venta") when the variety is archived. Everywhere else a leaf is its own host.
 * By the host's kind: a root shows the bar and "+ Nueva venta"; a card the bar and the
 * "‹ parent" arrow; a form neither.
 */

import {
  placeOf,
  resolveParent,
  screenOf,
  type ParentRef,
  type Place,
  type Screen,
  type ScreenFacts,
  type ScreenId,
  type Viewport,
} from '../routes'

export interface Chrome {
  /** The screen whose chrome this is: the leaf, or on a computer the two-pane detail's host. */
  host: ScreenId
  /** The "‹ parent" arrow; null when the host is not a card or has no parent. */
  backArrow: ParentRef | null
  /** The rail's "+ Nueva venta" (and the phone's floating one). */
  nuevaVenta: boolean
  /** Whether the bottom bar is drawn. */
  bar: boolean
  /** What the bar and the rail mark. */
  place: Place
}

function hostOf(leaf: Screen, viewport: Viewport, facts: ScreenFacts): ScreenId {
  if (viewport !== 'computer' || leaf.pane !== 'detail') return leaf.id
  if (leaf.id === 'customer') return 'customers'
  if (leaf.id === 'variety') return facts.archived === 'yes' ? 'varieties-archived' : 'varieties'
  return leaf.id
}

export function chromeOf(leaf: Screen, viewport: Viewport, facts: ScreenFacts): Chrome {
  const host = hostOf(leaf, viewport, facts)
  const { kind } = screenOf(host)
  return {
    host,
    backArrow: kind === 'card' ? (resolveParent(host, viewport, facts) ?? null) : null,
    nuevaVenta: kind === 'root',
    bar: kind !== 'form',
    place: placeOf(host, viewport),
  }
}
