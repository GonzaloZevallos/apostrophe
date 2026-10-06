/**
 * `Shell` at the screen seam, under a memory *data* router (plan, seams: "`Shell`
 * rendered under a memory data router with route handles") — `useMatches()` only
 * works inside a data router's context, unlike the plain `<MemoryRouter>` this
 * file used before chrome moved to `handle` (plan, invariants: "no pathname
 * comparison decides it").
 *
 * Only destinations that exist show (PRD, "Nada inventado"; metric M5): the bar is
 * Inicio, Ventas, Clientes, Stock and Más; the rail adds Gastos and Análisis after a
 * divider, with Más last (it leaves with the issue that empties it). The fixed "Nueva
 * venta" button, separate from the tabs, shows on every signed-in screen except
 * where its route's `handle.chrome` is `'none'` (`NuevaVenta`'s own
 * /ventas/nueva, `VentaDetalle`'s `/ventas/:id`) — phone and computer differ
 * only in which markup the CSS shows; this suite checks both pieces of markup
 * directly rather than real viewport widths, which jsdom doesn't lay out. The rail
 * ends with the business row, a link to Configuración (/settings), which marks Más on
 * the bar the way Gastos and Análisis do (`handle.tab`).
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
  useLocation,
  type RouteObject,
} from 'react-router'
import { expect, test } from 'vitest'
import type { Me } from '../api/me'
import { ANALYSIS, CUSTOMER, EXPENSES, EXPENSE_NEW, HOME, MORE, SALE, SALE_NEW, SCREENS, SETTINGS, SETTINGS_USERS, pathTo, type Screen } from '../routes'
import Mas from '../screens/Mas'
import Shell from './Shell'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03' }

const BAR = ['Inicio', 'Ventas', 'Clientes', 'Stock', 'Más']
const RAIL = ['Inicio', 'Ventas', 'Clientes', 'Stock', 'Gastos', 'Análisis', 'Más']

/** The tabs only, in the order they render — drops the fixed "Nueva venta"
 * button, which shares the rail's `link` role but is not one of the tabs. */
function tabNames(nav: HTMLElement): string[] {
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent)
    .filter(
      (name): name is string =>
        name !== null && !name.startsWith('Nueva venta') && !name.startsWith('LH'),
    )
}

/** Every registered screen as a leaf that only says its title, so what the shell shows is the
 * registry's answer for that screen and nothing else. */
function stub(entry: Screen): RouteObject {
  return { path: entry.path, element: <div>{`pantalla ${entry.title}`}</div>, handle: { screen: entry.id } }
}

function renderShell(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        element: <Outlet context={ME} />,
        children: [
          {
            element: <Shell />,
            children: SCREENS.map(stub),
          },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  )
  render(<RouterProvider router={router} />)
}

test('the bar shows Inicio, Ventas, Clientes, Stock and Más; the rail adds Gastos and Análisis before Más', () => {
  const { container } = renderShellWithContainer(HOME)

  expect(container.querySelectorAll('nav')).toHaveLength(2)
  expect(tabNames(bar(container))).toEqual(BAR)
  expect(tabNames(rail(container))).toEqual(RAIL)
})

test('in the rail, Gastos and Análisis come after the divider and the first four before it', () => {
  const { container } = renderShellWithContainer(HOME)

  const entries = [...rail(container).children].map((child) =>
    child.getAttribute('role') === 'separator' ? '---' : (child.textContent ?? ''),
  )
  expect(entries.filter((entry) => entry !== '').slice(1)).toEqual([
    'Inicio',
    'Ventas',
    'Clientes',
    'Stock',
    '---',
    'Gastos',
    'Análisis',
    'Más',
    'LHLa Huerta',
  ])
})

test.each([
  [EXPENSES, 'Gastos'],
  [ANALYSIS, 'Análisis'],
  [EXPENSE_NEW, 'Gastos'],
  [MORE, 'Más'],
])('on %s the rail marks %s and, where the bar shows, the bar marks Más', (path, railEntry) => {
  const { container } = renderShellWithContainer(path)

  expect(current(rail(container))).toEqual([railEntry])
  const barNav = container.querySelector('.bar-inferior')
  if (path === EXPENSE_NEW) {
    expect(barNav).toBeNull()
  } else {
    expect(current(bar(container))).toEqual(['Más'])
  }
})

test('on Inicio each surface marks Inicio alone, by path, since no route declares a tab', () => {
  const { container } = renderShellWithContainer(HOME)

  expect(current(bar(container))).toEqual(['Inicio'])
  expect(current(rail(container))).toEqual(['Inicio'])
})

test('the form route has no bar and no "Nueva venta" button, and its rail still marks Gastos', () => {
  const { container } = renderShellWithContainer(EXPENSE_NEW)

  expect(container.querySelector('.bar-inferior')).toBeNull()
  expect(screen.queryByRole('link', { name: /Nueva venta/ })).not.toBeInTheDocument()
  expect(current(rail(container))).toEqual(['Gastos'])
})

test('the fixed "Nueva venta" button shows outside a chrome route, once per nav rail', () => {
  renderShell(HOME)

  const links = screen.getAllByRole('link', { name: /Nueva venta/ })
  expect(links).toHaveLength(2)
  for (const link of links) {
    expect(link).toHaveAttribute('href', SALE_NEW)
  }
})

test('chrome: none hides the fixed "Nueva venta" button everywhere, phone and computer alike', () => {
  renderShell(SALE_NEW)

  expect(screen.queryByRole('link', { name: /Nueva venta/ })).not.toBeInTheDocument()
})

test('chrome: none drops the bottom bar outright — the phone case', () => {
  const { container } = renderShellWithContainer(SALE_NEW)

  expect(container.querySelector('.bar-inferior')).toBeNull()
})

