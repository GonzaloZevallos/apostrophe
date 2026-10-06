/**
 * `Settings`, the list of Configuración's seven groups (`Configuracion.dc.html` on the
 * phone, `ConfiguracionCompu.dc.html` on a computer): a card route, so the bar or the
 * rail shows and "+ Nueva venta" does not. Nothing else is listed (no language, no
 * placeholder): a group that does not exist is not drawn.
 *
 * Every link carries `state: { inApp: true }`, which is what lets a group's "Cerrar" and
 * this list's back go through history (`useBackOr`). Back's fallback parent is Más on the
 * phone (`MORE_PATH`, one constant) and Inicio on a computer; this file's one media query
 * decides which, and also the arrow's word.
 */

import { useSyncExternalStore } from 'react'
import { Link, useOutletContext } from 'react-router'
import type { Me } from '../../api/me'
import Boton from '../../components/Boton'
import Icono from '../../components/Icono'
import { useBackOr } from '../../components/useBackOr'
import { EXPENSE_CATEGORIES, MORE } from '../../routes'

/** The route the phone's Más tab lives at (`routes.ts`). */
export const MORE_PATH = MORE
const HOME_PATH = '/'
const COMPUTER_QUERY = '(min-width: 900px)'

const GROUPS = [
  { to: '/settings/business', label: 'Negocio' },
  { to: '/settings/users', label: 'Usuarios' },
  { to: '/settings/integrations', label: 'Integraciones' },
  { to: '/settings/catalog-message', label: 'Mensaje del catálogo' },
  { to: EXPENSE_CATEGORIES, label: 'Categorías de gastos' },
  { to: '/settings/appearance', label: 'Apariencia' },
  { to: '/settings/account', label: 'Tu cuenta' },
] as const

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined
  const query = window.matchMedia(COMPUTER_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function isComputer(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(COMPUTER_QUERY).matches
}

export default function Settings() {
  const me = useOutletContext<Me>()
  const computer = useSyncExternalStore(subscribe, isComputer)
  const back = useBackOr(computer ? HOME_PATH : MORE_PATH)

  return (
    <main className="pantalla">
      <div className="cuerpo ajustes">
        <Boton variant="link" onClick={back}>
          {computer ? '‹ Inicio' : '‹ Más'}
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
