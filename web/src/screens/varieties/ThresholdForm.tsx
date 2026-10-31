/**
 * `ThresholdForm`: sets a variety's low-stock warning (`PUT /stock/products/{id}/threshold`
 * with `{quantity}`), opened over its page. Like `RenameForm` it knows nothing of the router:
 * its host supplies the exits and learns whether something was typed. A refusal shows under
 * the field and keeps what was typed. What counts as a valid threshold (above zero) is the
 * backend's rule; here only text that is no amount of grams at all is turned back.
 */

import { type FormEvent, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, UNKNOWN_CODE } from '../../api/client'
import { invalidateResource } from '../../api/keys'
import { isGone, kindOf, resolveOverride } from '../../api/refusals'
import { setThreshold } from '../../api/stock'
import type { SuccessToast } from '../../components/AvisoExito'
import { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import { formatGramsInput } from '../../format/money'
import { parseGrams } from '../../format/parse'
import { exceedsDecimals, useDecimalsSentence } from '../../format/unitDecimals'
import { GENERIC_REFUSAL_MESSAGE } from '../Variedades'
import { THRESHOLD_INVALID_MESSAGE, THRESHOLD_OVERRIDES, THRESHOLD_SAVED, VARIETIES_TEXT } from '../../copy/varieties'
import Boton from '../../components/Boton'
import { SheetActions } from '../../components/Sheet'
import { COMMON_TEXT } from '../../copy/common'

/** The saved amount as a person types it: a comma, no unit. */
function typedFrom(threshold: number | null): string {
  return threshold === null ? '' : formatGramsInput(threshold)
}

export interface ThresholdFormProps {
  varietyId: number
  /** How many decimals the product's unit allows. */
  decimals: number
  /** The saved threshold from `GET /stock`; `null` when the warning is off. */
  threshold: number | null
  onDone: (saved: SuccessToast) => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
  onGone: () => void
}

export default function ThresholdForm({ varietyId, decimals, threshold, onDone, onCancel, onDirtyChange, onGone }: ThresholdFormProps) {
  const queryClient = useQueryClient()
  const sentence = useDecimalsSentence()
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
    if (exceedsDecimals(grams, decimals)) {
      setError(sentence(decimals))
      return
    }
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
        else if (caught.code === 'quantity.too_many_decimals') setError(sentence(decimals))
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
        <span className="gasto-form__titulo">{VARIETIES_TEXT.avisoDeStockBajo}</span>
        <span className="gasto-form__cerrar">
          <Boton variant="icon" action="close" ariaLabel={COMMON_TEXT.close} onClick={onCancel} />
        </span>
      </div>
      <form className="formulario" onSubmit={onSubmit}>
        <label className="campo">
          <span className="campo__rotulo">{VARIETIES_TEXT.avisarConMenosDe}</span>
          <input
            className="campo__input"
            type="text"
            inputMode="decimal"
            value={grams}
            aria-invalid={error !== null}
            onChange={(event) => setGrams(event.target.value)}
          />
          {error !== null && (
            <span className="campo__error" role="alert">
              {error}
            </span>
          )}
        </label>
        <SheetActions>
          {offline && <SinConexion />}
          <Boton textOnly="submit" type="submit" disabled={sending}>
            {VARIETIES_TEXT.guardaElAviso}
          </Boton>
        </SheetActions>
      </form>
    </div>
  )
}
