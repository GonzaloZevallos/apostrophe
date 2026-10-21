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
import { SETTINGS_TEXT } from '../copy/settings'
import { COMMON_TEXT } from '../copy/common'

interface Item {
  to: string
  label: string
  icon: NombreIcono
  detail?: string
}

const ITEMS: Item[] = [
  {
    to: EXPENSE_NEW,
    label: COMMON_TEXT.addExpense,
    icon: 'agregar',
    detail: SETTINGS_TEXT.categoriaMontoYDetalle,
  },
  {
    to: WITHDRAWAL_NEW,
    label: COMMON_TEXT.takeFromStock,
    icon: 'salidaStock',
    detail: SETTINGS_TEXT.promocionOConsumoPropio,
  },
  { to: EXPENSES, label: COMMON_TEXT.expenses, icon: 'gastos', detail: SETTINGS_TEXT.porMesYPor },
  {
    to: ANALYSIS,
    label: COMMON_TEXT.analysis,
    icon: 'analisis',
    detail: SETTINGS_TEXT.variedadesSemanasMesesY,
  },
  {
    to: SETTINGS,
    label: COMMON_TEXT.settings,
    icon: 'configuracion',
    detail: SETTINGS_TEXT.negocioUsuariosBotCatalogo,
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
        <span className="encabezado__titulo">{COMMON_TEXT.more}</span>
        <nav className="mas__lista" aria-label={COMMON_TEXT.more} data-menu>
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
