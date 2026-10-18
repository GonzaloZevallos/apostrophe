/**
 * `Settings`, the list of Configuración's eight groups (`Configuracion.dc.html` on the
 * phone, `ConfiguracionCompu.dc.html` on a computer): a card route, so the bar or the
 * rail shows and "+ Nueva venta" does not. Nothing else is listed (no language, no
 * placeholder): a group that does not exist is not drawn.
 *
 * Every link goes through `InAppLink`, which is what lets a group's "Cerrar" and
 * this list's back go through history (`useBackOr`). The "‹ parent" arrow is the shell's
 * (`shell/BackArrow.tsx`): Más on the phone, Inicio on a computer.
 */

import { useOutletContext } from 'react-router'
import type { Me } from '../../api/me'
import Icono, { type NombreIcono } from '../../components/Icono'
import InAppLink from '../../components/InAppLink'
import {
  EXPENSE_CATEGORIES,
  SETTINGS_ACCOUNT,
  SETTINGS_APPEARANCE,
  SETTINGS_BUSINESS,
  SETTINGS_CATALOG_MESSAGE,
  SETTINGS_INTEGRATIONS,
  SETTINGS_PRICES,
  SETTINGS_USERS,
} from '../../routes'
import {
  GROUP_ACCOUNT,
  GROUP_APPEARANCE,
  GROUP_BUSINESS,
  GROUP_CATALOG_MESSAGE,
  GROUP_EXPENSE_CATEGORIES,
  GROUP_INTEGRATIONS,
  GROUP_PRICES,
  GROUP_USERS,
  SETTINGS_TITLE,
} from '../../copy/settings'

const GROUPS: readonly { to: string; label: string; icon: NombreIcono }[] = [
  { to: SETTINGS_BUSINESS, label: GROUP_BUSINESS, icon: 'negocio' },
  { to: SETTINGS_USERS, label: GROUP_USERS, icon: 'usuarios' },
  { to: SETTINGS_PRICES, label: GROUP_PRICES, icon: 'precio' },
  { to: SETTINGS_INTEGRATIONS, label: GROUP_INTEGRATIONS, icon: 'integraciones' },
  { to: SETTINGS_CATALOG_MESSAGE, label: GROUP_CATALOG_MESSAGE, icon: 'mensaje' },
  { to: EXPENSE_CATEGORIES, label: GROUP_EXPENSE_CATEGORIES, icon: 'categorias' },
  { to: SETTINGS_APPEARANCE, label: GROUP_APPEARANCE, icon: 'apariencia' },
  { to: SETTINGS_ACCOUNT, label: GROUP_ACCOUNT, icon: 'cuenta' },
]

export default function Settings() {
  const me = useOutletContext<Me>()

  return (
    <main className="pantalla">
      <div className="cuerpo ajustes">
        <div className="ajustes__titulos">
          <span className="encabezado__negocio ajustes__negocio">{me.business_name}</span>
          <h1 className="ajustes__titulo">{SETTINGS_TITLE}</h1>
        </div>
        <nav className="ajustes__lista" aria-label={SETTINGS_TITLE} data-menu>
          {GROUPS.map((group) => (
            <InAppLink key={group.to} to={group.to} className="ajustes__item">
              <span className="ajustes__item-icono">
                <Icono nombre={group.icon} />
              </span>
              <span className="ajustes__item-rotulo">{group.label}</span>
              <span className="ajustes__item-flecha">
                <Icono nombre="chevron" />
              </span>
            </InAppLink>
          ))}
        </nav>
      </div>
    </main>
  )
}
