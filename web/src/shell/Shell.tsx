/**
 * The bottom bar on the phone, the side rail on a computer (`componentes.ts`'s `Destino`);
 * CSS alone switches between them (`styles/app.css`). Only destinations that exist show.
 * The bar is Inicio, Ventas, Clientes, Variedades and Más; the rail is "+ Nueva venta", the
 * same first four, a divider, Gastos and Análisis, and the business row (avatar and name) at
 * the bottom, which opens Configuración. There is no Más on a computer.
 *
 * Everything the shell decides comes from the leaf route's registry entry (`routes.ts`),
 * found through the route's `handle.screen`: `chromeOf` (`chrome.ts`) turns it into the
 * chrome (a root shows the bar and "+ Nueva venta", a card the bar and a "‹ parent" arrow, a
 * form neither; the rail goes only for a registry `modalOnComputer`), and
 * `placeOf(id, viewport)` says which entry each surface marks. Never the pathname, never
 * history, so a reload or a saved link marks the same entry. At most one entry per surface
 * carries `aria-current="page"`, and it is also bold and drawn filled and underlined (or, on
 * the rail, with its accent rule): never color alone. The bar marks with `placeOf(id,
 * 'phone').bar`, the rail with `placeOf(id, 'computer').rail`, since both are in the DOM and
 * CSS picks one.
 *
 * `useOutletContext` passes `me` on to whatever the active route renders, so none of them
 * has to re-run `GET /auth/me`.
 */

import { Fragment, useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, useMatches, useOutletContext } from 'react-router'
import { actionableFirstRun, firstRunQuery } from '../api/firstRun'
import type { Me } from '../api/me'
import Icono, { type NombreIcono } from '../components/Icono'
import InAppLink from '../components/InAppLink'
import {
  ANALYSIS,
  EXPENSES,
  HOME,
  isScreenId,
  MORE,
  placeOf,
  SALE_NEW,
  SALES,
  screenOf,
  CUSTOMERS,
  SETTINGS,
  VARIETIES,
  type RailPlace,
  type Screen,
  COMPUTER_VIEWPORT,
  PHONE_VIEWPORT,
} from '../routes'
import BotonLink from '../components/BotonLink'
import { NUEVA_VENTA_CLASS, NUEVA_VENTA_ESCRITORIO_CLASS } from '../components/botonVisual'
import BackArrow from './BackArrow'
import { NUEVA_VENTA_MISSING } from '../copy/home'
import {
  NAVIGATION,
  NEW_SALE,
  settingsOf,
  TAB_ANALYSIS,
  TAB_CUSTOMERS,
  TAB_EXPENSES,
  TAB_HOME,
  TAB_MORE,
  TAB_SALES,
  TAB_VARIETIES,
} from '../copy/shell'
import { chromeOf } from './chrome'
import { initialsOf } from './initials'
import { BackParentContext, type BackParentSlot, type BackParentStore } from './useBackParent'
import { useViewport } from './useViewport'

type Placement = 'bar' | 'rail' | 'both'

/** `main` entries sit above the rail's divider with their icon, `more` ones below it. */
type Group = 'main' | 'more'

interface Item {
  to: string
  label: string
  /** The bar's glyph; the rail draws one only above its divider (`GastosCompu.dc.html`). */
  icono?: NombreIcono
  placement: Placement
  group: Group
  /** The place a screen's registry entry names when this entry is the one to mark. */
  place: RailPlace
}

const ITEMS: Item[] = [
  { to: HOME, label: TAB_HOME, icono: 'inicio', placement: 'both', group: 'main', place: 'home' },
  { to: SALES, label: TAB_SALES, icono: 'ventas', placement: 'both', group: 'main', place: 'sales' },
  {
    to: CUSTOMERS,
    label: TAB_CUSTOMERS,
    icono: 'clientes',
    placement: 'both',
    group: 'main',
    place: 'customers',
  },
  {
    to: VARIETIES,
    label: TAB_VARIETIES,
    icono: 'variedades',
    placement: 'both',
    group: 'main',
    place: 'varieties',
  },
  { to: EXPENSES, label: TAB_EXPENSES, icono: 'gastos', placement: 'rail', group: 'more', place: 'expenses' },
  { to: ANALYSIS, label: TAB_ANALYSIS, icono: 'analisis', placement: 'rail', group: 'more', place: 'analysis' },
  { to: MORE, label: TAB_MORE, icono: 'mas', placement: 'bar', group: 'more', place: 'more' },
]

const BAR_ITEMS = ITEMS.filter((item) => item.placement !== 'rail')
const RAIL_ITEMS = ITEMS.filter((item) => item.placement !== 'bar')

/** The registry entry of the leaf route: the deepest match that names a screen. */
function leafScreen(matches: readonly { handle: unknown }[]): Screen {
  for (const match of [...matches].reverse()) {
    const { handle } = match
    if (typeof handle === 'object' && handle !== null && 'screen' in handle && isScreenId(handle.screen)) {
      return screenOf(handle.screen)
    }
  }
  throw new Error('Shell: the leaf route does not declare a screen (routes.ts)')
}

const ACTIVE_RAIL_ITEM_CLASS = 'riel-lateral__item--activo'

