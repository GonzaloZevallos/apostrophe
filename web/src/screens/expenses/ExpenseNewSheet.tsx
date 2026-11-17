/**
 * `ExpenseNewSheet`: the sheet that draws the new-expense form. Presentational only: the host owns
 * the leave guard, the exit (`onClose`, `onSaved`) and the `SheetLevel` of its own history entry.
 * The host passes a `blocker`, and the sheet draws the standard confirmation for it, or a
 * `leaveConfirm` node, drawn in the Sheet's aside beside the dialog, or neither. It calls no
 * `useLeaveGuard` and no `useBlocker`.
 */

import { type ReactNode, useState } from 'react'
import type { Blocker } from 'react-router'
import type { SuccessToast } from '../../components/AvisoExito'
import LeaveConfirm from '../../components/LeaveConfirm'
import Sheet from '../../components/Sheet'
import { COMMON_TEXT } from '../../copy/common'
import { EXPENSES_TEXT } from '../../copy/expenses'
import ExpenseForm from './ExpenseForm'

interface Common {
  /** What sits above the form, inside the dialog (the "Sale in progress" strip). */
  banner?: ReactNode
  onClose: () => void
  onSaved: (saved: SuccessToast) => void
  onDirtyChange: (dirty: boolean) => void
  computer: boolean
}

/**
 * The host's leave guard, or the confirmation it draws itself; a host with neither (the sheet
 * over New sale, for now) passes nothing.
 */
type ExpenseNewSheetProps = Common &
  (
    | { blocker?: Blocker; leaveConfirm?: never }
    | { leaveConfirm?: ReactNode; blocker?: never }
  )

export default function ExpenseNewSheet({
  blocker,
  leaveConfirm,
  banner,
  onClose,
  onSaved,
  onDirtyChange,
  computer,
}: ExpenseNewSheetProps) {
  const [touched, setTouched] = useState(false)

  function changeDirty(dirty: boolean): void {
    setTouched(dirty)
    onDirtyChange(dirty)
  }

  return (
    <Sheet
      computer={computer}
      computerClass="pantalla"
      computerDialog={false}
      label={COMMON_TEXT.addExpense}
      touched={touched}
      onClose={onClose}
      aside={
        blocker?.state === 'blocked' ? (
          <LeaveConfirm
            blocker={blocker}
            question={EXPENSES_TEXT.discardTheExpense}
            detail={COMMON_TEXT.losesWhatYouEntered}
            keepLabel={COMMON_TEXT.noKeepEntering}
            discardLabel={COMMON_TEXT.yesDiscard}
          />
        ) : (
          leaveConfirm
        )
      }
    >
      {banner}
      <ExpenseForm target="nuevo" onDone={onSaved} onCancel={onClose} onDirtyChange={changeDirty} />
    </Sheet>
  )
}
