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
import Icono from '../../components/Icono'
import SinConexion from '../../components/SinConexion'
import { logOut } from '../../session'
import CambiarContrasena from '../CambiarContrasena'
import { PASSWORD_CHANGED_SUCCESS } from './messages'
import SettingsGroup from './SettingsGroup'

const LEAVE = {
  question: '¿Descartás la contraseña nueva?',
  detail: 'Se pierde lo que cargaste: todavía no se guardó nada.',
  keepLabel: 'No, seguí editando',
  discardLabel: 'Sí, descartala',
}

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
    <SettingsGroup title="Tu cuenta" dirty={false} leave={LEAVE}>
      {({ disarm }) => (
        <>
          {passwordChanged && (
            <div className="aviso-flotante">
              <AvisoExito texto={PASSWORD_CHANGED_SUCCESS} />
            </div>
          )}
          <button
            className="ajustes__item ajustes__item--boton"
            type="button"
            onClick={() => setChangingPassword(true)}
          >
            <span className="ajustes__item-rotulo">Cambiar contraseña</span>
            <span className="ajustes__item-flecha">
              <Icono nombre="chevron" />
            </span>
          </button>
          <button
            className="ajustes__item ajustes__item--boton"
            type="button"
            onClick={() => void onLogOut(disarm)}
            disabled={loggingOut}
          >
            <span className="ajustes__item-rotulo">Cerrar sesión</span>
          </button>
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
