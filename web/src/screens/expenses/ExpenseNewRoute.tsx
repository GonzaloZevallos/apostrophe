/**
 * `ExpenseNewRoute`: the host of the expense form on its own route (`GastoNuevo.dc.html`),
 * opened from Más and from Gastos. It owns how the form is left (the form itself knows
 * nothing of the router):
 *
 * - "Cerrar" and a save leave through `useBackOr(EXPENSES)`: by history to whichever screen
 *   opened it when that entry is known to be in-app, else to Gastos on the current month,
 *   replacing the form's entry.
 * - A save refreshes the expenses, arms "Expense saved" to show on the screen it returns
 *   to (`useFlash().armAfterLeaving`), calls `disarm()`, then leaves.
 * - On a phone the form is a `Sheet` (ADR-0053); on a direct address Expenses is drawn behind it
 *   (`ExpensesBehind`). The computer page is the one it always was.
 * - Leaving with something typed asks first ("Discard the expense?"), through the one
 *   leave guard, so "Cerrar", the browser's Back and the swipe all ask the same question.
 */

import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { invalidateResource } from '../../api/keys'
import type { SuccessToast } from '../../components/AvisoExito'
import LeaveConfirm from '../../components/LeaveConfirm'
import { useBackOr } from '../../components/useBackOr'
import { useLeaveGuard } from '../../components/useLeaveGuard'
import { useFlash } from '../../flash/useFlash'
import { EXPENSES } from '../../routes'
import BehindPane from '../../components/BehindPane'
import Sheet from '../../components/Sheet'
import { useViewport } from '../../shell/useViewport'
import ExpenseForm from './ExpenseForm'
import ExpensesBehind from './ExpensesBehind'
import { EXPENSES_TEXT } from '../../copy/expenses'
import { COMMON_TEXT } from '../../copy/common'

export default function ExpenseNewRoute() {
  const queryClient = useQueryClient()
  const flash = useFlash()
  const [dirty, setDirty] = useState(false)
  const { blocker, disarm } = useLeaveGuard(dirty)
  const leave = useBackOr(EXPENSES)
  const computer = useViewport() === 'computer'

  function onDone(saved: SuccessToast): void {
    invalidateResource(queryClient, 'expenses')
    flash.armAfterLeaving(saved)
    disarm()
    leave()
  }

  return (
    <>
      {!computer && (
        <BehindPane>
          <ExpensesBehind />
        </BehindPane>
      )}
      <Sheet
        computer={computer}
        computerClass="pantalla"
        computerDialog={false}
        label={COMMON_TEXT.addExpense}
        touched={dirty}
        onClose={leave}
        aside={
          blocker.state === 'blocked' && (
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
        <ExpenseForm target="nuevo" onDone={onDone} onCancel={leave} onDirtyChange={setDirty} />
      </Sheet>
    </>
  )
}
