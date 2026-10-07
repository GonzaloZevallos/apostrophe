/**
 * `Mas`: "+ Cargar gasto", "Sacar del stock" (the withdrawal form), Gastos, Análisis and
 * Configuración, in the design's order (`Mas.dc.html`) and nothing else (navigation.md):
 * Variedades is a bar tab, and the catalog is reached from it.
 * Paths come from `routes.ts`. The subtitles are the design's own words.
 * Every entry goes through `InAppLink`, which lets a card's back go through history.
 */

import InAppLink from '../components/InAppLink'
import Icono from '../components/Icono'
import { ANALYSIS, EXPENSES, EXPENSE_NEW, SETTINGS, WITHDRAWAL_NEW } from '../routes'

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
  {
    to: WITHDRAWAL_NEW,
    label: 'Sacar del stock',
    detail: 'Promoción o consumo propio',
  },
  { to: EXPENSES, label: 'Gastos', detail: 'Por mes y por categoría' },
  {
    to: ANALYSIS,
    label: 'Análisis',
    detail: 'Variedades, semanas, meses y días',
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
                <Icono nombre="chevron" />
              </span>
            </InAppLink>
          ))}
        </nav>
      </div>
    </main>
  )
}
