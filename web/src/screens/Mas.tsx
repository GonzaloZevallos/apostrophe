/**
 * `Mas`: "+ Cargar gasto", Gastos and Análisis first, in the design's order
 * (`Mas.dc.html`), then the entries whose screens have not moved yet (Variedades,
 * Catálogo, Negocio), which leave with the issues that move them. Configuración is
 * not here: it joins in the diff that creates it, and no entry opens something that
 * does not exist. Paths come from `routes.ts`. The subtitles are the design's own
 * words; Negocio's is left out since its design subtitle ("La Huerta · 2 usuarios")
 * is data this screen has no route to fetch.
 */

import { Link } from 'react-router'
import Icono from '../components/Icono'
import { ANALYSIS, EXPENSE_NEW, EXPENSES } from '../routes'

interface Item {
  to: string
  label: string
  detail?: string
}

const ITEMS: Item[] = [
  {
    to: EXPENSE_NEW,
    label: '+ Cargar gasto',
    detail: 'Categoría, monto y detalle',
  },
  { to: EXPENSES, label: 'Gastos', detail: 'Por mes y por categoría' },
  {
    to: ANALYSIS,
    label: 'Análisis',
    detail: 'Variedades, semanas, meses y días',
  },
  {
    to: '/variedades',
    label: 'Variedades',
    detail: 'Precios y avisos de stock bajo',
  },
  {
    to: '/catalogo',
    label: 'Catálogo',
    detail: 'El mensaje de hoy, listo para copiar',
  },
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
              <span className="mas__item-flecha">
                <Icono nombre="chevron" size={18} />
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  )
}
