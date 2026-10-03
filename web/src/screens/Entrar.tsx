/**
 * `Entrar`: email and password sign a person in (plan, "Getting in"; `accounts.md`).
 * The hint under the button is fixed and never counts attempts — the backend does not
 * say how many are left, on purpose — and a lock (`account.login_locked`, 429) shows
 * the brake message in its place, not the usual inline refusal. A wrong email or
 * password answers plain 401, shown inline without naming which one was wrong.
 */

import { type FormEvent, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { ApiError, NetworkError } from '../api/client'
import { login } from '../session'

export const CREDENTIALS_WRONG = 'Email o contraseña incorrectos'
export const BRAKE_MESSAGE = '5 intentos fallidos · probá de nuevo en 15 minutos'
export const LOGIN_HINT = 'Después de 5 intentos fallidos, el email queda bloqueado 15 minutos'
export const OFFLINE_MESSAGE = 'Te quedaste sin internet'
export const RETRY_MESSAGE = 'Algo falló. Probá de nuevo.'

export default function Entrar() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [sending, setSending] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setLocked(false)
    setSending(true)
    try {
      await login({ queryClient, navigate }, email, password)
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'account.login_locked') {
        setLocked(true)
      } else if (caught instanceof ApiError && caught.status === 401) {
        setError(CREDENTIALS_WRONG)
      } else if (caught instanceof NetworkError) {
        setError(OFFLINE_MESSAGE)
      } else {
        setError(RETRY_MESSAGE)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="pantalla">
      <div className="entrar__contenido">
        <div>
          <span className="marca">
            apostrophe<span className="marca__apostrofe">’</span>
          </span>
          <p className="subtitulo">Tus ventas, tu stock y lo que te deben.</p>
        </div>
        <form className="formulario" onSubmit={onSubmit}>
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
            Entrá
          </button>
          {locked ? (
            <span className="campo__error" role="alert">
              {BRAKE_MESSAGE}
            </span>
          ) : (
            <span className="ayuda-fija">{LOGIN_HINT}</span>
          )}
        </form>
      </div>
      <div className="pie">Para usar apostrophe te tiene que invitar un negocio.</div>
    </main>
  )
}