test('chrome: none keeps the rail and its tabs — the computer case, only the button is gone', () => {
  const { container } = renderShellWithContainer(SALE.replace(':id', '7'))

  const rail = container.querySelector('.riel-lateral')
  expect(rail).not.toBeNull()
  expect(tabNames(rail as HTMLElement)).toEqual(RAIL)
})

test.each([
  ['a root', HOME, true, true],
  ['a root that is Gastos', EXPENSES, true, true],
  ['a card: a sale', pathTo(SALE, { id: 7 }), true, false],
  ['a card: a customer', pathTo(CUSTOMER, { id: 3 }), true, false],
  ['a card: Configuración', SETTINGS, true, false],
  ['a form: the sale', SALE_NEW, false, false],
  ['a form: a Configuración group', SETTINGS_USERS, false, false],
])('%s: bar %s, "Nueva venta" %s, from the leaf screen\'s kind alone', (_kind, path, bar, button) => {
  const { container } = renderShellWithContainer(path)

  expect(container.querySelector('.bar-inferior') !== null).toBe(bar)
  expect(screen.queryAllByRole('link', { name: /Nueva venta/ }).length > 0).toBe(button)
  expect(container.querySelector('.riel-lateral')).not.toBeNull()
})

test('a card marks its parent: a sale marks Ventas and a customer Clientes on both surfaces', () => {
  const sale = renderShellWithContainer(pathTo(SALE, { id: 7 }))
  expect(current(bar(sale.container))).toEqual(['Ventas'])
  expect(current(rail(sale.container))).toEqual(['Ventas'])
})

test('a customer card marks Clientes whatever screen opened it', () => {
  const { container } = renderShellWithContainer(pathTo(CUSTOMER, { id: 3 }))

  expect(current(bar(container))).toEqual(['Clientes'])
  expect(current(rail(container))).toEqual(['Clientes'])
})

function bar(container: HTMLElement): HTMLElement {
  return container.querySelector('.bar-inferior') as HTMLElement
}

function rail(container: HTMLElement): HTMLElement {
  return container.querySelector('.riel-lateral') as HTMLElement
}

/** The entries a surface marks as the current page. */
function current(nav: HTMLElement): string[] {
  return [...nav.querySelectorAll('[aria-current="page"]')].map((link) => link.textContent ?? '')
}

function renderShellWithContainer(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        element: <Outlet context={ME} />,
        children: [
          {
            element: <Shell />,
            children: SCREENS.map(stub),
          },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  )
  return render(<RouterProvider router={router} />)
}

test('marks the active item by more than color: a distinct class the other items do not get', () => {
  renderShell(HOME)

  const inicioLinks = screen.getAllByRole('link', { name: 'Inicio' })
  const clientesLinks = screen.getAllByRole('link', { name: 'Clientes' })
  for (const link of inicioLinks) {
    expect(link.className).toMatch(/--activo/)
  }
  for (const link of clientesLinks) {
    expect(link.className).not.toMatch(/--activo/)
  }
})

function Landed() {
  const location = useLocation()
  const inApp = (location.state as { inApp?: boolean } | null)?.inApp
  return <div>{`en ${location.pathname} inApp=${String(inApp)}`}</div>
}

function renderApp(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        element: <Outlet context={ME} />,
        children: [
          {
            element: <Shell />,
            children: [
              ...SCREENS.map((entry) => ({
                ...stub(entry),
                element: entry.id === 'more' ? <Mas /> : <Landed />,
              })),
            ],
          },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  )
  return render(<RouterProvider router={router} />)
}

test('the rail ends with the business row, a link to Configuración carrying inApp, one tap from Inicio', async () => {
  const { container } = renderApp(HOME)
  const railNav = rail(container)

  const row = within(railNav).getByRole('link', { name: 'Configuración de La Huerta' })
  expect(row).toHaveAttribute('href', SETTINGS)
  expect(row).toHaveTextContent('LH')
  expect(row).toHaveTextContent('La Huerta')
  expect(railNav.lastElementChild).toBe(row)
  await userEvent.click(row)

  expect(screen.getByText('en /settings inApp=true')).toBeInTheDocument()
})

test('the phone reaches Configuración in two taps: the Más tab, then its Configuración entry', async () => {
  const { container } = renderApp(HOME)

  await userEvent.click(within(bar(container)).getByRole('link', { name: 'Más' }))
  await userEvent.click(
    within(screen.getByRole('navigation', { name: 'Más' })).getByRole('link', {
      name: /^Configuración/,
    }),
  )

  expect(screen.getByText('en /settings inApp=true')).toBeInTheDocument()
})

test('on the phone, /settings marks Más as the active tab; the rail marks the business row', () => {
  const { container } = renderApp(SETTINGS)
  const more = within(bar(container)).getByRole('link', { name: 'Más' })

  expect(more).toHaveAttribute('aria-current', 'page')
  expect(more.className).toMatch(/--activo/)
  expect(within(bar(container)).getByRole('link', { name: 'Inicio' })).not.toHaveAttribute(
    'aria-current',
  )
  expect(
    within(rail(container)).getByRole('link', { name: 'Configuración de La Huerta' }),
  ).toHaveAttribute('aria-current', 'page')
})

test('a Configuración group is a form: chrome none, no bar at all', () => {
  const { container } = renderApp(SETTINGS_USERS)

  expect(container.querySelector('.bar-inferior')).toBeNull()
})

test('Más is not marked on other routes', () => {
  const { container } = renderApp(HOME)

  expect(within(bar(container)).getByRole('link', { name: 'Más' })).not.toHaveAttribute(
    'aria-current',
  )
})
