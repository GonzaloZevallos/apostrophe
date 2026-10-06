/**
 * The bottom bar on the phone, the side rail on a computer (plan, "Shell";
 * `componentes.ts`'s `Destino`); CSS alone switches between them (`styles/app.css`).
 * Only destinations that exist show (PRD, "Nada inventado"; metric M5). Each entry
 * says where it shows (`placement`) and, for the rail, which group it belongs to
 * (`group`): the bar is Inicio, Ventas, Clientes, Stock and Más; the rail is the same
 * four, a divider, then Gastos, Análisis and Más, as `GastosCompu.dc.html` draws the
 * sidebar. Más stays on the rail until the issue that empties it removes it, in the
 * same diff, so nothing a seller reaches today through Más is lost; Gastos and
 * Análisis never depend on it.
 *
 * Everything the shell decides comes from the leaf route's registry entry (`routes.ts`),
 * found through the route's `handle.screen`: its kind sets the chrome (a root shows the
 * bar and "+ Nueva venta", a card the bar alone, a form neither), and `placeOf(id,
 * viewport)` says which entry each surface marks. Never the pathname, never history, so a
 * reload or a saved link marks the same entry. At most one entry per surface carries
 * `aria-current="page"`, and it is also bold and, in the rail, filled: never color alone.
 * The bar marks with `placeOf(id, 'phone').bar`, the rail with `placeOf(id, 'computer').rail`,
 * since both are in the DOM and CSS picks one.
 *
 * `useOutletContext` passes `me` on to whatever the active route renders, so none of them
 * has to re-run `GET /auth/me`.
 */

import { Fragment } from 'react'
import { Link, Outlet, useMatches, useOutletContext } from 'react-router'
import type { Me } from '../api/me'
import Icono, { type NombreIcono } from '../components/Icono'
import {
  ANALYSIS,
  EXPENSES,
  HOME,
  isScreenId,
  MORE,
  placeOf,
  SALE_NEW,
  SALES,
  screenOf,
  CUSTOMERS,
  SETTINGS,
  STOCK,
  type RailPlace,
  type Screen,
} from '../routes'
import { initialsOf } from './initials'

type Placement = 'bar' | 'rail' | 'both'

/** `main` entries sit above the rail's divider with their icon, `more` ones below it. */
type Group = 'main' | 'more'

interface Item {
  to: string
  label: string
  /** The bar's glyph; the rail draws one only above its divider (`GastosCompu.dc.html`). */
  icono?: NombreIcono
  placement: Placement
  group: Group
  /** The place a screen's registry entry names when this entry is the one to mark. */
  place: RailPlace
}

const ITEMS: Item[] = [
  { to: HOME, label: 'Inicio', icono: 'inicio', placement: 'both', group: 'main', place: 'home' },
  { to: SALES, label: 'Ventas', icono: 'ventas', placement: 'both', group: 'main', place: 'sales' },
  {
    to: CUSTOMERS,
    label: 'Clientes',
    icono: 'clientes',
    placement: 'both',
    group: 'main',
    place: 'customers',
  },
  { to: STOCK, label: 'Stock', icono: 'stock', placement: 'both', group: 'main', place: 'varieties' },
  { to: EXPENSES, label: 'Gastos', placement: 'rail', group: 'more', place: 'expenses' },
  { to: ANALYSIS, label: 'Análisis', placement: 'rail', group: 'more', place: 'analysis' },
  { to: MORE, label: 'Más', icono: 'mas', placement: 'both', group: 'more', place: 'more' },
]

const BAR_ITEMS = ITEMS.filter((item) => item.placement !== 'rail')
const RAIL_ITEMS = ITEMS.filter((item) => item.placement !== 'bar')

/** The registry entry of the leaf route: the deepest match that names a screen. */
function leafScreen(matches: readonly { handle: unknown }[]): Screen {
  for (const match of [...matches].reverse()) {
    const { handle } = match
    if (typeof handle === 'object' && handle !== null && 'screen' in handle && isScreenId(handle.screen)) {
      return screenOf(handle.screen)
    }
  }
  throw new Error('Shell: the leaf route does not declare a screen (routes.ts)')
}

function railClassName(item: Item, active: boolean): string {
  const base =
    item.group === 'more'
      ? 'riel-lateral__item riel-lateral__item--secundario'
      : 'riel-lateral__item'
  return active ? `${base} riel-lateral__item--activo` : base
}

/** One bottom-bar entry; `active` is the registry's mark, not a path comparison. */
function BarItem({ item, active }: { item: Item; active: boolean }) {
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={active ? 'bar-inferior__item bar-inferior__item--activo' : 'bar-inferior__item'}
    >
      {item.icono !== undefined && <Icono nombre={item.icono} />}
      <span>{item.label}</span>
    </Link>
  )
}

export default function Shell() {
  const me = useOutletContext<Me>()
  const leaf = leafScreen(useMatches())
  const barPlace = placeOf(leaf.id, 'phone').bar
  const railPlace = placeOf(leaf.id, 'computer').rail
  const showNuevaVenta = leaf.kind === 'root'
  const showBar = leaf.kind !== 'form'

  return (
    <div className="disposicion">
      <nav className="riel-lateral" aria-label="Navegación">
        {showNuevaVenta && (
          <Link to={SALE_NEW} className="boton boton-nueva-venta--escritorio">
            <Icono nombre="agregar" size={19} strokeWidth={2} />
            Nueva venta
          </Link>
        )}
        {RAIL_ITEMS.map((item, index) => {
          const active = railPlace === item.place
          return (
            <Fragment key={item.to}>
              {index > 0 && RAIL_ITEMS[index - 1]?.group !== item.group && (
                <div role="separator" className="riel-lateral__divisor" />
              )}
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={railClassName(item, active)}
              >
                {item.group === 'main' && item.icono !== undefined && <Icono nombre={item.icono} />}
                {item.label}
              </Link>
            </Fragment>
          )
        })}
        <Link
          to={SETTINGS}
          state={{ inApp: true }}
          aria-label={`Configuración de ${me.business_name}`}
          aria-current={railPlace === 'business' ? 'page' : undefined}
          className={
            railPlace === 'business'
              ? 'riel-lateral__negocio riel-lateral__negocio--activo'
              : 'riel-lateral__negocio'
          }
        >
          <span className="riel-lateral__avatar" aria-hidden="true">
            {initialsOf(me.business_name)}
          </span>
          <span className="riel-lateral__negocio-nombre">{me.business_name}</span>
        </Link>
      </nav>
      <div className="columna-principal">
        <Outlet context={me} />
        {showNuevaVenta && (
          <Link to={SALE_NEW} className="boton boton-nueva-venta">
            <Icono nombre="agregar" size={19} strokeWidth={2} />
            Nueva venta
          </Link>
        )}
        {showBar && (
          <nav className="bar-inferior" aria-label="Navegación">
            {BAR_ITEMS.map((item) => (
              <BarItem key={item.to} item={item} active={barPlace === item.place} />
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}
