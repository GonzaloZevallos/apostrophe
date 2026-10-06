/**
 * `Settings`, the list of Configuración's seven groups (`Configuracion.dc.html` on the
 * phone, `ConfiguracionCompu.dc.html` on a computer): a card route, so the bar or the
 * rail shows and "+ Nueva venta" does not. Nothing else is listed (no language, no
 * placeholder): a group that does not exist is not drawn.
 *
 * Every link carries `state: { inApp: true }`, which is what lets a group's "Cerrar" and
 * this list's back go through history (`useBackOr`). The arrow's word and Back's fallback are
 * the screen's parent in the registry (`parentOf`): Más on the phone, Inicio on a computer.
 */

import { Link, useOutletContext } from 'react-router'
import type { Me } from '../../api/me'
import Boton from '../../components/Boton'
import Icono from '../../components/Icono'
import { useBackOr } from '../../components/useBackOr'
import {
  EXPENSE_CATEGORIES,
  HOME,
  parentOf,
  SETTINGS_ACCOUNT,
  SETTINGS_APPEARANCE,
  SETTINGS_BUSINESS,
  SETTINGS_CATALOG_MESSAGE,
  SETTINGS_INTEGRATIONS,
  SETTINGS_USERS,
} from '../../routes'
import { useViewport } from '../../shell/useViewport'

const GROUPS = [
  { to: SETTINGS_BUSINESS, label: 'Negocio' },
  { to: SETTINGS_USERS, label: 'Usuarios' },
  { to: SETTINGS_INTEGRATIONS, label: 'Integraciones' },
  { to: SETTINGS_CATALOG_MESSAGE, label: 'Mensaje del catálogo' },
  { to: EXPENSE_CATEGORIES, label: 'Categorías de gastos' },
  { to: SETTINGS_APPEARANCE, label: 'Apariencia' },
  { to: SETTINGS_ACCOUNT, label: 'Tu cuenta' },
] as const

export default function Settings() {
  const me = useOutletContext<Me>()
  const parent = parentOf('settings', useViewport())
  const back = useBackOr(parent?.path ?? HOME)

  return (
    <main className="pantalla">
      <div className="cuerpo ajustes">
        <Boton variant="link" onClick={back}>
          {`‹ ${parent?.title ?? ''}`}
        </Boton>
        <div className="ajustes__titulos">
          <span className="encabezado__negocio ajustes__negocio">{me.business_name}</span>
          <h1 className="ajustes__titulo">Configuración</h1>
        </div>
        <nav className="ajustes__lista" aria-label="Configuración">
          {GROUPS.map((group) => (
            <Link key={group.to} to={group.to} state={{ inApp: true }} className="ajustes__item">
              <span className="ajustes__item-rotulo">{group.label}</span>
              <span className="ajustes__item-flecha">
                <Icono nombre="chevron" size={18} />
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  )
}
