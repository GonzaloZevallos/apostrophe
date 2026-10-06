/**
 * `Configuracion` (`navigation.md`, "Configuración"): the list of the business's
 * setting groups, exactly four and in this order — Negocio, Usuarios, Tu cuenta and
 * Categorías de gastos. Integraciones and Mensaje del catálogo have routes but no
 * entry yet, and Apariencia has neither: nothing is listed for something not built,
 * and no "coming soon" (PRD, "Nada inventado").
 *
 * The back arrow and the chrome are `Shell`'s, decided by the route's `handle`; this
 * screen draws its title and its rows only, the same rows `Mas` draws.
 */

import { Link } from 'react-router'
import { paths } from '../../routes/paths'

interface Group {
  to: string
  label: string
}

const GROUPS: Group[] = [
  { to: paths.settingsBusiness(), label: 'Negocio' },
  { to: paths.settingsUsers(), label: 'Usuarios' },
  { to: paths.settingsAccount(), label: 'Tu cuenta' },
  { to: paths.expenseCategories(), label: 'Categorías de gastos' },
]

export default function Configuracion() {
  return (
    <main className="pantalla">
      <div className="cuerpo">
        <span className="encabezado__titulo">Configuración</span>
        <nav className="mas__lista" aria-label="Configuración">
          {GROUPS.map((group) => (
            <Link key={group.to} to={group.to} className="mas__item">
              <span className="mas__item-texto">
                <span className="mas__item-rotulo">{group.label}</span>
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  )
}
