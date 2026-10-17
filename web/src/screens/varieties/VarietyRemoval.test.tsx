/**
 * A live variety's removal action at the screen seam (`varieties.md`, "Deleting and
 * archiving"): `VarietyPage` through Testing Library, the real router and flash provider,
 * `fetch` faked. The page shows the one action `GET /varieties/{id}` says (`removal`), asks
 * first, and leaves by the toast and the route the PRD names; it never invents a name or an
 * amount in a toast, the console or storage.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, RouterProvider, createMemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { keys } from '../../api/keys'
import type { Me } from '../../api/me'
import FlashProvider from '../../flash/FlashProvider'
import { VARIETIES, VARIETY, pathTo, relative } from '../../routes'
import VarietyPage from './VarietyPage'
import VarietyRoute from './VarietyRoute'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }
const GONE_TEXT = "That's gone. The list is up to date."
const ARCHIVE_DETAIL =
  'Te quedan 12 g. Si la archivás, dejan de verse en Inicio y en las listas, pero el stock queda guardado.'

function variety(id: number, name: string, removal: 'delete' | 'archive' | null = 'archive') {
  return { id, name, archived: false, removal, current_price: null }
}

function stockOf(grams: number) {
  const row = { variety_id: 2, grams, status: 'ok', sold_out_since: null, threshold: null, days_left: null }
  return { total: grams, varieties: [row], entries: [] }
}

const CATALOG = { text: '', header: '', footer: '', varieties: [] }

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

type Answers = Record<string, () => Response>

function defaults(removal: 'delete' | 'archive' | null, grams: number): Answers {
  return {
    'GET /varieties/2': () => json(200, variety(2, 'Blue Dream', removal)),
    'GET /varieties/2/prices': () => json(200, []),
    'GET /stock': () => json(200, stockOf(grams)),
    'GET /catalog': () => json(200, CATALOG),
  }
}

function Where() {
  const location = useLocation()
  return <output aria-label="ubicación">{location.pathname}</output>
}

function setComputer(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  })
}

interface Options {
  removal?: 'delete' | 'archive' | null
  grams?: number
  overrides?: Answers
  /** The list the left pane would have cached, as `GET /varieties` answered it. */
  list?: unknown[]
  computer?: boolean
}

function renderPage({ removal = 'archive', grams = 12, overrides = {}, list, computer = false }: Options = {}) {
  setComputer(computer)
  const answers = { ...defaults(removal, grams), ...overrides }
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const answer = answers[`${init?.method ?? 'GET'} ${url}`]
    if (answer === undefined) return Promise.reject(new Error(`unexpected request: ${init?.method ?? 'GET'} ${url}`))
    return Promise.resolve(answer())
  })
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (list !== undefined) queryClient.setQueryData(keys.varieties(), list)
  const router = createMemoryRouter(
    [
      {
        element: (
          <QueryClientProvider client={queryClient}>
            <FlashProvider>
              <Outlet context={ME} />
              <Where />
            </FlashProvider>
          </QueryClientProvider>
        ),
        children: [
          { path: relative(VARIETIES), element: <main>Pantalla Variedades</main> },
          {
            path: relative(VARIETY),
            element: <VarietyRoute render={(varietyId) => <VarietyPage varietyId={varietyId} />} />,
          },
        ],
      },
    ],
    { initialEntries: [VARIETIES, pathTo(VARIETY, { id: 2 })], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
  return { router, fetchMock, queryClient }
}

function writes(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls
    .map(([url, init]) => ({ url: url as string, method: (init as RequestInit | undefined)?.method ?? 'GET' }))
    .filter(({ method }) => method !== 'GET')
    .map(({ url, method }) => `${method} ${url}`)
}

function reads(fetchMock: ReturnType<typeof vi.fn>, call: string): number {
  return fetchMock.mock.calls.filter(
    ([url, init]) => `${(init as RequestInit | undefined)?.method ?? 'GET'} ${url as string}` === call,
  ).length
}

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(window, 'matchMedia')
})

