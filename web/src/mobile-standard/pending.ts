/**
 * The three primary actions whose tap must show its pending state at once (PRD,
 * requirement 7): Nueva venta's save, Registrar cobro's save and Entrar's "Entrá". Each
 * is a screen of the walk (its name is one `Violation.screen` may carry), the steps that
 * fill the form up to the button, the button's name and the one write the tap sends. The
 * write is held and then aborted (invariant 6): it never reaches the backend.
 */

import { CUSTOMERS, LOGIN, SALE_NEW } from '../routes.ts'
import { COMMON_TEXT } from '../copy/common.ts'
import type { WalkStep } from './states.ts'

export interface PendingTap {
  /** A name `Violation.screen` may carry: a registry screen or a walked state. */
  screen: string
  route: string
  signedOut?: boolean
  steps: readonly WalkStep[]
  /** The primary action's accessible name before the tap. */
  button: string
  /** The write the tap sends. */
  write: { method: string; path: RegExp }
}

export const PENDING_TAPS: readonly PendingTap[] = [
  {
    screen: 'NuevaVentaConLinea',
    route: SALE_NEW,
    steps: [
      { fill: { label: 'Variedad línea 1', value: 'Golden Cookies' } },
      { fill: { label: 'Gramos línea 1', value: '10' } },
    ],
    button: 'Guardá la venta',
    write: { method: 'POST', path: /^\/sales$/ },
  },
  {
    screen: 'CobroDesdeClientes',
    route: CUSTOMERS,
    steps: [
      { click: 'Nico Parra' },
      { click: COMMON_TEXT.recordPayment },
      { fill: { label: COMMON_TEXT.amount, value: '1000' } },
      { click: COMMON_TEXT.cash },
    ],
    button: COMMON_TEXT.save,
    write: { method: 'POST', path: /^\/customers\/\d+\/payments$/ },
  },
  {
    screen: 'Entrar',
    route: LOGIN,
    signedOut: true,
    steps: [
      { fill: { label: 'Email', value: '{email}' } },
      { fill: { label: 'Contraseña', value: 'equivocada123' } },
    ],
    button: 'Entrá',
    write: { method: 'POST', path: /^\/auth\/login$/ },
  },
]

/** What the page says about a tapped button: its state and its words, once, after the tap. */
export interface TappedButton {
  disabled: boolean
  busy: boolean
  label: string
}

/** Pending at once: the button refuses a second tap (disabled or `aria-busy`) and says a word the idle one did not. */
export function showsPending(before: string, after: TappedButton): boolean {
  return (after.disabled || after.busy) && after.label !== before
}
