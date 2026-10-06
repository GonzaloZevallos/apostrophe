/**
 * `Catalogo` at the screen seam (plan, "Front"): the preview built only from
 * `telegramPreview(text)`, Copiar gated on the open's fetch, "Qué sale en el
 * catálogo" told by word, and the variety's edit form. The API is faked at `fetch`, never
 * mocked deeper (CODING_STANDARDS §10).
 */

import { CATALOG as CATALOG_ROUTE, SETTINGS_CATALOG_MESSAGE } from '../routes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import * as clipboard from '../clipboard'
import Catalogo from './Catalogo'

vi.mock('../clipboard', () => ({ copyText: vi.fn().mockResolvedValue(true) }))

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ME: Me = { email: 'vos@lahuerta.com', business_name: 'La Huerta', today: '2026-10-02' }

function Provide() {
  return <Outlet context={ME} />
}

function renderCatalogo(fetchMock: ReturnType<typeof vi.fn>): QueryClient {
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[CATALOG_ROUTE]}>
        <Routes>
          <Route element={<Provide />}>
            <Route path={CATALOG_ROUTE} element={<Catalogo />} />
            <Route
              path={SETTINGS_CATALOG_MESSAGE}
              element={<div>Aterrizaste en el mensaje del catálogo</div>}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return queryClient
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const CATALOG = {
  text: '🌿 **CATÁLOGO** 🌿\n\n🥇 **24K Gold**\n• 60% índica / 40% sativa\n• Aroma/sabor: cítrico\n• Precio x gramo: $11.000\n• Desde 10 g: $10.000 c/u\n\n📩 Consultas y pedidos por privado.',
  header: '🌿 **CATÁLOGO** 🌿',
  footer: '📩 Consultas y pedidos por privado.',
  varieties: [
    {
      id: 1,
      name: '24K Gold',
      emoji: '🥇',
      indica_share: 60,
      aroma: 'cítrico',
      shown: true,
      state: 'in',
    },
    {
      id: 2,
      name: 'Sir Jack',
      emoji: '👑',
      indica_share: null,
      aroma: null,
      shown: false,
      state: 'hidden',
    },
  ],
}

// Every test but the ones that build `withPinnedCatalog` explicitly leaves the bot
// section's own fetch (`GET /pinned-catalog`) unmocked: this fallback answers it with
// "nothing saved yet" so the catalog-only tests above don't have to know the bot
// section exists, the same way they never had to mock `/catalog/varieties` twice.
const DEFAULT_PINNED_CATALOG = {
  token_saved_on: null,
  own_chat: null,
  channel_chat: null,
  can_publish: false,
  publish_blocked_by: 'not_tested',
  status: null,
}

function defaultResponse(url: string): Response {
  return jsonResponse(200, url === '/pinned-catalog' ? DEFAULT_PINNED_CATALOG : CATALOG)
}

test('Copiar is not rendered until the open fetch has resolved', async () => {
  let resolveFetch: (value: Response) => void = () => {}
  const pending = new Promise<Response>((resolve) => {
    resolveFetch = resolve
  })
  renderCatalogo(
    vi.fn((url: string) =>
      url === '/pinned-catalog' ? Promise.resolve(jsonResponse(200, DEFAULT_PINNED_CATALOG)) : pending,
    ),
  )

  expect(screen.queryByRole('button', { name: 'Copiar' })).not.toBeInTheDocument()

  resolveFetch(jsonResponse(200, CATALOG))
  expect(await screen.findByRole('button', { name: 'Copiar' })).toBeInTheDocument()
})

test('the preview reads bold where ** pairs sit, with the markers hidden', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await screen.findByRole('button', { name: 'Copiar' })
  const preview = document.querySelector('.catalogo__vista-previa') as HTMLElement
  const bold = within(preview).getByText('24K Gold')
  expect(bold.tagName).toBe('STRONG')
  expect(within(preview).queryByText('**24K Gold**')).not.toBeInTheDocument()
})

test('shows the empty state and no Copiar when nothing qualifies', async () => {
  renderCatalogo(
    vi.fn((url: string) =>
      Promise.resolve(
        url === '/pinned-catalog'
          ? jsonResponse(200, DEFAULT_PINNED_CATALOG)
          : jsonResponse(200, { ...CATALOG, text: null }),
      ),
    ),
  )

  expect(await screen.findByText('No hay nada en el catálogo hoy')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Copiar' })).not.toBeInTheDocument()
})

test('every variety is told in or out by word, never only by color', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  expect(await screen.findByText('Sale')).toBeInTheDocument()
  expect(await screen.findByText('Oculta')).toBeInTheDocument()
})

function catalogFetch(catalog: unknown): ReturnType<typeof vi.fn> {
  return vi.fn((url: string) =>
    Promise.resolve(
      url === '/pinned-catalog' ? jsonResponse(200, DEFAULT_PINNED_CATALOG) : jsonResponse(200, catalog),
    ),
  )
}

test('a variety with no price today reads "No sale: sin precio hoy"', async () => {
  renderCatalogo(
    catalogFetch({ ...CATALOG, varieties: [{ ...CATALOG.varieties[0], state: 'no_price' }] }),
  )

  expect(await screen.findByText('No sale: sin precio hoy')).toBeInTheDocument()
})

test('a sold-out variety reads "No sale: está agotada"', async () => {
  renderCatalogo(
    catalogFetch({ ...CATALOG, varieties: [{ ...CATALOG.varieties[0], state: 'sold_out' }] }),
  )

  expect(await screen.findByText('No sale: está agotada')).toBeInTheDocument()
})

