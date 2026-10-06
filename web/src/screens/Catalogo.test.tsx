/**
 * `Catalogo` at the screen seam (plan, "Front"): the preview built only from
 * `telegramPreview(text)`, Copiar gated on the open's fetch, "Qué sale en el
 * catálogo" told by word, and both edit forms. The API is faked at `fetch`, never
 * mocked deeper (CODING_STANDARDS §10).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import * as clipboard from '../clipboard'
import Catalogo from './Catalogo'
import { paths } from '../routes/paths'

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
      <MemoryRouter initialEntries={[paths.catalog()]}>
        <Routes>
          <Route element={<Provide />}>
            <Route path={paths.catalog()} element={<Catalogo />} />
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

test('editing the header and footer saves and shows the new values', async () => {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'PUT' && url === '/catalog/header-footer') {
      return Promise.resolve(
        jsonResponse(200, { ...CATALOG, header: 'Nuevo encabezado', footer: 'Nuevo pie' }),
      )
    }
    return Promise.resolve(defaultResponse(url))
  })
  renderCatalogo(fetchMock)

  await userEvent.click(await screen.findByRole('button', { name: 'Editar encabezado y pie' }))
  const headerInput = screen.getByLabelText('Encabezado')
  await userEvent.clear(headerInput)
  await userEvent.type(headerInput, 'Nuevo encabezado')
  const footerInput = screen.getByLabelText('Pie')
  await userEvent.clear(footerInput)
  await userEvent.type(footerInput, 'Nuevo pie')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText('Catálogo guardado')).toBeInTheDocument()
  expect(await screen.findByText('Nuevo encabezado')).toBeInTheDocument()
  expect(await screen.findByText('Nuevo pie')).toBeInTheDocument()
})

const PINNED_CATALOG = {
  token_saved_on: '2026-08-12',
  own_chat: '123456789',
  channel_chat: '@mi_canal',
  can_publish: true,
  status: { state: 'up_to_date', reason: null, last_published_on: '2026-09-29' },
}

function withPinnedCatalog(
  pinned: unknown,
  overrides?: (url: string, init?: RequestInit) => Response | undefined,
) {
  return vi.fn((url: string, init?: RequestInit) => {
    const override = overrides?.(url, init)
    if (override !== undefined) return Promise.resolve(override)
    if (url === '/pinned-catalog') return Promise.resolve(jsonResponse(200, pinned))
    return Promise.resolve(defaultResponse(url))
  })
}

test('the bot section shows the masked token and the saved chats', async () => {
  renderCatalogo(withPinnedCatalog(PINNED_CATALOG))

  expect(await screen.findByText('Guardado el 12/08 · no se muestra más')).toBeInTheDocument()
  expect(screen.getByLabelText('Tu chat', { exact: false })).toHaveValue('123456789')
  expect(screen.getByLabelText('Chat del canal', { exact: false })).toHaveValue('@mi_canal')
  expect(await screen.findByText('Al día')).toBeInTheDocument()
  expect(screen.getByText(/El último fue el 29\/09/)).toBeInTheDocument()
})

test.each([
  ['telegram_unreachable', 'Telegram no respondió'],
  ['bot_cannot_post', 'El bot no puede publicar en el canal'],
  ['message_gone', 'El mensaje fijado ya no está: publicalo de nuevo'],
  ['missing_publish', 'Falta publicarlo con el bot o el canal nuevo'],
  ['too_long', 'Es demasiado largo para Telegram: acortá aromas u ocultá variedades.'],
] as const)('Desactualizado reads its fixed reason for %s, never only by color', async (reason, text) => {
  renderCatalogo(
    withPinnedCatalog({
      ...PINNED_CATALOG,
      status: { state: 'out_of_date', reason, last_published_on: '2026-09-29' },
    }),
  )

  expect(await screen.findByText('Desactualizado')).toBeInTheDocument()
  expect(screen.getByText(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument()
})

test('missing_publish shows no "El último fue" line: that history restarts with the new chat', async () => {
  renderCatalogo(
    withPinnedCatalog({
      ...PINNED_CATALOG,
      status: { state: 'out_of_date', reason: 'missing_publish', last_published_on: null },
    }),
  )

  expect(await screen.findByText('Desactualizado')).toBeInTheDocument()
  expect(screen.getByText(/Falta publicarlo con el bot o el canal nuevo/)).toBeInTheDocument()
  expect(screen.queryByText(/El último fue/)).not.toBeInTheDocument()
})

test('Cambiar opens an empty token field; the token is never prefilled', async () => {
  renderCatalogo(withPinnedCatalog(PINNED_CATALOG))

  await screen.findByText('Guardado el 12/08 · no se muestra más')
  await userEvent.click(screen.getByRole('button', { name: 'Cambiar' }))

  const tokenInput = screen.getByLabelText('Token')
  expect(tokenInput).toHaveValue('')
})

test('Publicar is disabled with the fixed reason when can_publish is false', async () => {
  renderCatalogo(withPinnedCatalog({ ...PINNED_CATALOG, can_publish: false, channel_chat: null }))

  await screen.findByLabelText('Tu chat', { exact: false })
  expect(screen.getByRole('button', { name: 'Publicar' })).toBeDisabled()
  expect(screen.getByText('Probalo primero para ver cómo queda')).toBeInTheDocument()
})

test('editing a saved chat re-arms the gate and disables Publicar again', async () => {
  renderCatalogo(withPinnedCatalog(PINNED_CATALOG))

  const channelInput = await screen.findByLabelText('Chat del canal', { exact: false })
  expect(screen.getByRole('button', { name: 'Publicar' })).not.toBeDisabled()

  await userEvent.clear(channelInput)
  await userEvent.type(channelInput, '@otro_canal')

  expect(screen.getByRole('button', { name: 'Publicar' })).toBeDisabled()
})

test('Probarlo on success saves the typed values, shows the toast, re-enables Publicar', async () => {
  // `can_publish` starts false (no channel saved yet); the POST answers it saved and
  // tested, and — since Probarlo's success no longer writes the query cache directly
  // (review finding: a failed attempt must refetch too, so both paths now share the
  // same `invalidateResource` call) — the settings query must actually refetch this
  // updated snapshot for Publicar to read `can_publish: true` off it.
  let saved: Record<string, unknown> = { ...PINNED_CATALOG, can_publish: false, channel_chat: null }
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/pinned-catalog/test' && init?.method === 'POST') {
      saved = { ...PINNED_CATALOG, can_publish: true, channel_chat: null }
      return Promise.resolve(jsonResponse(200, { ...saved, previous_pin_left: false }))
    }
    if (url === '/pinned-catalog') return Promise.resolve(jsonResponse(200, saved))
    return Promise.resolve(defaultResponse(url))
  })
  renderCatalogo(fetchMock)

  await screen.findByLabelText('Tu chat', { exact: false })
  expect(screen.getByRole('button', { name: 'Publicar' })).toBeDisabled()

  await userEvent.click(screen.getByRole('button', { name: 'Probarlo' }))

  expect(await screen.findByText('Prueba enviada')).toBeInTheDocument()
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
  expect(JSON.parse(call?.[1]?.body as string)).toEqual({
    token: null,
    own_chat: '123456789',
    channel_chat: null,
  })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Publicar' })).not.toBeDisabled())
})

test('a failed Probarlo keeps everything typed and shows a fixed reason', async () => {
  const fetchMock = withPinnedCatalog(PINNED_CATALOG, (url, init) => {
    if (url === '/pinned-catalog/test' && init?.method === 'POST') {
      return jsonResponse(422, { detail: 'refused', code: 'pinned_catalog.telegram_unreachable' })
    }
    return undefined
  })
  renderCatalogo(fetchMock)

  const channelInput = await screen.findByLabelText('Chat del canal', { exact: false })
  await userEvent.clear(channelInput)
  await userEvent.type(channelInput, '@probando')
  await userEvent.click(screen.getByRole('button', { name: 'Probarlo' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Telegram no respondió')
  expect(channelInput).toHaveValue('@probando')
})

test('previous_pin_left shows the fixed notice after a successful test', async () => {
  const fetchMock = withPinnedCatalog(PINNED_CATALOG, (url, init) => {
    if (url === '/pinned-catalog/test' && init?.method === 'POST') {
      return jsonResponse(200, { ...PINNED_CATALOG, previous_pin_left: true })
    }
    return undefined
  })
  renderCatalogo(fetchMock)

  await screen.findByLabelText('Tu chat', { exact: false })
  await userEvent.click(screen.getByRole('button', { name: 'Probarlo' }))

  expect(
    await screen.findByText(
      'El mensaje fijado anterior queda como está; desfijalo vos en Telegram.',
    ),
  ).toBeInTheDocument()
})

test('Publicar on success shows the toast "Catálogo publicado"', async () => {
  const fetchMock = withPinnedCatalog(PINNED_CATALOG, (url, init) => {
    if (url === '/pinned-catalog/publish' && init?.method === 'POST') {
      return jsonResponse(200, {
        ...PINNED_CATALOG,
        status: { state: 'up_to_date', reason: null, last_published_on: '2026-10-03' },
      })
    }
    return undefined
  })
  renderCatalogo(fetchMock)

  await screen.findByLabelText('Tu chat', { exact: false })
  await userEvent.click(screen.getByRole('button', { name: 'Publicar' }))

  expect(await screen.findByText('Catálogo publicado')).toBeInTheDocument()
})

test('a failed Publicar shows its fixed reason', async () => {
  const fetchMock = withPinnedCatalog(PINNED_CATALOG, (url, init) => {
    if (url === '/pinned-catalog/publish' && init?.method === 'POST') {
      return jsonResponse(422, { detail: 'refused', code: 'pinned_catalog.bot_cannot_post' })
    }
    return undefined
  })
  renderCatalogo(fetchMock)

  await screen.findByLabelText('Tu chat', { exact: false })
  await userEvent.click(screen.getByRole('button', { name: 'Publicar' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('El bot no puede publicar en el canal')
})

test('a catalog input never carries maxLength', async () => {
  vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(defaultResponse(url))))
  const queryClient = new QueryClient()
  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[paths.catalog()]}>
        <Routes>
          <Route element={<Provide />}>
            <Route path={paths.catalog()} element={<Catalogo />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Editar 24K Gold' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Editar encabezado y pie' }))

  await waitFor(() => expect(container.querySelectorAll('input, textarea').length).toBeGreaterThan(0))
  for (const el of container.querySelectorAll('input, textarea')) {
    expect(el.hasAttribute('maxLength')).toBe(false)
  }
})
