/**
 * `CobroRoute`: the host of Registrar cobro on its own route, `/customers/{id}/payment`. On a
 * computer the frame is a modal over Clientes (`CobroCompu.dc.html`, ADR-0044: drawn by its own
 * route, so a direct link or a reload opens it with the customer chosen); on a phone it is a
 * full form screen (`Cobro.dc.html`). The host owns the queries, the gone, error and loading
 * states, the leave guard and where the form goes: "Cerrar", Escape, the backdrop and a save
 * all end in one `leave`, which goes back by history or, with none (a direct link), to
 * Clientes. The three closing gestures do nothing while the save is in flight or while the
 * leave confirmation is showing. The balance, the standing and the date come from the API
 * (`GET /customers/{id}`): the browser computes none.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOutletContext, useParams } from 'react-router'
import { ApiError, NetworkError } from '../../api/client'
import { getCustomer } from '../../api/customers'
import { keys } from '../../api/keys'
import type { Me } from '../../api/me'
import { isGone } from '../../api/refusals'
import ErrorGenerico from '../../components/ErrorGenerico'
import GoneScreen from '../../components/GoneScreen'
import LeaveConfirm from '../../components/LeaveConfirm'
import Loading from '../../components/Loading'
import SinConexion from '../../components/SinConexion'
import { useBackOr } from '../../components/useBackOr'
import { useGoneExit } from '../../components/useGoneExit'
import { useLeaveGuard } from '../../components/useLeaveGuard'
import { CUSTOMERS } from '../../routes'
import { useViewport } from '../../shell/useViewport'
import Cobro from './Cobro'
import CobroFrame from './CobroFrame'
import { COMMON_TEXT } from '../../copy/common'
import { PAYMENTS_TEXT } from '../../copy/payments'

const LABEL = 'Registrar cobro'

/** The element focus returns to after "No, seguí cargando": the title when it is gone or is `body`. */
function stillFocusable(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement && element !== document.body && element.isConnected
}

export default function CobroRoute() {
  const { id } = useParams<{ id: string }>()
  const customerId = id ?? ''
  const me = useOutletContext<Me>()
  const dialog = useViewport() === 'computer'
  const back = useBackOr(CUSTOMERS)
  const goneExit = useGoneExit('customer-payment', { id: customerId })
  const [dirty, setDirty] = useState(false)
  const [sending, setSending] = useState(false)
  const { blocker, disarm } = useLeaveGuard(dirty)
  const onDirtyChange = useCallback((value: boolean) => setDirty(value), [])
  const titleId = useId()
  const titleRef = useRef<HTMLSpanElement>(null)
  const { data, error, isError } = useQuery({
    queryKey: keys.customer(customerId),
    queryFn: () => getCustomer(customerId),
  })

  // The one way out of every close gesture: none does anything while the save is in
  // flight or while the leave confirmation is showing.
  const blocked = blocker.state === 'blocked'
  const leave = useCallback(() => {
    if (sending || blocked) return
    back()
  }, [sending, blocked, back])

  function onDone(): void {
    disarm()
    back()
  }

  function onGone(): void {
    disarm()
    goneExit()
  }

  useEffect(() => {
    if (!dialog) return
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape' || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
      leave()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [dialog, leave])

  const ready = data !== undefined
  const focusedTitle = useRef(false)
  useEffect(() => {
    if (!dialog || !ready || focusedTitle.current) return
    focusedTitle.current = true
    titleRef.current?.focus()
  }, [dialog, ready])

  const focusBeforeAsking = useRef<Element | null>(null)
  const wasBlocked = useRef(false)
  useEffect(() => {
    if (blocked) {
      if (!wasBlocked.current) focusBeforeAsking.current = document.activeElement
    } else if (wasBlocked.current) {
      const before = focusBeforeAsking.current
      if (stillFocusable(before)) before.focus()
      else titleRef.current?.focus()
    }
    wasBlocked.current = blocked
  }, [blocked])

  if (isError) {
    const state =
      error instanceof ApiError && isGone(error.code) ? (
        <GoneScreen label={COMMON_TEXT.clientes} to={CUSTOMERS} />
      ) : error instanceof NetworkError ? (
        <SinConexion />
      ) : (
        <ErrorGenerico />
      )
    return <CobroFrame dialog={dialog} label={LABEL} onBackdrop={leave} form={state} />
  }
  if (data === undefined) {
    return <CobroFrame dialog={dialog} label={LABEL} onBackdrop={leave} form={<Loading />} />
  }

  return (
    <CobroFrame
      dialog={dialog}
      titleId={titleId}
      onBackdrop={leave}
      form={
        <Cobro
          customerId={customerId}
          customer={data}
          today={me.today}
          titleId={titleId}
          titleRef={titleRef}
          onCancel={leave}
          onDone={onDone}
          onGone={onGone}
          onDirtyChange={onDirtyChange}
          onSendingChange={setSending}
        />
      }
    >
      {blocked && (
        <LeaveConfirm
          blocker={blocker}
          question={PAYMENTS_TEXT.descartasElCobro}
          detail={COMMON_TEXT.sePierdeLoQue}
          keepLabel={COMMON_TEXT.noSeguiCargando}
          discardLabel={COMMON_TEXT.siDescartalo}
        />
      )}
    </CobroFrame>
  )
}
