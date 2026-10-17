/**
 * `Catalogo` at the screen seam (plan, "Front"): the preview built only from
 * `telegramPreview(text)`, Compartir and Copiar gated on the open's fetch and handed
 * exactly the API's text, "Qué no sale y por qué" told by one word per variety, the
 * links out. It edits no variety attribute (that is the variety's own page). The API is faked at `fetch`, never
 * mocked deeper (CODING_STANDARDS §10).
 */

import { CATALOG as CATALOG_PATH, SETTINGS_CATALOG_MESSAGE, VARIETIES, VARIETY } from '../routes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  MemoryRouter,
  Outlet,
  RouterProvider,
  Route,
  Routes,
  createMemoryRouter,
  useLocation,
} from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import * as clipboard from '../clipboard'
import * as share from '../share'
import Shell from '../shell/Shell'
import Catalogo from './Catalogo'
import { iconAndTextProblems } from '../test/iconAndTextRule'
import { EMPTY_STATE_DETAIL, EMPTY_STATE_TITLE } from '../copy/catalog'

vi.mock('../clipboard', () => ({ copyText: vi.fn().mockResolvedValue(true) }))
vi.mock('../share', () => ({
  canShare: vi.fn(() => true),
  shareText: vi.fn().mockResolvedValue('shared'),
}))

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function VarietyLanding() {
  const location = useLocation()
  return (
    <div>
      Aterrizaste en {location.pathname}
      {location.hash}
    </div>
  )
}

const ME: Me = { email: 'vos@lahuerta.com', business_name: 'La Huerta', today: '2026-10-02' }

function Provide() {
  return <Outlet context={ME} />
}

function renderCatalogo(
  fetchMock: ReturnType<typeof vi.fn>,
  queryClient: QueryClient = new QueryClient(),
): QueryClient & { unmount: () => void } {
  vi.stubGlobal('fetch', fetchMock)
  const { unmount } = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[CATALOG_PATH]}>
        <Routes>
          <Route element={<Provide />}>
            <Route path={CATALOG_PATH} element={<Catalogo />} />
            <Route path={VARIETIES} element={<div>Aterrizaste en Variedades</div>} />
            <Route path={VARIETY} element={<VarietyLanding />} />
            <Route
              path={SETTINGS_CATALOG_MESSAGE}
              element={<div>Aterrizaste en el mensaje del catálogo</div>}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return Object.assign(queryClient, { unmount })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  vi.mocked(share.canShare).mockReturnValue(true)
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

