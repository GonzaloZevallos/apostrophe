/**
 * What New sale's one leave guard asks while the Expense Sheet may be over the sale (ADR-20261114:
 * one guard per screen, its dirty flag and floor pointed at the form on top).
 *
 * - `leaveQuestion`: the pure rule. Closing only the Sheet asks about the Expense; leaving the
 *   screen asks about the sale when it is touched, else about the Expense. The detail under an
 *   Expense question says the sale stays as it is while the strip shows.
 * - `useLeaveQuestion`: freezes the question on the edge from unblocked to blocked, so a re-render
 *   (the Expense still reporting its state, a second back) never changes the words on screen.
 *   Only Escape (as "No") and the confirmation's own buttons answer it; only "Yes" proceeds.
 */

import { useEffect, useRef, useState } from 'react'
import { type Blocker, useLocation } from 'react-router'
import { onlySheetChanges } from '../../components/useLeaveGuard'
import { COMMON_TEXT } from '../../copy/common'
import { EXPENSES_TEXT } from '../../copy/expenses'
import { SALES_TEXT } from '../../copy/sales'

export interface LeaveQuestionInput {
  /** The sale itself has something typed. */
  touched: boolean
  /** The "Sale in progress" strip shows (a Product is chosen). */
  strip: boolean
  /** The blocked navigation only closes the Sheet. */
  onlySheet: boolean
}

export interface LeaveQuestionWords {
  question: string
  detail: string
}

export function leaveQuestion({ touched, strip, onlySheet }: LeaveQuestionInput): LeaveQuestionWords {
  if (!onlySheet && touched) return { question: SALES_TEXT.discardSale, detail: SALES_TEXT.cannotRecover }
  return {
    question: EXPENSES_TEXT.discardTheExpense,
    detail: strip ? EXPENSES_TEXT.saleStaysAsItIs : COMMON_TEXT.losesWhatYouEntered,
  }
}

interface Frozen {
  blocker: Blocker
  words: LeaveQuestionWords
}

interface LeaveQuestionContext {
  touched: boolean
  strip: boolean
}

/** The frozen question while the guard is blocked, or `null`. */
export function useLeaveQuestion(blocker: Blocker, { touched, strip }: LeaveQuestionContext): LeaveQuestionWords | null {
  const location = useLocation()
  const [frozen, setFrozen] = useState<Frozen | null>(null)

  // The edge is derived during render, like `customerWasOpen`: freeze once when blocked, clear when
  // unblocked. A different blocker object while frozen keeps the words (the effect below resets it).
  if (blocker.state === 'blocked' && frozen === null) {
    const onlySheet = onlySheetChanges(location, blocker.location)
    setFrozen({ blocker, words: leaveQuestion({ touched, strip, onlySheet }) })
  } else if (blocker.state === 'unblocked' && frozen !== null) {
    setFrozen(null)
  }

  // A second back while the question shows blocks again with a new blocker object: answer it as
  // "No" once, so the one question stays and the history is as it was.
  const resetRef = useRef<Blocker | null>(null)
  useEffect(() => {
    if (frozen === null || blocker.state !== 'blocked' || blocker === frozen.blocker) return
    if (resetRef.current === blocker) return
    resetRef.current = blocker
    blocker.reset()
  }, [blocker, frozen])

  const active = frozen !== null
  useEffect(() => {
    if (!active) return
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape' || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
      event.preventDefault()
      event.stopPropagation()
      if (blocker.state === 'blocked') blocker.reset()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [active, blocker])

  return frozen === null ? null : frozen.words
}
