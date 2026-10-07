/**
 * `WithdrawalFormRoute`: the host of the withdrawal form on its own routes, `/withdrawals/new`
 * (optionally `?variety=<id>`, which chooses the first line's variety) and
 * `/withdrawals/:id/edit` (the same form, filled in). It owns how the form is left:
 *
 * - Back goes by history to whichever screen opened it, or, with no history to go back
 *   to (`location.key === 'default'`: a direct link), to Variedades (new) or the
 *   withdrawal's detail (edit).
 * - A save arms "Retiro guardado" for the screen history returns to, then leaves.
 * - Leaving with something typed asks first (`useLeaveGuard`); a save never is blocked.
 * - A withdrawal that is gone shows "Eso ya no está." when opened for editing, and
 *   "Eso ya no está. La lista ya está al día." on Variedades when a save finds it gone.
 */

import { useQuery } from '@tanstack/react-query'
import { type ReactNode, useCallback, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { ApiError, NetworkError } from '../../api/client'
import { keys } from '../../api/keys'
import { isGone } from '../../api/refusals'
import { getWithdrawal } from '../../api/stock'
import type { SuccessToast } from '../../components/AvisoExito'
import ErrorGenerico from '../../components/ErrorGenerico'
import GoneScreen from '../../components/GoneScreen'
import LeaveConfirm from '../../components/LeaveConfirm'
import Loading from '../../components/Loading'
import SinConexion from '../../components/SinConexion'
import { gone } from '../../components/feedback'
import { useLeaveGuard } from '../../components/useLeaveGuard'
import { useFlash } from '../../flash/useFlash'
import { VARIETIES, withdrawalPath } from '../../routes'
import WithdrawalForm, { type WithdrawalTarget } from './WithdrawalForm'


function Frame({ children }: { children: ReactNode }) {
  return (
    <main className="pantalla">
      <div className="cuerpo">{children}</div>
    </main>
  )
}

export default function WithdrawalFormRoute({ mode }: { mode: 'new' | 'edit' }) {
  if (mode === 'new') return <FormHost target="new" />
  return <EditHost />
}

function EditHost() {
  const { id } = useParams<{ id: string }>()
  const withdrawalId = id ?? ''
  const existing = useQuery({
    queryKey: keys.stockWithdrawal(withdrawalId),
    queryFn: () => getWithdrawal(withdrawalId),
    retry: false,
  })
  if (existing.isError) {
    if (existing.error instanceof ApiError && isGone(existing.error.code)) {
      return <GoneScreen label="Variedades" to={VARIETIES} />
    }
    return (
      <Frame>{existing.error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />}</Frame>
    )
  }
  if (existing.data === undefined) {
    return (
      <Frame>
        <Loading />
      </Frame>
    )
  }
  return <FormHost target={existing.data} />
}

function FormHost({ target }: { target: WithdrawalTarget }) {
  const navigate = useNavigate()
  const location = useLocation()
  const flash = useFlash()
  const [params] = useSearchParams()
  const [dirty, setDirty] = useState(false)
  const { blocker, disarm } = useLeaveGuard(dirty)
  const editing = target !== 'new'
  const varietyParam = params.get('variety') ?? ''
  const initialVarietyId = /^\d+$/.test(varietyParam) ? varietyParam : ''

  const leave = useCallback((): void => {
    if (location.key === 'default') {
      void navigate(editing ? withdrawalPath(target.id) : VARIETIES, { replace: true })
    } else {
      void navigate(-1)
    }
  }, [location.key, navigate, editing, target])

  function onDone(saved: SuccessToast): void {
    disarm()
    flash.armAfterLeaving(saved)
    leave()
  }

  function onGone(): void {
    disarm()
    void navigate(VARIETIES, { replace: true, state: gone() })
  }

  return (
    <Frame>
      <WithdrawalForm
        target={target}
        initialVarietyId={initialVarietyId}
        onDone={onDone}
        onCancel={leave}
        onDirtyChange={setDirty}
        onGone={onGone}
      />
      {blocker.state === 'blocked' && (
        <LeaveConfirm
          blocker={blocker}
          question={editing ? '¿Descartás los cambios?' : '¿Descartás el retiro?'}
          detail={
            editing
              ? 'Se pierde lo que cambiaste: el retiro sigue como estaba.'
              : 'Se pierde lo que cargaste: todavía no se guardó nada.'
          }
          keepLabel={editing ? 'No, seguí editando' : 'No, seguí cargando'}
          discardLabel="Sí, descartalo"
        />
      )}
    </Frame>
  )
}
