/**
 * "Aviso de stock bajo" on a variety's page: the saved warning as `GET /stock`
 * answered it, an on/off switch and "Editar". The switch is derived from the saved
 * threshold and changes only when the server has answered. Turning it on only opens the
 * form (a warning that is off has no saved amount to bring back); turning it off saves at
 * once with `{grams: null}`, stays on and disabled while that runs, and stays on after a
 * refusal, a dropped network or a gone variety.
 *
 * `readOnly` (an archived variety) states only the stored setting, "Avisame abajo de N g" or
 * "Aviso apagado": never the live "Avisando: quedan N g", and no switch, no "Editar".
 */

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, UNKNOWN_CODE } from '../../api/client'
import { invalidateResource } from '../../api/keys'
import { isGone, kindOf, resolveOverride } from '../../api/refusals'
import { type VarietyStock, setThreshold } from '../../api/stock'
import { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import Boton from '../../components/Boton'
import SinConexion from '../../components/SinConexion'
import { useFlash } from '../../flash/useFlash'
import { formatGrams } from '../../format/money'
import { warningFor } from '../../stock/detail'
import { GENERIC_REFUSAL_MESSAGE } from '../Variedades'
import { THRESHOLD_OVERRIDES, THRESHOLD_SAVED } from './thresholdMessages'
import { useOpenForm } from './varietyForms'

export default function VarietyThresholdSection({
  varietyId,
  row,
  refreshing,
  onGone,
  readOnly = false,
}: {
  varietyId: number
  row: VarietyStock
  /** `GET /stock` is being asked again: the switch waits for the server's new answer. */
  refreshing: boolean
  onGone: () => void
  readOnly?: boolean
}) {
  const queryClient = useQueryClient()
  const flash = useFlash()
  const openForm = useOpenForm()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const on = row.threshold !== null

  async function turnOff(): Promise<void> {
    setError(null)
    setOffline(false)
    setSaving(true)
    try {
      await setThreshold(varietyId, null)
      invalidateResource(queryClient, 'stock')
      flash.showNow(THRESHOLD_SAVED)
    } catch (caught) {
      if (caught instanceof ApiError && isGone(caught.code)) {
        invalidateResource(queryClient, 'stock')
        onGone()
      } else if (caught instanceof ApiError) {
        const message = resolveOverride(THRESHOLD_OVERRIDES, caught.code)
        if (message !== undefined) setError(message)
        else if (caught.code !== UNKNOWN_CODE && kindOf(caught.code) === 'refusal') setError(GENERIC_REFUSAL_MESSAGE)
        else setError(ERROR_GENERICO_MENSAJE)
      } else if (caught instanceof NetworkError) {
        setOffline(true)
      } else {
        setError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSaving(false)
    }
  }

  if (readOnly) {
    return (
      <section className="seccion-variedad">
        <div className="seccion-variedad__cabecera">
          <h2 className="seccion-variedad__titulo">Aviso de stock bajo</h2>
        </div>
        <div className="seccion-variedad__fila">
          <span className="seccion-variedad__valor">
            {row.threshold === null ? 'Aviso apagado' : `Avisame abajo de ${formatGrams(row.threshold)}`}
          </span>
        </div>
      </section>
    )
  }

  return (
    <section className="seccion-variedad">
      <div className="seccion-variedad__cabecera">
        <h2 className="seccion-variedad__titulo">Aviso de stock bajo</h2>
        <Boton variant="icon" action="edit" ariaLabel="Editar aviso" onClick={() => openForm('threshold')} />
      </div>
      <div className="seccion-variedad__fila">
        <span className={row.status === 'low' ? 'seccion-variedad__valor seccion-variedad__valor--aviso' : 'seccion-variedad__valor'}>
          {warningFor(row)}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Avisar cuando quede poco"
          className="interruptor"
          disabled={saving || refreshing}
          onClick={() => {
            if (on) void turnOff()
            else openForm('threshold')
          }}
        >
          <span className="interruptor__perilla" aria-hidden="true" />
        </button>
      </div>
      {error !== null && (
        <span className="campo__error" role="alert">
          {error}
        </span>
      )}
      {offline && <SinConexion />}
    </section>
  )
}
