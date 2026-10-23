/**
 * `useReturnToPlace`: brings the seller back to where they were when they opened Record
 * payment (PM option a, this flow only). The hand-off (`paymentReturn.ts`) holds a customer id
 * and a scroll offset, set by the payment link; the document scrolls on both viewports.
 *   - Under the sheet (the location is Record payment's), the mount only puts the page at the
 *     offset, once, and takes nothing.
 *   - The origin's live mount, once its data has rendered and stopped refetching, puts the page
 *     at the offset, focuses the customer's control (or `fallback` when the row is gone) and
 *     takes the hand-off, so a later visit applies nothing. A mount that does not `own` the
 *     place (the list beside a card) leaves it to the one that does.
 * With no hand-off nothing moves and focus is untouched.
 */

import { type RefObject, useEffect, useRef } from 'react'
import { useMatch } from 'react-router'
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

function scrollTo(top: number): void {
  window.scrollTo({ top, left: 0, behavior: 'instant' })
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
  const done = useRef(false)

  useEffect(() => {
    if (!ready || done.current) return
    const handOff = peekPaymentReturn()
    if (handOff === null) return
    if (underSheet) {
      done.current = true
      scrollTo(handOff.scrollY)
      return
    }
    if (!owns) return
    if (customerId !== undefined && Number(customerId) !== handOff.customerId) return
    const element = root.current
    if (element === null) return
    done.current = true
    consumePaymentReturn()
    scrollTo(handOff.scrollY)
    const href = pathTo(CUSTOMER_PAYMENT, { id: handOff.customerId })
    const controls = Array.from(element.querySelectorAll<HTMLElement>('a')).filter((link) => link.getAttribute('href') === href)
    const target = nearestTo(controls, handOff.scrollY) ?? fallback(element)
    target?.focus({ preventScroll: true })
  }, [ready, underSheet, owns, customerId, root, fallback])
}