test('neither Compartir nor Copiar is rendered while the first fetch is pending', async () => {
  const pending = new Promise<Response>(() => {})
  renderCatalogo(
    vi.fn((url: string) =>
      url === '/pinned-catalog' ? Promise.resolve(jsonResponse(200, DEFAULT_PINNED_CATALOG)) : pending,
    ),
  )

  await screen.findByRole('button', { name: 'Publicar' })
  expect(screen.queryByRole('button', { name: 'Copiar' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Compartir' })).not.toBeInTheDocument()
})

test("with the cache already holding a catalog, both buttons stay disabled until this mount's own fetch resolves", async () => {
  const queryClient = new QueryClient()
  queryClient.setQueryData(['catalog'], { ...CATALOG, text: 'texto viejo' })
  let resolveFetch: (value: Response) => void = () => {}
  const pending = new Promise<Response>((resolve) => {
    resolveFetch = resolve
  })
  renderCatalogo(
    vi.fn((url: string) =>
      url === '/pinned-catalog' ? Promise.resolve(jsonResponse(200, DEFAULT_PINNED_CATALOG)) : pending,
    ),
    queryClient,
  )

  expect(await screen.findByRole('button', { name: 'Copiar' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Compartir' })).toBeDisabled()

  resolveFetch(jsonResponse(200, CATALOG))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Copiar' })).toBeEnabled())
  expect(screen.getByRole('button', { name: 'Compartir' })).toBeEnabled()
})

test('opening the screen again after another reader unmounted asks the server again', async () => {
  const fetchMock = vi.fn((url: string) => Promise.resolve(defaultResponse(url)))
  const first = renderCatalogo(fetchMock)
  await screen.findByRole('button', { name: 'Copiar' })
  first.unmount()

  renderCatalogo(fetchMock, first)
  await screen.findByRole('button', { name: 'Copiar' })

  const catalogCalls = fetchMock.mock.calls.filter(([url]) => url === '/catalog')
  expect(catalogCalls).toHaveLength(2)
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
  expect(screen.queryByRole('button', { name: 'Compartir' })).not.toBeInTheDocument()
})

function catalogFetch(catalog: unknown): ReturnType<typeof vi.fn> {
  return vi.fn((url: string) =>
    Promise.resolve(
      url === '/pinned-catalog' ? jsonResponse(200, DEFAULT_PINNED_CATALOG) : jsonResponse(200, catalog),
    ),
  )
}

function variety(id: number, name: string, state: string) {
  return { id, name, emoji: null, indica_share: null, aroma: null, shown: true, state }
}

function reasonsSection(): HTMLElement {
  const heading = screen.getByText('Qué no sale y por qué')
  return heading.parentElement as HTMLElement
}

test('"Qué no sale y por qué" lists every variety out of the catalog with its one word, and none that goes out', async () => {
  renderCatalogo(
    catalogFetch({
      ...CATALOG,
      varieties: [
        variety(1, '24K Gold', 'in'),
        variety(2, 'Sir Jack', 'hidden'),
        variety(3, 'Mango Bomb', 'no_price'),
        variety(4, 'Golden Cookies', 'sold_out'),
        variety(5, 'Lemon Haze', 'no_entries'),
      ],
    }),
  )

  await screen.findByText('Qué no sale y por qué')
  const rows = within(reasonsSection()).getAllByRole('listitem')
  expect(rows.map((row) => row.textContent)).toEqual([
    'Sir Jackoculta',
    'Mango Bombsin precio',
    'Golden Cookiesagotada',
    'Lemon Hazesin entradas',
  ])
  expect(within(reasonsSection()).queryByText('24K Gold')).not.toBeInTheDocument()
})

test('with nothing out of the catalog the reasons section is not drawn', async () => {
  renderCatalogo(catalogFetch({ ...CATALOG, varieties: [variety(1, '24K Gold', 'in')] }))

  await screen.findByRole('button', { name: 'Copiar' })
  expect(screen.queryByText('Qué no sale y por qué')).not.toBeInTheDocument()
})

test('a variety left out opens its "En el catálogo" section on its page', async () => {
  renderCatalogo(catalogFetch({ ...CATALOG, varieties: [variety(7, 'Sir Jack', 'hidden')] }))

  await userEvent.click(await screen.findByRole('link', { name: 'Sir Jack' }))

  expect(await screen.findByText('Aterrizaste en /varieties/7#en-el-catalogo')).toBeInTheDocument()
})

test('the shell\'s "‹ Variedades" is the only back and goes to the list, by history and with none', async () => {
  vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(defaultResponse(url))))
  const router = createMemoryRouter(
    [
      {
        element: <Provide />,
        children: [
          {
            element: <Shell />,
            children: [
              { path: CATALOG_PATH, element: <Catalogo />, handle: { screen: 'catalog' } },
              { path: VARIETIES, element: <div>Aterrizaste en Variedades</div>, handle: { screen: 'varieties' } },
            ],
          },
        ],
      },
    ],
    { initialEntries: [CATALOG_PATH] },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )

  const backs = await screen.findAllByRole('button', { name: /^‹ / })
  expect(backs.map((back) => back.textContent)).toEqual(['‹ Variedades'])
  await userEvent.click(backs[0]!)

  expect(await screen.findByText('Aterrizaste en Variedades')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(VARIETIES)
})

test('Compartir hands the share sheet exactly the API text, byte for byte, and shows nothing after', async () => {
  const text = '🌿 **CATÁLOGO** 🌿\n\n  🥇 **24K Gold**  \n• Precio x gramo: $11.000\n\n'
  renderCatalogo(catalogFetch({ ...CATALOG, text }))

  await userEvent.click(await screen.findByRole('button', { name: 'Compartir' }))

  expect(share.shareText).toHaveBeenCalledTimes(1)
  expect(vi.mocked(share.shareText).mock.calls[0]?.[0]).toBe(text)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByText('Catálogo copiado')).not.toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('a cancelled share shows nothing at all', async () => {
  vi.mocked(share.shareText).mockResolvedValueOnce('cancelled')
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await userEvent.click(await screen.findByRole('button', { name: 'Compartir' }))

  await waitFor(() => expect(share.shareText).toHaveBeenCalled())
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByText('No se pudo compartir.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Copiar' })).toBeEnabled()
})

test('a failed share shows only the fixed message and leaves Copiar available', async () => {
  vi.mocked(share.shareText).mockResolvedValueOnce('failed')
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await userEvent.click(await screen.findByRole('button', { name: 'Compartir' }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(/^No se pudo compartir\.$/)
  expect(screen.getByRole('button', { name: 'Copiar' })).toBeEnabled()
  await userEvent.click(screen.getByRole('button', { name: 'Copiar' }))
  expect(clipboard.copyText).toHaveBeenCalledWith(CATALOG.text)
})

test('where the browser cannot share, Compartir is not shown and Copiar remains', async () => {
  vi.mocked(share.canShare).mockReturnValue(false)
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  expect(await screen.findByRole('button', { name: 'Copiar' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Compartir' })).not.toBeInTheDocument()
})

test('sharing and copying write nothing to the console or to browser storage', async () => {
  vi.mocked(share.shareText).mockResolvedValueOnce('failed')
  vi.mocked(clipboard.copyText).mockResolvedValueOnce(false)
  const spies = (['log', 'warn', 'error', 'info', 'debug'] as const).map((method) =>
    vi.spyOn(globalThis.console, method).mockImplementation(() => {}),
  )
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await userEvent.click(await screen.findByRole('button', { name: 'Compartir' }))
  await userEvent.click(screen.getByRole('button', { name: 'Copiar' }))
  await screen.findAllByRole('alert')

  for (const spy of spies) expect(spy).not.toHaveBeenCalled()
  expect(window.localStorage.length).toBe(0)
  expect(window.sessionStorage.length).toBe(0)
  vi.restoreAllMocks()
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

test('the catalog screen offers no header or footer editing, only the link out', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  expect(await screen.findByRole('link', { name: 'Editar encabezado y pie' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Encabezado')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Pie')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Guardá el mensaje' })).not.toBeInTheDocument()
})

test('the catalog screen still shows the preview, Copiar, the pin status and Publicar', async () => {
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

test('the catalog screen edits no variety attribute: no Editar button and no field', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await screen.findByRole('link', { name: 'Editar encabezado y pie' })
  expect(screen.queryByRole('button', { name: /^Editar / })).not.toBeInTheDocument()
  expect(screen.queryByText('Atributos en el catálogo')).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
})

test('Publicar is icon + text: the icon is hidden, so the name stays the word', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  const publish = await screen.findByRole('button', { name: 'Publicar' })
  const icon = publish.querySelector('svg')
  expect(icon).not.toBeNull()
  expect(icon).toHaveAttribute('aria-hidden', 'true')
})

test('"Editar encabezado y pie" is a text link with no icon', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  const link = await screen.findByRole('link', { name: 'Editar encabezado y pie' })
  expect(link.querySelector('svg')).toBeNull()
})

test('the empty state shows the registered title and line, each within its limit', async () => {
  renderCatalogo(
    vi.fn((url: string) =>
      Promise.resolve(jsonResponse(200, url === '/pinned-catalog' ? DEFAULT_PINNED_CATALOG : { ...CATALOG, text: null })),
    ),
  )

  expect(await screen.findByText(EMPTY_STATE_TITLE)).toBeInTheDocument()
  expect(screen.getByText(EMPTY_STATE_DETAIL)).toBeInTheDocument()
  expect(Array.from(EMPTY_STATE_TITLE).length).toBeLessThanOrEqual(40)
  expect(Array.from(EMPTY_STATE_DETAIL).length).toBeLessThanOrEqual(80)
})

test('Compartir keeps its word and Copiar is icon + text, the icons hidden; "Editar encabezado y pie" stays a text link', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  const share = await screen.findByRole('button', { name: 'Compartir' })
  const copy = screen.getByRole('button', { name: 'Copiar' })

  for (const button of [share, copy]) {
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(button).not.toHaveClass('boton-icono')
  }
  expect(share).toHaveTextContent('Compartir')
  expect(copy).toHaveTextContent('Copiar')
  const edit = screen.getByRole('link', { name: 'Editar encabezado y pie' })
  expect(edit.querySelector('svg')).toBeNull()
  expect(screen.queryByText('Volver')).not.toBeInTheDocument()
  // The variety name links of "Qué no sale y por qué" are plain row links, not controls of the rule.
  const problems = iconAndTextProblems(document.body).filter((problem) => !problem.includes('catalogo__fila-nombre'))
  expect(problems).toEqual([])
})
