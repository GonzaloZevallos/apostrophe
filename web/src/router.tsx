/**
 * The route table (plan, "Session"; "Shape"): a public branch (/login,
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
 * The route table is built from the registry in `routes.ts`: every screen under `Shell` is a
 * `screen()` declaration bound to its element here (`bind`), and every other route is an
 * `outside()` one. Each route carries `handle: { screen: id }`, which is how `Shell` finds the
 * leaf's kind, parent and place; no path is written in this file.
 *
 * Kept out of `Root.tsx` itself, which otherwise would export both a non-component
 * value (`router`) and its default component — fast-refresh's own
 * `only-export-components` (oxlint) warns on exactly that mix. A test drives this
 * same singleton with `router.navigate(path)` before rendering `<App />`, rather
 * than `window.history.pushState`, which would race this module's own import (the
 * router is built once, from whatever `window.location` is at that moment).
 */

import type { ReactElement } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import Root from './Root'
import Analisis from './screens/Analisis'
import Entrar from './screens/Entrar'
import EntradaStock from './screens/EntradaStock'
import ExpenseNewRoute from './screens/expenses/ExpenseNewRoute'
import Gastos from './screens/Gastos'
import Inicio from './screens/Inicio'
import Invitacion from './screens/Invitacion'
import Mas from './screens/Mas'
import Listo from './screens/onboarding/Listo'
import OnboardingLayout from './screens/onboarding/OnboardingLayout'
import { OnboardingEntry, OnboardingStepRoute } from './screens/onboarding/OnboardingRoutes'
import Catalogo from './screens/Catalogo'
import ClienteFicha from './screens/clientes/ClienteFicha'
import CobroRoute from './screens/clientes/CobroRoute'
import ClienteForm from './screens/clientes/ClienteForm'
import Clientes from './screens/clientes/Clientes'
import ClientesLayout from './screens/clientes/ClientesLayout'
import PriceHistory from './screens/varieties/PriceHistory'
import PriceNew from './screens/varieties/PriceNew'
import ArchivedIndex from './screens/varieties/ArchivedIndex'
import VarietyPage from './screens/varieties/VarietyPage'
import VarietyRoute from './screens/varieties/VarietyRoute'
import VarietiesIndex from './screens/varieties/VarietiesIndex'
import VarietiesLayout from './screens/varieties/VarietiesLayout'
import VarietyNew from './screens/varieties/VarietyNew'
import EntriesList from './screens/EntriesList'
import Reset from './screens/Reset'
import Settings from './screens/settings/Settings'
import AccountGroup from './screens/settings/AccountGroup'
import AppearanceGroup from './screens/settings/AppearanceGroup'
import BusinessGroup from './screens/settings/BusinessGroup'
import CatalogMessageGroup from './screens/settings/CatalogMessageGroup'
import ExpenseCategoriesGroup from './screens/settings/ExpenseCategoriesGroup'
import IntegrationsGroup from './screens/settings/IntegrationsGroup'
import PricingGroup from './screens/settings/PricingGroup'
import UsersGroup from './screens/settings/UsersGroup'
import WithdrawalDetail from './screens/withdrawals/WithdrawalDetail'
import WithdrawalFormRoute from './screens/withdrawals/WithdrawalFormRoute'
import NuevaVenta from './screens/ventas/NuevaVenta'
import VentaDetalle from './screens/ventas/VentaDetalle'
import Ventas from './screens/ventas/Ventas'
import GatedLayout from './shell/GatedLayout'
import Shell from './shell/Shell'
import { holdScrollRestoration, watchScroll } from './shell/scrollPlaces'
import {
  CATCH_ALL,
  HOME,
  INVITATION,
  LOGIN,
  ONBOARDING_SCREENS,
  RESET,
  SCREENS,
  type Screen,
  type ScreenId,
} from './routes'

/** The element each declared screen renders. A screen with no element, or an element with no
 * screen, does not type-check. */
