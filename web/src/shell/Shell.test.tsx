/**
 * `Shell` at the screen seam, under a memory *data* router (plan, seams: "`Shell`
 * rendered under a memory data router with route handles") — `useMatches()` only
 * works inside a data router's context, unlike the plain `<MemoryRouter>` this
 * file used before chrome moved to `handle` (plan, invariants: "no pathname
 * comparison decides it").
 *
 * Only destinations that exist show (PRD, "Nada inventado"; metric M5) — Inicio,
 * Ventas, Clientes, Stock and Más, in the design's own order. The fixed "Nueva
 * venta" button, separate from the tabs, shows on every signed-in screen except
 * where its route's `handle.chrome` is `'none'` (`NuevaVenta`'s own
 * `/ventas/nueva`, `VentaDetalle`'s `/ventas/:id`) — phone and computer differ
 * only in which markup the CSS shows; this suite checks both pieces of markup
 * directly rather than real viewport widths, which jsdom doesn't lay out.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from 'react-router'
import { expect, test } from 'vitest'
import type { Me } from '../api/me'
import Mas from '../screens/Mas'
import Shell from './Shell'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03' }

/** The tabs only, in the order they render — drops the fixed "Nueva venta"
 * button, which shares the rail's `link` role but is not one of the tabs. */
function tabNames(nav: HTMLElement): string[] {
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent)
    .filter((name): name is string => name !== null && !name.startsWith('Nueva venta') && !name.startsWith('LH'))
}

function renderShell(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        element: <Outlet context={ME} />,
        children: [{ element: <Shell />, children: [
          { index: true, element: <div>contenido</div> },
          { path: 'ventas/nueva', element: <div>Nueva venta</div>, handle: { chrome: 'none' } },
          { path: 'ventas/:id', element: <div>detalle</div>, handle: { chrome: 'none' } },
        ] }],
      },
    ],
    { initialEntries: [initialPath] },
  )
  render(<RouterProvider router={router} />)
}

test('shows exactly Inicio, Ventas, Clientes, Stock and Más in both navs, no handle on the route', () => {
  renderShell('/')

  const navs = screen.getAllByRole('navigation')
  expect(navs).toHaveLength(2)
  for (const nav of navs) {
    expect(tabNames(nav)).toEqual(['Inicio', 'Ventas', 'Clientes', 'Stock', 'Más'])
  }
})

test('the fixed "Nueva venta" button shows outside a chrome route, once per nav rail', () => {
  renderShell('/')

  const links = screen.getAllByRole('link', { name: /Nueva venta/ })
  expect(links).toHaveLength(2)
  for (const link of links) {
    expect(link).toHaveAttribute('href', '/ventas/nueva')
  }
})

test('chrome: none hides the fixed "Nueva venta" button everywhere, phone and computer alike', () => {
  renderShell('/ventas/nueva')

  expect(screen.queryByRole('link', { name: /Nueva venta/ })).not.toBeInTheDocument()
})

test('chrome: none drops the bottom bar outright — the phone case', () => {
  const { container } = renderShellWithContainer('/ventas/nueva')

  expect(container.querySelector('.bar-inferior')).toBeNull()
})

test('chrome: none keeps the rail and its tabs — the computer case, only the button is gone', () => {
  const { container } = renderShellWithContainer('/ventas/:id'.replace(':id', '7'))

  const rail = container.querySelector('.riel-lateral')
  expect(rail).not.toBeNull()
  expect(tabNames(rail as HTMLElement)).toEqual(['Inicio', 'Ventas', 'Clientes', 'Stock', 'Más'])
})

function renderShellWithContainer(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        element: <Outlet context={ME} />,
        children: [{ element: <Shell />, children: [
          { index: true, element: <div>contenido</div> },
          { path: 'ventas/nueva', element: <div>Nueva venta</div>, handle: { chrome: 'none' } },
          { path: 'ventas/:id', element: <div>detalle</div>, handle: { chrome: 'none' } },
        ] }],
      },
    ],
    { initialEntries: [initialPath] },
  )
  return render(<RouterProvider router={router} />)
}

test('marks the active item by more than color: a distinct class the other items do not get', () => {
  renderShell('/')

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
  return <div>{`en ${location.pathname} inApp=${String((location.state as { inApp?: boolean } | null)?.inApp)}`}</div>
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
              { index: true, element: <div>contenido</div> },
              { path: 'mas', element: <Mas /> },
              { path: 'settings', element: <Landed />, handle: { chrome: 'card' } },
              { path: 'settings/users', element: <Landed />, handle: { chrome: 'none' } },
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
  const { container } = renderApp('/')
  const rail = container.querySelector('.riel-lateral') as HTMLElement

  const row = within(rail).getByRole('link', { name: 'Configuración de La Huerta' })
  expect(row).toHaveAttribute('href', '/settings')
  expect(row).toHaveTextContent('LH')
  expect(row).toHaveTextContent('La Huerta')
  expect(rail.lastElementChild).toBe(row)
  await userEvent.click(row)

  expect(screen.getByText('en /settings inApp=true')).toBeInTheDocument()
})

test('the phone reaches Configuración in two taps: the Más tab, then its Configuración entry', async () => {
  const { container } = renderApp('/')
  const bar = container.querySelector('.bar-inferior') as HTMLElement

  await userEvent.click(within(bar).getByRole('link', { name: 'Más' }))
  await userEvent.click(
    within(screen.getByRole('navigation', { name: 'Más' })).getByRole('link', { name: /^Configuración/ }),
  )

  expect(screen.getByText('en /settings inApp=true')).toBeInTheDocument()
})

test('on the phone, /settings and its groups mark Más as the active tab; the rail marks the business row', () => {
  for (const path of ['/settings', '/settings/users']) {
    const { container, unmount } = renderApp(path)
    const bar = container.querySelector('.bar-inferior') as HTMLElement
    const rail = container.querySelector('.riel-lateral') as HTMLElement

    if (path === '/settings') {
      const more = within(bar).getByRole('link', { name: 'Más' })
      expect(more).toHaveAttribute('aria-current', 'page')
      expect(more.className).toMatch(/--activo/)
      expect(within(bar).getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current')
      expect(within(rail).getByRole('link', { name: 'Configuración de La Huerta' })).toHaveAttribute(
        'aria-current',
        'page',
      )
    } else {
      // A group is a form: chrome none, no bar at all.
      expect(bar).toBeNull()
    }
    unmount()
  }
})

test('Más is not marked on other routes', () => {
  const { container } = renderApp('/')
  const bar = container.querySelector('.bar-inferior') as HTMLElement

  expect(within(bar).getByRole('link', { name: 'Más' })).not.toHaveAttribute('aria-current')
})
