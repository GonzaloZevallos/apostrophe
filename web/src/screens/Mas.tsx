/**
 * `Mas`: "Cargar gasto" (the docs' "+ Cargar gasto": the `agregar` icon is the plus), "Sacar del stock" (the withdrawal form), Gastos, Análisis and
 * Configuración, in the design's order (`Mas.dc.html`) and nothing else (navigation.md):
 * Variedades is a bar tab, and the catalog is reached from it.
 * Paths come from `routes.ts`. The subtitles are the design's own words.
 * Every entry goes through `InAppLink`, which lets a card's back go through history.
 */

import InAppLink from '../components/InAppLink'
import Icono, { type NombreIcono } from '../components/Icono'
import { ANALYSIS, EXPENSES, EXPENSE_NEW, SETTINGS, WITHDRAWAL_NEW } from '../routes'

interface Item {
  to: string
  label: string
  icon: NombreIcono
  detail?: string
}

const ITEMS: Item[] = [
  {
    to: EXPENSE_NEW,
    label: 'Cargar gasto',
    icon: 'agregar',
    detail: 'Categoría, monto y detalle',
  },
  {
    to: WITHDRAWAL_NEW,
    label: 'Sacar del stock',
    icon: 'salidaStock',
    detail: 'Promoción o consumo propio',
  },
  { to: EXPENSES, label: 'Gastos', icon: 'gastos', detail: 'Por mes y por categoría' },
  {
    to: ANALYSIS,
    label: 'Análisis',
    icon: 'analisis',
    detail: 'Variedades, semanas, meses y días',
  },
  {
    to: SETTINGS,
    label: 'Configuración',
    icon: 'configuracion',
    detail: 'Negocio, usuarios, bot, catálogo, categorías, apariencia y tu cuenta',
  },
]

/**
 * The docs' "+ Cargar gasto" stands for the `agregar` icon, which draws the plus: the screen
 * shows the word alone, and the accessible name keeps the "+" (icon-and-text-rule.md,
 * criterion 5). It is built from the item's own fields, so the two cannot drift. An entry
 * with another icon is named by its content, as before.
 */
function accessibleName(item: Item): string | undefined {
  if (item.icon !== 'agregar') return undefined
  return `+ ${item.label}${item.detail === undefined ? '' : ` ${item.detail}`}`
}

export default function Mas() {
  return (
    <main className="pantalla">
      <div className="cuerpo">
        <span className="encabezado__titulo">Más</span>
        <nav className="mas__lista" aria-label="Más" data-menu>
          {ITEMS.map((item) => (
            <InAppLink
              key={item.to}
              to={item.to}
              className="mas__item"
              aria-label={accessibleName(item)}
            >
              <span className="mas__item-icono">
                <Icono nombre={item.icon} />
              </span>
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
