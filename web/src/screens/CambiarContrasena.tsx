/**
 * "Cambiar contraseña", a sheet over `Negocio` (plan, "Negocio"; `accounts.md`),
 * the same `.capa`/`.capa__contenido` layer `Cobro` uses. A wrong current
 * password clears "Contraseña actual" and keeps "Contraseña nueva" — a
 * deliberate exception to "refusals keep what was typed" (PM round 2). A short
 * new password shows the invitation's own too-short text; a lock shows the
 * login brake's own message (`Entrar`'s `BRAKE_MESSAGE`), both keeping
 * everything typed. Neither a 422 nor a 429 ever sends the user to login: they
 * are handled here, inline, never through `handleUnauthorized`.
 *
 * `account.current_password_wrong` is matched by a plain string comparison here,
 * not through `refusals.ts`'s contract-backed `RefusalCode` (same shape as
 * `Cobro.tsx`'s own `payment.*` codes): it is this screen's own new code, and it
 * reaches `contract.json` in the same diff as the `backend` subtask, still open
 * as this one ships (`tests/test_refusal_codes.py` refuses a code in
 * `contract.json` the backend does not yet answer). `account.password_weak` and
 * `account.login_locked` already exist there, so they keep going through
 * `resolveOverride`.
 */

import { type FormEvent, useState } from 'react'
import { ApiError, NetworkError, UNKNOWN_CODE } from '../api/client'
import { kindOf, resolveOverride, type RefusalCode } from '../api/refusals'
import SinConexion from '../components/SinConexion'
import { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import { changePassword } from '../session'
import { BRAKE_MESSAGE } from './Entrar'
import { WEAK_PASSWORD_MESSAGE } from './Invitacion'

export const WRONG_CURRENT_PASSWORD_MESSAGE = 'La contraseña actual no es esa.'
export const GENERIC_REFUSAL_MESSAGE = 'Revisá los datos e intentá de nuevo.'
export const CURRENT_PASSWORD_WRONG_CODE = 'account.current_password_wrong'

export interface CambiarContrasenaProps {
  onClose: () => void
  onSaved: () => void
}

const OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'account.password_weak': WEAK_PASSWORD_MESSAGE,
  'account.login_locked': BRAKE_MESSAGE,
}

export default function CambiarContrasena({ onClose, onSaved }: CambiarContrasenaProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [currentError, setCurrentError] = useState<string | null>(null)
  const [newError, setNewError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setCurrentError(null)
    setNewError(null)
    setFormError(null)
    setOffline(false)
    setSending(true)
    try {
      await changePassword(currentPassword, newPassword)
      onSaved()
    } catch (caught) {
      if (caught instanceof NetworkError) {
        setOffline(true)
      } else if (caught instanceof ApiError && caught.code === CURRENT_PASSWORD_WRONG_CODE) {
        setCurrentPassword('')
        setCurrentError(WRONG_CURRENT_PASSWORD_MESSAGE)
      } else if (caught instanceof ApiError && caught.code === 'account.password_weak') {
        setNewError(OVERRIDES['account.password_weak'] ?? GENERIC_REFUSAL_MESSAGE)
      } else if (caught instanceof ApiError) {
        const message = resolveOverride(OVERRIDES, caught.code)
        if (message !== undefined) {
          setFormError(message)
        } else if (caught.code !== UNKNOWN_CODE && kindOf(caught.code) === 'refusal') {
          setFormError(GENERIC_REFUSAL_MESSAGE)
        } else {
          setFormError(ERROR_GENERICO_MENSAJE)
        }
      } else {
        setFormError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="capa" role="presentation">
      <div className="capa__contenido">
        <span className="panel__titulo">Cambiar contraseña</span>
        <form className="formulario" onSubmit={(event) => void onSubmit(event)}>
          <label className="campo">
            <span className="campo__rotulo">Contraseña actual</span>
            <input
              className="campo__input"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
            {currentError !== null && (
              <span className="campo__error" role="alert">
                {currentError}
              </span>
            )}
          </label>
          <label className="campo">
            <span className="campo__rotulo">Contraseña nueva</span>
            <input
              className="campo__input"
              type={reveal ? 'text' : 'password'}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
            {newError !== null && (
              <span className="campo__error" role="alert">
                {newError}
              </span>
            )}
          </label>
          <button type="button" className="boton-enlace" onClick={() => setReveal((shown) => !shown)}>
            {reveal ? 'Ocultar' : 'Mostrar'}
          </button>
          {formError !== null && (
            <span className="campo__error" role="alert">
              {formError}
            </span>
          )}
          {offline && <SinConexion />}
          <button className="boton" type="submit" disabled={sending}>
            Guardar
          </button>
          <button type="button" className="boton-enlace" onClick={onClose}>
            Cancelar
          </button>
        </form>
      </div>
    </div>
  )
}
