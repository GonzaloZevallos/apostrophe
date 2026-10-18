/**
 * `WithdrawalFormRoute`: the host of the withdrawal form on its own routes, `/withdrawals/new`
 * (optionally `?variety=<id>`, which chooses the first line's variety) and
 * `/withdrawals/:id/edit` (the same form, filled in). It owns how the form is left:
 *
 * - Back goes by history to whichever screen opened it (`useBackOr`), or, opened by a
 *   direct link, to Varieties (new) or the withdrawal's detail (edit).
 * - A save arms "Withdrawal saved" for the screen history returns to, then leaves.
 * - Leaving with something typed asks first (`useLeaveGuard`); a save never is blocked.
 * - A withdrawal that is gone shows "That's gone." when opened for editing, and
 *   "That's gone. The list is up to date." on Varieties when a save finds it gone
 *   (`useGoneExit`).
 */

import { useQuery } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
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
import { useBackOr } from '../../components/useBackOr'
import { useGoneExit } from '../../components/useGoneExit'
import { useLeaveGuard } from '../../components/useLeaveGuard'
import { useFlash } from '../../flash/useFlash'
import { VARIETIES, WITHDRAWAL, pathTo } from '../../routes'
import WithdrawalForm, { type WithdrawalTarget } from './WithdrawalForm'
import { TAB_VARIETIES } from '../../copy/shell'
import {
  DISCARD_CHANGES_TITLE,
  DISCARD_ENTRY_DETAIL,
  DISCARD_WITHDRAWAL_EDIT_DETAIL,
  DISCARD_WITHDRAWAL_TITLE,
  NO_KEEP_EDITING,
  NO_KEEP_ENTERING,
  YES_DISCARD_IT,
} from '../../copy/stock'


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
      return <GoneScreen label={TAB_VARIETIES} to={VARIETIES} />
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
  const flash = useFlash()
  const [params] = useSearchParams()
  const [dirty, setDirty] = useState(false)
  const { blocker, disarm } = useLeaveGuard(dirty)
  const editing = target !== 'new'
  const varietyParam = params.get('variety') ?? ''
  const initialVarietyId = /^\d+$/.test(varietyParam) ? varietyParam : ''

  const leave = useBackOr(editing ? pathTo(WITHDRAWAL, { id: target.id }) : VARIETIES)
  // A gone withdrawal has no detail to go back to: an edit leaves for the detail's own parent.
  const goneExit = useGoneExit(editing ? 'withdrawal' : 'withdrawal-new')

  function onDone(saved: SuccessToast): void {
    disarm()
    flash.armAfterLeaving(saved)
    leave()
  }

  function onGone(): void {
    disarm()
    goneExit()
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
          question={editing ? DISCARD_CHANGES_TITLE : DISCARD_WITHDRAWAL_TITLE}
          detail={editing ? DISCARD_WITHDRAWAL_EDIT_DETAIL : DISCARD_ENTRY_DETAIL}
          keepLabel={editing ? NO_KEEP_EDITING : NO_KEEP_ENTERING}
          discardLabel={YES_DISCARD_IT}
        />
      )}
    </Frame>
  )
}
