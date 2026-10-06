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
 * `account.current_password_wrong` is typed as a `RefusalCode` from
 * `refusals.ts`'s contract-backed set, like `account.password_weak` and
 * `account.login_locked`: a rename on the backend side fails `tsc` here instead
 * of silently falling through. It is checked separately from `OVERRIDES` because
 * its handling clears a different field than the one that held the refusal.
 *
 * No design file exists for this sheet: checked by eye before delivery against
 * `Negocio`'s own comparison (`scripts/design/compare.sh`) with the sheet open
 * — same `.capa`/`.capa__contenido` dim-backdrop bottom sheet `Cobro`'s
 * "Registrar cobro" uses, the same `panel__titulo` heading and `.formulario`/
 * `.campo` field rhythm.
 */

import { type FormEvent, useState } from 'react'
import { ApiError, NetworkError, UNKNOWN_CODE } from '../api/client'
import { kindOf, resolveOverride, type RefusalCode } from '../api/refusals'
import Sheet from '../components/Sheet'
import SinConexion from '../components/SinConexion'
import { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import { changePassword } from '../session'
import { BRAKE_MESSAGE } from './Entrar'
import { WEAK_PASSWORD_MESSAGE } from './Invitacion'
import { useLeaveGuard } from '../shell/leaveGuard'

export const WRONG_CURRENT_PASSWORD_MESSAGE = 'La contraseña actual no es esa.'
export const GENERIC_REFUSAL_MESSAGE = 'Revisá los datos e intentá de nuevo.'
const CURRENT_PASSWORD_WRONG_CODE: RefusalCode = 'account.current_password_wrong'

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
  const guard = useLeaveGuard({ touched: currentPassword !== '' || newPassword !== '' })

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setCurrentError(null)
    setNewError(null)
    setFormError(null)
    setOffline(false)
    setSending(true)
    try {
      await changePassword(currentPassword, newPassword)
      guard.allowLeave()
      onSaved()
    } catch (caught) {
      if (caught instanceof NetworkError) {
        setOffline(true)
      } else if (caught instanceof ApiError && caught.code === CURRENT_PASSWORD_WRONG_CODE) {
        setCurrentPassword('')
        setCurrentError(WRONG_CURRENT_PASSWORD_MESSAGE)
      } else if (caught instanceof ApiError && caught.code === 'account.password_weak') {
        setNewError(WEAK_PASSWORD_MESSAGE)
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
    <Sheet title="Cambiar contraseña" guard={guard} onClose={onClose}>
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
        </form>
    </Sheet>
  )
}