describe('the action the page offers', () => {
  test.each([
    ['delete', 'Eliminar variedad', 'Archivar variedad'],
    ['archive', 'Archivar variedad', 'Eliminar variedad'],
  ] as const)('removal "%s" offers "%s" and never "%s"', async (removal, offered, refused) => {
    renderPage({ removal })

    expect(await screen.findByRole('button', { name: offered })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: refused })).not.toBeInTheDocument()
  })

  test('"Eliminar variedad" is an icon + text critical action, not a filled button; only the dialog fills', async () => {
    const user = userEvent.setup()
    renderPage({ removal: 'delete' })

    const trigger = await screen.findByRole('button', { name: 'Eliminar variedad' })
    expect(trigger.textContent).toBe('Eliminar variedad')
    expect(trigger.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(trigger).toHaveClass('boton--critico')
    expect(trigger).not.toHaveClass('boton--destructivo')
    expect(trigger).not.toHaveClass('boton-icono')
    expect(document.querySelectorAll('.boton--destructivo')).toHaveLength(0)

    await user.click(trigger)

    const confirm = screen.getByRole('button', { name: 'Sí, eliminala' })
    expect(confirm).toHaveClass('boton--destructivo')
    expect(document.querySelectorAll('.boton--destructivo')).toHaveLength(1)
  })

  test('"Archivar variedad" keeps its non-destructive look', async () => {
    renderPage({ removal: 'archive' })

    const trigger = await screen.findByRole('button', { name: 'Archivar variedad' })
    expect(trigger).toHaveClass('boton--suave')
    expect(trigger).not.toHaveClass('boton--critico')
  })

  test('a page that offers no removal shows neither action', async () => {
    renderPage({ removal: null })

    await screen.findByRole('heading', { name: 'Blue Dream' })
    expect(screen.queryByRole('button', { name: /variedad$/ })).not.toBeInTheDocument()
  })
})

describe('archiving', () => {
  test('asks first, naming the grams on hand, and nothing is sent until it is confirmed', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderPage({ overrides: { 'POST /varieties/2/archive': () => json(200, {}) } })

    await user.click(await screen.findByRole('button', { name: 'Archivar variedad' }))

    expect(screen.getByRole('alertdialog')).toHaveTextContent(ARCHIVE_DETAIL)
    expect(writes(fetchMock)).toEqual([])
  })

  test('with zero stock it simply asks, with no grams', async () => {
    const user = userEvent.setup()
    renderPage({ grams: 0 })

    await user.click(await screen.findByRole('button', { name: 'Archivar variedad' }))

    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Si la archivás, dejan de verse en Inicio y en las listas, pero el stock queda guardado.',
    )
    expect(screen.getByRole('alertdialog')).not.toHaveTextContent('Te quedan')
  })

  test('with negative stock it says the shortfall, not "Te quedan"', async () => {
    const user = userEvent.setup()
    renderPage({ grams: -5 })

    await user.click(await screen.findByRole('button', { name: 'Archivar variedad' }))

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Tiene un faltante de 5 g.')
    expect(screen.getByRole('alertdialog')).not.toHaveTextContent('Te quedan')
  })

  test('"No, dejala" closes the dialog and sends nothing', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Archivar variedad' }))

    await user.click(screen.getByRole('button', { name: 'No, dejala' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(writes(fetchMock)).toEqual([])
  })

  test('confirming archives, goes back to Variedades and says "Variedad archivada"', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderPage({ overrides: { 'POST /varieties/2/archive': () => json(200, {}) } })
    await user.click(await screen.findByRole('button', { name: 'Archivar variedad' }))

    await user.click(screen.getByRole('button', { name: 'Sí, archivala' }))

    expect(await screen.findByText('Pantalla Variedades')).toBeInTheDocument()
    expect(await screen.findByText('Variedad archivada')).toBeInTheDocument()
    expect(writes(fetchMock)).toEqual(['POST /varieties/2/archive'])
  })
})

