/**
 * `ExpenseNewRoute`: the host of the expense form on its own route (`GastoNuevo.dc.html`),
 * opened from Más and from Gastos. It owns how the form is left (the form itself knows
 * nothing of the router):
 *
 * - Back goes by history to whichever screen opened it (`navigate(-1)`), or to Gastos
 *   when there is no history to go back to (`location.key === 'default'`: a direct link).
 * - A save refreshes the expenses, arms "Gasto guardado" to show on the screen history
 *   returns to (`useFlash().armAfterLeaving`), then leaves.
 * - Leaving with something typed asks first ("¿Descartás el gasto?"): `useBlocker`, with
 *   its predicate reading refs at call time (as `NuevaVenta` does), so a save, which
 *   leaves right after, is never blocked.
 */

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import { useBlocker, useLocation, useNavigate } from 'react-router'
import { invalidateResource } from '../../api/keys'
import type { SuccessToast } from '../../components/AvisoExito'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useFlash } from '../../flash/useFlash'
import { EXPENSES } from '../../routes'
import ExpenseForm from './ExpenseForm'

export default function ExpenseNewRoute() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const flash = useFlash()
  const dirtyRef = useRef(false)
  const savedRef = useRef(false)

  const shouldBlock = useCallback(() => dirtyRef.current && !savedRef.current, [])
  const blocker = useBlocker(shouldBlock)

  const onDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty
  }, [])

  function leave(): void {
    if (location.key === 'default') navigate(EXPENSES, { replace: true })
    else navigate(-1)
  }

  function onDone(saved: SuccessToast): void {
    savedRef.current = true
    invalidateResource(queryClient, 'expenses')
    flash.armAfterLeaving(saved)
    leave()
  }

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <ExpenseForm target="nuevo" onDone={onDone} onCancel={leave} onDirtyChange={onDirtyChange} />
      </div>
      {blocker.state === 'blocked' && (
        <ConfirmDialog
          title="¿Descartás el gasto?"
          detail="Se pierde lo que cargaste: todavía no se guardó nada."
          confirmText="Sí, descartalo"
          cancelText="No, seguí cargando"
          onConfirm={() => blocker.proceed()}
          onCancel={() => blocker.reset()}
        />
      )}
    </main>
  )
}
