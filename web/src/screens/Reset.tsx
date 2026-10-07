/**
 * `/reset/:token` (plan, "Reset"; `accounts.md`): opening a reset link logs out
 * first, through the backend (`openResetLink`), exactly as `/invitation/:token`
 * does, so the screen always starts from a clean, signed-out state — even for the
 * user's own currently-signed-in link. The lookup spends nothing: a live link
 * answers 204, a dead one 404 `account.reset_link_gone`, shown as the fixed
 * dead-link notice, never the generic gone notice, and never saying why the link
 * is dead. Submitting shares the same dead-link state when the link went stale
 * between opening and submitting, and the invitation's own too-short refusal
 * text when the new password is under 10 characters. On success this device is
 * signed in and lands on Inicio, with no toast (PRD, "On screen").
 *
 * `account.reset_link_gone` is dispatched through `refusals.ts`'s contract-backed
 * `isGone`, like every other screen's gone records (`GastoCategorias.tsx`,
 * `Invitacion.tsx`): the code is in `contract.json` with `kind: "gone"`, so a
 * rename on the backend side fails `tsc` here instead of silently falling through.
 *
 * No design file exists for this screen: it renders through `AuthPage` (ADR-0025),
 * the layout Invitacion shares, and is compared against `Invitacion.dc.html` through
 * the `Reset` entry of `scripts/design/screens.json` (`compare.sh`). It is shorter
 * than Invitacion's own form only because this screen's copy has no badge, subtitle
 * or footer line.
 */

import { LOGIN } from '../routes'
import { type FormEvent, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError, NetworkError } from '../api/client'
import { openResetLink, submitReset } from '../session'
import AuthPage from '../components/AuthPage'
import Boton from '../components/Boton'
import Loading from '../components/Loading'
import PasswordField from '../components/PasswordField'
import SinConexion from '../components/SinConexion'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import { isGone, resolveOverride, type RefusalCode } from '../api/refusals'
import { DEAD_LINK_MESSAGE, WEAK_PASSWORD_MESSAGE } from './authMessages'

export { DEAD_LINK_MESSAGE }
export { ERROR_GENERICO_MENSAJE as RETRY_MESSAGE }

const SUBMIT_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'account.password_weak': WEAK_PASSWORD_MESSAGE,
}

type Status = 'loading' | 'dead' | 'offline' | 'error' | 'ready'

export default function Reset() {
  const { token } = useParams<{ token: string }>()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('loading')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (token === undefined) return
    let cancelled = false
    openResetLink({ queryClient }, token)
      .then(() => {
        if (cancelled) return
        setStatus('ready')
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        if (caught instanceof ApiError && isGone(caught.code)) {
          setStatus('dead')
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
    if (token === undefined) return
    setError(null)
    setSending(true)
    try {
      await submitReset({ queryClient, navigate }, token, password)
    } catch (caught) {
      if (caught instanceof ApiError && isGone(caught.code)) {
        setStatus('dead')
      } else if (caught instanceof ApiError) {
        const message = resolveOverride(SUBMIT_OVERRIDES, caught.code)
        setError(message ?? ERROR_GENERICO_MENSAJE)
      } else if (caught instanceof NetworkError) {
        setStatus('offline')
      } else {
        setError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSending(false)
    }
  }

  if (status === 'loading') {
    return (
      <AuthPage>
        <Loading />
      </AuthPage>
    )
  }

  if (status === 'dead') {
    return (
      <AuthPage title={DEAD_LINK_MESSAGE}>
        <Link className="boton" to={LOGIN}>
          Entrar
        </Link>
      </AuthPage>
    )
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

  return (
    <AuthPage title="Elegí tu contraseña nueva">
      <form className="formulario" onSubmit={(event) => void onSubmit(event)}>
        <PasswordField label="Contraseña nueva" value={password} onChange={setPassword} error={error} />
        <Boton textOnly="submit" type="submit" disabled={sending}>
          Guardar y entrar
        </Boton>
      </form>
    </AuthPage>
  )
}
