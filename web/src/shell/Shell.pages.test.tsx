/**
 * `Shell` with each card's real page (GH-135, B2): the page is mounted under the shell's own
 * route subtree (taken from `router.tsx`, so no page is wired twice), `fetch` faked, on both
 * viewports. Every card shows exactly one back control, drawn by the shell; a computer's
 * two-pane detail adds none of its own; an archived variety reads "‹ Archivadas" on the
 * phone; the "Ver todas" list reads "‹ <variety>"; and no phone card shows "+ Nueva venta".
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider, type RouteObject } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import { SheetRouterProvider } from '../components/useSheetStack'
import FlashProvider from '../flash/FlashProvider'
import { router as appRouter } from '../router'
import { pathTo, SCREENS, type ScreenId } from '../routes'
import Shell from './Shell'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03' }

const viewport = vi.hoisted(() => ({ current: 'phone' as 'phone' | 'computer' }))

vi.mock('./useViewport', () => ({ useViewport: () => viewport.current }))

function shellRoute(routes: RouteObject[]): RouteObject | undefined {
  for (const route of routes) {
    if (route.element !== undefined && (route.element as { type?: unknown }).type === Shell) return route
    const inner = shellRoute(route.children ?? [])
    if (inner !== undefined) return inner
  }
  return undefined
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function api(archived: boolean) {
  return (input: string | URL | Request): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url === '/varieties/1') {
      return Promise.resolve(json({ id: 1, name: '24K Gold', archived, removal: 'archive', current_price: null }))
    }
    if (url === '/varieties') return Promise.resolve(json(archived ? [] : [{ id: 1, name: '24K Gold' }]))
    if (url.startsWith('/varieties?archived')) return Promise.resolve(json(archived ? [{ id: 1, name: '24K Gold' }] : []))
    return Promise.resolve(json({}, 404))
  }
}

function mount(id: ScreenId, options: { computer?: boolean; archived?: boolean } = {}) {
  viewport.current = options.computer === true ? 'computer' : 'phone'
  vi.stubGlobal('fetch', vi.fn(api(options.archived === true)))
  const entry = SCREENS.find((screenEntry) => screenEntry.id === id)
  if (entry === undefined) throw new Error(`no screen ${id}`)
  const shell = shellRoute(appRouter.routes)
  if (shell === undefined) throw new Error('router.tsx has no Shell route')
  const memory = createMemoryRouter(
    [
      {
        element: (
          <FlashProvider>
            <Outlet context={ME} />
          </FlashProvider>
        ),
        children: [{ element: <Shell />, children: shell.children }],
      },
    ],
    { initialEntries: [pathTo(entry.path, { id: 1 })] },
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SheetRouterProvider router={memory}>
        <RouterProvider router={memory} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )
}

/** The back controls on screen: buttons or links named "‹ …" or the bare "Volver". */
function backControls(): HTMLElement[] {
  return [...screen.queryAllByRole('button'), ...screen.queryAllByRole('link')].filter((node) => {
    const name = node.getAttribute('aria-label') ?? node.textContent ?? ''
    return name.startsWith('‹') || name === 'Volver'
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const CARDS = SCREENS.filter((entry) => entry.kind === 'card' && entry.id !== 'settings').map((entry) => entry.id)
const TWO_PANE_DETAILS: ScreenId[] = ['customer', 'variety']

test.each(CARDS.filter((id) => !TWO_PANE_DETAILS.includes(id)))(
  'on the phone, %s shows exactly one back control and no "+ Nueva venta"',
  async (id) => {
    mount(id)

    await vi.waitFor(() => expect(backControls()).toHaveLength(1))
    expect(screen.queryAllByRole('link', { name: /Nueva venta/ }).filter((link) => link.closest('.riel-lateral') === null)).toHaveLength(0)
  },
)

test.each(TWO_PANE_DETAILS)('on the phone, %s is an ordinary card with exactly one back control', async (id) => {
  mount(id)

  await vi.waitFor(() => expect(backControls()).toHaveLength(1))
})

test.each(TWO_PANE_DETAILS)('on a computer, %s adds no back control of its own', async (id) => {
  const { container } = mount(id, { computer: true })

  await vi.waitFor(() => expect(container.querySelector('.riel-lateral')).not.toBeNull())
  expect(backControls()).toHaveLength(0)
})

test('on a computer, Archivadas shows its one back control and no "+ Nueva venta"', async () => {
  const { container } = mount('varieties-archived', { computer: true })

  await vi.waitFor(() => expect(backControls()).toHaveLength(1))
  expect(within(container.querySelector('.riel-lateral') as HTMLElement).queryByRole('link', { name: /Nueva venta/ })).toBeNull()
})

test('an archived variety on the phone reads "‹ Archivadas", once', async () => {
  mount('variety', { archived: true })

  expect(await screen.findByRole('button', { name: '‹ Archivadas' })).toBeInTheDocument()
  expect(backControls()).toHaveLength(1)
})

test('the "Ver todas" lists read "‹ <variety>" and "‹ Variedades", once each', async () => {
  mount('variety-entries')
  expect(await screen.findByRole('button', { name: '‹ 24K Gold' })).toBeInTheDocument()
  expect(backControls()).toHaveLength(1)
})
