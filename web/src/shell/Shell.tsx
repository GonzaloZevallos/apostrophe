/**
 * The bottom bar on the phone, the side rail on a computer (plan, "Shell";
 * `componentes.ts`'s `Destino`); CSS alone switches between them (`styles/app.css`).
 * Only destinations that exist show (PRD, "Nada inventado"; metric M5): Inicio,
 * Ventas, Clientes, Stock and Más, in the design's own order (`Inicio.dc.html`,
 * `InicioCompu.dc.html`: Inicio, Ventas, Clientes, Stock, Más on both bars; PRD,
 * "the design wins" on tab order).
 * `useOutletContext` passes `me` on to whatever the active
 * route renders (`Inicio` first; the screen subtasks' routes next), so none of them
 * has to re-run `GET /auth/me`.
 *
 * The fixed "Nueva venta" button (accounts.md, "Shell") is separate from the tabs —
 * it never gets the active-item treatment and isn't one of `ITEMS` — and shows on
 * every signed-in screen except the sale form itself and its customer sheet. The
 * sheet (`NuevaVentaCliente`) is never a route of its own (`router.tsx`): it opens
 * over `NuevaVenta`'s own `/ventas/nueva`, so hiding the button on that one
 * pathname covers both without this component needing to know the sheet exists.
 */

import { Link, NavLink, Outlet, useLocation, useOutletContext } from 'react-router'
import type { Me } from '../api/me'

interface Item {
  to: string
  label: string
}

const ITEMS: Item[] = [
  { to: '/', label: 'Inicio' },
  { to: '/ventas', label: 'Ventas' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/mi-stock', label: 'Stock' },
  { to: '/mas', label: 'Más' },
]

const NUEVA_VENTA_PATH = '/ventas/nueva'

function className(base: string): (state: { isActive: boolean }) => string {
  return ({ isActive }) => (isActive ? `${base} ${base}--activo` : base)
}

export default function Shell() {
  const me = useOutletContext<Me>()
  const location = useLocation()
  const showNuevaVenta = location.pathname !== NUEVA_VENTA_PATH

  return (
    <div className="disposicion">
      <nav className="riel-lateral" aria-label="Navegación">
        {showNuevaVenta && (
          <Link to={NUEVA_VENTA_PATH} className="boton boton-nueva-venta--escritorio">
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
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="columna-principal">
        <Outlet context={me} />
        {showNuevaVenta && (
          <Link to={NUEVA_VENTA_PATH} className="boton boton-nueva-venta">
            Nueva venta
          </Link>
        )}
        <nav className="bar-inferior" aria-label="Navegación">
          {ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={className('bar-inferior__item')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