describe('deleting', () => {
  test('asks first in a destructive dialog, then deletes, goes back and says "Variedad eliminada"', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderPage({
      removal: 'delete',
      overrides: { 'DELETE /varieties/2': () => new Response(null, { status: 204 }) },
    })
    await user.click(await screen.findByRole('button', { name: 'Eliminar variedad' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Esto no se puede deshacer.')
    expect(writes(fetchMock)).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Sí, eliminala' }))

    expect(await screen.findByText('Pantalla Variedades')).toBeInTheDocument()
    expect(await screen.findByText('Variedad eliminada')).toBeInTheDocument()
    expect(writes(fetchMock)).toEqual(['DELETE /varieties/2'])
  })

  test('history that appeared after the page loaded: no toast, the page is read again and offers "Archivar variedad"', async () => {
    const user = userEvent.setup()
    let removal: 'delete' | 'archive' = 'delete'
    const { fetchMock } = renderPage({
      removal: 'delete',
      overrides: {
        'GET /varieties/2': () => json(200, variety(2, 'Blue Dream', removal)),
        'DELETE /varieties/2': () => {
          removal = 'archive'
          return json(409, { code: 'variety.has_history' })
        },
      },
    })
    await user.click(await screen.findByRole('button', { name: 'Eliminar variedad' }))

    await user.click(screen.getByRole('button', { name: 'Sí, eliminala' }))

    expect(await screen.findByRole('button', { name: 'Archivar variedad' })).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByText(/^Variedad (eliminada|archivada)$/)).not.toBeInTheDocument()
    expect(reads(fetchMock, 'GET /varieties/2')).toBe(2)
  })
})

describe('a variety that is already gone', () => {
  test.each(['variety.not_found', 'variety.archived'])(
    'a confirm answered "%s" closes the dialog, refreshes and says the generic notice',
    async (code) => {
      const user = userEvent.setup()
      const { fetchMock } = renderPage({
        removal: 'delete',
        // The page itself stays readable, so the notice is on screen, not the gone screen.
        overrides: { 'DELETE /varieties/2': () => json(404, { code }) },
      })
      await user.click(await screen.findByRole('button', { name: 'Eliminar variedad' }))

      await user.click(screen.getByRole('button', { name: 'Sí, eliminala' }))

      expect(await screen.findByText(GONE_TEXT)).toBeInTheDocument()
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(screen.queryByText('Variedad eliminada')).not.toBeInTheDocument()
      await waitFor(() => expect(reads(fetchMock, 'GET /varieties/2')).toBeGreaterThan(1))
    },
  )
})

describe('a dropped network or a failure', () => {
  test('offline keeps the page and says so, with no toast', async () => {
    const user = userEvent.setup()
    renderPage({
      overrides: {
        'POST /varieties/2/archive': () => {
          throw new TypeError('Failed to fetch')
        },
      },
    })
    await user.click(await screen.findByRole('button', { name: 'Archivar variedad' }))

    await user.click(screen.getByRole('button', { name: 'Sí, archivala' }))

    expect(await screen.findByText(/connection/i)).toBeInTheDocument()
    expect(screen.queryByText(/^Variedad (eliminada|archivada)$/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Blue Dream' })).toBeInTheDocument()
  })
})

describe('the computer', () => {
  const LIST = [variety(1, 'Amnesia'), variety(2, 'Blue Dream'), variety(3, 'Critical')]

  test('removing the selected variety selects the next one by name', async () => {
    const user = userEvent.setup()
    renderPage({ computer: true, list: LIST, overrides: { 'POST /varieties/2/archive': () => json(200, {}) } })
    await user.click(await screen.findByRole('button', { name: 'Archivar variedad' }))

    await user.click(screen.getByRole('button', { name: 'Sí, archivala' }))

    await waitFor(() => expect(screen.getByLabelText('ubicación')).toHaveTextContent(pathTo(VARIETY, { id: 3 })))
  })

  test('the last one by name selects the previous one', async () => {
    const user = userEvent.setup()
    renderPage({
      computer: true,
      list: [variety(1, 'Amnesia'), variety(2, 'Blue Dream')],
      overrides: { 'POST /varieties/2/archive': () => json(200, {}) },
    })
    await user.click(await screen.findByRole('button', { name: 'Archivar variedad' }))

    await user.click(screen.getByRole('button', { name: 'Sí, archivala' }))

    await waitFor(() => expect(screen.getByLabelText('ubicación')).toHaveTextContent(pathTo(VARIETY, { id: 1 })))
  })

  test('the only one left goes to the list with nothing selected', async () => {
    const user = userEvent.setup()
    const { queryClient } = renderPage({
      computer: true,
      removal: 'delete',
      list: [variety(2, 'Blue Dream', 'delete')],
      overrides: { 'DELETE /varieties/2': () => new Response(null, { status: 204 }) },
    })
    await user.click(await screen.findByRole('button', { name: 'Eliminar variedad' }))

    await user.click(screen.getByRole('button', { name: 'Sí, eliminala' }))

    await waitFor(() => expect(screen.getByLabelText('ubicación')).toHaveTextContent(/^\/varieties$/))
    expect(queryClient.getQueryData(keys.varieties())).toEqual([])
  })

  test('a phone goes back to Variedades, whatever the list holds', async () => {
    const user = userEvent.setup()
    renderPage({ list: LIST, overrides: { 'POST /varieties/2/archive': () => json(200, {}) } })
    await user.click(await screen.findByRole('button', { name: 'Archivar variedad' }))

    await user.click(screen.getByRole('button', { name: 'Sí, archivala' }))

    await waitFor(() => expect(screen.getByLabelText('ubicación')).toHaveTextContent(/^\/varieties$/))
  })
})

describe('what is never written down', () => {
  test('no name or amount reaches a toast, the console or storage', async () => {
    const user = userEvent.setup()
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) => vi.spyOn(console, method))
    renderPage({ overrides: { 'POST /varieties/2/archive': () => json(200, {}) } })
    await user.click(await screen.findByRole('button', { name: 'Archivar variedad' }))

    await user.click(screen.getByRole('button', { name: 'Sí, archivala' }))

    const toast = (await screen.findByText('Variedad archivada')).closest('.aviso-exito')
    expect(toast).not.toBeNull()
    expect(toast).not.toHaveTextContent('Blue Dream')
    expect(toast).not.toHaveTextContent('12')
    for (const spy of spies) expect(spy).not.toHaveBeenCalled()
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toMatch(/Blue Dream|12/)
    vi.restoreAllMocks()
  })
})
