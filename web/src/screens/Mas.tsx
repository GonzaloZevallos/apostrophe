/**
 * `Mas`: Gastos, Variedades, Catálogo, Análisis and Configuración. Each entry links to
 * where its own screen subtask mounts its route (`/gastos`, `/variedades`,
 * `/catalogo`, `/analisis`, `/settings`). The fixed subtitles are the design's own words
 * (`Mas.dc.html`); Análisis's is the plan's own line ("Análisis · Variedades, semanas,
 * meses y días"). Configuración carries `state: { inApp: true }`, which lets its list's
 * back go through history (`useBackOr`).
 */

import { Link } from 'react-router'

interface Item {
  to: string
  label: string
  detail?: string
  /** Opening it leaves the app behind it, so a group's "Cerrar" can go back by history. */
  inApp?: boolean
}

const ITEMS: Item[] = [
  { to: '/gastos', label: 'Gastos', detail: 'Por mes y por categoría' },
  { to: '/variedades', label: 'Variedades', detail: 'Precios y avisos de stock bajo' },
  { to: '/catalogo', label: 'Catálogo', detail: 'El mensaje de hoy, listo para copiar' },
  { to: '/analisis', label: 'Análisis', detail: 'Variedades, semanas, meses y días' },
  {
    to: '/settings',
    label: 'Configuración',
    detail: 'Negocio, usuarios, bot, catálogo, categorías, apariencia y tu cuenta',
    inApp: true,
  },
]

export default function Mas() {
  return (
    <main className="pantalla">
      <div className="cuerpo">
        <span className="encabezado__titulo">Más</span>
        <nav className="mas__lista" aria-label="Más">
          {ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              state={item.inApp === true ? { inApp: true } : undefined}
              className="mas__item"
            >
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
