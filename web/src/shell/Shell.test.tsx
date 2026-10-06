/**
 * `Shell` at the screen seam: rendered under a memory data router with the real route
 * table (`routes` from `router.tsx`), so what it draws for a kind is what the route's
 * own `handle` says, never a pathname comparison. `fetch` answers `/auth/me` and 404s
 * the rest: the screens under test draw their error states, which this suite ignores.
 * jsdom lays nothing out, so the phone/computer switch is checked as markup (which
 * element carries which class), the CSS being the only thing that hides one.
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { queryClient } from '../queryClient'
import { routes } from '../router'
import { paths } from '../routes/paths'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }

function open(entries: string[], index = entries.length - 1) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        new Response(JSON.stringify(url === '/auth/me' ? ME : { code: 'x' }), {
          status: url === '/auth/me' ? 200 : 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ),
  )
  const router = createMemoryRouter(routes, { initialEntries: entries, initialIndex: index })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router, container: view.container }
}

afterEach(() => {
  vi.unstubAllGlobals()
  queryClient.clear()
})

function bar(container: HTMLElement): HTMLElement | null {
  return container.querySelector('.bar-inferior')
}

function sidebar(container: HTMLElement): HTMLElement | null {
  return container.querySelector('.riel-lateral')
}

function labels(nav: HTMLElement): string[] {
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent ?? '')
    .filter((text) => !text.startsWith('Nueva venta'))
}

test('a root shows the bar, the sidebar and "Nueva venta" in both', async () => {
  const { container } = open([paths.home()])
  await screen.findAllByRole('link', { name: /Nueva venta/ })

  expect(bar(container)).not.toBeNull()
  expect(sidebar(container)).not.toBeNull()
  const links = screen.getAllByRole('link', { name: /Nueva venta/ })
  expect(links).toHaveLength(2)
  for (const link of links) expect(link).toHaveAttribute('href', paths.newSale())
  expect(screen.queryByRole('link', { name: /^Volver a/ })).not.toBeInTheDocument()
})

test('the bar lists exactly Inicio, Ventas, Clientes, Variedades and Más', async () => {
  const { container } = open([paths.sales()])
  await screen.findAllByRole('link', { name: /Nueva venta/ })

  expect(labels(bar(container) as HTMLElement)).toEqual([
    'Inicio',
    'Ventas',
    'Clientes',
    'Variedades',
    'Más',
  ])
})

test('the sidebar lists Inicio, Ventas, Clientes, Variedades, a divider, Gastos, Análisis and the business', async () => {
  const { container } = open([paths.sales()])
  const business = await screen.findByRole('link', { name: 'Configuración de La Huerta' })
  const rail = sidebar(container) as HTMLElement

  expect(labels(rail)).toEqual([
    'Inicio',
    'Ventas',
    'Clientes',
    'Variedades',
    'Gastos',
    'Análisis',
    'LHLa Huerta',
  ])
  expect(business).toHaveAttribute('href', paths.settings())
  expect(within(rail).getByRole('separator')).toBeInTheDocument()
  expect(within(rail).queryByRole('link', { name: 'Más' })).not.toBeInTheDocument()
  // The business row is the last thing in the rail, the divider sits before Gastos.
  const all = [...rail.querySelectorAll('a, [role="separator"]')]
  expect(all.at(-1)).toBe(business)
  expect(all.at(-4)).toBe(within(rail).getByRole('separator'))
})

test('a detail shows the bar, the sidebar and its parent, never "Nueva venta"', async () => {
  const { container } = open([paths.sale(3)])
  const back = await screen.findByRole('link', { name: 'Volver a Ventas' })

  expect(back).toHaveAttribute('href', paths.sales())
  expect(back).toHaveTextContent('Ventas')
  expect(bar(container)).not.toBeNull()
  expect(sidebar(container)).not.toBeNull()
  expect(screen.queryByRole('link', { name: /Nueva venta/ })).not.toBeInTheDocument()
})

test.each([paths.newSale(), paths.newEntry(), paths.settingsUsers()])(
  'a form (%s) shows neither bar nor sidebar nor "Nueva venta", nor a back link',
  async (path) => {
    const { container } = open([path])
    await waitFor(() => expect(container.querySelector('.disposicion')).not.toBeNull())

    expect(bar(container)).toBeNull()
    expect(sidebar(container)).toBeNull()
    expect(screen.queryByRole('link', { name: /Nueva venta/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Volver a/ })).not.toBeInTheDocument()
  },
)

test('back goes to the previous screen when there is history', async () => {
  const { router } = open([paths.customers(), paths.sale(3)])
  const back = await screen.findByRole('link', { name: 'Volver a Ventas' })

  await userEvent.click(back)

  await waitFor(() => expect(router.state.location.pathname).toBe(paths.customers()))
})

test('back goes to the parent when there is no history', async () => {
  const { router } = open([paths.sale(3)])
  const back = await screen.findByRole('link', { name: 'Volver a Ventas' })

  await userEvent.click(back)

  await waitFor(() => expect(router.state.location.pathname).toBe(paths.sales()))
})

test('Configuración renders both parents, each tagged with the viewport the CSS shows it on', async () => {
  open([paths.settings()])
  const phone = await screen.findByRole('link', { name: 'Volver a Más' })
  const computer = screen.getByRole('link', { name: 'Volver a Inicio' })

  expect(phone).toHaveAttribute('href', paths.more())
  expect(phone).toHaveClass('volver--telefono')
  expect(computer).toHaveAttribute('href', paths.home())
  expect(computer).toHaveClass('volver--compu')
})

test('the active tab carries aria-current and a mark that is not color, in both navs', async () => {
  const { container } = open([paths.customer(4)])
  await screen.findByRole('link', { name: 'Volver a Clientes' })

  for (const nav of [bar(container), sidebar(container)]) {
    const current = within(nav as HTMLElement).getAllByRole('link', { current: 'page' })
    expect(current.map((link) => link.textContent)).toEqual(['Clientes'])
    expect(current[0]?.className).toMatch(/--activo/)
    const others = within(nav as HTMLElement)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === null)
    for (const link of others) expect(link.className).not.toMatch(/--activo/)
  }
})

test('a settings detail marks Más on the phone bar', async () => {
  const { container } = open([paths.settings()])
  await screen.findByRole('link', { name: 'Volver a Más' })

  const current = within(bar(container) as HTMLElement).getByRole('link', { current: 'page' })
  expect(current).toHaveTextContent('Más')
  const row = within(sidebar(container) as HTMLElement).getByRole('link', {
    name: 'Configuración de La Huerta',
  })
  expect(row).toHaveAttribute('aria-current', 'page')
})

test('Gastos is current in the sidebar and no bar tab is', async () => {
  const { container } = open([paths.expenses()])
  await screen.findAllByRole('link', { name: /Nueva venta/ })

  const rail = sidebar(container) as HTMLElement
  expect(within(rail).getByRole('link', { current: 'page' })).toHaveTextContent('Gastos')
  expect(within(bar(container) as HTMLElement).queryByRole('link', { current: 'page' })).toBeNull()
})

test('Inicio opens Configuración from the business avatar at its top', async () => {
  const { container } = open([paths.home()])
  await screen.findAllByRole('link', { name: 'Configuración de La Huerta' })

  const avatar = container.querySelector('.avatar--inicio')
  expect(avatar).toHaveAttribute('href', paths.settings())
  expect(avatar).toHaveTextContent('LH')
})
