/**
 * `Entrar`: email and password sign a person in (plan, "Getting in"; `accounts.md`).
 * The hint under the button is fixed and never counts attempts — the backend does not
 * say how many are left, on purpose — and a lock (`account.login_locked`) shows the
 * brake message in its place, not the usual inline refusal. A wrong email or password
 * answers plain 401 (no `code` of its own), shown inline without naming which one was
 * wrong. Every other refusal is dispatched through `refusals.ts` — never a raw
 * `caught.code === '…'` comparison — so a renamed or misspelt code fails `tsc` here,
 * not silently at runtime. A server error (`api/client.ts`'s `'unknown'` sentinel for
 * a body with no recognised `code`, a 500 above all) shows the generic retry, never a
 * refusal — a refusal would blame what the user typed.
 */

import { type FormEvent, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { ApiError, NetworkError, UNKNOWN_CODE } from '../api/client'
import { kindOf, resolveOverride, type RefusalCode } from '../api/refusals'
import { login } from '../session'
import SinConexion from '../components/SinConexion'
import { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import AuthPage from '../components/AuthPage'
import Boton from '../components/Boton'
import PasswordField from '../components/PasswordField'
import { BRAKE_MESSAGE, INVITE_ONLY_LINE, LOGIN_HINT, AUTH_TEXT } from '../copy/auth'
import { GENERIC_REFUSAL_MESSAGE as COPY_GENERIC_REFUSAL_MESSAGE } from '../copy/settings'

export const CREDENTIALS_WRONG = AUTH_TEXT.wrongEmailOrPassword
export const GENERIC_REFUSAL_MESSAGE = COPY_GENERIC_REFUSAL_MESSAGE
export { BRAKE_MESSAGE, LOGIN_HINT, ERROR_GENERICO_MENSAJE as RETRY_MESSAGE }

const LOGIN_OVERRIDES: Partial<Record<RefusalCode, 'locked'>> = {
  'account.login_locked': 'locked',
}

export default function Entrar() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setLocked(false)
    setOffline(false)
    setSending(true)
    try {
      await login({ queryClient, navigate }, email, password)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        setError(CREDENTIALS_WRONG)
      } else if (caught instanceof ApiError && resolveOverride(LOGIN_OVERRIDES, caught.code) === 'locked') {
        setLocked(true)
      } else if (caught instanceof ApiError && caught.code !== UNKNOWN_CODE && kindOf(caught.code) === 'refusal') {
        setError(GENERIC_REFUSAL_MESSAGE)
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
    <AuthPage brand>
      <p className="subtitulo">{AUTH_TEXT.tagline}</p>
      <form className="formulario" onSubmit={onSubmit}>
        <label className="campo">
          <span className="campo__rotulo">{AUTH_TEXT.emailAddress}</span>
          <input
            className="campo__input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <PasswordField
          label={AUTH_TEXT.password}
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={error}
        />
        <Boton textOnly="submit" type="submit" disabled={sending}>
          {AUTH_TEXT.signIn}
        </Boton>
        {locked ? (
          <span className="campo__error" role="alert">
            {BRAKE_MESSAGE}
          </span>
        ) : (
          <span className="ayuda-fija">{LOGIN_HINT}</span>
        )}
        {offline && <SinConexion />}
      </form>
      <div className="pie">{INVITE_ONLY_LINE}</div>
    </AuthPage>
  )
}
