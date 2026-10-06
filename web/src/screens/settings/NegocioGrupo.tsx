/**
 * Configuración → Negocio (`accounts.md`): renaming the business, today's piece
 * unchanged. The name is local state seeded once from the answer, so the guard can
 * tell touched from untouched by comparing it with what the screen opened with.
 *
 * Renaming shows the fixed toast "Negocio renombrado" with no name or id in it. A
 * rejected name (`account.business_name_invalid`) shows inline and keeps what was
 * typed, dispatched through `refusals.ts`. A dropped network shows "Sin conexión",
 * never the generic retry, which would wrongly blame the server.
 */

import { type FormEvent, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, UNKNOWN_CODE, patch } from '../../api/client'
import { invalidateResource } from '../../api/keys'
import { kindOf, resolveOverride, type RefusalCode } from '../../api/refusals'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import { type Business, useBusiness } from './business'

export const RENAME_SUCCESS = 'Negocio renombrado'
export const BUSINESS_NAME_INVALID_MESSAGE = 'Ponele un nombre al negocio, sin espacios de más'
export const GENERIC_REFUSAL_MESSAGE = 'Revisá los datos e intentá de nuevo.'
export { ERROR_GENERICO_MENSAJE as RETRY_MESSAGE }

const RENAME_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'account.business_name_invalid': BUSINESS_NAME_INVALID_MESSAGE,
}

export default function NegocioGrupo() {
  const queryClient = useQueryClient()
  const { data, isPending, isError, error } = useBusiness()

  const [name, setName] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [nameOffline, setNameOffline] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [renamed, setRenamed] = useState(false)

  if (isPending) return <main className="pantalla" />

  if (isError) {
    return (
      <main className="pantalla">
        <div className="cuerpo">
          {error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />}
        </div>
      </main>
    )
  }

  const currentName = name ?? data.name

  function onNameChange(value: string): void {
    setName(value)
    setNameError(null)
    setNameOffline(false)
    setRenamed(false)
  }

  async function onRename(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setNameError(null)
    setNameOffline(false)
    setRenamed(false)
    setSavingName(true)
    try {
      const updated = await patch<Business>('/business', { name: currentName })
      invalidateResource(queryClient, 'business')
      setName(updated.name)
      setRenamed(true)
    } catch (caught) {
      if (caught instanceof NetworkError) {
        setNameOffline(true)
      } else if (caught instanceof ApiError) {
        const message = resolveOverride(RENAME_OVERRIDES, caught.code)
        if (message !== undefined) {
          setNameError(message)
        } else if (caught.code !== UNKNOWN_CODE && kindOf(caught.code) === 'refusal') {
          setNameError(GENERIC_REFUSAL_MESSAGE)
        } else {
          setNameError(ERROR_GENERICO_MENSAJE)
        }
      } else {
        setNameError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSavingName(false)
    }
  }

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <span className="encabezado__titulo">Negocio</span>

        {renamed && (
          <div className="aviso-flotante" role="status">
            <div className="aviso-exito">
              <span className="aviso-exito__texto">{RENAME_SUCCESS}</span>
            </div>
          </div>
        )}

        <form className="formulario" onSubmit={onRename}>
          <label className="campo">
            <span className="campo__rotulo">Nombre del negocio</span>
            <input
              className="campo__input"
              type="text"
              value={currentName}
              onChange={(event) => onNameChange(event.target.value)}
              required
            />
            {nameError !== null && (
              <span className="campo__error" role="alert">
                {nameError}
              </span>
            )}
          </label>
          <button className="boton" type="submit" disabled={savingName}>
            Guardar
          </button>
          {nameOffline && <SinConexion />}
        </form>
      </div>
    </main>
  )
}
