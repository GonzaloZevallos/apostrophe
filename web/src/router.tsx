/**
 * The route table (plan, "Session"; "Shape"): a public branch (`/login`,
 * `/invitation/:token`, `/reset/:token` and the old Spanish paths, which only
 * redirect) and a gated branch, exactly as the plan's invariants ask — no gated query
 * mounts under the public paths, because `GatedLayout` (which runs `me`) is simply
 * not in their element tree.
 *
 * Every path comes from `routes/paths.ts`; every gated leaf declares one
 * `handle.kind` (`shell/routeHandle.ts`), which `Shell` alone reads to decide the
 * chrome and the back link. `/customers/owing`, `/settings/integrations` and
 * `/settings/catalog-message` are interim rows: the area issues replace their row
 * and never touch `routes/legacy.ts`.
 *
 * Built with `createBrowserRouter` rather than `<BrowserRouter>` because `useBlocker`
 * only works under a data router. `Root` (`Root.tsx`) carries `RouterSync` and the
 * offline banner so they render once for every route, public or gated. `routes` is
 * exported on its own so a test walks the table without a browser.
 *
 * Kept out of `Root.tsx` itself, which otherwise would export both a non-component
 * value (`router`) and its default component — fast-refresh's own
 * `only-export-components` (oxlint) warns on exactly that mix. A test drives this
 * same singleton with `router.navigate(path)` before rendering `<App />`, rather
 * than `window.history.pushState`, which would race this module's own import (the
 * router is built once, from whatever `window.location` is at that moment).
 */

import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import Root from './Root'
import Analisis from './screens/Analisis'
import Entrar from './screens/Entrar'
import EntradaStock from './screens/EntradaStock'
import GastoCategorias from './screens/GastoCategorias'
import Gastos, { NuevoGasto } from './screens/Gastos'
import Inicio from './screens/Inicio'
import Invitacion from './screens/Invitacion'
import Mas from './screens/Mas'
import Catalogo from './screens/Catalogo'
import Stock from './screens/Stock'
import ClienteFicha from './screens/clientes/ClienteFicha'
import ClienteForm from './screens/clientes/ClienteForm'
import Clientes from './screens/clientes/Clientes'
import ClientesLayout from './screens/clientes/ClientesLayout'
import TeDeben from './screens/clientes/TeDeben'
import VariedadDetalle from './screens/VariedadDetalle'
import Variedades from './screens/Variedades'
import Reset from './screens/Reset'
import NuevaVenta from './screens/ventas/NuevaVenta'
import VentaDetalle from './screens/ventas/VentaDetalle'
import Ventas from './screens/ventas/Ventas'
import Configuracion from './screens/settings/Configuracion'
import NegocioGrupo from './screens/settings/NegocioGrupo'
import TuCuentaGrupo from './screens/settings/TuCuentaGrupo'
import UsuariosGrupo from './screens/settings/UsuariosGrupo'
import { legacyRoutes } from './routes/legacy'
import { paths } from './routes/paths'
import GatedLayout from './shell/GatedLayout'
import type { RouteHandle } from './shell/routeHandle'
import Shell from './shell/Shell'

const root: RouteHandle = { kind: 'root' }
const form: RouteHandle = { kind: 'form' }
const detailOf = (label: string, to: string): RouteHandle => ({ kind: 'detail', parent: { label, to } })

// There is no Más on a computer, so Configuración's back reads "Inicio" there.
const settingsHandle: RouteHandle = {
  kind: 'detail',
  parent: { phone: { label: 'Más', to: paths.more() }, computer: { label: 'Inicio', to: paths.home() } },
}
const catalogHandle = detailOf('Variedades', paths.varieties())

export const routes: RouteObject[] = [
  {
    element: <Root />,
    children: [
      { path: paths.login(), element: <Entrar /> },
      { path: paths.invitation(':token'), element: <Invitacion /> },
      { path: paths.reset(':token'), element: <Reset /> },
      ...legacyRoutes(),
      {
        element: <GatedLayout />,
        children: [
          {
            element: <Shell />,
            children: [
              { index: true, element: <Inicio />, handle: root },
              { path: paths.more(), element: <Mas />, handle: root },
              {
                path: paths.customers(),
                element: <ClientesLayout />,
                children: [
                  { index: true, element: <Clientes />, handle: root },
                  { path: paths.newCustomer(), element: <ClienteForm mode="nuevo" />, handle: form },
                  {
                    path: paths.customersOwing(),
                    element: <TeDeben />,
                    handle: detailOf('Clientes', paths.customers()),
                  },
                  {
                    path: paths.customer(':id'),
                    element: <ClienteFicha />,
                    handle: detailOf('Clientes', paths.customers()),
                  },
                  { path: paths.editCustomer(':id'), element: <ClienteForm mode="editar" />, handle: form },
                ],
              },
              { path: paths.varieties(), element: <Variedades />, handle: root },
              {
                path: paths.variety(':id'),
                element: <VariedadDetalle />,
                handle: detailOf('Variedades', paths.varieties()),
              },
              { path: paths.catalog(), element: <Catalogo />, handle: catalogHandle },
              { path: paths.entries(), element: <Stock />, handle: catalogHandle },
              { path: paths.newEntry(), element: <EntradaStock mode="nuevo" />, handle: form },
              { path: paths.entry(':id'), element: <EntradaStock mode="editar" />, handle: form },
              { path: paths.expenses(), element: <Gastos />, handle: root },
              { path: paths.newExpense(), element: <NuevoGasto />, handle: form },
              { path: paths.analysis(), element: <Analisis />, handle: root },
              {
                path: paths.settings(),
                element: <Configuracion />,
                handle: settingsHandle,
              },
              { path: paths.settingsBusiness(), element: <NegocioGrupo />, handle: form },
              { path: paths.settingsUsers(), element: <UsuariosGrupo />, handle: form },
              { path: paths.settingsAccount(), element: <TuCuentaGrupo />, handle: form },
              { path: paths.expenseCategories(), element: <GastoCategorias />, handle: form },
              { path: paths.settingsIntegrations(), element: <Catalogo />, handle: catalogHandle },
              { path: paths.settingsCatalogMessage(), element: <Catalogo />, handle: catalogHandle },
              { path: paths.sales(), element: <Ventas />, handle: root },
              { path: paths.newSale(), element: <NuevaVenta />, handle: form },
              { path: paths.sale(':id'), element: <VentaDetalle />, handle: detailOf('Ventas', paths.sales()) },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to={paths.home()} replace /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
