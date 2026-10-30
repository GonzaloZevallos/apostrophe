/**
 * `useReturnToPlace`: brings focus back to the customer's control when Record payment was
 * saved. The hand-off (`paymentReturn.ts`) holds a customer id, written by a save alone
 * (`CobroRoute`): Close and Back leave none. The page's scroll is not this hook's: it belongs
 * to `shell/ScrollSync.tsx` alone (ADR-0068), which restores the screen's place on the way
 * back; this hook never scrolls.
 *   - Under the sheet (the location is Record payment's), the mount takes nothing.
 *   - The origin's live mount, once its data has rendered and stopped refetching, focuses the
 *     customer's control nearest the part of the page in view (or `fallback` when the row is
 *     gone) and takes the hand-off, so a later visit applies nothing. A mount that does not
 *     `own` the place (the list beside a card) leaves it to the one that does.
 *   - It acts once per history entry (its location key), so a later entry starts clean.
 * With no hand-off focus is untouched.
 */

import { type RefObject, useEffect, useRef } from 'react'
import { useLocation, useMatch } from 'react-router'
import { consumePaymentReturn, peekPaymentReturn } from '../paymentReturn'
import { CUSTOMER_PAYMENT, pathTo } from '../routes'

interface Place {
  /** The mount's root: the controls are looked for inside it. */
  root: RefObject<HTMLElement | null>
  /** True once the data has rendered and no refetch is in flight. */
  ready: boolean
  /** False for a mount that is not the screen the seller returns to. */
  owns?: boolean
  /** Only a hand-off for this customer applies (the card of one customer). */
  customerId?: string
  /** Where focus goes when the customer's control is gone (a heading or a line); a stable function. */
  fallback: (root: HTMLElement) => HTMLElement | null
}

/** Marks the "Owed to you" heading, or the "Nobody owes you" line: where focus lands when the row has left. */
export const OWED_PLACE = 'owed'

/** The fallback of the screens that draw that block. */
export function owedPlace(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-place="${OWED_PLACE}"]`)
}

/** The candidate nearest the part of the page the seller was looking at. */
export function nearestTo(candidates: readonly HTMLElement[], scrollY: number): HTMLElement | null {
  let best: HTMLElement | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const candidate of candidates) {
    const top = candidate.getBoundingClientRect().top + window.scrollY
    const distance = top < scrollY ? scrollY - top : top > scrollY + window.innerHeight ? top - scrollY - window.innerHeight : 0
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}

export function useReturnToPlace({ root, ready, owns = true, customerId, fallback }: Place): void {
  const underSheet = useMatch(CUSTOMER_PAYMENT) !== null
  const { key: entry } = useLocation()
  const handled = useRef<string | null>(null)

  useEffect(() => {
    if (!ready || underSheet || handled.current === entry) return
    const handOff = peekPaymentReturn()
    if (handOff === null || !owns) return
    if (customerId !== undefined && Number(customerId) !== handOff.customerId) return
    const element = root.current
    if (element === null) return
    handled.current = entry
    consumePaymentReturn()
    const href = pathTo(CUSTOMER_PAYMENT, { id: handOff.customerId })
    const controls = Array.from(element.querySelectorAll<HTMLElement>('a')).filter((link) => link.getAttribute('href') === href)
    const target = nearestTo(controls, window.scrollY) ?? fallback(element)
    target?.focus({ preventScroll: true })
  }, [ready, underSheet, owns, customerId, root, fallback, entry])
}
