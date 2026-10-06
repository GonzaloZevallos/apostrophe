/**
 * The only place an old Spanish path appears (navigation.md, "Until the area issues").
 * Saved links and the home-screen shortcut still point at them, so each one redirects
 * on the client with `<Navigate replace>` — the old path never stays in history — and
 * carries the id, the query string and the hash across. There is no server redirect.
 *
 * A row's key is the old path, a row's value builds the new one from its `:id`.
 * Targets are `paths` functions, never literals, so an area issue that replaces a
 * screen (Clientes' `customersOwing`, say) changes `paths.ts` and the route table,
 * not this table. These rows sit outside `GatedLayout`: signed out, a visitor goes
 * old → new → `/login`, each hop a replace.
 */

import { createElement, type ReactElement } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'
import { paths } from './paths'

export const LEGACY_REDIRECTS: Readonly<Record<string, (id: string) => string>> = {
  '/entrar': () => paths.login(),
  '/ventas': () => paths.sales(),
  '/ventas/nueva': () => paths.newSale(),
  '/ventas/:id': (id) => paths.sale(id),
  '/clientes': () => paths.customers(),
  '/clientes/nuevo': () => paths.newCustomer(),
  '/clientes/:id': (id) => paths.customer(id),
  '/clientes/:id/editar': (id) => paths.editCustomer(id),
  '/clientes/deben': () => paths.customersOwing(),
  '/variedades': () => paths.varieties(),
  '/variedades/:id': (id) => paths.variety(id),
  '/catalogo': () => paths.catalog(),
  '/mi-stock': () => paths.entries(),
  '/mi-stock/nueva-entrada': () => paths.newEntry(),
  '/mi-stock/entradas/:id': (id) => paths.entry(id),
  '/gastos': () => paths.expenses(),
  '/analisis': () => paths.analysis(),
  '/mas': () => paths.more(),
  '/negocio': () => paths.settings(),
  '/gastos/categorias': () => paths.expenseCategories(),
}

function LegacyRedirect({ target }: { target: (id: string) => string }): ReactElement {
  const { id } = useParams()
  const { search, hash } = useLocation()
  return createElement(Navigate, {
    to: { pathname: target(id ?? ''), search, hash },
    replace: true,
  })
}

/** One route object per old path, to spread into the public branch of the route table. */
export function legacyRoutes(): { path: string; element: ReactElement }[] {
  return Object.entries(LEGACY_REDIRECTS).map(([path, target]) => ({
    path,
    element: createElement(LegacyRedirect, { target }),
  }))
}
