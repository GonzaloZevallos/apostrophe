/**
 * `/invitation/:token`: a new-business invitation (`NegocioNuevo`) or a join
 * invitation (`Invitacion`), told apart by `InvitationView.kind` — one route, the
 * backend already tells which (plan, "Session"; `accounts.md`). Opening it always
 * logs out first, through the backend (`session.openInvitation`), so acceptance
 * always starts clean; that includes a user opening their own business's link.
 *
 * An unknown, used or expired invitation (`account.invitation_not_usable`) shows the
 * fixed "Esta invitación ya no sirve" (plan, "Gone records": the override for this
 * code) instead of the generic gone notice — it is not a record someone deleted, it
 * is the invitation itself.
 */

import { type FormEvent, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'
import { ApiError, NetworkError } from '../api/client'
import { acceptInvitation, openInvitation, type InvitationView } from '../session'

export const NOT_USABLE_TITLE = 'Esta invitación ya no sirve'
export const NOT_USABLE_DETAIL =
  'Venció o alguien la usó antes. Pedile al negocio que te manden una nueva.'
export const OFFLINE_MESSAGE = 'Te quedaste sin internet'
export const RETRY_MESSAGE = 'Algo falló. Probá de nuevo.'
export const EMAIL_TAKEN_MESSAGE = 'Ya hay una cuenta con ese email'
export const WEAK_PASSWORD_MESSAGE = 'La contraseña tiene que tener al menos 10 caracteres'

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
        if (caught instanceof ApiError && caught.code === 'account.invitation_not_usable') {
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
      if (caught instanceof ApiError && caught.code === 'account.invitation_not_usable') {
        setStatus('not_usable')
      } else if (caught instanceof ApiError && caught.code === 'account.email_taken') {
        setError(EMAIL_TAKEN_MESSAGE)
      } else if (caught instanceof ApiError && caught.code === 'account.password_weak') {
        setError(WEAK_PASSWORD_MESSAGE)
      } else if (caught instanceof NetworkError) {
        setError(OFFLINE_MESSAGE)
      } else {
        setError(RETRY_MESSAGE)
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

  if (status === 'offline' || status === 'error') {
    return (
      <main className="pantalla">
        <div className="cuerpo">
          <div className="aviso-ambar">
            <span className="aviso-ambar__titulo">
              {status === 'offline' ? OFFLINE_MESSAGE : RETRY_MESSAGE}
            </span>
          </div>
        </div>
      </main>
    )
  }

  const isNewBusiness = view?.kind === 'new_business'

  return (
    <main className="pantalla">
      <div className="entrar__contenido">
        <div>
          <span className="marca">
            apostrophe<span className="marca__apostrofe">’</span>
          </span>
          <p className="subtitulo">
            {isNewBusiness ? 'Creá tu negocio en apostrophe.' : `${view?.business_name} te invitó a sumarte.`}
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
            {isNewBusiness ? 'Crear negocio' : 'Sumarme'}
          </button>
        </form>
      </div>
    </main>
  )
}
