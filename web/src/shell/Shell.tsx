/**
 * The chrome of every signed-in screen: the bottom bar on the phone, the sidebar on a
 * computer (navigation.md); CSS alone switches between them at 900 px
 * (`styles/app.css`), nothing here reads the viewport.
 *
 * What a screen shows comes only from its route's `handle.kind` (`routeHandle.ts`),
 * the deepest match read with `useMatches()`; this is the only reader (plan,
 * invariant 5):
 * - root: the bar or sidebar and "+ Nueva venta";
 * - detail: the bar or sidebar and "‹ <parent>", never "+ Nueva venta";
 * - form: neither (the screen itself offers "Cerrar").
 *
 * Which tab is lit comes only from `activeTab(pathname)`: both navs render plain
 * `Link`s with `aria-current` and a mark that is not color (bold and an underline,
 * `--activo`). The phone bar has Inicio, Ventas, Clientes, Variedades and Más; the
 * sidebar has no Más but Gastos and Análisis below a divider, and the business at the
 * bottom (`InicioCompu.dc.html`). Variedades reuses the `stock` icon, the design's box.
 *
 * Configuración's parent is two places ("‹ Más" on the phone, "‹ Inicio" on a
 * computer, which has no Más): both links are rendered and CSS hides one with
 * `display: none`, so only one is in the accessibility tree.
 * `useOutletContext` passes `me` on to whatever the active route renders.
 */

import { Link, Outlet, useLocation, useMatches, useOutletContext } from 'react-router'
import type { Me } from '../api/me'
import BusinessAvatar from '../components/BusinessAvatar'
import Icono, { type NombreIcono } from '../components/Icono'
import { paths } from '../routes/paths'
import { activeTab, type Tab } from './activeTab'
import { handleOf, parentOf, type ViewportParent } from './routeHandle'
import { useBack } from './useBack'

interface Entry {
  tab: Tab
  to: string
  label: string
  icono?: NombreIcono
}

const BAR: Entry[] = [
  { tab: 'home', to: paths.home(), label: 'Inicio', icono: 'inicio' },
  { tab: 'sales', to: paths.sales(), label: 'Ventas', icono: 'ventas' },
  { tab: 'customers', to: paths.customers(), label: 'Clientes', icono: 'clientes' },
  { tab: 'varieties', to: paths.varieties(), label: 'Variedades', icono: 'stock' },
  { tab: 'more', to: paths.more(), label: 'Más', icono: 'mas' },
]

const SIDEBAR_MAIN = BAR.filter((entry) => entry.tab !== 'more')

const SIDEBAR_MORE: Entry[] = [
  { tab: 'expenses', to: paths.expenses(), label: 'Gastos' },
  { tab: 'analysis', to: paths.analysis(), label: 'Análisis' },
]

function mark(base: string, active: boolean): string {
  return active ? `${base} ${base}--activo` : base
}

function current(active: boolean): 'page' | undefined {
  return active ? 'page' : undefined
}

function NewSale({ className }: { className: string }) {
  return (
    <Link to={paths.newSale()} className={`boton ${className}`}>
      <Icono nombre="agregar" size={19} strokeWidth={2} />
      Nueva venta
    </Link>
  )
}

function BackLink({ parent }: { parent: ViewportParent }) {
  const onClick = useBack()
  const className =
    parent.viewport === undefined
      ? 'volver'
      : `volver volver--${parent.viewport === 'phone' ? 'telefono' : 'compu'}`
  return (
    <Link to={parent.to} className={className} aria-label={`Volver a ${parent.label}`} onClick={onClick}>
      <span aria-hidden="true">‹</span> {parent.label}
    </Link>
  )
}

export default function Shell() {
  const me = useOutletContext<Me>()
  const matches = useMatches()
  const { pathname } = useLocation()
  const handle = handleOf(matches) ?? { kind: 'root' as const }
  const tab = activeTab(pathname)
  const showNewSale = handle.kind === 'root'
  const showNav = handle.kind !== 'form'

  return (
    <div className="disposicion">
      {showNav && (
        <nav className="riel-lateral" aria-label="Navegación">
          <div className="riel-lateral__marca" aria-hidden="true">
            apostrophe<span className="riel-lateral__apostrofe">’</span>
          </div>
          {showNewSale && <NewSale className="boton-nueva-venta--escritorio" />}
          {SIDEBAR_MAIN.map((entry) => (
            <Link
              key={entry.tab}
              to={entry.to}
              aria-current={current(tab === entry.tab)}
              className={mark('riel-lateral__item', tab === entry.tab)}
            >
              {entry.icono !== undefined && <Icono nombre={entry.icono} />}
              {entry.label}
            </Link>
          ))}
          <div className="riel-lateral__division" role="separator" />
          {SIDEBAR_MORE.map((entry) => (
            <Link
              key={entry.tab}
              to={entry.to}
              aria-current={current(tab === entry.tab)}
              className={mark('riel-lateral__secundario', tab === entry.tab)}
            >
              {entry.label}
            </Link>
          ))}
          <Link
            to={paths.settings()}
            aria-label={`Configuración de ${me.business_name}`}
            aria-current={current(tab === 'more')}
            className={mark('riel-lateral__negocio', tab === 'more')}
          >
            <BusinessAvatar name={me.business_name} className="avatar avatar--chico" />
            <span className="riel-lateral__negocio-nombre">{me.business_name}</span>
          </Link>
        </nav>
      )}
      <div className="columna-principal">
        {handle.kind === 'detail' && (
          <div className="volver-fila">
            {parentOf(handle).map((parent) => (
              <BackLink key={parent.viewport ?? 'both'} parent={parent} />
            ))}
          </div>
        )}
        <Outlet context={me} />
        {showNewSale && <NewSale className="boton-nueva-venta" />}
        {showNav && (
          <nav className="bar-inferior" aria-label="Navegación">
            {BAR.map((entry) => (
              <Link
                key={entry.tab}
                to={entry.to}
                aria-current={current(tab === entry.tab)}
                className={mark('bar-inferior__item', tab === entry.tab)}
              >
                {entry.icono !== undefined && <Icono nombre={entry.icono} />}
                <span>{entry.label}</span>
              </Link>
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}
