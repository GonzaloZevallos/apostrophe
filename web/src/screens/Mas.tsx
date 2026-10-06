/**
 * `Mas` (phone): "+ Cargar gasto", Gastos, Análisis and Configuración, in that order
 * and nothing else (`navigation.md`, "Más"). Catálogo, Variedades and Negocio left:
 * the catalog screen opens from Variedades, Configuración holds the business. Every
 * route comes from `paths`. The subtitles are the design's own words (`Mas.dc.html`);
 * Configuración's lists only the groups that exist (the design's also names the bot,
 * the catalog and Apariencia, which no group of `/settings` holds yet).
 */

import { Link } from 'react-router'
import Icono from '../components/Icono'
import { paths } from '../routes/paths'

interface Item {
  to: string
  label: string
  detail: string
}

const ITEMS: Item[] = [
  { to: paths.newExpense(), label: '+ Cargar gasto', detail: 'Categoría, monto y detalle' },
  { to: paths.expenses(), label: 'Gastos', detail: 'Por mes y por categoría' },
  { to: paths.analysis(), label: 'Análisis', detail: 'Variedades, semanas, meses y días' },
  { to: paths.settings(), label: 'Configuración', detail: 'Negocio, usuarios, categorías y tu cuenta' },
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
                <span className="mas__item-detalle">{item.detail}</span>
              </span>
              <span className="mas__item-flecha">
                <Icono nombre="chevron" size={18} strokeWidth={1.6} />
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  )
}
