/**
 * `ExpenseNewSheet`: the sheet that draws the new-expense form. Presentational only: the host owns
 * the leave guard (it passes the `blocker`, or none), the exit (`onClose`, `onSaved`) and the `SheetLevel`
 * of its own history entry. It calls no `useLeaveGuard` and no `useBlocker`.
 */

import { type ReactNode, useState } from 'react'
import type { Blocker } from 'react-router'
import type { SuccessToast } from '../../components/AvisoExito'
import LeaveConfirm from '../../components/LeaveConfirm'
import Sheet from '../../components/Sheet'
import { COMMON_TEXT } from '../../copy/common'
import { EXPENSES_TEXT } from '../../copy/expenses'
import ExpenseForm from './ExpenseForm'

interface ExpenseNewSheetProps {
  /** The host's leave guard; a host with none (the sheet over New sale) passes nothing. */
  blocker?: Blocker
  /** What sits above the form, inside the dialog (the "Sale in progress" strip). */
  banner?: ReactNode
  onClose: () => void
  onSaved: (saved: SuccessToast) => void
  onDirtyChange: (dirty: boolean) => void
  computer: boolean
}

export default function ExpenseNewSheet({
  blocker,
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
        blocker !== undefined && blocker.state === 'blocked' && (
          <LeaveConfirm
            blocker={blocker}
            question={EXPENSES_TEXT.discardTheExpense}
            detail={COMMON_TEXT.losesWhatYouEntered}
            keepLabel={COMMON_TEXT.noKeepEntering}
            discardLabel={COMMON_TEXT.yesDiscard}
          />
        )
      }
    >
      {banner}
      <ExpenseForm target="nuevo" onDone={onSaved} onCancel={onClose} onDirtyChange={changeDirty} />
    </Sheet>
  )
}
