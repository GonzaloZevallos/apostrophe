/**
 * The "Negocio" group of Configuración (`ConfiguracionNegocio.dc.html`; `accounts.md`):
 * renaming the business.
 *
 * The business comes only from the session: `GET`/`PATCH /business` never take an id
 * (CODING_STANDARDS §9). Renaming shows the fixed toast "Negocio renombrado" (a constant,
 * never built from the response). A rejected name (`account.business_name_invalid`) shows
 * inline and keeps what was typed, dispatched through `refusals.ts`. A dropped network shows
 * "Sin conexión", never the generic retry, which would wrongly blame the server.
 *
 * `dirty` is the typed name against `accepted`: the name the server last accepted, taken
 * once from the first answer and reset from the PATCH answer. It is never compared with the
 * query cache, which the save refetches and a partner's rename can move under the form.
 */

import { type FormEvent, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, UNKNOWN_CODE, get, patch } from '../../api/client'
import { invalidateResource, keys } from '../../api/keys'
import { kindOf, resolveOverride, type RefusalCode } from '../../api/refusals'
import AvisoExito from '../../components/AvisoExito'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import Loading from '../../components/Loading'
import { BUSINESS_NAME_INVALID_MESSAGE, GENERIC_REFUSAL_MESSAGE, RENAME_SUCCESS } from './messages'
import SettingsGroup from './SettingsGroup'

interface Business {
  name: string
}

const LEAVE = {
  question: '¿Descartás el nombre?',
  detail: 'Se pierde lo que cargaste: todavía no se guardó nada.',
  keepLabel: 'No, seguí editando',
  discardLabel: 'Sí, descartalo',
}

const RENAME_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'account.business_name_invalid': BUSINESS_NAME_INVALID_MESSAGE,
}

export default function BusinessGroup() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: keys.business(),
    queryFn: () => get<Business>('/business'),
  })

  if (isPending || isError) {
    return (
      <SettingsGroup title="Negocio" dirty={false} leave={LEAVE}>
        {isPending && <Loading />}
        {isError && (error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />)}
      </SettingsGroup>
    )
  }
  return <BusinessForm initialName={data.name} />
}

function BusinessForm({ initialName }: { initialName: string }) {
  const queryClient = useQueryClient()
  const [accepted, setAccepted] = useState(initialName)
  const [name, setName] = useState(initialName)
  const [nameError, setNameError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [saving, setSaving] = useState(false)
  const [renamed, setRenamed] = useState(false)

  function onNameChange(value: string): void {
    setName(value)
    setNameError(null)
    setOffline(false)
    setRenamed(false)
  }

  async function onRename(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setNameError(null)
    setOffline(false)
    setRenamed(false)
    setSaving(true)
    try {
      const updated = await patch<Business>('/business', { name })
      invalidateResource(queryClient, 'business')
      setAccepted(updated.name)
      setName(updated.name)
      setRenamed(true)
    } catch (caught) {
      if (caught instanceof NetworkError) {
        setOffline(true)
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
      setSaving(false)
    }
  }

  return (
    <SettingsGroup title="Negocio" dirty={name !== accepted} leave={LEAVE}>
      {renamed && (
        <div className="aviso-flotante">
          <AvisoExito texto={RENAME_SUCCESS} />
        </div>
      )}
      <form className="formulario" onSubmit={onRename}>
        <label className="campo">
          <span className="campo__rotulo">Nombre del negocio</span>
          <input
            className="campo__input"
            type="text"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            required
          />
          {nameError !== null && (
            <span className="campo__error" role="alert">
              {nameError}
            </span>
          )}
        </label>
        <button className="boton" type="submit" disabled={saving}>
          Guardá el nombre
        </button>
        {offline && <SinConexion />}
      </form>
    </SettingsGroup>
  )
}
