/**
 * The frame of one Configuración group (`ConfiguracionNegocio.dc.html` and its siblings):
 * the title, "Cerrar", and the unsaved-changes confirmation. It is a form, so it carries no
 * bar and no "+ Nueva venta" (the route says `chrome: 'none'`; `Shell` reads it).
 *
 * "Cerrar" goes through `useBackOr(/settings)` and never calls `disarm()`: a dirty group
 * always asks, and only discarding lets it through. `disarm` is handed to the child so a
 * save that navigates (invariant: only right before a navigation after a successful save or
 * logout) can drop the guard first.
 */

import { SETTINGS } from '../../routes'
import type { ReactNode } from 'react'
import Boton from '../../components/Boton'
import LeaveConfirm from '../../components/LeaveConfirm'
import { useBackOr } from '../../components/useBackOr'
import { useLeaveGuard } from '../../components/useLeaveGuard'

export const SETTINGS_PATH = SETTINGS

export interface LeaveWording {
  question: string
  detail: string
  keepLabel: string
  discardLabel: string
}

export interface SettingsGroupFrame {
  disarm: () => void
}

export interface SettingsGroupProps {
  title: string
  dirty: boolean
  leave: LeaveWording
  children: ReactNode | ((frame: SettingsGroupFrame) => ReactNode)
}

export default function SettingsGroup({ title, dirty, leave, children }: SettingsGroupProps) {
  const { blocker, disarm } = useLeaveGuard(dirty)
  const close = useBackOr(SETTINGS_PATH)

  return (
    <main className="pantalla ajustes-grupo">
      <div className="ajustes-grupo__tarjeta">
        <div className="ajustes-grupo__encabezado">
          <span className="ajustes-grupo__titulo">{title}</span>
          <Boton variant="link" onClick={close}>
            Cerrar
          </Boton>
        </div>
        <div className="ajustes-grupo__cuerpo">
          {typeof children === 'function' ? children({ disarm }) : children}
        </div>
      </div>
      {blocker.state === 'blocked' && <LeaveConfirm blocker={blocker} {...leave} />}
    </main>
  )
}
