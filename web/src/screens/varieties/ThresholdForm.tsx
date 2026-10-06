/**
 * `ThresholdForm`: sets a variety's low-stock warning (`PUT /stock/varieties/{id}/threshold`
 * with `{grams}`), opened over its page. Like `RenameForm` it knows nothing of the router:
 * its host supplies the exits and learns whether something was typed. A refusal shows under
 * the field and keeps what was typed. What counts as a valid threshold (above zero) is the
 * backend's rule; here only text that is no amount of grams at all is turned back.
 */

import { type FormEvent, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, UNKNOWN_CODE } from '../../api/client'
import { invalidateResource } from '../../api/keys'
import { isGone, kindOf, resolveOverride, type RefusalCode } from '../../api/refusals'
import { setThreshold } from '../../api/stock'
import type { SuccessToast } from '../../components/AvisoExito'
import { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import { parseGrams } from '../../format/parse'
import { GENERIC_REFUSAL_MESSAGE } from '../Variedades'

export const THRESHOLD_INVALID_MESSAGE = 'Revisá el umbral cargado'
export const THRESHOLD_SAVED: SuccessToast = 'Aviso guardado'

export const THRESHOLD_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'stock.threshold_invalid': THRESHOLD_INVALID_MESSAGE,
}

/** The saved amount as a person types it: a comma, no unit. */
function typedFrom(threshold: number | null): string {
  return threshold === null ? '' : String(threshold).replace('.', ',')
}

export interface ThresholdFormProps {
  varietyId: number
  /** The saved threshold from `GET /stock`; `null` when the warning is off. */
  threshold: number | null
  onDone: (saved: SuccessToast) => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
  onGone: () => void
}

export default function ThresholdForm({ varietyId, threshold, onDone, onCancel, onDirtyChange, onGone }: ThresholdFormProps) {
  const queryClient = useQueryClient()
  const saved = typedFrom(threshold)
  const [grams, setGrams] = useState(saved)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)

  const dirty = grams !== saved
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setOffline(false)
    const parsed = parseGrams(grams)
    if (!parsed.ok) {
      setError(THRESHOLD_INVALID_MESSAGE)
      return
    }
    setSending(true)
    try {
      await setThreshold(varietyId, Number(parsed.value))
      invalidateResource(queryClient, 'stock')
      onDone(THRESHOLD_SAVED)
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
      setSending(false)
    }
  }

  return (
    <div className="gasto-form">
      <div className="gasto-form__cabecera">
        <span className="gasto-form__titulo">Aviso de stock bajo</span>
        <button type="button" className="boton--enlace gasto-form__cerrar" onClick={onCancel}>
          Cerrar
        </button>
      </div>
      <form className="formulario" onSubmit={onSubmit}>
        <label className="campo">
          <span className="campo__rotulo">Avisar con menos de</span>
          <input
            className="campo__input"
            type="text"
            inputMode="decimal"
            value={grams}
            onChange={(event) => setGrams(event.target.value)}
          />
          {error !== null && (
            <span className="campo__error" role="alert">
              {error}
            </span>
          )}
        </label>
        {offline && <SinConexion />}
        <button className="boton" type="submit" disabled={sending}>
          Guardá el aviso
        </button>
      </form>
    </div>
  )
}
