/**
 * The bottom bar on the phone, the side rail on a computer (plan, "Shell";
 * `componentes.ts`'s `Destino`); CSS alone switches between them (`styles/app.css`).
 * Only destinations that exist show (PRD, "Nada inventado"; metric M5): Inicio,
 * Ventas, Clientes, Stock and Más, in the design's own order (`Inicio.dc.html`,
 * `InicioCompu.dc.html`: Inicio, Ventas, Clientes, Stock, Más on both bars; PRD,
 * "the design wins" on tab order) — no Análisis and no extra rail entries, even
 * though `InicioCompu.dc.html` itself draws Gastos/Análisis/Catálogo/Variedades/
 * Negocio below a divider (plan, invariants: "the rail always list exactly
 * Inicio, Ventas, Clientes, Stock and Más").
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

import { Link, NavLink, Outlet, useMatches, useOutletContext } from 'react-router'
import type { Me } from '../api/me'
import Icono, { type NombreIcono } from '../components/Icono'

interface Item {
  to: string
  label: string
  icono: NombreIcono
}

const ITEMS: Item[] = [
  { to: '/', label: 'Inicio', icono: 'inicio' },
  { to: '/ventas', label: 'Ventas', icono: 'ventas' },
  { to: '/clientes', label: 'Clientes', icono: 'clientes' },
  { to: '/mi-stock', label: 'Stock', icono: 'stock' },
  { to: '/mas', label: 'Más', icono: 'mas' },
]

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

function className(base: string): (state: { isActive: boolean }) => string {
  return ({ isActive }) => (isActive ? `${base} ${base}--activo` : base)
}

export default function Shell() {
  const me = useOutletContext<Me>()
  const matches = useMatches()
  const chrome = chromeFromMatches(matches)
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
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={className('riel-lateral__item')}
          >
            <Icono nombre={item.icono} />
            {item.label}
          </NavLink>
        ))}
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
            {ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={className('bar-inferior__item')}
              >
                <Icono nombre={item.icono} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}
