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
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test } from 'vitest'
import Shell from './Shell'
import { paths } from '../routes/paths'

/** The tabs only, in the order they render — drops the fixed "Nueva venta"
 * button, which shares the rail's `link` role but is not one of the tabs. */
function tabNames(nav: HTMLElement): string[] {
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent)
    .filter((name): name is string => name !== null && !name.startsWith('Nueva venta'))
}

function renderShell(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        element: <Shell />,
        children: [
          { index: true, element: <div>contenido</div> },
          { path: 'ventas/nueva', element: <div>Nueva venta</div>, handle: { chrome: 'none' } },
          { path: 'ventas/:id', element: <div>detalle</div>, handle: { chrome: 'none' } },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  )
  render(<RouterProvider router={router} />)
}

test('shows exactly Inicio, Ventas, Clientes, Stock and Más in both navs, no handle on the route', () => {
  renderShell(paths.home())

  const navs = screen.getAllByRole('navigation')
  expect(navs).toHaveLength(2)
  for (const nav of navs) {
    expect(tabNames(nav)).toEqual(['Inicio', 'Ventas', 'Clientes', 'Stock', 'Más'])
  }
})

test('the fixed "Nueva venta" button shows outside a chrome route, once per nav rail', () => {
  renderShell(paths.home())

  const links = screen.getAllByRole('link', { name: /Nueva venta/ })
  expect(links).toHaveLength(2)
  for (const link of links) {
    expect(link).toHaveAttribute('href', paths.newSale())
  }
})

test('chrome: none hides the fixed "Nueva venta" button everywhere, phone and computer alike', () => {
  renderShell(paths.newSale())

  expect(screen.queryByRole('link', { name: /Nueva venta/ })).not.toBeInTheDocument()
})

test('chrome: none drops the bottom bar outright — the phone case', () => {
  const { container } = renderShellWithContainer(paths.newSale())

  expect(container.querySelector('.bar-inferior')).toBeNull()
})

test('chrome: none keeps the rail and its tabs — the computer case, only the button is gone', () => {
  const { container } = renderShellWithContainer(paths.sale(7))

  const rail = container.querySelector('.riel-lateral')
  expect(rail).not.toBeNull()
  expect(tabNames(rail as HTMLElement)).toEqual(['Inicio', 'Ventas', 'Clientes', 'Stock', 'Más'])
})

function renderShellWithContainer(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        element: <Shell />,
        children: [
          { index: true, element: <div>contenido</div> },
          { path: 'ventas/nueva', element: <div>Nueva venta</div>, handle: { chrome: 'none' } },
          { path: 'ventas/:id', element: <div>detalle</div>, handle: { chrome: 'none' } },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  )
  return render(<RouterProvider router={router} />)
}

test('marks the active item by more than color: a distinct class the other items do not get', () => {
  renderShell(paths.home())

  const inicioLinks = screen.getAllByRole('link', { name: 'Inicio' })
  const clientesLinks = screen.getAllByRole('link', { name: 'Clientes' })
  for (const link of inicioLinks) {
    expect(link.className).toMatch(/--activo/)
  }
  for (const link of clientesLinks) {
    expect(link.className).not.toMatch(/--activo/)
  }
})
