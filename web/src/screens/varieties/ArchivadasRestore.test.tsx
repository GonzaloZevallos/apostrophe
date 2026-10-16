/**
 * Restaurar from an Archivadas row on a computer (`varieties.md`, "Archivadas"): the seller
 * stays on Archivadas. The selection that left moves to the next archived variety by name,
 * else the previous one, else the empty state, with `replace`, and never to an id already
 * restored; a row that is not the selected one restores with no navigation.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import FlashProvider from '../../flash/FlashProvider'
import { ARCHIVED_VARIETIES, VARIETIES, VARIETY, pathTo } from '../../routes'
import ArchivedIndex from './ArchivedIndex'
import VarietiesIndex from './VarietiesIndex'
import VarietiesLayout from './VarietiesLayout'
import VarietyPage from './VarietyPage'
import VarietyRoute from './VarietyRoute'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// By name: Alfa (4), Beta (6), Zeta (5); the API sends them in id order.
const NAMES: Record<number, string> = { 4: 'Alfa Vieja', 5: 'Zeta Vieja', 6: 'Beta Vieja' }

function stockRow(id: number) {
  return { variety_id: id, grams: id, status: 'ok', sold_out_since: null, threshold: null, days_left: null }
}

interface Setup {
  /** The archived ids the list answers while none is restored. */
  ids: number[]
  /** The list never changes after a restore (the refetch is slower than the seller's next tap). */
  stale?: boolean
}

function renderComputer(path: string, { ids, stale = false }: Setup) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  })
  const restored = new Set<number>()
  const variety = (id: number) => ({
    id,
    name: NAMES[id],
    archived: !restored.has(id),
    removal: restored.has(id) ? 'archive' : null,
    current_price: null,
  })
  const archivedList = () => ids.filter((id) => stale || !restored.has(id)).map((id) => variety(id))
  const answers: Record<string, () => Response> = {
    'GET /varieties?archived=true': () => json(200, archivedList()),
    'GET /varieties': () => json(200, ids.filter((id) => restored.has(id)).map((id) => variety(id))),
    'GET /stock': () => json(200, { total: 0, varieties: [], entries: [] }),
    'GET /stock?archived=true': () => json(200, { total: 0, varieties: ids.map(stockRow), entries: [] }),
    'GET /catalog': () => json(200, { text: '', header: '', footer: '', varieties: [] }),
  }
  for (const id of ids) {
    answers[`GET /varieties/${id}`] = () => json(200, variety(id))
    answers[`GET /varieties/${id}/prices`] = () => json(200, [])
    answers[`GET /catalog/varieties/${id}`] = () =>
      json(200, { shown: true, emoji: null, indica_share: null, aroma: null })
    answers[`POST /varieties/${id}/restore`] = () => {
      restored.add(id)
      return json(200, { id, name: NAMES[id], archived: false, removal: 'archive' })
    }
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
          {
            path: VARIETIES,
            element: <VarietiesLayout />,
            children: [
              { index: true, element: <VarietiesIndex /> },
              { path: ARCHIVED_VARIETIES, element: <ArchivedIndex /> },
              { path: VARIETY, element: <VarietyRoute render={(id) => <VarietyPage varietyId={id} />} /> },
            ],
          },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return { router, fetchMock }
}

/** The "Restaurar" of one row of the card on the left. */
async function rowRestore(name: string): Promise<HTMLElement> {
  const row = (await screen.findByText(name, { selector: '.variedad-fila__nombre' })).closest('.variedad-archivada')
  return within(row as HTMLElement).getByRole('button', { name: 'Restaurar' })
}

function path(id: number): string {
  return pathTo(VARIETY, { id })
}

afterEach(() => vi.unstubAllGlobals())

describe('Restaurar on an Archivadas row, on a computer', () => {
  test('the selected row moves the selection to the next archived variety by name and the left pane stays Archivadas', async () => {
    const user = userEvent.setup()
    const { router } = renderComputer(path(4), { ids: [4, 5, 6] })
    await screen.findByRole('heading', { name: 'Alfa Vieja' })

    await user.click(await rowRestore('Alfa Vieja'))

    expect(await screen.findByText('Variedad restaurada')).toBeTruthy()
    await waitFor(() => expect(router.state.location.pathname).toBe(path(6)))
    expect(await screen.findByRole('heading', { name: 'Beta Vieja' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Archivadas' })).toBeTruthy()
    await waitFor(() => expect(screen.queryByText('Alfa Vieja')).toBeNull())
    expect(screen.queryByText('Todas las entradas')).toBeNull()
  })

  test('the selection is replaced, so Back never lands on the variety just restored', async () => {
    const user = userEvent.setup()
    const { router } = renderComputer(path(4), { ids: [4, 6] })
    await screen.findByRole('heading', { name: 'Alfa Vieja' })

    await user.click(await rowRestore('Alfa Vieja'))
    await waitFor(() => expect(router.state.location.pathname).toBe(path(6)))

    expect(router.state.historyAction).toBe('REPLACE')
  })

  test('two restores before the list refetches never select an id already restored', async () => {
    const user = userEvent.setup()
    const { router } = renderComputer(path(6), { ids: [4, 5, 6], stale: true })
    await screen.findByRole('heading', { name: 'Beta Vieja' })

    await user.click(await rowRestore('Beta Vieja'))
    await waitFor(() => expect(router.state.location.pathname).toBe(path(5)))
    await screen.findByRole('heading', { name: 'Zeta Vieja' })
    await user.click(await rowRestore('Zeta Vieja'))

    // Zeta is last by name and Beta, the one before it, was restored a moment ago: Alfa.
    await waitFor(() => expect(router.state.location.pathname).toBe(path(4)))
    expect(await screen.findByRole('heading', { name: 'Alfa Vieja' })).toBeTruthy()
  })

  test('the last one by name moves the selection to the previous one', async () => {
    const user = userEvent.setup()
    const { router } = renderComputer(path(5), { ids: [4, 5] })
    await screen.findByRole('heading', { name: 'Zeta Vieja' })

    await user.click(await rowRestore('Zeta Vieja'))

    await waitFor(() => expect(router.state.location.pathname).toBe(path(4)))
    expect(await screen.findByRole('heading', { name: 'Alfa Vieja' })).toBeTruthy()
  })

  test('the only one leaves Archivadas with its empty state and nothing selected', async () => {
    const user = userEvent.setup()
    const { router } = renderComputer(path(4), { ids: [4] })
    await screen.findByRole('heading', { name: 'Alfa Vieja' })

    await user.click(await rowRestore('Alfa Vieja'))

    expect(await screen.findByText('No tenés variedades archivadas')).toBeTruthy()
    expect(router.state.location.pathname).toBe(ARCHIVED_VARIETIES)
    expect(screen.getByRole('link', { name: 'Volver a Variedades' })).toBeTruthy()
  })

  test('a row that is not the selected one restores with no navigation', async () => {
    const user = userEvent.setup()
    const { router, fetchMock } = renderComputer(path(4), { ids: [4, 5] })
    await screen.findByRole('heading', { name: 'Alfa Vieja' })

    await user.click(await rowRestore('Zeta Vieja'))

    expect(await screen.findByText('Variedad restaurada')).toBeTruthy()
    expect(router.state.location.pathname).toBe(path(4))
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').map(([url]) => url)).toEqual([
      '/varieties/5/restore',
    ])
  })
})
