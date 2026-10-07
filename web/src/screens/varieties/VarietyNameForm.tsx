/**
 * `VarietyNameForm`: the name field and its save (`POST /varieties`), taken out of
 * `VarietyNew` so the Onboarding's first step can reuse it. It knows nothing of the router:
 * its host decides what follows a save (`onSaved`, with the new variety's id and name) and
 * learns whether something was typed (`onDirtyChange`). A refusal shows under the name and
 * keeps what was typed.
 */

import { type FormEvent, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, UNKNOWN_CODE, post } from '../../api/client'
import { invalidateResource } from '../../api/keys'
import { NAME_ARCHIVED_MESSAGE, kindOf, resolveOverride, type RefusalCode } from '../../api/refusals'
import { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import {
  GENERIC_REFUSAL_MESSAGE,
  NAME_INVALID_MESSAGE,
  NAME_TAKEN_MESSAGE,
  type Variety,
} from '../Variedades'

const SAVE_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'variety.name_taken': NAME_TAKEN_MESSAGE,
  'variety.name_archived': NAME_ARCHIVED_MESSAGE,
  'variety.name_invalid': NAME_INVALID_MESSAGE,
}

export interface VarietyNameFormProps {
  onSaved: (saved: Pick<Variety, 'id' | 'name'>) => void
  onDirtyChange: (dirty: boolean) => void
}

export default function VarietyNameForm({ onSaved, onDirtyChange }: VarietyNameFormProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)

  const dirty = name !== ''
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setOffline(false)
    setSending(true)
    try {
      const saved = await post<Variety>('/varieties', { name })
      invalidateResource(queryClient, 'varieties')
      onSaved({ id: saved.id, name: saved.name })
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
  )
}
