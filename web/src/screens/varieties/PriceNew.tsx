/**
 * `PriceNew` (`PrecioNuevo`): the host of the price form on its own route, opened from a
 * variety's page by "Nuevo precio". It owns how the form is left, as `ExpenseNewRoute`
 * does: "Cerrar" and a save go back by history, or to the variety's page when there is no
 * history (a direct link); a save arms the saved-price toast (`PRICE_SAVED`) for the screen history returns
 * to; leaving with something typed asks first ("¿Descartás el precio?").
 *
 * On a computer the same tree draws the design's modal (`PrecioNuevoCompu`) over the
 * variety's page, which stays beneath it, inert and hidden from assistive technology. The
 * modal's only exits are "Cerrar", history back and a save: no Escape handler and no
 * clickable backdrop (the scrim is CSS). The tree is the same on both viewports, so a
 * viewport flip keeps what was typed.
 */

import { useCallback, useState } from 'react'
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
import { VARIETIES, VARIETY, pathTo } from '../../routes'
import type { Variety } from '../Variedades'
import { useViewport } from '../../shell/useViewport'
import PriceForm from './PriceForm'
import VarietyPage from './VarietyPage'

export default function PriceNew({ varietyId }: { varietyId: number }) {
  const me = useOutletContext<Me>()
  const leave = useBackOr(pathTo(VARIETY, { id: varietyId }))
  const flash = useFlash()
  const computer = useViewport() === 'computer'
  const [dirty, setDirty] = useState(false)
  const [gone, setGone] = useState(false)
  const { blocker, disarm } = useLeaveGuard(dirty)
  const onDirtyChange = useCallback((value: boolean) => setDirty(value), [])
  const varietyQuery = useQuery({
    queryKey: keys.variety(String(varietyId)),
    queryFn: () => get<Variety>(`/varieties/${varietyId}`),
  })

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
    <>
      {computer && (
        <div className="precio-nuevo__pagina" inert aria-hidden="true">
          <VarietyPage varietyId={varietyId} background />
        </div>
      )}
      <main className={computer ? 'pantalla precio-nuevo' : 'pantalla'}>
        <div
          className="cuerpo"
          role={computer ? 'dialog' : undefined}
          aria-modal={computer ? true : undefined}
          aria-label={computer ? 'Nuevo precio' : undefined}
        >
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
      </main>
      {blocker.state === 'blocked' && (
        <LeaveConfirm
          blocker={blocker}
          question="¿Descartás el precio?"
          detail="Se pierde lo que cargaste: todavía no se guardó nada."
          keepLabel="No, seguí cargando"
          discardLabel="Sí, descartalo"
        />
      )}
    </>
  )
}
