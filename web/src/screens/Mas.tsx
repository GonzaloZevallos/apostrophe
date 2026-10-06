/**
 * `Mas`: "+ Cargar gasto", Gastos and Análisis first, in the design's order
 * (`Mas.dc.html`), then the entries whose screens have not moved yet (Variedades,
 * Catálogo), which leave with the issues that move them, and Configuración last.
 * Paths come from `routes.ts`. The subtitles are the design's own words.
 * Every entry goes through `InAppLink`, which lets a card's back go through history.
 */

import InAppLink from '../components/InAppLink'
import Icono from '../components/Icono'
import { ANALYSIS, CATALOG, EXPENSES, EXPENSE_NEW, SETTINGS, VARIETIES } from '../routes'

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
    to: VARIETIES,
    label: 'Variedades',
    detail: 'Precios y avisos de stock bajo',
  },
  {
    to: CATALOG,
    label: 'Catálogo',
    detail: 'El mensaje de hoy, listo para copiar',
  },
  {
    to: SETTINGS,
    label: 'Configuración',
    detail: 'Negocio, usuarios, bot, catálogo, categorías, apariencia y tu cuenta',
  },
]

export default function Mas() {
  return (
    <main className="pantalla">
      <div className="cuerpo">
        <span className="encabezado__titulo">Más</span>
        <nav className="mas__lista" aria-label="Más">
          {ITEMS.map((item) => (
            <InAppLink
              key={item.to}
              to={item.to}
              className="mas__item"
            >
              <span className="mas__item-texto">
                <span className="mas__item-rotulo">{item.label}</span>
                {item.detail !== undefined && (
                  <span className="mas__item-detalle">{item.detail}</span>
                )}
              </span>
              <span className="mas__item-flecha">
                <Icono nombre="chevron" size={18} />
              </span>
            </InAppLink>
          ))}
        </nav>
      </div>
    </main>
  )
}