const ELEMENTS: Record<ScreenId, ReactElement> = {
  home: <Inicio />,
  more: <Mas />,
  sales: <Ventas />,
  'sale-new': <NuevaVenta />,
  sale: <VentaDetalle />,
  customers: <Clientes />,
  'customer-new': <ClienteForm mode="nuevo" />,
  customer: <ClienteFicha />,
  'customer-payment': <CobroRoute />,
  'customer-edit': <ClienteForm mode="editar" />,
  varieties: <VarietiesIndex />,
  'variety-new': <VarietyNew />,
  variety: <VarietyRoute render={(varietyId) => <VarietyPage varietyId={varietyId} />} />,
  'variety-prices': <VarietyRoute render={(varietyId) => <PriceHistory varietyId={varietyId} />} />,
  'variety-price-new': <VarietyRoute render={(varietyId) => <PriceNew varietyId={varietyId} />} />,
  'variety-entries': <VarietyRoute render={(varietyId) => <EntriesList varietyId={varietyId} />} />,
  catalog: <Catalogo />,
  stock: <EntriesList />,
  'stock-entry-new': <EntradaStock mode="nuevo" />,
  'stock-entry': <EntradaStock mode="editar" />,
  'varieties-archived': <ArchivedIndex />,
  'withdrawal-new': <WithdrawalFormRoute mode="new" />,
  withdrawal: <WithdrawalDetail />,
  'withdrawal-edit': <WithdrawalFormRoute mode="edit" />,
  expenses: <Gastos />,
  'expense-new': <ExpenseNewRoute />,
  analysis: <Analisis />,
  settings: <Settings />,
  'settings-business': <BusinessGroup />,
  'settings-users': <UsersGroup />,
  'settings-prices': <PricingGroup />,
  'settings-integrations': <IntegrationsGroup />,
  'settings-catalog-message': <CatalogMessageGroup />,
  'settings-expense-categories': <ExpenseCategoriesGroup />,
  'settings-appearance': <AppearanceGroup />,
  'settings-account': <AccountGroup />,
  onboarding: <OnboardingEntry />,
  'onboarding-variety': <OnboardingStepRoute slug="variety" />,
  'onboarding-stock': <OnboardingStepRoute slug="stock" />,
  'onboarding-catalog-message': <OnboardingStepRoute slug="header_footer" />,
  'onboarding-bot': <OnboardingStepRoute slug="bot" />,
  'onboarding-partner': <OnboardingStepRoute slug="partner" />,
  'onboarding-categories': <OnboardingStepRoute slug="categories" />,
  'onboarding-done': <Listo />,
}

/** The customer screens share `ClientesLayout`, which keeps the search across them. */
const WITH_VARIETIES_PANES: ReadonlySet<ScreenId> = new Set([
  'varieties',
  'variety-new',
  'variety',
  'variety-price-new',
  'varieties-archived',
  'stock-entry-new',
  'stock-entry',
])

const WITH_CUSTOMER_SEARCH: ReadonlySet<ScreenId> = new Set([
  'customers',
  'customer-new',
  'customer',
  'customer-edit',
  'customer-payment',
])

/** A declared screen as a route; `handle.screen` is how `Shell` finds its registry entry. */
function bind(entry: Screen): RouteObject {
  return { path: entry.path, element: ELEMENTS[entry.id], handle: { screen: entry.id } }
}

/** `Shell`'s children: every one is a `Screen` of the registry, so none is declared twice. */
const shellChildren: RouteObject[] = [
  ...SCREENS.filter(
    (entry) =>
      !WITH_CUSTOMER_SEARCH.has(entry.id) && !WITH_VARIETIES_PANES.has(entry.id) && !ONBOARDING_SCREENS.has(entry.id),
  ).map(bind),
  {
    element: <VarietiesLayout />,
    children: SCREENS.filter((entry) => WITH_VARIETIES_PANES.has(entry.id)).map(bind),
  },
  {
    element: <ClientesLayout />,
    children: SCREENS.filter((entry) => WITH_CUSTOMER_SEARCH.has(entry.id)).map(bind),
  },
]

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: LOGIN, element: <Entrar /> },
      { path: INVITATION, element: <Invitacion /> },
      { path: RESET, element: <Reset /> },
      {
        element: <GatedLayout />,
        children: [
          // The Onboarding's forms sit outside `Shell` on purpose: no bar, no side rail, no
          // "+ Nueva venta"; one centred column on every viewport (onboarding.md).
          { element: <OnboardingLayout />, children: SCREENS.filter((entry) => ONBOARDING_SCREENS.has(entry.id)).map(bind) },
          { element: <Shell />, children: shellChildren },
        ],
      },
      { path: CATCH_ALL, element: <Navigate to={HOME} replace /> },
    ],
  },
])

// Where the document goes is decided in `router.subscribe`, before the new screen is drawn (ADR-0065).
watchScroll(router)
holdScrollRestoration()
