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
import { useFlash } from '../../flash/useFlash'
import { EXPENSES } from '../../routes'
import ExpenseForm from './ExpenseForm'

export default function ExpenseNewRoute() {
  const queryClient = useQueryClient()
  const flash = useFlash()
  const [dirty, setDirty] = useState(false)
  const { blocker, disarm } = useLeaveGuard(dirty)
  const leave = useBackOr(EXPENSES)

  function onDone(saved: SuccessToast): void {
    invalidateResource(queryClient, 'expenses')
    flash.armAfterLeaving(saved)
    disarm()
    leave()
  }

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <ExpenseForm target="nuevo" onDone={onDone} onCancel={leave} onDirtyChange={setDirty} />
      </div>
      {blocker.state === 'blocked' && (
        <LeaveConfirm
          blocker={blocker}
          question="¿Descartás el gasto?"
          detail="Se pierde lo que cargaste: todavía no se guardó nada."
          keepLabel="No, seguí cargando"
          discardLabel="Sí, descartalo"
        />
      )}
    </main>
  )
}
