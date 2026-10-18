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
import AuthPage from '../components/AuthPage'
import Boton from '../components/Boton'
import Loading from '../components/Loading'
import PasswordField from '../components/PasswordField'
import SinConexion from '../components/SinConexion'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import { formatDateShort } from '../format/dates'
import {
  BUSINESS_NAME_LABEL,
  CREATE_BUSINESS,
  EMAIL_INVALID_MESSAGE,
  EMAIL_LABEL,
  EMAIL_TAKEN_MESSAGE,
  expiryLine,
  INVITED_TO,
  joinBusiness,
  JOIN_SUBTITLE,
  NEW_BUSINESS_SUBTITLE,
  NOT_USABLE_DETAIL,
  NOT_USABLE_TITLE,
  PASSWORD_LABEL,
  SET_UP_BUSINESS,
  VALID_INVITATION,
  WEAK_PASSWORD_MESSAGE,
} from '../copy/auth'
import { GENERIC_REFUSAL_MESSAGE } from '../copy/common'
import { BUSINESS_NAME_INVALID_MESSAGE } from '../copy/settings'

type AcceptAction = { kind: 'inline'; message: string } | { kind: 'not_usable' }

const ACCEPT_OVERRIDES: Partial<Record<RefusalCode, AcceptAction>> = {
  'account.invitation_not_usable': { kind: 'not_usable' },
  'account.email_taken': { kind: 'inline', message: EMAIL_TAKEN_MESSAGE },
  'account.password_weak': { kind: 'inline', message: WEAK_PASSWORD_MESSAGE },
  'account.email_invalid': { kind: 'inline', message: EMAIL_INVALID_MESSAGE },
  'account.business_name_invalid': { kind: 'inline', message: BUSINESS_NAME_INVALID_MESSAGE },
}

const TITLE_CLASS = 'invitacion__titulo'

const STATUS = {
  loading: 'loading',
  not_usable: 'not_usable',
  offline: 'offline',
  error: 'error',
  ready: 'ready',
} as const
type Status = (typeof STATUS)[keyof typeof STATUS]

export default function Invitacion() {
  const { token } = useParams<{ token: string }>()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>(STATUS.loading)
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
        setStatus(STATUS.ready)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        if (caught instanceof ApiError && isGone(caught.code)) {
          setStatus(STATUS.not_usable)
        } else if (caught instanceof NetworkError) {
          setStatus(STATUS.offline)
        } else {
          setStatus(STATUS.error)
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
        view.kind,
      )
    } catch (caught) {
      if (caught instanceof ApiError) {
        const action = resolveOverride(ACCEPT_OVERRIDES, caught.code)
        if (action?.kind === 'not_usable') {
          setStatus(STATUS.not_usable)
        } else if (action?.kind === 'inline') {
          setError(action.message)
        } else if (caught.code !== UNKNOWN_CODE && kindOf(caught.code) === 'refusal') {
          setError(GENERIC_REFUSAL_MESSAGE)
        } else {
          setError(ERROR_GENERICO_MENSAJE)
        }
      } else if (caught instanceof NetworkError) {
        setStatus(STATUS.offline)
      } else {
        setError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSending(false)
    }
  }

  if (status === 'not_usable') {
    return <AuthPage title={NOT_USABLE_TITLE} subtitle={NOT_USABLE_DETAIL} />
  }

  if (status === 'offline') {
    return (
      <AuthPage>
        <SinConexion />
      </AuthPage>
    )
  }

  if (status === 'error') {
    return (
      <AuthPage>
        <ErrorGenerico />
      </AuthPage>
    )
  }

  if (status === 'loading' || view === null) {
    return (
      <AuthPage>
        <Loading />
      </AuthPage>
    )
  }

  const isNewBusiness = view.kind === 'new_business'
  const expiry = formatDateShort(view.expires_at.slice(0, 10))

  return (
    <AuthPage
      titleClass={TITLE_CLASS}
      eyebrow={isNewBusiness ? VALID_INVITATION : INVITED_TO}
      title={isNewBusiness ? SET_UP_BUSINESS : (view.business_name ?? undefined)}
      subtitle={
        isNewBusiness
          ? NEW_BUSINESS_SUBTITLE
          : JOIN_SUBTITLE
      }
    >
      <form className="formulario" onSubmit={onSubmit}>
        {isNewBusiness && (
          <label className="campo">
            <span className="campo__rotulo">{BUSINESS_NAME_LABEL}</span>
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
          <span className="campo__rotulo">{EMAIL_LABEL}</span>
          <input
            className="campo__input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <PasswordField label={PASSWORD_LABEL} value={password} onChange={setPassword} error={error} />
        <Boton textOnly="submit" type="submit" disabled={sending}>
          {isNewBusiness ? CREATE_BUSINESS : joinBusiness(view.business_name ?? '')}
        </Boton>
      </form>
      <div className="pie">
        {expiryLine(isNewBusiness, expiry)}
      </div>
    </AuthPage>
  )
}
