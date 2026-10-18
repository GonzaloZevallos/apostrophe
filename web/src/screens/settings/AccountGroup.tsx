/**
 * The "Tu cuenta" group of Configuración (`ConfiguracionCuenta.dc.html`; `accounts.md`):
 * "Cambiar contraseña" (the unchanged `CambiarContrasena` sheet) above "Cerrar sesión".
 *
 * Logging out reuses `session.logOut`, the one place every session boundary clears the query
 * cache before navigating, and calls `disarm()` right before that navigation. It does not
 * clear the device's theme choice (`accounts.md`). A dropped network shows "Sin conexión".
 */

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { NetworkError } from '../../api/client'
import AvisoExito from '../../components/AvisoExito'
import Boton from '../../components/Boton'
import SinConexion from '../../components/SinConexion'
import { logOut } from '../../session'
import CambiarContrasena from '../CambiarContrasena'
import { CHANGE_PASSWORD } from '../../copy/auth'
import { GROUP_ACCOUNT, LEAVE_PASSWORD, LOG_OUT, PASSWORD_CHANGED_SUCCESS } from '../../copy/settings'
import SettingsGroup from './SettingsGroup'

export default function AccountGroup() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutOffline, setLogoutOffline] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordChanged, setPasswordChanged] = useState(false)

  async function onLogOut(disarm: () => void): Promise<void> {
    setLoggingOut(true)
    setLogoutOffline(false)
    try {
      await logOut({
        queryClient,
        navigate: (path) => {
          disarm()
          void navigate(path)
        },
      })
    } catch (caught) {
      if (caught instanceof NetworkError) setLogoutOffline(true)
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <SettingsGroup title={GROUP_ACCOUNT} dirty={false} leave={LEAVE_PASSWORD}>
      {({ disarm }) => (
        <>
          {passwordChanged && (
            <div className="aviso-flotante">
              <AvisoExito texto={PASSWORD_CHANGED_SUCCESS} />
            </div>
          )}
          <Boton variant="secondary" icon="candado" onClick={() => setChangingPassword(true)}>
            {CHANGE_PASSWORD}
          </Boton>
          <Boton variant="secondary" icon="salirSesion" onClick={() => void onLogOut(disarm)} disabled={loggingOut}>
            {LOG_OUT}
          </Boton>
          {logoutOffline && <SinConexion />}
          {changingPassword && (
            <CambiarContrasena
              onClose={() => setChangingPassword(false)}
              onSaved={() => {
                setChangingPassword(false)
                setPasswordChanged(true)
              }}
            />
          )}
        </>
      )}
    </SettingsGroup>
  )
}
