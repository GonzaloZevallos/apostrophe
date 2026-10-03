/**
 * `/invitation/:token`: a new-business invitation (`NegocioNuevo`) or a join
 * invitation (`Invitacion`), told apart by `InvitationView.kind` — one route, the
 * backend already tells which (plan, "Session"; `accounts.md`). Opening it always
 * logs out first, through the backend (`session.openInvitation`), so acceptance
 * always starts clean; that includes a user opening their own business's link.
 *
 * Every refusal is dispatched through `refusals.ts` (`kindOf`/`resolveOverride`),
 * never a raw `caught.code === '…'` comparison: a renamed or misspelt code fails
 * `tsc` here, not silently at runtime. An unknown, used or expired invitation
 * (`account.invitation_not_usable`, kind `gone`) shows the fixed "Esta invitación ya
 * no sirve" instead of the generic gone notice — it is not a record someone deleted,
 * it is the invitation itself. A server error (`api/client.ts`'s `'unknown'`
 * sentinel for a body with no recognised `code`, a 500 above all) shows the generic
 * retry on both the lookup and accepting, never a refusal.
 */

import { type FormEvent, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'
import { ApiError, NetworkError, UNKNOWN_CODE } from '../api/client'
import { kindOf, isGone, resolveOverride, type RefusalCode } from '../api/refusals'
import { acceptInvitation, openInvitation, type InvitationView } from '../session'
import SinConexion from '../components/SinConexion'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import { formatDateShort } from '../format/dates'

export const NOT_USABLE_TITLE = 'Esta invitación ya no sirve'
export const NOT_USABLE_DETAIL =
  'Venció o alguien la usó antes. Pedile al negocio que te manden una nueva.'
export const GENERIC_REFUSAL_MESSAGE = 'Revisá los datos e intentá de nuevo.'
export { ERROR_GENERICO_MENSAJE as RETRY_MESSAGE }
export const EMAIL_TAKEN_MESSAGE = 'Ya hay una cuenta con ese email'
export const WEAK_PASSWORD_MESSAGE = 'La contraseña tiene que tener al menos 10 caracteres'
export const EMAIL_INVALID_MESSAGE = 'Ingresá un email válido'
export const BUSINESS_NAME_INVALID_MESSAGE = 'Ponele un nombre al negocio, sin espacios de más'

type AcceptAction = { kind: 'inline'; message: string } | { kind: 'not_usable' }

const ACCEPT_OVERRIDES: Partial<Record<RefusalCode, AcceptAction>> = {
  'account.invitation_not_usable': { kind: 'not_usable' },
  'account.email_taken': { kind: 'inline', message: EMAIL_TAKEN_MESSAGE },
  'account.password_weak': { kind: 'inline', message: WEAK_PASSWORD_MESSAGE },
  'account.email_invalid': { kind: 'inline', message: EMAIL_INVALID_MESSAGE },
  'account.business_name_invalid': { kind: 'inline', message: BUSINESS_NAME_INVALID_MESSAGE },
}

type Status = 'loading' | 'not_usable' | 'offline' | 'error' | 'ready'

export default function Invitacion() {
  const { token } = useParams<{ token: string }>()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('loading')
  const [view, setView] = useState<InvitationView | null>(null)
  const [businessName, setBusinessName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (token === undefined) return
    let cancelled = false
    openInvitation({ queryClient }, token)
      .then((looked) => {
        if (cancelled) return
        setView(looked)
        setStatus('ready')
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        if (caught instanceof ApiError && isGone(caught.code)) {
          setStatus('not_usable')
        } else if (caught instanceof NetworkError) {
          setStatus('offline')
        } else {
          setStatus('error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, queryClient])

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (token === undefined || view === null) return
    setError(null)
    setSending(true)
    try {
      await acceptInvitation(
        { queryClient, navigate },
        token,
        view.kind === 'new_business'
          ? { email, password, business_name: businessName }
          : { email, password },
      )
    } catch (caught) {
      if (caught instanceof ApiError) {
        const action = resolveOverride(ACCEPT_OVERRIDES, caught.code)
        if (action?.kind === 'not_usable') {
          setStatus('not_usable')
        } else if (action?.kind === 'inline') {
          setError(action.message)
        } else if (caught.code !== UNKNOWN_CODE && kindOf(caught.code) === 'refusal') {
          setError(GENERIC_REFUSAL_MESSAGE)
        } else {
          setError(ERROR_GENERICO_MENSAJE)
        }
      } else if (caught instanceof NetworkError) {
        setStatus('offline')
      } else {
        setError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSending(false)
    }
  }

  if (status === 'loading') return <main className="pantalla" />

  if (status === 'not_usable') {
    return (
      <main className="pantalla">
        <div className="cuerpo">
          <div className="estado-vacio">
            <span className="estado-vacio__titulo">{NOT_USABLE_TITLE}</span>
            <span className="estado-vacio__detalle">{NOT_USABLE_DETAIL}</span>
          </div>
        </div>
      </main>
    )
  }

  if (status === 'offline') {
    return (
      <main className="pantalla">
        <div className="cuerpo">
          <SinConexion />
        </div>
      </main>
    )
  }

  if (status === 'error') {
    return (
      <main className="pantalla">
        <div className="cuerpo">
          <ErrorGenerico />
        </div>
      </main>
    )
  }

  if (view === null) return <main className="pantalla" />

  const isNewBusiness = view.kind === 'new_business'
  const expiry = formatDateShort(view.expires_at.slice(0, 10))

  return (
    <main className="pantalla">
      <div className="entrar__contenido">
        <div>
          <span className="invitacion__pastilla">
            {isNewBusiness ? 'Invitación válida' : 'Te invitaron a'}
          </span>
          {isNewBusiness ? (
            <p className="invitacion__titulo">Armá tu negocio</p>
          ) : (
            <p className="invitacion__titulo">{view.business_name}</p>
          )}
          <p className="subtitulo">
            {isNewBusiness
              ? 'Ponele un nombre y creá tu usuario. Después podés invitar a un socio.'
              : 'Creá tu usuario y vas a ver las ventas, el stock y los clientes de este negocio. Sólo de este.'}
          </p>
        </div>
        <form className="formulario" onSubmit={onSubmit}>
          {isNewBusiness && (
            <label className="campo">
              <span className="campo__rotulo">Nombre del negocio</span>
              <input
                className="campo__input"
                type="text"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                required
              />
            </label>
          )}
          <label className="campo">
            <span className="campo__rotulo">Email</span>
            <input
              className="campo__input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="campo">
            <span className="campo__rotulo">Contraseña</span>
            <input
              className="campo__input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {error !== null && (
              <span className="campo__error" role="alert">
                {error}
              </span>
            )}
          </label>
          <button className="boton" type="submit" disabled={sending}>
            {isNewBusiness ? 'Creá el negocio' : `Sumate a ${view.business_name}`}
          </button>
        </form>
      </div>
      <div className="pie">
        {isNewBusiness
          ? `La invitación se usa una sola vez y vence el ${expiry}.`
          : `Esta invitación vence el ${expiry} y se usa una sola vez.`}
      </div>
    </main>
  )
}
