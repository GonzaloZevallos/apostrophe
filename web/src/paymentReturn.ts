/**
 * The return-of-place hand-off for Record payment (GH-281, PM option a): when "Collect" or
 * "Record payment" is followed, the screen it was followed from leaves a one-shot note of
 * where the seller was, and the origin picks it up when it is drawn again after Close or a
 * save. It holds a customer id and a scroll offset, in memory only: never in `history`, in
 * browser storage or in a URL, and no name, phone number or amount (§9). Only the payment
 * link helper in `routes.ts` sets it; the screens that come back to a place read it through
 * `useReturnToPlace`.
 */

export interface PaymentReturn {
  customerId: number
  scrollY: number
}

let pending: PaymentReturn | null = null

/** Leaves the note, replacing any earlier one. */
export function setPaymentReturn(customerId: number, scrollY: number): void {
  pending = { customerId, scrollY }
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

/** How far the page is scrolled now; the document scrolls on both viewports. */
export function pageScrollY(): number {
  return 'scrollY' in globalThis && typeof globalThis.scrollY === 'number' ? globalThis.scrollY : 0
}
