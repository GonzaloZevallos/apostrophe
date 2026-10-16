/**
 * The bottom bar on the phone, the side rail on a computer (`componentes.ts`'s `Destino`);
 * CSS alone switches between them (`styles/app.css`). Only destinations that exist show.
 * The bar is Inicio, Ventas, Clientes, Variedades and Más; the rail is "+ Nueva venta", the
 * same first four, a divider, Gastos and Análisis, and the business row (avatar and name) at
 * the bottom, which opens Configuración. There is no Más on a computer.
 *
 * Everything the shell decides comes from the leaf route's registry entry (`routes.ts`),
 * found through the route's `handle.screen`: `chromeOf` (`chrome.ts`) turns it into the
 * chrome (a root shows the bar and "+ Nueva venta", a card the bar and a "‹ parent" arrow, a
 * form neither; the rail goes only for a registry `modalOnComputer`), and
 * `placeOf(id, viewport)` says which entry each surface marks. Never the pathname, never
 * history, so a reload or a saved link marks the same entry. At most one entry per surface
 * carries `aria-current="page"`, and it is also bold and drawn filled and underlined (or, on
 * the rail, with its accent rule): never color alone. The bar marks with `placeOf(id,
 * 'phone').bar`, the rail with `placeOf(id, 'computer').rail`, since both are in the DOM and
 * CSS picks one.
 *
 * `useOutletContext` passes `me` on to whatever the active route renders, so none of them
 * has to re-run `GET /auth/me`.
 */

import { Fragment } from 'react'
import { Link, Outlet, useMatches, useOutletContext } from 'react-router'
import type { Me } from '../api/me'
import Icono, { type NombreIcono } from '../components/Icono'
import InAppLink from '../components/InAppLink'
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
  VARIETIES,
  type RailPlace,
  type Screen,
} from '../routes'
import BotonLink from '../components/BotonLink'
import { NUEVA_VENTA_CLASS, NUEVA_VENTA_ESCRITORIO_CLASS } from '../components/botonVisual'
import BackArrow from './BackArrow'
import { chromeOf } from './chrome'
import { initialsOf } from './initials'
import { useViewport } from './useViewport'

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
  {
    to: VARIETIES,
    label: 'Variedades',
    icono: 'variedades',
    placement: 'both',
    group: 'main',
    place: 'varieties',
  },
  { to: EXPENSES, label: 'Gastos', icono: 'gastos', placement: 'rail', group: 'more', place: 'expenses' },
  { to: ANALYSIS, label: 'Análisis', icono: 'analisis', placement: 'rail', group: 'more', place: 'analysis' },
  { to: MORE, label: 'Más', icono: 'mas', placement: 'bar', group: 'more', place: 'more' },
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
  const chrome = chromeOf(leaf, useViewport())

  return (
    <div className="disposicion">
      {chrome.rail && (
        <nav className="riel-lateral" aria-label="Navegación" data-menu>
          {chrome.railNuevaVenta && (
            <BotonLink to={SALE_NEW} icon="agregar" className={NUEVA_VENTA_ESCRITORIO_CLASS}>
              Nueva venta
            </BotonLink>
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
                  {item.icono !== undefined && <Icono nombre={item.icono} />}
                  {item.label}
                </Link>
              </Fragment>
            )
          })}
          <InAppLink
            to={SETTINGS}
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
          </InAppLink>
        </nav>
      )}
      <div className="columna-principal">
        {chrome.backArrow && <BackArrow id={leaf.id} />}
        <Outlet context={me} />
        {chrome.barNuevaVenta && (
          <BotonLink to={SALE_NEW} icon="agregar" className={NUEVA_VENTA_CLASS}>
            Nueva venta
          </BotonLink>
        )}
        {chrome.bar && (
          <nav className="bar-inferior" aria-label="Navegación" data-menu>
            {BAR_ITEMS.map((item) => (
              <BarItem key={item.to} item={item} active={barPlace === item.place} />
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}
