/**
 * The route table (plan, "Session"; "Shape"): a public branch (`/entrar`,
 * `/invitation/:token`) and a gated branch, exactly as the plan's invariants ask —
 * no gated query mounts under the public paths, because `GatedLayout` (which runs
 * `me`) is simply not in their element tree.
 *
 * Built with `createBrowserRouter` rather than `<BrowserRouter>` (plan, "Shape":
 * "`App.tsx` moves to a data router so `useBlocker` can catch Back") — `useBlocker`
 * only works under a data router, and `NuevaVenta`'s leave guard ("¿Descartás la
 * venta?") needs it to catch the browser's own Back button, not only an in-app
 * link. `Root` (`Root.tsx`) carries `RouterSync` and the offline banner so they
 * render once for every route, public or gated, exactly as they did before the
 * migration.
 *
 * Sales routes live under `/ventas` (`contract.json`'s `frontSegments`, plan
 * invariants: "No front path starts with `sales`"), nested under `Shell` like every
 * other gated destination so the tab bar stays up. This subtask only wires the
 * route table; the modules it points at (`screens/ventas/*`) are stubs the screen
 * subtasks (`new-sale-screen`, `sales-list-and-detail`, `assign-customer`) fill in.
 *
 * Kept out of `Root.tsx` itself, which otherwise would export both a non-component
 * value (`router`) and its default component — fast-refresh's own
 * `only-export-components` (oxlint) warns on exactly that mix. A test drives this
 * same singleton with `router.navigate(path)` before rendering `<App />`, rather
 * than `window.history.pushState`, which would race this module's own import (the
 * router is built once, from whatever `window.location` is at that moment).
 */

import { createBrowserRouter, Navigate } from 'react-router'
import Root from './Root'
import Entrar from './screens/Entrar'
import EntradaStock from './screens/EntradaStock'
import GastoCategorias from './screens/GastoCategorias'
import Gastos from './screens/Gastos'
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
import Negocio from './screens/Negocio'
import Reset from './screens/Reset'
import NuevaVenta from './screens/ventas/NuevaVenta'
import VentaDetalle from './screens/ventas/VentaDetalle'
import Ventas from './screens/ventas/Ventas'
import GatedLayout from './shell/GatedLayout'
import Shell from './shell/Shell'

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/entrar', element: <Entrar /> },
      { path: '/invitation/:token', element: <Invitacion /> },
      { path: '/reset/:token', element: <Reset /> },
      {
        element: <GatedLayout />,
        children: [
          {
            element: <Shell />,
            children: [
              { index: true, element: <Inicio /> },
              { path: 'mas', element: <Mas /> },
              {
                path: 'clientes',
                element: <ClientesLayout />,
                children: [
                  { index: true, element: <Clientes /> },
                  { path: 'nuevo', element: <ClienteForm mode="nuevo" /> },
                  { path: 'deben', element: <TeDeben /> },
                  { path: ':id', element: <ClienteFicha /> },
                  { path: ':id/editar', element: <ClienteForm mode="editar" /> },
                ],
              },
              { path: 'variedades', element: <Variedades /> },
              { path: 'variedades/:id', element: <VariedadDetalle /> },
              { path: 'gastos', element: <Gastos /> },
              { path: 'gastos/categorias', element: <GastoCategorias /> },
              { path: 'mi-stock', element: <Stock /> },
              { path: 'mi-stock/nueva-entrada', element: <EntradaStock mode="nuevo" /> },
              { path: 'mi-stock/entradas/:id', element: <EntradaStock mode="editar" /> },
              { path: 'negocio', element: <Negocio /> },
              { path: 'catalogo', element: <Catalogo /> },
              {
                path: 'ventas',
                children: [
                  { index: true, element: <Ventas /> },
                  { path: 'nueva', element: <NuevaVenta /> },
                  { path: ':id', element: <VentaDetalle /> },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
