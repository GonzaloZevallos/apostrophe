/**
 * `VarietyNew` (`VariedadNueva.dc.html`, frame 1): adds a variety (`POST /varieties`) on its
 * own route, `/varieties/new`, a form: "Cerrar" and a save go back by history, or to the list
 * when there is no history (a direct link); a save arms "Variedad guardada" for the screen
 * history returns to; leaving with a name typed asks first. Refusals show under the name and
 * keep what was typed. On a computer the CSS draws it as the design's modal over the panes.
 */

import { type FormEvent, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { ApiError, NetworkError, UNKNOWN_CODE, post } from '../../api/client'
import { invalidateResource } from '../../api/keys'
import { kindOf, resolveOverride, type RefusalCode } from '../../api/refusals'
import { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import LeaveConfirm from '../../components/LeaveConfirm'
import SinConexion from '../../components/SinConexion'
import { useLeaveGuard } from '../../components/useLeaveGuard'
import { useFlash } from '../../flash/useFlash'
import { VARIETIES } from '../../routes'
import {
  GENERIC_REFUSAL_MESSAGE,
  NAME_INVALID_MESSAGE,
  NAME_TAKEN_MESSAGE,
  VARIETY_SAVED,
  type Variety,
} from '../Variedades'

const SAVE_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'variety.name_taken': NAME_TAKEN_MESSAGE,
  'variety.name_invalid': NAME_INVALID_MESSAGE,
}

export default function VarietyNew() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const flash = useFlash()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)
  const { blocker, disarm } = useLeaveGuard(name !== '')

  function leave(): void {
    if (location.key === 'default') void navigate(VARIETIES, { replace: true })
    else void navigate(-1)
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setOffline(false)
    setSending(true)
    try {
      await post<Variety>('/varieties', { name })
      invalidateResource(queryClient, 'varieties')
      disarm()
      flash.armAfterLeaving(VARIETY_SAVED)
      leave()
    } catch (caught) {
      if (caught instanceof ApiError) {
        const message = resolveOverride(SAVE_OVERRIDES, caught.code)
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
    <main className="pantalla variedad-nueva">
      <div className="cuerpo">
        <div className="gasto-form">
          <div className="gasto-form__cabecera">
            <span className="gasto-form__titulo">Nueva variedad</span>
            <button type="button" className="boton--enlace gasto-form__cerrar" onClick={leave}>
              Cerrar
            </button>
          </div>
          <form className="formulario" onSubmit={onSubmit}>
            <label className="campo">
              <span className="campo__rotulo">Nombre</span>
              <input
                className="campo__input"
                type="text"
                placeholder="Nombre de la variedad"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
              <span className="pie">Hasta 60 caracteres · no puede repetir el nombre de otra variedad</span>
              {error !== null && (
                <span className="campo__error" role="alert">
                  {error}
                </span>
              )}
            </label>
            {offline && <SinConexion />}
            <button className="boton" type="submit" disabled={sending}>
              Agregá la variedad
            </button>
          </form>
        </div>
      </div>
      {blocker.state === 'blocked' && (
        <LeaveConfirm
          blocker={blocker}
          question="¿Descartás la variedad?"
          detail="Se pierde lo que escribiste: todavía no se guardó nada."
          keepLabel="No, seguí escribiendo"
          discardLabel="Sí, descartalo"
        />
      )}
    </main>
  )
}
