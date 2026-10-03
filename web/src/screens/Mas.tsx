/**
 * `Mas`: Gastos, Variedades and Negocio — Análisis and Catálogo are not shown yet
 * (PRD, "Nada inventado"; they come with their own tasks). Each entry links to
 * where its own screen subtask mounts its route (`/gastos`, `/variedades`,
 * `/negocio`), already reserved in `contract.json`'s `frontSegments`.
 */

import { Link } from 'react-router'

interface Item {
  to: string
  label: string
}

const ITEMS: Item[] = [
  { to: '/gastos', label: 'Gastos' },
  { to: '/variedades', label: 'Variedades' },
  { to: '/negocio', label: 'Negocio' },
]

export default function Mas() {
  return (
    <main className="pantalla">
      <div className="cuerpo">
        <span className="encabezado__titulo">Más</span>
        <nav className="mas__lista" aria-label="Más">
          {ITEMS.map((item) => (
            <Link key={item.to} to={item.to} className="mas__item">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  )
}
