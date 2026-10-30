/**
 * The return-of-place hand-off for Record payment (GH-281, GH-480): when a payment is saved,
 * `CobroRoute` leaves a one-shot note of whose payment it was, and the screen the seller comes
 * back to picks it up once it is drawn again, to put focus on that customer's control. It
 * holds a customer id only, in memory only: never in `history`, in browser storage or in a URL,
 * and no name, phone number, amount or scroll offset (§9). Only a save writes it: opening the
 * link, Close and Back leave nothing behind. The page's scroll is not part of it: it belongs to
 * `shell/ScrollSync.tsx` alone (ADR-0068). The screens that come back to a place read it
 * through `useReturnToPlace`.
 */

export interface PaymentReturn {
  customerId: number
}

let pending: PaymentReturn | null = null

/** Leaves the note, replacing any earlier one. */
export function setPaymentReturn(customerId: number): void {
  pending = { customerId }
}

/** Reads the note without taking it: a screen under the sheet looks, only the origin takes. */
export function peekPaymentReturn(): PaymentReturn | null {
  return pending === null ? null : { ...pending }
}

/** Takes the note: a later visit finds nothing. */
export function consumePaymentReturn(): PaymentReturn | null {
  const taken = pending
  pending = null
  return taken
}
