/**
 * `Mas`: Gastos, Variedades and Negocio — Análisis and Catálogo are not shown yet
 * (PRD, "Nada inventado"; they come with their own tasks). Each entry links to
 * where its own screen subtask mounts its route (`/gastos`, `/variedades`,
 * `/negocio`), already reserved in `contract.json`'s `frontSegments`. The fixed
 * subtitles are the design's own words (`Mas.dc.html`); Negocio's is left out since
 * its design subtitle ("La Huerta · 2 usuarios") is data this subtask has no route
 * to fetch.
 */

import { Link } from 'react-router'

interface Item {
  to: string
  label: string
  detail?: string
}

const ITEMS: Item[] = [
  { to: '/gastos', label: 'Gastos', detail: 'Por mes y por categoría' },
  { to: '/variedades', label: 'Variedades', detail: 'Precios y avisos de stock bajo' },
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
              <span className="mas__item-texto">
                <span className="mas__item-rotulo">{item.label}</span>
                {item.detail !== undefined && (
                  <span className="mas__item-detalle">{item.detail}</span>
                )}
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  )
}
