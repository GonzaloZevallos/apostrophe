/**
 * `ExpenseEditSheet`: the in-page sheet that edits one expense inside Expenses (ADR-0062), and
 * how leaving it works in each layout (ADR-0078). It is mounted once per edit, while the host
 * holds an edit target, so its guard is armed again on every opening.
 *
 * One source of truth: the host's target decides whether the edit is open, in both layouts.
 * On the phone the open edit is also a history entry (`useSheet(1)`), a mirror of that target:
 * when this edit's own entry pops, `onClosed` clears the target. A resize across 900 px keeps
 * the form mounted and what was typed, and moves only the entry: it is popped, without
 * clearing the target, when the layout turns computer, and pushed again when it turns phone.
 *
 * - Phone: Close and the system back are the same `sheet.close()`. The leave guard, with the
 *   sheet floor, is the only thing that asks, and it opens the one `LeaveConfirm`.
 * - Computer: nothing is a history entry, the guard never blocks, and Close asks through
 *   `confirmingDiscard`, as it always did.
 * - `closeEdit` is the one exit (save, gone, delete): on the phone it disarms the guard before
 *   it pops, so the pop it makes is not asked about.
 */

import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { type Expense } from '../../api/expenses'
import type { SuccessToast } from '../../components/AvisoExito'
import ConfirmDialog from '../../components/ConfirmDialog'
import LeaveConfirm from '../../components/LeaveConfirm'
import Sheet from '../../components/Sheet'
import { useLeaveGuard } from '../../components/useLeaveGuard'
import { SheetLevel, useSheet } from '../../components/useSheetStack'
import { COMMON_TEXT } from '../../copy/common'
import { useViewport } from '../../shell/useViewport'
import ExpenseForm from './ExpenseForm'

/** The expense screen's own words, handed down by the host that reads them (the Copy module). */
export interface ExpenseEditWords {
  /** The sheet's accessible name. */
  title: string
  /** What the discard confirmation says is lost. */
  lost: string
  /** The discard answer. */
  discard: string
}

export interface ExpenseEditSheetProps {
  target: Expense
  words: ExpenseEditWords
  /** The edit is over: the host clears its target. */
  onClosed: () => void
  /** What follows a save, after the edit has closed. */
  onSaved: (saved: SuccessToast) => void
  /** What follows the expense turning out to be gone, after the edit has closed. */
  onGone: () => void
  /** What follows a delete request, after the edit has closed. */
  onRequestDelete: (expense: Expense) => void
}

export default function ExpenseEditSheet({
  target,
  words,
  onClosed,
  onSaved,
  onGone,
  onRequestDelete,
}: ExpenseEditSheetProps) {
  const computer = useViewport() === 'computer'
  const phone = !computer
  const [dirty, setDirty] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const { blocker, disarm } = useLeaveGuard(phone && dirty, { sheetFloor: 1 })
  const sheet = useSheet(1)

  // Whether this edit has pushed its entry, and whether it was seen open (the mirror's `mine`).
  const pushed = useRef(false)
  const seenOpen = useRef(false)
  // True while a resize pops the entry on purpose: the target must stay.
  const switching = useRef(false)

  const latest = useRef({ sheet, blocker, onClosed })
  useLayoutEffect(() => {
    latest.current = { sheet, blocker, onClosed }
  })

  // A resize resets the computer's own dialog; the phone's is the blocker's, reset below.
  const [wasPhone, setWasPhone] = useState(phone)
  if (wasPhone !== phone) {
    setWasPhone(phone)
    setConfirmingDiscard(false)
  }

  useEffect(() => {
    if (phone) {
      if (!pushed.current) {
        pushed.current = true
        latest.current.sheet.open()
      }
      return
    }
    if (latest.current.blocker.state === 'blocked') latest.current.blocker.reset()
    if (pushed.current) {
      pushed.current = false
      if (latest.current.sheet.isOpen) {
        switching.current = true
        latest.current.sheet.close()
      }
    }
  }, [phone])

  useEffect(() => {
    if (sheet.isOpen) {
      seenOpen.current = true
      return
    }
    if (!seenOpen.current) return
    seenOpen.current = false
    if (switching.current) {
      switching.current = false
      return
    }
    pushed.current = false
    latest.current.onClosed()
  }, [sheet.isOpen])

  // Discarding lets the pop through (`proceeding`): the target goes in the same commit, as a
  // discard on the computer does, instead of one navigation later.
  useEffect(() => {
    if (blocker.state === 'proceeding') latest.current.onClosed()
  }, [blocker.state])

  function closeEdit(after?: () => void): void {
    if (phone) {
      disarm()
      sheet.close()
    }
    // The target goes at once, so the form is gone in the same commit as the exit; the entry's
    // pop, if any, lands after it and finds nothing left to clear.
    onClosed()
    after?.()
  }

  function requestClose(): void {
    if (phone) sheet.close()
    else if (dirty) setConfirmingDiscard(true)
    else closeEdit()
  }

  const discardDialog: ReactNode = confirmingDiscard && (
    <ConfirmDialog
      title={COMMON_TEXT.discardTheChanges}
      detail={words.lost}
      confirmText={words.discard}
      cancelText={COMMON_TEXT.noKeepEditing}
      onConfirm={() => closeEdit()}
      onCancel={() => setConfirmingDiscard(false)}
    />
  )

  return (
    // An in-page sheet (ADR-0062): Expenses itself is behind it, so no `BehindPane`. On a
    // computer it is the `.capa` it always was, a `div` since the screen is already the `main`.
    <Sheet
      computer={computer}
      computerClass="capa"
      computerBodyClass="capa__contenido"
      computerDialog={false}
      frameTag="div"
      label={words.title}
      touched={dirty}
      onClose={requestClose}
      computerFrameRole="presentation"
      aside={
        phone &&
        blocker.state === 'blocked' && (
          <LeaveConfirm
            blocker={blocker}
            question={COMMON_TEXT.discardTheChanges}
            detail={words.lost}
            keepLabel={COMMON_TEXT.noKeepEditing}
            discardLabel={words.discard}
          />
        )
      }
    >
      <SheetLevel.Provider value={1}>
        <ExpenseForm
          target={target}
          onDirtyChange={setDirty}
          onCancel={requestClose}
          onDone={(saved) => closeEdit(() => onSaved(saved))}
          onGone={() => closeEdit(onGone)}
          onRequestDelete={(expense) => closeEdit(() => onRequestDelete(expense))}
        />
      </SheetLevel.Provider>
      {computer && discardDialog}
    </Sheet>
  )
}
