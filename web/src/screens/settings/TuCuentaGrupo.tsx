/**
 * Configuración → Tu cuenta (`accounts.md`): "Cambiar contraseña" above "Cerrar
 * sesión", today's piece unchanged. The password sheet and its fixed toast behave as
 * they did on `Negocio`. Logging out reuses `session.logOut`, the one place every
 * session boundary clears the query cache before navigating; a dropped network shows
 * "Sin conexión" and re-enables the button.
 */

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { NetworkError } from '../../api/client'
import SinConexion from '../../components/SinConexion'
import { logOut } from '../../session'
import CambiarContrasena from '../CambiarContrasena'

export const PASSWORD_CHANGED_SUCCESS = 'Contraseña cambiada · cerramos tus otras sesiones'

export default function TuCuentaGrupo() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutOffline, setLogoutOffline] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordChanged, setPasswordChanged] = useState(false)

  async function onLogOut(): Promise<void> {
    setLoggingOut(true)
    setLogoutOffline(false)
    try {
      await logOut({ queryClient, navigate })
    } catch (caught) {
      if (caught instanceof NetworkError) setLogoutOffline(true)
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <span className="encabezado__titulo">Tu cuenta</span>

        {passwordChanged && (
          <div className="aviso-flotante" role="status">
            <div className="aviso-exito">
              <span className="aviso-exito__texto">{PASSWORD_CHANGED_SUCCESS}</span>
            </div>
          </div>
        )}

        <button className="boton" type="button" onClick={() => setChangingPassword(true)}>
          Cambiar contraseña
        </button>
        <button className="boton" type="button" onClick={onLogOut} disabled={loggingOut}>
          Cerrar sesión
        </button>
        {logoutOffline && <SinConexion />}
      </div>
      {changingPassword && (
        <CambiarContrasena
          onClose={() => setChangingPassword(false)}
          onSaved={() => {
            setChangingPassword(false)
            setPasswordChanged(true)
          }}
        />
      )}
    </main>
  )
}
