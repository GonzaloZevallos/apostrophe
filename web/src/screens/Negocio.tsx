/**
 * `Negocio` (plan, "Negocio"; `accounts.md`): the business's name and renaming it,
 * its users by email (sorted the way the backend already answers them), the
 * signed-in one marked "vos", "Invitá a un socio" and logging out.
 *
 * The business comes only from the session: `GET`/`PATCH /business` never take an
 * id (CODING_STANDARDS §9). Renaming shows the fixed toast "Negocio renombrado"
 * (`accounts.md`, "Feedback") with no name or id in it — the toast is a constant
 * string, never built from the response. A rejected name (`account.business_name_
 * invalid`) shows inline and keeps what was typed, dispatched through `refusals.ts`
 * (`resolveOverride`/`kindOf`), never a raw `caught.code === '…'` comparison.
 * "Invitá a un socio" shows the fresh link right on the screen, which is why it
 * gets no toast of its own ("Invitación lista", unless the link is shown on the
 * screen, which already confirms it — `accounts.md`). Logging out reuses
 * `session.logOut`, the one place every session boundary clears the query cache
 * before navigating.
 */

import { type FormEvent, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useOutletContext } from 'react-router'
import { ApiError, NetworkError, get, patch, post } from '../api/client'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import SinConexion from '../components/SinConexion'
import { invalidateResource, keys } from '../api/keys'
import type { Me } from '../api/me'
import { kindOf, resolveOverride, type RefusalCode } from '../api/refusals'
import { formatDateShort } from '../format/dates'
import { logOut } from '../session'

export const RENAME_SUCCESS = 'Negocio renombrado'
export const BUSINESS_NAME_INVALID_MESSAGE = 'Ponele un nombre al negocio, sin espacios de más'
export const GENERIC_REFUSAL_MESSAGE = 'Revisá los datos e intentá de nuevo.'
export { ERROR_GENERICO_MENSAJE as RETRY_MESSAGE }

interface BusinessUser {
  email: string
}

interface Business {
  name: string
  users: BusinessUser[]
}

interface Invite {
  url: string
  expires_at: string
}

const RENAME_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'account.business_name_invalid': BUSINESS_NAME_INVALID_MESSAGE,
}

export default function Negocio() {
  const me = useOutletContext<Me>()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data, isPending, isError, error } = useQuery({
    queryKey: keys.business(),
    queryFn: () => get<Business>('/business'),
  })

  const [name, setName] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [savingName, setSavingName] = useState(false)
  const [renamed, setRenamed] = useState(false)

  const [invite, setInvite] = useState<Invite | null>(null)
  const [invitePending, setInvitePending] = useState(false)
  const [inviteError, setInviteError] = useState(false)

  const [loggingOut, setLoggingOut] = useState(false)

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
    setRenamed(false)
  }

  async function onRename(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setNameError(null)
    setRenamed(false)
    setSavingName(true)
    try {
      const updated = await patch<Business>('/business', { name: currentName })
      invalidateResource(queryClient, 'business')
      setName(updated.name)
      setRenamed(true)
    } catch (caught) {
      if (caught instanceof ApiError) {
        const message = resolveOverride(RENAME_OVERRIDES, caught.code)
        if (message !== undefined) {
          setNameError(message)
        } else if (caught.code !== 'unknown' && kindOf(caught.code) === 'refusal') {
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

  async function onInvite(): Promise<void> {
    setInviteError(false)
    setInvitePending(true)
    try {
      const issued = await post<Invite>('/invitations')
      setInvite(issued)
    } catch {
      setInviteError(true)
    } finally {
      setInvitePending(false)
    }
  }

  async function onCopy(): Promise<void> {
    if (invite === null) return
    await navigator.clipboard.writeText(invite.url)
  }

  async function onShare(): Promise<void> {
    if (invite === null || typeof navigator.share !== 'function') return
    await navigator.share({ url: invite.url })
  }

  async function onLogOut(): Promise<void> {
    setLoggingOut(true)
    await logOut({ queryClient, navigate })
  }

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <span className="encabezado__titulo">Negocio</span>

        {renamed && (
          <div className="aviso-flotante" role="status">
            <span className="aviso-ambar__titulo">{RENAME_SUCCESS}</span>
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
        </form>

        <div className="negocio__usuarios">
          <span className="campo__rotulo">Usuarios</span>
          <ul className="negocio__lista">
            {data.users.map((user) => (
              <li key={user.email} className="negocio__usuario">
                <span>{user.email}</span>
                {user.email === me.email && <span className="negocio__vos">vos</span>}
              </li>
            ))}
          </ul>
        </div>

        <div className="negocio__invitar">
          <span className="campo__rotulo">Invitá a un socio</span>
          <button className="boton" type="button" onClick={onInvite} disabled={invitePending}>
            Invitá a un socio
          </button>
          {invite !== null && (
            <>
              <div className="negocio__link">{invite.url}</div>
              <div className="negocio__acciones">
                <button type="button" className="boton" onClick={onCopy}>
                  Copiar
                </button>
                <button type="button" className="boton" onClick={onShare}>
                  Compartir
                </button>
              </div>
              <span className="campo__rotulo">
                Vence el {formatDateShort(invite.expires_at.slice(0, 10))}
              </span>
            </>
          )}
          {inviteError && <ErrorGenerico />}
        </div>

        <button className="boton" type="button" onClick={onLogOut} disabled={loggingOut}>
          Cerrar sesión
        </button>
      </div>
    </main>
  )
}
