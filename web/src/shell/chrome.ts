/**
 * What the shell draws around a screen, decided in one place and from the registry alone:
 * the chrome comes only from the screen's kind (a root shows the bar and "+ Nueva venta", a
 * card the bar and a "‹ parent" arrow, a form neither), plus the registry's explicit
 * `modalOnComputer`, which is the only thing that hides the side rail. Nothing is inferred
 * from a screen's `pane` or from its id, so `Shell` compares no screen id and a new modal
 * route says so in its own registry entry (ADR-0045).
 */

import type { Screen, Viewport } from '../routes'

export interface Chrome {
  /** Whether the side rail is in the markup (CSS shows it on a computer only). */
  rail: boolean
  /** "+ Nueva venta" at the top of the rail. */
  railNuevaVenta: boolean
  /** The phone's floating "+ Nueva venta". */
  barNuevaVenta: boolean
  /** The bottom bar. */
  bar: boolean
  /** The "‹ parent" arrow at the top of the main column. */
  backArrow: boolean
}

export function chromeOf(screen: Screen, viewport: Viewport): Chrome {
  return {
    rail: !(viewport === 'computer' && screen.modalOnComputer === true),
    railNuevaVenta: screen.kind === 'root',
    barNuevaVenta: screen.kind === 'root',
    bar: screen.kind !== 'form',
    backArrow: screen.kind === 'card',
  }
}
