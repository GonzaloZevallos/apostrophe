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
import { COMMON_TEXT } from '../../copy/common'
import { INTEGRATIONS_LINK_WORD } from '../../copy/pinnedCatalog'

const GROUPS: readonly { to: string; label: string; icon: NombreIcono }[] = [
  { to: SETTINGS_BUSINESS, label: COMMON_TEXT.business, icon: 'negocio' },
  { to: SETTINGS_USERS, label: COMMON_TEXT.users, icon: 'usuarios' },
  { to: SETTINGS_PRICES, label: COMMON_TEXT.prices, icon: 'precio' },
  { to: SETTINGS_INTEGRATIONS, label: INTEGRATIONS_LINK_WORD, icon: 'integraciones' },
  { to: SETTINGS_CATALOG_MESSAGE, label: COMMON_TEXT.catalogMessage, icon: 'mensaje' },
  { to: EXPENSE_CATEGORIES, label: COMMON_TEXT.expenseCategories, icon: 'categorias' },
  { to: SETTINGS_APPEARANCE, label: COMMON_TEXT.appearance, icon: 'apariencia' },
  { to: SETTINGS_ACCOUNT, label: COMMON_TEXT.yourAccount, icon: 'cuenta' },
]

export default function Settings() {
  const me = useOutletContext<Me>()

  return (
    <main className="pantalla">
      <div className="cuerpo ajustes">
        <div className="ajustes__titulos">
          <span className="encabezado__negocio ajustes__negocio">{me.business_name}</span>
          <h1 className="ajustes__titulo">{COMMON_TEXT.settings}</h1>
        </div>
        <nav className="ajustes__lista" aria-label={COMMON_TEXT.settings} data-menu>
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