function railClassName(item: Item, active: boolean): string {
  const baseClass =
    item.group === 'more'
      ? 'riel-lateral__item riel-lateral__item--secundario'
      : 'riel-lateral__item'
  return active ? `${baseClass} ${ACTIVE_RAIL_ITEM_CLASS}` : baseClass
}

/** One bottom-bar entry; `active` is the registry's mark, not a path comparison. */
function BarItem({ item, active }: { item: Item; active: boolean }) {
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={active ? 'bar-inferior__item bar-inferior__item--activo' : 'bar-inferior__item'}
    >
      {item.icono !== undefined && <Icono nombre={item.icono} />}
      <span>{item.label}</span>
    </Link>
  )
}

/** The one slot a record-labelled card's `useBackParent` writes and `BackArrow` reads. */
function useBackParentStore(): BackParentStore {
  const [slot, setSlot] = useState<BackParentSlot>()
  const write = useCallback((next: BackParentSlot) => setSlot(next), [])
  const clearIf = useCallback(
    (own: Pick<BackParentSlot, 'screen' | 'param'>) =>
      setSlot((now) => (now !== undefined && now.screen === own.screen && now.param === own.param ? undefined : now)),
    [],
  )
  return useMemo(() => ({ slot, write, clearIf }), [slot, write, clearIf])
}

const NUEVA_VENTA_MISSING_ID = 'nueva-venta-falta'
const RAIL_MISSING_ID = 'nueva-venta-falta-riel'

/** Whether `GET /first-run` says the checklist shows with its priced-variety step not done.
 * Asked only where "+ Nueva venta" is drawn; while pending or failed it is `false`, so the
 * button draws normally. The shell decides nothing: it shows the server's answer. */
function useNuevaVentaMissing(enabled: boolean): boolean {
  const data = actionableFirstRun(useQuery({ ...firstRunQuery, enabled }))
  return (
    data?.kind === 'checklist' &&
    data.checklist.some((step) => step.step === 'priced_variety' && !step.done)
  )
}

export default function Shell() {
  const me = useOutletContext<Me>()
  const leaf = leafScreen(useMatches())
  const barPlace = placeOf(leaf.id, PHONE_VIEWPORT).bar
  const railPlace = placeOf(leaf.id, COMPUTER_VIEWPORT).rail
  const chrome = chromeOf(leaf, useViewport())
  const backParent = useBackParentStore()
  const missing = useNuevaVentaMissing(chrome.railNuevaVenta || chrome.barNuevaVenta)
  const barDescribedBy = missing ? NUEVA_VENTA_MISSING_ID : undefined
  const railDescribedBy = missing ? RAIL_MISSING_ID : undefined

  return (
    <BackParentContext.Provider value={backParent}>
    <div className="disposicion">
      {chrome.rail && (
        <nav className="riel-lateral" aria-label={NAVIGATION} data-menu>
          {chrome.railNuevaVenta && (
            <>
              <BotonLink
                to={SALE_NEW}
                icon="agregar"
                className={NUEVA_VENTA_ESCRITORIO_CLASS}
                ariaDescribedBy={railDescribedBy}
              >
                {NEW_SALE}
              </BotonLink>
              {missing && (
                <span className="nueva-venta__falta nueva-venta__falta--escritorio" id={RAIL_MISSING_ID}>
                  {NUEVA_VENTA_MISSING}
                </span>
              )}
            </>
          )}
          {RAIL_ITEMS.map((item, index) => {
            const active = railPlace === item.place
            return (
              <Fragment key={item.to}>
                {index > 0 && RAIL_ITEMS[index - 1]?.group !== item.group && (
                  <div role="separator" className="riel-lateral__divisor" />
                )}
                <Link
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={railClassName(item, active)}
                >
                  {item.icono !== undefined && <Icono nombre={item.icono} />}
                  {item.label}
                </Link>
              </Fragment>
            )
          })}
          <InAppLink
            to={SETTINGS}
            aria-label={settingsOf(me.business_name)}
            aria-current={railPlace === 'business' ? 'page' : undefined}
            className={
              railPlace === 'business'
                ? 'riel-lateral__negocio riel-lateral__negocio--activo'
                : 'riel-lateral__negocio'
            }
          >
            <span className="riel-lateral__avatar" aria-hidden="true">
              {initialsOf(me.business_name)}
            </span>
            <span className="riel-lateral__negocio-nombre">{me.business_name}</span>
          </InAppLink>
        </nav>
      )}
      <div className={chrome.bar ? 'columna-principal' : 'columna-principal columna-principal--sin-bar'}>
          {chrome.backArrow && <BackArrow id={leaf.id} />}
          <Outlet context={me} />
          {chrome.barNuevaVenta && (
            <>
              <BotonLink to={SALE_NEW} icon="agregar" className={NUEVA_VENTA_CLASS} ariaDescribedBy={barDescribedBy}>
                {NEW_SALE}
              </BotonLink>
              {missing && (
                <span className="nueva-venta__falta" id={NUEVA_VENTA_MISSING_ID}>
                  {NUEVA_VENTA_MISSING}
                </span>
              )}
            </>
          )}
          {chrome.bar && (
            <nav className="bar-inferior" aria-label={NAVIGATION} data-menu>
              {BAR_ITEMS.map((item) => (
                <BarItem key={item.to} item={item} active={barPlace === item.place} />
              ))}
            </nav>
          )}
      </div>
    </div>
    </BackParentContext.Provider>
  )
}
