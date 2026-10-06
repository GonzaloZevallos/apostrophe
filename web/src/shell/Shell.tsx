/**
 * The bottom bar on the phone, the side rail on a computer (plan, "Shell";
 * `componentes.ts`'s `Destino`); CSS alone switches between them (`styles/app.css`).
 * Only destinations that exist show (PRD, "Nada inventado"; metric M5). Each entry
 * says where it shows (`placement`) and, for the rail, which group it belongs to
 * (`group`): the bar is Inicio, Ventas, Clientes, Stock and Más; the rail is the same
 * four, a divider, then Gastos, Análisis and Más, as `GastosCompu.dc.html` draws the
 * sidebar. Más stays on the rail until the issue that empties it removes it, in the
 * same diff, so nothing a seller reaches today through Más is lost; Gastos and
 * Análisis never depend on it. Paths of the screens that moved come from `routes.ts`.
 *
 * Active state, per surface, at most one entry each (`aria-current="page"`): the rail
 * marks its entry by path alone (`NavLink`), so `/expenses/new` marks Gastos; the bar
 * marks Más for the screens reached from it through `barActiveTab(matches)`, the
 * deepest `handle.tab`, and with none declared falls back to the path. The active
 * entry is also bold and, in the rail, filled: never color alone.
 *
 * `useOutletContext` passes `me` on to whatever the active
 * route renders (`Inicio` first; the screen subtasks' routes next), so none of them
 * has to re-run `GET /auth/me`.
 *
 * Chrome comes only from the route (plan, invariants: "Only `Shell.tsx` decides
 * whether the bottom bar and the 'Nueva venta' button render, from route
 * `handle.chrome` read with `useMatches()`; no pathname comparison decides it").
 * `useMatches()` returns the whole match chain root to leaf; the deepest one that
 * declares `handle.chrome` wins, so a parent's absence of a handle never
 * overrides a child's. `'none'` hides the fixed "Nueva venta" button everywhere,
 * and on the phone also drops the bottom bar outright — `NuevaVenta`'s own
 * `/ventas/nueva` and `VentaDetalle`'s `/ventas/:id` are the two routes that set
 * it (`router.tsx`). The side rail's destinations never disappear on the
 * computer: only its button does (plan, "Chrome"). `'card'` (Configuración's list) is
 * the third case: the bar or the rail stays and only "+ Nueva venta" goes.
 */

import { Fragment } from 'react'
import {
  Link,
  matchPath,
  NavLink,
  Outlet,
  useLocation,
  useMatches,
  useOutletContext,
} from 'react-router'
import type { Me } from '../api/me'
import Icono, { type NombreIcono } from '../components/Icono'
import { ANALYSIS, EXPENSES, MORE } from '../routes'
import { barActiveTab } from './barActiveTab'
import { initialsOf } from './initials'

const SETTINGS_PATH = '/settings'

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
  /** The `handle.tab` a route declares to mark this entry on the bar. */
  tab?: string
}

const ITEMS: Item[] = [
  {
    to: '/',
    label: 'Inicio',
    icono: 'inicio',
    placement: 'both',
    group: 'main',
  },
  {
    to: '/ventas',
    label: 'Ventas',
    icono: 'ventas',
    placement: 'both',
    group: 'main',
  },
  {
    to: '/clientes',
    label: 'Clientes',
    icono: 'clientes',
    placement: 'both',
    group: 'main',
  },
  {
    to: '/mi-stock',
    label: 'Stock',
    icono: 'stock',
    placement: 'both',
    group: 'main',
  },
  { to: EXPENSES, label: 'Gastos', placement: 'rail', group: 'more' },
  { to: ANALYSIS, label: 'Análisis', placement: 'rail', group: 'more' },
  {
    to: MORE,
    label: 'Más',
    icono: 'mas',
    placement: 'both',
    group: 'more',
    tab: 'more',
  },
]

const BAR_ITEMS = ITEMS.filter((item) => item.placement !== 'rail')
const RAIL_ITEMS = ITEMS.filter((item) => item.placement !== 'bar')

const NUEVA_VENTA_PATH = '/ventas/nueva'

type Chrome = 'none' | 'card'

function chromeOf(handle: unknown): Chrome | undefined {
  if (typeof handle !== 'object' || handle === null || !('chrome' in handle)) return undefined
  return handle.chrome === 'none' || handle.chrome === 'card' ? handle.chrome : undefined
}

/** The deepest match that declares `handle.chrome` wins — walk from the leaf
 * backwards and stop at the first one that has it. */
function chromeFromMatches(matches: readonly { handle: unknown }[]): Chrome | undefined {
  for (const match of [...matches].reverse()) {
    const chrome = chromeOf(match.handle)
    if (chrome !== undefined) return chrome
  }
  return undefined
}

function railClassName(item: Item): (state: { isActive: boolean }) => string {
  const base =
    item.group === 'more'
      ? 'riel-lateral__item riel-lateral__item--secundario'
      : 'riel-lateral__item'
  return ({ isActive }) => (isActive ? `${base} riel-lateral__item--activo` : base)
}

/** One bottom-bar entry. `Link`, not `NavLink`: with a `handle.tab` declared the bar
 * marks the entry the route names, whatever the path, and `NavLink` only knows paths. */
function BarItem({ item, tab }: { item: Item; tab: string | undefined }) {
  const { pathname } = useLocation()
  const active =
    tab !== undefined
      ? item.tab === tab
      : matchPath({ path: item.to, end: item.to === '/' }, pathname) !== null
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
  const matches = useMatches()
  const chrome = chromeFromMatches(matches)
  const tab = barActiveTab(matches)
  const showNuevaVenta = chrome === undefined

  return (
    <div className="disposicion">
      <nav className="riel-lateral" aria-label="Navegación">
        {showNuevaVenta && (
          <Link to={NUEVA_VENTA_PATH} className="boton boton-nueva-venta--escritorio">
            <Icono nombre="agregar" size={19} strokeWidth={2} />
            Nueva venta
          </Link>
        )}
        {RAIL_ITEMS.map((item, index) => (
          <Fragment key={item.to}>
            {index > 0 && RAIL_ITEMS[index - 1]?.group !== item.group && (
              <div role="separator" className="riel-lateral__divisor" />
            )}
            <NavLink to={item.to} end={item.to === '/'} className={railClassName(item)}>
              {item.group === 'main' && item.icono !== undefined && <Icono nombre={item.icono} />}
              {item.label}
            </NavLink>
          </Fragment>
        ))}
        <NavLink
          to={SETTINGS_PATH}
          state={{ inApp: true }}
          aria-label={`Configuración de ${me.business_name}`}
          className={({ isActive }) =>
            isActive ? 'riel-lateral__negocio riel-lateral__negocio--activo' : 'riel-lateral__negocio'
          }
        >
          <span className="riel-lateral__avatar" aria-hidden="true">
            {initialsOf(me.business_name)}
          </span>
          <span className="riel-lateral__negocio-nombre">{me.business_name}</span>
        </NavLink>
      </nav>
      <div className="columna-principal">
        <Outlet context={me} />
        {showNuevaVenta && (
          <Link to={NUEVA_VENTA_PATH} className="boton boton-nueva-venta">
            <Icono nombre="agregar" size={19} strokeWidth={2} />
            Nueva venta
          </Link>
        )}
        {chrome !== 'none' && (
          <nav className="bar-inferior" aria-label="Navegación">
            {BAR_ITEMS.map((item) => (
              <BarItem key={item.to} item={item} tab={tab} />
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}
