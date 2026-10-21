/**
 * `PriceNew` (`PrecioNuevo`, `PrecioNuevoCompu`): the host of the price form on its own
 * route, opened from a variety's page by "Nuevo precio". On a computer the frame is a modal
 * over the variety's page (ADR-0044: drawn by its own route, so a direct link opens it); on
 * a phone it is a full form screen. The host owns how the form is left, as `ExpenseNewRoute`
 * does, and it is one leave for every way out: "Cerrar", Escape, the backdrop and a save go
 * back by history, or to the variety's page when there is no history (a direct link). A
 * save arms "Precio guardado" for the screen history returns to; leaving with something
 * typed asks first ("¿Descartás el precio?"). A close gesture does nothing while the save is
 * in flight or while that question is showing. The host owns the document `Escape` listener
 * and focus too; `PriceFrame` only draws.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router'
import { ApiError, NetworkError, get } from '../../api/client'
import { keys } from '../../api/keys'
import { pricingSettingsQueryOptions } from '../../api/pricingSettings'
import type { Me } from '../../api/me'
import { isGone } from '../../api/refusals'
import type { SuccessToast } from '../../components/AvisoExito'
import ErrorGenerico from '../../components/ErrorGenerico'
import GoneScreen from '../../components/GoneScreen'
import LeaveConfirm from '../../components/LeaveConfirm'
import Loading from '../../components/Loading'
import SinConexion from '../../components/SinConexion'
import { useBackOr } from '../../components/useBackOr'
import { useLeaveGuard } from '../../components/useLeaveGuard'
import { useFlash } from '../../flash/useFlash'
import { useViewport } from '../../shell/useViewport'
import { VARIETIES, VARIETY, pathTo } from '../../routes'
import type { Variety } from '../Variedades'
import PriceForm from './PriceForm'
import PriceFrame from './PriceFrame'
import { VARIETIES_TEXT } from '../../copy/varieties'
import { COMMON_TEXT } from '../../copy/common'

/** The element focus returns to after "No, seguí cargando": the title when it is gone or is `body`. */
function stillFocusable(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement && element !== document.body && element.isConnected
}

export default function PriceNew({ varietyId }: { varietyId: number }) {
  const me = useOutletContext<Me>()
  const dialog = useViewport() === 'computer'
  const back = useBackOr(pathTo(VARIETY, { id: varietyId }))
  const flash = useFlash()
  const [dirty, setDirty] = useState(false)
  const [gone, setGone] = useState(false)
  const [sending, setSending] = useState(false)
  const { blocker, disarm } = useLeaveGuard(dirty)
  const onDirtyChange = useCallback((value: boolean) => setDirty(value), [])
  const titleId = useId()
  const titleRef = useRef<HTMLSpanElement>(null)
  const varietyQuery = useQuery({
    queryKey: keys.variety(String(varietyId)),
    queryFn: () => get<Variety>(`/varieties/${varietyId}`),
  })
  const settingsQuery = useQuery(pricingSettingsQueryOptions())
  const ready = varietyQuery.data !== undefined && settingsQuery.data !== undefined && !gone

  // The one way out of every close gesture: none does anything while the save is in
  // flight or while the leave confirmation is showing.
  const blocked = blocker.state === 'blocked'
  const leave = useCallback(() => {
    if (sending || blocked) return
    back()
  }, [sending, blocked, back])

  function onDone(saved: SuccessToast): void {
    disarm()
    flash.armAfterLeaving(saved)
    back()
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

  const failure = varietyQuery.error ?? settingsQuery.error
  if (gone || (failure instanceof ApiError && isGone(failure.code))) {
    return (
      <PriceFrame dialog={dialog} label={COMMON_TEXT.newPrice} onBackdrop={leave} form={<GoneScreen label={COMMON_TEXT.varieties} to={VARIETIES} />} />
    )
  }
  if (failure !== null) {
    return (
      <PriceFrame
        dialog={dialog}
        label={COMMON_TEXT.newPrice}
        onBackdrop={leave}
        form={failure instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />}
      />
    )
  }
  if (varietyQuery.data === undefined || settingsQuery.data === undefined) {
    return <PriceFrame dialog={dialog} label={COMMON_TEXT.newPrice} onBackdrop={leave} form={<Loading />} />
  }

  return (
    <PriceFrame
      dialog={dialog}
      titleId={titleId}
      onBackdrop={leave}
      form={
        <PriceForm
          varietyId={varietyId}
          today={me.today}
          settings={settingsQuery.data}
          onDone={onDone}
          onCancel={leave}
          onDirtyChange={onDirtyChange}
          onSendingChange={setSending}
          titleId={titleId}
          titleRef={titleRef}
          onGone={() => {
            disarm()
            setGone(true)
          }}
        />
      }
    >
      {blocked && (
        <LeaveConfirm
          blocker={blocker}
          question={VARIETIES_TEXT.descartasElPrecio}
          detail={COMMON_TEXT.losesWhatYouEntered}
          keepLabel={COMMON_TEXT.noKeepEntering}
          discardLabel={COMMON_TEXT.yesDiscard}
        />
      )}
    </PriceFrame>
  )
}
