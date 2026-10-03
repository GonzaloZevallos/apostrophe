/**
 * `feedback.ts` is the only reader and writer of navigation (`location.state`)
 * in the app (plan, "Shape"; invariants): every screen gets to history state
 * through the functions here, never by building or reading an object literal
 * itself — so the closed set below is the whole of what can ever ride in it,
 * and a stray name, note, amount or phone number can't sneak in through a
 * screen's own `navigate(..., { state: {...} })`.
 *
 * Three kinds of marker live here:
 * - a success toast from `TOAST_MESSAGES`, written through `toast(message)`,
 *   or the gone notice (`GONE_NOTICE`, from `refusals.ts`), written through
 *   `gone()` — both read back through `readFeedback` into a `Feedback` that
 *   `Notice` renders;
 * - the "just saved" marker (`saleJustSaved`/`clearSaleJustSaved`), also read
 *   through `readFeedback` (kind `'saved'`) — plan invariants: "Venta
 *   guardada" is the only success notice with Deshacer, so `VentaDetalle`
 *   builds its own banner for it instead of handing it to the generic
 *   `Notice`, and clears it once read so a refresh or Back never resurrects
 *   Deshacer;
 * - the customer id for "Nueva venta a <name>" (`newSaleFor`/
 *   `readNewSaleState`) — an id only, never the name: `NuevaVenta` looks the
 *   customer up itself (plan, invariants: "No customer name ... appears in
 *   ... history state").
 *
 * Every reader checks the value's shape itself rather than trusting an
 * unchecked cast: an arbitrary object pushed into history state (by a bug, or
 * by code outside this file) renders and unlocks nothing.
 */

import { GONE_NOTICE } from '../api/refusals'

/** Every plain success toast a screen can show by navigating away (PRD,
 * "Feedback"; sales.md round 3). "Venta guardada" is deliberately not here —
 * it carries Deshacer, so it is the separate `'saved'` marker below, never a
 * plain toast string. */
export const TOAST_MESSAGES = [
  'Cliente guardado',
  'Venta eliminada',
  'Entrada guardada',
  'Entrada eliminada',
] as const

export type ToastMessage = (typeof TOAST_MESSAGES)[number]

function isToastMessage(value: unknown): value is ToastMessage {
  return typeof value === 'string' && (TOAST_MESSAGES as readonly string[]).includes(value)
}

/** The fixed text `VentaDetalle` announces alongside its own Deshacer button
 * (plan, invariants: "Venta guardada" is the only success notice with
 * Deshacer) — exported so that screen never invents the copy itself. */
export const SALE_SAVED = 'Venta guardada'

export interface Feedback {
  kind: 'toast' | 'notice' | 'saved'
  message: string
}

export function readFeedback(state: unknown): Feedback | null {
  if (state === null || typeof state !== 'object') return null
  const record = state as Record<string, unknown>
  if (isToastMessage(record.toast)) return { kind: 'toast', message: record.toast }
  if (record.notice === GONE_NOTICE) return { kind: 'notice', message: GONE_NOTICE }
  if (record.saleJustSaved === true) return { kind: 'saved', message: SALE_SAVED }
  return null
}

/** Writes a plain success toast into history state — the only way a screen
 * hands one of `TOAST_MESSAGES` to `navigate`'s `state`, so a screen never
 * builds `{ toast: ... }` by hand (plan, invariants: "feedback.ts" is the only
 * reader and writer of navigation state"). Pair of `readFeedback`'s `'toast'`
 * case. */
export function toast(message: ToastMessage): { toast: ToastMessage } {
  return { toast: message }
}

/** Writes the gone notice into history state — `toast`'s counterpart for
 * `GONE_NOTICE`, so a screen that lands on a gone record after navigating
 * away never builds `{ notice: GONE_NOTICE }` by hand either. */
export function gone(): { notice: typeof GONE_NOTICE } {
  return { notice: GONE_NOTICE }
}

/** Written once, by `NuevaVenta` on a successful save, alongside
 * `navigate(`/ventas/${id}`, { replace: true, state: saleJustSaved() })`
 * (plan, invariants: that navigation is a `replace` and the leave guard never
 * blocks it). */
export function saleJustSaved(): { saleJustSaved: true } {
  return { saleJustSaved: true }
}

/** What `VentaDetalle` replaces its own history state with once it has read
 * the "just saved" marker (plan, invariants: "The undo marker is cleared from
 * history state once VentaDetalle reads it"), so neither a refresh nor Back
 * past this point shows Deshacer again. */
export function clearSaleJustSaved(): null {
  return null
}

/** Written only by the "Nueva venta a <name>" link (plan, invariants: "The
 * 'Nueva venta a <name>' state is written only through `newSaleFor`"). Takes
 * the id alone — never the name — so the customer's name can never ride in a
 * URL, history state, the console or storage. */
export function newSaleFor(customerId: string): { customerId: string } {
  return { customerId }
}

/** Read only by `NuevaVenta` (plan, invariants: "...and read only through
 * `readNewSaleState`. No screen reads `location.state` fields directly."):
 * the form looks the customer up by this id itself, rather than trusting
 * anything else riding along in state. */
export function readNewSaleState(state: unknown): string | null {
  if (state === null || typeof state !== 'object') return null
  const record = state as Record<string, unknown>
  return typeof record.customerId === 'string' && record.customerId !== ''
    ? record.customerId
    : null
}
