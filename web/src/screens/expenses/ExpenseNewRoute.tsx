/**
 * `ExpenseNewRoute`: the host of the expense form on its own route (`GastoNuevo.dc.html`),
 * opened from Más and from Gastos. It owns how the form is left (the form itself knows
 * nothing of the router):
 *
 * - "Cerrar" and a save leave through `useBackOr(EXPENSES)`: by history to whichever screen
 *   opened it when that entry is known to be in-app, else to Gastos on the current month,
 *   replacing the form's entry.
 * - A save refreshes the expenses, arms "Gasto guardado" to show on the screen it returns
 *   to (`useFlash().armAfterLeaving`), calls `disarm()`, then leaves.
 * - Leaving with something typed asks first ("¿Descartás el gasto?"), through the one
 *   leave guard, so "Cerrar", the browser's Back and the swipe all ask the same question.
 */

import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { invalidateResource } from '../../api/keys'
import type { SuccessToast } from '../../components/AvisoExito'
import LeaveConfirm from '../../components/LeaveConfirm'
import { useBackOr } from '../../components/useBackOr'
import { useLeaveGuard } from '../../components/useLeaveGuard'
import { DISCARD_NEW_CANCEL, DISCARD_NEW_CONFIRM, DISCARD_NEW_DETAIL, DISCARD_NEW_TITLE } from '../../copy/expenses'
import { useFlash } from '../../flash/useFlash'
import { EXPENSES } from '../../routes'
import ExpenseForm from './ExpenseForm'

const EXPENSES_KEY = 'expenses' as const
const NEW_TARGET = 'nuevo' as const

export default function ExpenseNewRoute() {
  const queryClient = useQueryClient()
  const flash = useFlash()
  const [dirty, setDirty] = useState(false)
  const { blocker, disarm } = useLeaveGuard(dirty)
  const leave = useBackOr(EXPENSES)

  function onDone(saved: SuccessToast): void {
    invalidateResource(queryClient, EXPENSES_KEY)
    flash.armAfterLeaving(saved)
    disarm()
    leave()
  }

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <ExpenseForm target={NEW_TARGET} onDone={onDone} onCancel={leave} onDirtyChange={setDirty} />
      </div>
      {blocker.state === 'blocked' && (
        <LeaveConfirm
          blocker={blocker}
          question={DISCARD_NEW_TITLE}
          detail={DISCARD_NEW_DETAIL}
          keepLabel={DISCARD_NEW_CANCEL}
          discardLabel={DISCARD_NEW_CONFIRM}
        />
      )}
    </main>
  )
}
