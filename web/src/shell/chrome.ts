/**
 * What the shell draws around a screen, decided in one place and from the registry alone:
 * the chrome comes only from the screen's kind (`kindOf`; a root shows the bar and "+ Nueva venta", a
 * card the bar and a "‹ parent" arrow, a form neither), plus the registry's explicit
 * `modalOnComputer`, which is the only thing that hides the side rail. Nothing is inferred
 * from a screen's `pane` or from its id, so `Shell` compares no screen id and a new modal
 * route says so in its own registry entry (ADR-0045).
 */

import { kindOf, type Screen, type Viewport } from '../routes'

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
    // The rail and the bar are both in the markup and CSS picks one, so each reads the kind of
    // the viewport it is drawn on; the arrow is drawn on both, so it reads the real viewport.
    railNuevaVenta: kindOf(screen, 'computer') === 'root',
    barNuevaVenta: kindOf(screen, 'phone') === 'root',
    bar: kindOf(screen, 'phone') !== 'form',
    backArrow: kindOf(screen, viewport) === 'card',
  }
}
