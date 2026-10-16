/**
 * `VarietyPage` for an archived variety, its restore return and the stored catalog values it
 * reads (`varieties.md`, "Archivadas"), at the screen seam with `fetch` faked by one small
 * stateful API: the variety's archived flag and its stored catalog values live in the fake,
 * so a restore, an edit and an archive change what the next read answers.
 *
 * The restore tests are characterisations of a decision, not a new rule: the page switches
 * to the live variety in place, and the URL is the same in both states, so there is no
 * history entry to add or replace.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import FlashProvider from '../../flash/FlashProvider'
import { ARCHIVED_VARIETIES, VARIETIES, VARIETY, pathTo, relative } from '../../routes'
import Variedades from '../Variedades'
import ArchivedIndex from './ArchivedIndex'
import VarietiesIndex from './VarietiesIndex'
import VarietiesLayout from './VarietiesLayout'
import VarietyPage from './VarietyPage'
import VarietyRoute from './VarietyRoute'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }
const VARIETY_ONE = pathTo(VARIETY, { id: 1 })

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

interface Stored {
  shown: boolean
  emoji: string | null
  indica_share: number | null
  aroma: string | null
}

function fakeApi(initial: { archived: boolean; stored: Stored }) {
  const state = { ...initial }
  const row = { variety_id: 1, grams: 18, status: 'ok', sold_out_since: null, threshold: 20, days_left: null }
  const detail = () => ({
    id: 1,
    name: '24K Gold',
    archived: state.archived,
    removal: state.archived ? null : 'archive',
    current_price: null,
  })
  const answers: Record<string, () => Response> = {
    'GET /varieties/1': () => json(200, detail()),
    'GET /varieties/1/prices': () => json(200, []),
    'GET /varieties': () => json(200, state.archived ? [] : [detail()]),
    'GET /varieties?archived=true': () => json(200, state.archived ? [detail()] : []),
    'GET /stock': () => json(200, { total: 18, varieties: state.archived ? [] : [row], entries: [] }),
    'GET /stock?archived=true': () => json(200, { total: 18, varieties: state.archived ? [row] : [], entries: [] }),
    'GET /stock/varieties/1/movements': () => json(200, []),
    'GET /pricing-settings': () => json(200, { is_bulk_pricing: true, is_vip_customers: true }),
    'GET /catalog': () =>
      json(200, {
        text: null,
        header: '',
        footer: '',
        varieties: state.archived ? [] : [{ id: 1, name: '24K Gold', ...state.stored, state: 'in' }],
      }),
    'GET /catalog/varieties/1': () => json(200, state.stored),
    'POST /varieties/1/restore': () => {
      state.archived = false
      return json(200, detail())
    },
    'POST /varieties/1/archive': () => {
      state.archived = true
      return json(200, detail())
    },
  }
  return { answers, state }
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

function render_(api: ReturnType<typeof fakeApi>, computer: boolean) {
  setComputer(computer)
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`
    if (key === 'PUT /catalog/varieties/1') {
      api.state.stored = JSON.parse(init?.body as string) as Stored
      return Promise.resolve(json(200, { text: null, header: '', footer: '', varieties: [] }))
    }
    const answer = api.answers[key]
    if (answer === undefined) return Promise.reject(new Error(`unexpected request: ${key}`))
    return Promise.resolve(answer())
  })
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const shell = (
    <QueryClientProvider client={queryClient}>
      <FlashProvider>
        <Outlet context={ME} />
      </FlashProvider>
    </QueryClientProvider>
  )
  const page = <VarietyRoute render={(id) => <VarietyPage varietyId={id} />} />
  const router = createMemoryRouter(
    computer
      ? [
          {
            element: shell,
            children: [
              {
                path: VARIETIES,
                element: <VarietiesLayout />,
                children: [
                  { index: true, element: <VarietiesIndex /> },
                  { path: ARCHIVED_VARIETIES, element: <ArchivedIndex /> },
                  { path: VARIETY, element: page },
                ],
              },
            ],
          },
        ]
      : [
          {
            element: shell,
            children: [
              { path: relative(VARIETIES), element: <Variedades /> },
              { path: relative(ARCHIVED_VARIETIES), element: <main>Pantalla Archivadas</main> },
              { path: relative(VARIETY), element: page },
            ],
          },
        ],
    { initialEntries: [VARIETIES, ARCHIVED_VARIETIES, VARIETY_ONE], initialIndex: 2 },
  )
  render(<RouterProvider router={router} />)
  return { router, fetchMock }
}

const STORED: Stored = { shown: false, emoji: '🍪', indica_share: 70, aroma: 'Galletita' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Restaurar on the archived page (a characterisation: the page turns live in place)', () => {
  test('on the phone, the same history entry becomes the live page and Back leaves it for Archivadas', async () => {
    const user = userEvent.setup()
    const { router } = render_(fakeApi({ archived: true, stored: STORED }), false)
    await user.click(await screen.findByRole('button', { name: 'Restaurar' }))

    expect(await screen.findByText('Variedad restaurada')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Archivar variedad' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '‹ Variedades' })).toHaveAttribute('href', VARIETIES)
    expect(screen.queryByRole('link', { name: '‹ Archivadas' })).toBeNull()
    expect(router.state.location.pathname).toBe(VARIETY_ONE)

    await router.navigate(-1)
    expect(router.state.location.pathname).toBe(ARCHIVED_VARIETIES)
    expect(await screen.findByText('Pantalla Archivadas')).toBeInTheDocument()
  })

  test('on the phone, restoring adds no history entry and keeps every flag: Oculta is still there', async () => {
    const user = userEvent.setup()
    const { router } = render_(fakeApi({ archived: true, stored: STORED }), false)
    await user.click(await screen.findByRole('button', { name: 'Restaurar' }))
    const key = router.state.location.key
    await screen.findByRole('button', { name: 'Archivar variedad' })

    expect(router.state.location.key).toBe(key)
    expect(screen.getByText('Oculta')).toBeInTheDocument()
    const catalog = (await screen.findByRole('heading', { name: 'En el catálogo' })).closest('section')
    expect(within(catalog as HTMLElement).getByText('No se muestra')).toBeInTheDocument()
    expect(within(catalog as HTMLElement).getByRole('button', { name: 'Editar catálogo' })).toBeInTheDocument()
  })

  test('on the computer, the left pane goes back to Variedades with the variety in it, the right stays on it', async () => {
    const user = userEvent.setup()
    const { router } = render_(fakeApi({ archived: true, stored: STORED }), true)
    await screen.findByRole('heading', { name: 'Archivadas' })
    // The row's own Restaurar is on the left; this is the page's, in the right pane.
    const detail = document.querySelector('.variedades-paneles__detalle') as HTMLElement
    await user.click(await within(detail).findByRole('button', { name: 'Restaurar' }))

    expect(await screen.findByText('Todas las entradas')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Archivadas' })).toBeNull()
    expect(await screen.findByRole('button', { name: 'Archivar variedad' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(VARIETY_ONE)
  })
})

describe('the stored catalog values across restore, edit and archive', () => {
  test('reopening the archived page shows the values edited while it was live', async () => {
    const user = userEvent.setup()
    const api = fakeApi({ archived: true, stored: { shown: true, emoji: null, indica_share: null, aroma: 'Vieja' } })
    const { router } = render_(api, false)

    const catalog = async () => within((await screen.findByRole('heading', { name: 'En el catálogo' })).closest('section') as HTMLElement)
    expect(await (await catalog()).findByText('Vieja')).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: 'Restaurar' }))
    await user.click(await screen.findByRole('button', { name: 'Editar catálogo' }))
    const aroma = await screen.findByLabelText('Aroma/sabor')
    await user.clear(aroma)
    await user.type(aroma, 'Nueva')
    await user.click(screen.getByRole('button', { name: 'Guardá el catálogo' }))
    await screen.findByText('Catálogo guardado', { exact: false })

    await user.click(await screen.findByRole('button', { name: 'Archivar variedad' }))
    await user.click(await screen.findByRole('button', { name: 'Sí, archivala' }))

    await waitFor(() => expect(api.state.archived).toBe(true))
    await router.navigate(VARIETY_ONE)
    expect(await (await catalog()).findByText('Nueva', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.queryByText('Vieja')).toBeNull()
  })
})
