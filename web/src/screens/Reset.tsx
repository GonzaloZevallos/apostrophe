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
 * `account.reset_link_gone` is matched by a plain string comparison, not
 * through `refusals.ts`'s contract-backed `isGone` (same shape as `Cobro.tsx`'s
 * own `payment.*` codes): it is this screen's own new code, and it reaches
 * `contract.json` in the same diff as the `backend` subtask, still open as this
 * one ships (`tests/test_refusal_codes.py` refuses a code in `contract.json` the
 * backend does not yet answer).
 *
 * No design file exists for this screen: checked by eye before delivery against
 * `Invitacion`'s own comparison (`scripts/design/compare.sh`) — same
 * `.entrar__contenido` top padding, the same `.invitacion__titulo` type for the
 * heading, the same `.formulario`/`.campo` field rhythm and pill button. It is
 * shorter than Invitacion's own form only because this screen's copy has no
 * badge, subtitle or footer line, not because of a missed spacing rule.
 */

import { type FormEvent, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'
import { ApiError, NetworkError } from '../api/client'
import { openResetLink, submitReset } from '../session'
import SinConexion from '../components/SinConexion'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import { WEAK_PASSWORD_MESSAGE } from './Invitacion'

export const DEAD_LINK_MESSAGE = 'Este enlace ya no sirve. Pedile uno nuevo a quien te lo pasó.'
export const RESET_LINK_GONE_CODE = 'account.reset_link_gone'
export { ERROR_GENERICO_MENSAJE as RETRY_MESSAGE }

type Status = 'loading' | 'dead' | 'offline' | 'error' | 'ready'

export default function Reset() {
  const { token } = useParams<{ token: string }>()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('loading')
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(false)
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
        if (caught instanceof ApiError && caught.code === RESET_LINK_GONE_CODE) {
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
      if (caught instanceof ApiError && caught.code === RESET_LINK_GONE_CODE) {
        setStatus('dead')
      } else if (caught instanceof ApiError && caught.code === 'account.password_weak') {
        setError(WEAK_PASSWORD_MESSAGE)
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

  if (status === 'dead') {
    return (
      <main className="pantalla">
        <div className="cuerpo">
          <div className="estado-vacio">
            <span className="estado-vacio__titulo">{DEAD_LINK_MESSAGE}</span>
          </div>
          <a className="boton" href="/entrar">
            Entrar
          </a>
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

  return (
    <main className="pantalla">
      <div className="entrar__contenido">
        <div>
          <p className="invitacion__titulo">Elegí tu contraseña nueva</p>
        </div>
        <form className="formulario" onSubmit={(event) => void onSubmit(event)}>
          <label className="campo">
            <span className="campo__rotulo">Contraseña nueva</span>
            <input
              className="campo__input"
              type={reveal ? 'text' : 'password'}
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
          <button type="button" className="boton-enlace" onClick={() => setReveal((shown) => !shown)}>
            {reveal ? 'Ocultar' : 'Mostrar'}
          </button>
          <button className="boton" type="submit" disabled={sending}>
            Guardar y entrar
          </button>
        </form>
      </div>
    </main>
  )
}
