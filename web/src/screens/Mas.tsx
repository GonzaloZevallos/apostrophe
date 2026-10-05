/**
 * `Mas`: Gastos, Variedades, Catálogo, Análisis and Negocio. Each entry links to
 * where its own screen subtask mounts its route (`/gastos`, `/variedades`,
 * `/catalogo`, `/analisis`, `/negocio`), already reserved in `contract.json`'s
 * `frontSegments`. The fixed subtitles are the design's own words (`Mas.dc.html`);
 * Análisis's is the plan's own line ("Análisis · Variedades, semanas, meses y
 * días"); Negocio's is left out since its design subtitle ("La Huerta · 2 usuarios")
 * is data this subtask has no route to fetch.
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
  { to: '/catalogo', label: 'Catálogo', detail: 'El mensaje de hoy, listo para copiar' },
  { to: '/analisis', label: 'Análisis', detail: 'Variedades, semanas, meses y días' },
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
