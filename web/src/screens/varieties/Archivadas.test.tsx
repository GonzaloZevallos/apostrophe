/**
 * Archivadas at the screen seam (`varieties.md`, "Archivadas"): the count at the foot of
 * Variedades and its absence, the card listing only archived varieties by name with
 * "Archivada" and "Restaurar", restore in one tap from the card and from the archived
 * variety's read-only page, and that page offering no action but "Restaurar".
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import FlashProvider from '../../flash/FlashProvider'
import { ARCHIVED_VARIETIES, VARIETIES, VARIETY, relative } from '../../routes'
import Variedades from '../Variedades'
import ArchivedVarieties from './ArchivedVarieties'
import VarietyPage from './VarietyPage'
import VarietyRoute from './VarietyRoute'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const ARCHIVED = [
  { id: 5, name: 'Zeta Vieja', archived: true, current_price: null },
  { id: 4, name: 'Alfa Vieja', archived: true, current_price: null },
]
const NO_STOCK = { total: 0, varieties: [], entries: [] }
const ARCHIVED_STOCK = {
  total: 7,
  varieties: [{ variety_id: 4, grams: 7, status: 'ok', sold_out_since: null, threshold: null, days_left: null }],
  entries: [],
}
const CATALOG = { text: '', header: '', footer: '', varieties: [] }

type Answers = Record<string, () => Response>

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

function renderAt(path: string, overrides: Answers = {}) {
  setComputer(false)
  const answers: Answers = {
    'GET /varieties': () => json(200, []),
    'GET /varieties?archived=true': () => json(200, ARCHIVED),
    'GET /stock': () => json(200, NO_STOCK),
    'GET /stock?archived=true': () => json(200, ARCHIVED_STOCK),
    'GET /catalog': () => json(200, CATALOG),
    'GET /varieties/4': () => json(200, { id: 4, name: 'Alfa Vieja', archived: true, removal: null, current_price: null }),
    'GET /varieties/4/prices': () => json(200, []),
    'POST /varieties/4/restore': () => json(200, { id: 4, name: 'Alfa Vieja', archived: false, removal: 'archive' }),
    ...overrides,
  }
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const answer = answers[`${init?.method ?? 'GET'} ${url}`]
    if (answer === undefined) return Promise.reject(new Error(`unexpected request: ${init?.method ?? 'GET'} ${url}`))
    return Promise.resolve(answer())
  })
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      {
        element: (
          <QueryClientProvider client={queryClient}>
            <FlashProvider>
              <Outlet context={ME} />
            </FlashProvider>
          </QueryClientProvider>
        ),
        children: [
          { path: relative(VARIETIES), element: <Variedades /> },
          { path: relative(ARCHIVED_VARIETIES), element: <ArchivedVarieties /> },
          {
            path: relative(VARIETY(':id')),
            element: <VarietyRoute render={(id) => <VarietyPage varietyId={id} />} />,
          },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return { fetchMock, router }
}

afterEach(() => vi.unstubAllGlobals())

describe('Archivadas (N) on Variedades', () => {
  test('shows the count of archived varieties and links to the card', async () => {
    renderAt(VARIETIES)
    const link = await screen.findByRole('link', { name: /Archivadas \(2\)/ })
    expect(link.getAttribute('href')).toBe(ARCHIVED_VARIETIES)
  })

  test('shows nothing when there are none', async () => {
    renderAt(VARIETIES, { 'GET /varieties?archived=true': () => json(200, []) })
    await screen.findByText('Todas las entradas')
    await waitFor(() => expect(screen.queryByText(/Archivadas \(/)).toBeNull())
  })
})

describe('the Archivadas card', () => {
  test('lists the archived varieties by name, each marked Archivada with Restaurar', async () => {
    renderAt(ARCHIVED_VARIETIES)
    await screen.findByText('Alfa Vieja')
    const names = screen.getAllByText(/Vieja$/).map((node) => node.textContent)
    expect(names).toEqual(['Alfa Vieja', 'Zeta Vieja'])
    expect(screen.getAllByText('Archivada')).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Restaurar' })).toHaveLength(2)
    expect(screen.getByRole('link', { name: '‹ Variedades' })).toBeTruthy()
    expect(screen.queryByText('+ Nueva venta')).toBeNull()
  })

  test('says so with a fixed line when there are none', async () => {
    renderAt(ARCHIVED_VARIETIES, { 'GET /varieties?archived=true': () => json(200, []) })
    expect(await screen.findByText('No tenés variedades archivadas')).toBeTruthy()
  })

  test('restores in one tap, with the toast and no confirmation', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderAt(ARCHIVED_VARIETIES)
    await screen.findByText('Alfa Vieja')
    await user.click(screen.getAllByRole('button', { name: 'Restaurar' })[0]!)
    expect(await screen.findByText('Variedad restaurada')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').map(([url]) => url)
    expect(posts).toEqual(['/varieties/4/restore'])
  })

  test('a variety already gone shows the generic gone notice', async () => {
    const user = userEvent.setup()
    renderAt(ARCHIVED_VARIETIES, {
      'POST /varieties/4/restore': () => json(404, { code: 'variety.not_found', detail: 'x' }),
    })
    await screen.findByText('Alfa Vieja')
    await user.click(screen.getAllByRole('button', { name: 'Restaurar' })[0]!)
    expect(await screen.findByText('Eso ya no está. La lista ya está al día.')).toBeTruthy()
  })
})

describe("an archived variety's page", () => {
  test('is read-only: back to Archivadas, Archivada in words, and Restaurar the one action', async () => {
    renderAt(VARIETY(4))
    expect(await screen.findByRole('heading', { name: 'Alfa Vieja' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '‹ Archivadas' }).getAttribute('href')).toBe(ARCHIVED_VARIETIES)
    expect(screen.getByText('Archivada')).toBeTruthy()
    expect(screen.getByText('7 g', { exact: false })).toBeTruthy()
    for (const gone of [
      '+ Entrada',
      'Nuevo precio',
      'Eliminar variedad',
      'Archivar variedad',
      'Borrar',
      'Editar',
    ]) {
      expect(screen.queryByText(gone)).toBeNull()
    }
    expect(screen.queryByRole('button', { name: /Editar|Borrar/ })).toBeNull()
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Restaurar'])
  })

  test('restores in one tap and then shows the live variety', async () => {
    const user = userEvent.setup()
    let restored = false
    renderAt(VARIETY(4), {
      'GET /varieties/4': () =>
        json(200, restored
          ? { id: 4, name: 'Alfa Vieja', archived: false, removal: 'archive', current_price: null }
          : { id: 4, name: 'Alfa Vieja', archived: true, removal: null, current_price: null }),
      'POST /varieties/4/restore': () => {
        restored = true
        return json(200, { id: 4, name: 'Alfa Vieja', archived: false, removal: 'archive' })
      },
    })
    await user.click(await screen.findByRole('button', { name: 'Restaurar' }))
    expect(await screen.findByText('Variedad restaurada')).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Archivar variedad' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '‹ Variedades' })).toBeTruthy()
  })
})
