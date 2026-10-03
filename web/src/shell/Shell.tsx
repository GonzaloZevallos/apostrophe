/**
 * The bottom bar on the phone, the side rail on a computer (plan, "Shell";
 * `componentes.ts`'s `Destino`); CSS alone switches between them (`styles/app.css`).
 * Only destinations that exist show (PRD, "Nada inventado"; metric M5): Inicio,
 * Clientes, Stock and Más, no Ventas yet (its own screen task). `useOutletContext` passes `me` on to
 * whatever the active route renders (`Inicio` first; the screen subtasks' routes
 * next), so none of them has to re-run `GET /auth/me`.
 */

import { NavLink, Outlet, useOutletContext } from 'react-router'
import type { Me } from '../api/me'

interface Item {
  to: string
  label: string
}

const ITEMS: Item[] = [
  { to: '/', label: 'Inicio' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/mi-stock', label: 'Stock' },
  { to: '/mas', label: 'Más' },
]

function className(base: string): (state: { isActive: boolean }) => string {
  return ({ isActive }) => (isActive ? `${base} ${base}--activo` : base)
}

export default function Shell() {
  const me = useOutletContext<Me>()
  return (
    <div className="disposicion">
      <nav className="riel-lateral" aria-label="Navegación">
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
