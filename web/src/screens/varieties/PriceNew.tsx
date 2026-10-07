/**
 * `PriceNew` (`PrecioNuevo`): the host of the price form on its own route, opened from a
 * variety's page by "Nuevo precio". It owns how the form is left, as `ExpenseNewRoute`
 * does: "Cerrar" and a save go back by history, or to the variety's page when there is no
 * history (a direct link); a save arms "Precio guardado" for the screen history returns
 * to; leaving with something typed asks first ("¿Descartás el precio?").
 */

import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate, useOutletContext } from 'react-router'
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
import { useLeaveGuard } from '../../components/useLeaveGuard'
import { useFlash } from '../../flash/useFlash'
import { VARIETIES, VARIETY } from '../../routes'
import type { Variety } from '../Variedades'
import PriceForm from './PriceForm'

export default function PriceNew({ varietyId }: { varietyId: number }) {
  const me = useOutletContext<Me>()
  const navigate = useNavigate()
  const location = useLocation()
  const flash = useFlash()
  const [dirty, setDirty] = useState(false)
  const [gone, setGone] = useState(false)
  const { blocker, disarm } = useLeaveGuard(dirty)
  const onDirtyChange = useCallback((value: boolean) => setDirty(value), [])
  const varietyQuery = useQuery({
    queryKey: keys.variety(String(varietyId)),
    queryFn: () => get<Variety>(`/varieties/${varietyId}`),
  })

  function leave(): void {
    if (location.key === 'default') void navigate(VARIETY(varietyId), { replace: true })
    else void navigate(-1)
  }

  function onDone(saved: SuccessToast): void {
    disarm()
    flash.armAfterLeaving(saved)
    leave()
  }

  const settingsQuery = useQuery(pricingSettingsQueryOptions())

  const failure = varietyQuery.error ?? settingsQuery.error
  if (gone || (failure instanceof ApiError && isGone(failure.code))) {
    return <GoneScreen label="Variedades" to={VARIETIES} />
  }
  if (failure !== null) {
    return (
      <main className="pantalla">
        <div className="cuerpo">{failure instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />}</div>
      </main>
    )
  }
  if (varietyQuery.data === undefined || settingsQuery.data === undefined) {
    return (
      <main className="pantalla">
        <div className="cuerpo">
          <Loading />
        </div>
      </main>
    )
  }

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <PriceForm
          varietyId={varietyId}
          today={me.today}
          settings={settingsQuery.data}
          onDone={onDone}
          onCancel={leave}
          onDirtyChange={onDirtyChange}
          onGone={() => {
            disarm()
            setGone(true)
          }}
        />
      </div>
      {blocker.state === 'blocked' && (
        <LeaveConfirm
          blocker={blocker}
          question="¿Descartás el precio?"
          detail="Se pierde lo que cargaste: todavía no se guardó nada."
          keepLabel="No, seguí cargando"
          discardLabel="Sí, descartalo"
        />
      )}
    </main>
  )
}