test('a variety with no stock entries reads "No sale: sin entradas"', async () => {
  renderCatalogo(
    catalogFetch({ ...CATALOG, varieties: [{ ...CATALOG.varieties[0], state: 'no_entries' }] }),
  )

  expect(await screen.findByText('No sale: sin entradas')).toBeInTheDocument()
})

test('Copiar copies the raw API text through copyText and shows the toast', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await userEvent.click(await screen.findByRole('button', { name: 'Copiar' }))

  expect(clipboard.copyText).toHaveBeenCalledWith(CATALOG.text)
  expect(await screen.findByText('Catálogo copiado')).toBeInTheDocument()
})

test('a failed copy shows the fixed message and no toast', async () => {
  vi.mocked(clipboard.copyText).mockResolvedValueOnce(false)
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await userEvent.click(await screen.findByRole('button', { name: 'Copiar' }))

  expect(await screen.findByText('No se pudo copiar.')).toBeInTheDocument()
  expect(screen.queryByText('Catálogo copiado')).not.toBeInTheDocument()
})

test('editing a variety saves its attributes and shows the saved toast', async () => {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'PUT' && url === '/catalog/varieties/2') {
      return Promise.resolve(
        jsonResponse(200, {
          ...CATALOG,
          varieties: [
            CATALOG.varieties[0],
            { ...CATALOG.varieties[1], shown: true, state: 'no_price' },
          ],
        }),
      )
    }
    return Promise.resolve(defaultResponse(url))
  })
  renderCatalogo(fetchMock)

  await userEvent.click(await screen.findByRole('button', { name: 'Editar Sir Jack' }))
  await userEvent.click(screen.getByRole('checkbox', { name: 'Se muestra en el catálogo' }))
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText('Catálogo guardado')).toBeInTheDocument()
  const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
  expect(put?.[0]).toBe('/catalog/varieties/2')
  expect(JSON.parse(put?.[1]?.body as string)).toEqual({
    shown: true,
    emoji: '👑',
    indica_share: null,
    aroma: null,
  })
})

test('an invalid indica share keeps what was typed and shows the inline refusal', async () => {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      return Promise.resolve(
        jsonResponse(422, { detail: 'invalid', code: 'catalog.indica_share_invalid' }),
      )
    }
    return Promise.resolve(defaultResponse(url))
  })
  renderCatalogo(fetchMock)

  await userEvent.click(await screen.findByRole('button', { name: 'Editar 24K Gold' }))
  const shareInput = screen.getByLabelText('Porcentaje de índica')
  await userEvent.clear(shareInput)
  await userEvent.type(shareInput, '150')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('El porcentaje de índica va de 0 a 100')
  expect(shareInput).toHaveValue('150')
})

test('a gone variety shows "Eso ya no está." instead of a toast', async () => {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      return Promise.resolve(
        jsonResponse(404, { detail: 'gone', code: 'catalog.variety_not_found' }),
      )
    }
    return Promise.resolve(defaultResponse(url))
  })
  renderCatalogo(fetchMock)

  await userEvent.click(await screen.findByRole('button', { name: 'Editar 24K Gold' }))
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText('Eso ya no está. La lista ya está al día.')).toBeInTheDocument()
  expect(screen.queryByText('Catálogo guardado')).not.toBeInTheDocument()
})

test('the catalog screen offers no header or footer editing, only the read-only values', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await screen.findByRole('button', { name: 'Editar 24K Gold' })
  expect(screen.getByText('Encabezado')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Editar encabezado y pie' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Encabezado')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Pie')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Guardá el mensaje' })).not.toBeInTheDocument()
})

test('CATALOG still shows the preview, Copiar, the pin status and Publicar', async () => {
  const published = {
    ...DEFAULT_PINNED_CATALOG,
    can_publish: true,
    publish_blocked_by: null,
    status: { state: 'up_to_date', reason: null, last_published_on: '2026-10-01' },
  }
  renderCatalogo(
    vi.fn((url: string) =>
      Promise.resolve(jsonResponse(200, url === '/pinned-catalog' ? published : CATALOG)),
    ),
  )

  expect(await screen.findByText('Cómo se ve en Telegram')).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Copiar' })).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Publicar' })).toBeInTheDocument()
  expect(await screen.findByText('Al día')).toBeInTheDocument()
})

test('"Editar encabezado y pie" opens Configuración → Mensaje del catálogo', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await userEvent.click(await screen.findByRole('link', { name: 'Editar encabezado y pie' }))

  expect(await screen.findByText('Aterrizaste en el mensaje del catálogo')).toBeInTheDocument()
})

test('the catalog screen offers no bot settings: they live in Integraciones', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await screen.findByRole('button', { name: 'Publicar' })
  expect(screen.queryByLabelText('Token del bot')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Probarlo' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Tu chat', { exact: false })).not.toBeInTheDocument()
})

test('a catalog input never carries maxLength', async () => {
  vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(defaultResponse(url))))
  const queryClient = new QueryClient()
  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[CATALOG_ROUTE]}>
        <Routes>
          <Route element={<Provide />}>
            <Route path={CATALOG_ROUTE} element={<Catalogo />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Editar 24K Gold' }))

  await waitFor(() => expect(container.querySelectorAll('input, textarea').length).toBeGreaterThan(0))
  for (const el of container.querySelectorAll('input, textarea')) {
    expect(el.hasAttribute('maxLength')).toBe(false)
  }
})
