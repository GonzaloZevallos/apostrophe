/**
 * `Settings`, the list of groups, mounted through the real route table (`router.routes`)
 * under a memory router, so the test also proves what `router.tsx` registers: which chrome
 * the list and a group get, and which groups exist. `matchMedia` is stubbed per case since
 * jsdom lays nothing out: the list's back arrow reads one media query.
 */

import { EXPENSE_CATEGORIES, HOME, MORE, SALES, SETTINGS, SETTINGS_ACCOUNT, SETTINGS_APPEARANCE, SETTINGS_BUSINESS, SETTINGS_CATALOG_MESSAGE, SETTINGS_INTEGRATIONS, SETTINGS_USERS } from '../../routes'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { queryClient } from '../../queryClient'
import { router as appRouter } from '../../router'

const GROUPS = [
  ['Negocio', SETTINGS_BUSINESS],
  ['Usuarios', SETTINGS_USERS],
  ['Integraciones', SETTINGS_INTEGRATIONS],
  ['Mensaje del catálogo', SETTINGS_CATALOG_MESSAGE],
  ['Categorías de gastos', EXPENSE_CATEGORIES],
  ['Apariencia', SETTINGS_APPEARANCE],
  ['Tu cuenta', SETTINGS_ACCOUNT],
] as const

function stubComputer(isComputer: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: isComputer,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  )
}

function renderApp(entries: string[], index?: number) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ),
  )
  const router = createMemoryRouter(appRouter.routes, {
    initialEntries: entries,
    initialIndex: index ?? entries.length - 1,
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router, ...view }
}

afterEach(() => {
  vi.unstubAllGlobals()
  queryClient.clear()
})

test('lists exactly the seven groups in order, each a link to its own route', async () => {
  stubComputer(false)
  renderApp([SETTINGS])

  const list = await screen.findByRole('navigation', { name: 'Configuración' })
  const links = within(list).getAllByRole('link')
  expect(links.map((link) => link.textContent)).toEqual(GROUPS.map(([name]) => name))
  expect(links.map((link) => link.getAttribute('href'))).toEqual(GROUPS.map(([, path]) => path))
})

test('shows the bar and no "+ Nueva venta"', async () => {
  stubComputer(false)
  const { container } = renderApp([SETTINGS])

  await screen.findByRole('navigation', { name: 'Configuración' })

  expect(container.querySelector('.bar-inferior')).not.toBeNull()
  expect(screen.queryByRole('link', { name: /Nueva venta/ })).not.toBeInTheDocument()
})

test('a group route shows no bar and no "+ Nueva venta"', async () => {
  stubComputer(false)
  const { container } = renderApp([SETTINGS_BUSINESS])

  await screen.findByRole('button', { name: 'Cerrar' })

  expect(container.querySelector('.bar-inferior')).toBeNull()
  expect(screen.queryByRole('link', { name: /Nueva venta/ })).not.toBeInTheDocument()
})

test.each(GROUPS)('"%s" opens its group, marking the entry as in-app', async (name, path) => {
  stubComputer(false)
  const user = userEvent.setup()
  const { router } = renderApp([SETTINGS])

  await user.click(await screen.findByRole('link', { name }))

  expect(router.state.location.pathname).toBe(path)
  expect(router.state.location.state).toEqual({ inApp: true })
})

test('every group route exists and closes with "Cerrar"', async () => {
  stubComputer(false)
  for (const [, path] of GROUPS) {
    const { unmount } = renderApp([path])
    expect(await screen.findByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
    unmount()
  }
})

test('reached directly on the phone, back says "‹ Más" and goes to Más', async () => {
  stubComputer(false)
  const user = userEvent.setup()
  const { router } = renderApp(['/otro', SETTINGS], 1)

  await user.click(await screen.findByRole('button', { name: '‹ Más' }))

  expect(router.state.location.pathname).toBe(MORE)
  expect(screen.queryByRole('button', { name: '‹ Inicio' })).not.toBeInTheDocument()
})

test('reached directly on a computer, back says "‹ Inicio" and goes to Inicio', async () => {
  stubComputer(true)
  const user = userEvent.setup()
  const { router } = renderApp(['/otro', SETTINGS], 1)

  await user.click(await screen.findByRole('button', { name: '‹ Inicio' }))

  expect(router.state.location.pathname).toBe(HOME)
})

test('reached by an in-app link, back goes back in history', async () => {
  stubComputer(false)
  const user = userEvent.setup()
  const { router } = renderApp([SALES])
  await act(() => router.navigate(SETTINGS, { state: { inApp: true } }))

  await user.click(await screen.findByRole('button', { name: '‹ Más' }))

  expect(router.state.location.pathname).toBe(SALES)
})
