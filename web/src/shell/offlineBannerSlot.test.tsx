/**
 * The offline notice's slot at the screen seam: `Root` and `Shell` rendered under a memory data
 * router with the viewport set by `test-viewport.ts`, the app offline. Whatever the width, the
 * route or a resize, exactly one notice is drawn: in `.aviso-flotante` on the phone, as the
 * first child of the Shell's content column on a computer, and as a row at the top of the page
 * where there is no Shell. Placement is structural, so it is read from the notice's own classes.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Profiler, StrictMode, useState } from 'react'
import { createMemoryRouter, Link, RouterProvider, type RouteObject } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import common from '../copy/locales/en/common.json'
import { LOGIN, pathTo, SALE, SALES, CUSTOMERS, SCREENS, type Screen } from '../routes'
import Root from '../Root'
import { flipViewport, stubViewport } from '../test-viewport'
import { SHOWN_EN } from '../test/shownLanguage'
import GatedLayout from './GatedLayout'
import { useClaimOfflineBannerSlot } from './useOfflineBannerSlot'
import Shell from './Shell'
import type { Viewport } from '../routes'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03', shown_language: SHOWN_EN, money: { symbol: '$', decimals: 0 } }

const SHELL_SCREENS = new Set(['sales', 'sale', 'customers'])

type MeAnswer = 'ok' | 'network' | 'unauthorized'
const meAnswer = { current: 'ok' as MeAnswer }

function leaf(entry: Screen): RouteObject {
  return { path: entry.path, element: <div>{`pantalla ${entry.id}`}</div>, handle: { screen: entry.id } }
}

function stubFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      if (!String(input).includes('/auth/me') || meAnswer.current === 'network') {
        return Promise.reject(new TypeError('Failed to fetch'))
      }
      if (meAnswer.current === 'unauthorized') {
        return Promise.resolve(new Response(JSON.stringify({ detail: 'no' }), { status: 401, headers: { 'Content-Type': 'application/json' } }))
      }
      return Promise.resolve(new Response(JSON.stringify(ME), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    }),
  )
}

function renderApp(
  entry: string,
  viewport: Viewport,
  options: { strict?: boolean; extra?: RouteObject[]; client?: QueryClient } = {},
) {
  stubViewport(viewport)
  stubFetch()
  const router = createMemoryRouter(
    [
      {
        element: <Root />,
        children: [
          { path: LOGIN, element: <div>Sign in page</div> },
          ...(options.extra ?? []),
          { element: <GatedLayout />, children: [{ element: <Shell />, children: SCREENS.filter((s) => SHELL_SCREENS.has(s.id)).map(leaf) }] },
        ],
      },
    ],
    { initialEntries: [entry] },
  )
  const queryClient = options.client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const tree = (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  const view = render(options.strict === true ? <StrictMode>{tree}</StrictMode> : tree)
  return { router, queryClient, ...view }
}

function banners(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.aviso-sin-conexion')]
}

beforeEach(() => {
  meAnswer.current = 'ok'
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('on the phone the one notice floats in .aviso-flotante', async () => {
  renderApp(SALES, 'phone')
  await screen.findByText('pantalla sales')

  expect(banners()).toHaveLength(1)
  expect(banners()[0]?.closest('.aviso-flotante')).not.toBeNull()
  expect(banners()[0]?.closest('.columna-principal')).toBeNull()
  expect(screen.getAllByText(common.offline)).toHaveLength(1)
})

test('on a computer with the Shell the notice is the first child of the column, before the back arrow', async () => {
  renderApp(pathTo(SALE, { id: 7 }), 'computer')
  await screen.findByText('pantalla sale')

  expect(banners()).toHaveLength(1)
  const column = document.querySelector('.columna-principal') as HTMLElement
  expect(column.firstElementChild).toBe(banners()[0])
  expect(banners()[0]?.closest('.aviso-flotante')).toBeNull()
  const back = within(column).getByRole('button')
  expect(column.contains(back)).toBe(true)
  expect(banners()[0]?.compareDocumentPosition(back)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
})

test('a root screen on a computer has the notice first in the column as well', async () => {
  renderApp(SALES, 'computer')
  await screen.findByText('pantalla sales')

  expect(banners()).toHaveLength(1)
  expect((document.querySelector('.columna-principal') as HTMLElement).firstElementChild).toBe(banners()[0])
})

test('on a computer with no Shell the notice is a row at the top of the page, outside .aviso-flotante', async () => {
  renderApp(LOGIN, 'computer')
  await screen.findByText('Sign in page')

  expect(banners()).toHaveLength(1)
  expect(banners()[0]?.closest('.aviso-flotante')).toBeNull()
  expect(banners()[0]?.classList.contains('aviso-sin-conexion--pagina')).toBe(true)
})

test('a resize across 900 keeps exactly one notice, each time where it belongs', async () => {
  renderApp(SALES, 'phone')
  await screen.findByText('pantalla sales')

  flipViewport('computer')
  expect(banners()).toHaveLength(1)
  expect(banners()[0]?.closest('.columna-principal')).not.toBeNull()
  expect(banners()[0]?.closest('.aviso-flotante')).toBeNull()

  flipViewport('phone')
  expect(banners()).toHaveLength(1)
  expect(banners()[0]?.closest('.aviso-flotante')).not.toBeNull()

  flipViewport('computer')
  expect(banners()).toHaveLength(1)
  expect(banners()[0]?.closest('.columna-principal')).not.toBeNull()
})

test('under StrictMode the Shell keeps the slot: one notice, in the column', async () => {
  renderApp(SALES, 'computer', { strict: true })
  await screen.findByText('pantalla sales')

  expect(banners()).toHaveLength(1)
  expect(banners()[0]?.closest('.columna-principal')).not.toBeNull()
})

test('when the Shell unmounts on a 401, Root draws the notice in its place', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  renderApp(SALES, 'computer', { client })
  await screen.findByText('pantalla sales')
  expect(banners()[0]?.closest('.columna-principal')).not.toBeNull()

  meAnswer.current = 'unauthorized'
  await act(async () => {
    await client.refetchQueries()
  })

  expect(screen.queryByText('pantalla sales')).not.toBeInTheDocument()
  expect(banners()).toHaveLength(1)
  expect(banners()[0]?.closest('.columna-principal')).toBeNull()
  expect(banners()[0]?.classList.contains('aviso-sin-conexion--pagina')).toBe(true)
})

test('between two Shell routes the notice is the same DOM node', async () => {
  const { router } = renderApp(SALES, 'computer')
  await screen.findByText('pantalla sales')
  const before = banners()[0]

  await act(async () => {
    await router.navigate(CUSTOMERS)
  })

  expect(screen.getByText('pantalla customers')).toBeInTheDocument()
  expect(banners()).toHaveLength(1)
  expect(banners()[0]).toBe(before)
})

test('when GatedLayout cannot reach "me", the notice and the inline notice both show', async () => {
  meAnswer.current = 'network'
  renderApp(SALES, 'computer')

  await waitFor(() => expect(screen.getAllByText(common.offline)).toHaveLength(2))
  expect(banners()).toHaveLength(1)
  expect(banners()[0]?.closest('.aviso-flotante')).toBeNull()
})

test('a claim and a release re-render no leaf screen', async () => {
  const user = userEvent.setup()
  let renders = 0
  function Toggler() {
    const [on, setOn] = useState(false)
    return (
      <>
        <button type="button" onClick={() => setOn((now) => !now)}>
          toggle
        </button>
        {on && <Claimant />}
      </>
    )
  }
  function Claimant() {
    useClaimOfflineBannerSlot()
    return null
  }
  renderApp('/hoja', 'computer', {
    extra: [
      {
        path: '/hoja',
        element: (
          <>
            <Profiler id="hoja" onRender={() => (renders += 1)}>
              <Link to="/hoja">hoja</Link>
            </Profiler>
            <Toggler />
          </>
        ),
      },
    ],
  })
  await screen.findByText('hoja')
  expect(banners()).toHaveLength(1)
  const settled = renders

  await user.click(screen.getByRole('button', { name: 'toggle' }))
  expect(banners()).toHaveLength(0)
  await user.click(screen.getByRole('button', { name: 'toggle' }))
  expect(banners()).toHaveLength(1)

  expect(renders).toBe(settled)
})
