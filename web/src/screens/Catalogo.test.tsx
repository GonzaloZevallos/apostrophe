/**
 * `Catalogo` at the screen seam (plan, "Front"): the preview built only from
 * `telegramPreview(text)`, Compartir and Copiar gated on the open's fetch and handed
 * the API's text without its paired `**`, "What does not go out and why" told by one word per variety, the
 * links out. It edits no variety attribute (that is the variety's own page). The API is faked at `fetch`, never
 * mocked deeper (CODING_STANDARDS §10).
 */

import { CATALOG as CATALOG_PATH, SETTINGS_CATALOG_MESSAGE, VARIETIES, VARIETY } from '../routes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, RouterProvider, Route, Routes, createMemoryRouter, useLocation } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import { SHOWN_EN } from '../test/shownLanguage'
import * as clipboard from '../clipboard'
import * as share from '../share'
import Shell from '../shell/Shell'
import Catalogo from './Catalogo'
import { iconAndTextProblems } from '../test/iconAndTextRule'
import { baselineText } from '../i18n/testing'

const EMPTY_STATE_TITLE = baselineText('catalog.ts:EMPTY_STATE_TITLE')
const EMPTY_STATE_DETAIL = baselineText('catalog.ts:EMPTY_STATE_DETAIL')

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

const ME: Me = { email: 'vos@lahuerta.com', business_name: 'La Huerta', today: '2026-10-02', shown_language: SHOWN_EN }

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

// `CATALOG.text` with its paired `**` removed by hand: what Copiar and Compartir hand out.
const CATALOG_PLAIN =
  '🌿 CATÁLOGO 🌿\n\n🥇 24K Gold\n• 60% índica / 40% sativa\n• Aroma/flavor: cítrico\n• Precio x gramo: $11.000\n• From 10 g: $10.000 c/u\n\n📩 Consultas y pedidos por privado.'

const CATALOG = {
  text: '🌿 **CATÁLOGO** 🌿\n\n🥇 **24K Gold**\n• 60% índica / 40% sativa\n• Aroma/flavor: cítrico\n• Precio x gramo: $11.000\n• From 10 g: $10.000 c/u\n\n📩 Consultas y pedidos por privado.',
  header: '🌿 **CATÁLOGO** 🌿',
  footer: '📩 Consultas y pedidos por privado.',
  products: [
    {
      product_id: 1,
      name: '24K Gold',
      emoji: '🥇',
      indica_share: 60,
      aroma: 'cítrico',
      shown: true,
      state: 'in',
    },
    {
      product_id: 2,
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

  await screen.findByRole('button', { name: 'Publish' })
  expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
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

  expect(await screen.findByRole('button', { name: 'Copy' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Share' })).toBeDisabled()

  resolveFetch(jsonResponse(200, CATALOG))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled())
  expect(screen.getByRole('button', { name: 'Share' })).toBeEnabled()
})

test('opening the screen again after another reader unmounted asks the server again', async () => {
  const fetchMock = vi.fn((url: string) => Promise.resolve(defaultResponse(url)))
  const first = renderCatalogo(fetchMock)
  await screen.findByRole('button', { name: 'Copy' })
  first.unmount()

  renderCatalogo(fetchMock, first)
  await screen.findByRole('button', { name: 'Copy' })

  const catalogCalls = fetchMock.mock.calls.filter(([url]) => url === '/catalog')
  expect(catalogCalls).toHaveLength(2)
})

test('the preview reads bold where ** pairs sit, with the markers hidden', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await screen.findByRole('button', { name: 'Copy' })
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

  expect(await screen.findByText(EMPTY_STATE_TITLE)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
})

function catalogFetch(catalog: unknown): ReturnType<typeof vi.fn> {
  return vi.fn((url: string) =>
    Promise.resolve(
      url === '/pinned-catalog' ? jsonResponse(200, DEFAULT_PINNED_CATALOG) : jsonResponse(200, catalog),
    ),
  )
}

function variety(id: number, name: string, state: string) {
  return { product_id: id, name, emoji: null, indica_share: null, aroma: null, shown: true, state }
}

function reasonsSection(): HTMLElement {
  const heading = screen.getByText('What does not go out and why')
  return heading.parentElement as HTMLElement
}

test('"What does not go out and why" lists every variety out of the catalog with its one word, and none that goes out', async () => {
  renderCatalogo(
    catalogFetch({
      ...CATALOG,
      products: [
        variety(1, '24K Gold', 'in'),
        variety(2, 'Sir Jack', 'hidden'),
        variety(3, 'Mango Bomb', 'no_price'),
        variety(4, 'Golden Cookies', 'sold_out'),
        variety(5, 'Lemon Haze', 'no_entries'),
      ],
    }),
  )

  await screen.findByText('What does not go out and why')
  const rows = within(reasonsSection()).getAllByRole('listitem')
  expect(rows.map((row) => row.textContent)).toEqual([
    'Sir Jackhidden',
    'Mango Bombno price',
    'Golden Cookiessold out',
    'Lemon Hazeno entries',
  ])
  expect(within(reasonsSection()).queryByText('24K Gold')).not.toBeInTheDocument()
})

test('with nothing out of the catalog the reasons section is not drawn', async () => {
  renderCatalogo(catalogFetch({ ...CATALOG, products: [variety(1, '24K Gold', 'in')] }))

  await screen.findByRole('button', { name: 'Copy' })
  expect(screen.queryByText('What does not go out and why')).not.toBeInTheDocument()
})

test('a variety left out opens its "In the catalog" section on its page', async () => {
  renderCatalogo(catalogFetch({ ...CATALOG, products: [variety(7, 'Sir Jack', 'hidden')] }))

  await userEvent.click(await screen.findByRole('link', { name: 'Sir Jack' }))

  expect(await screen.findByText('Aterrizaste en /varieties/7#en-el-catalogo')).toBeInTheDocument()
})

test('the shell\'s "‹ Varieties" is the only back and goes to the list, by history and with none', async () => {
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
  expect(backs.map((back) => back.textContent)).toEqual(['‹ Varieties'])
  await userEvent.click(backs[0]!)

  expect(await screen.findByText('Aterrizaste en Variedades')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(VARIETIES)
})

test('Compartir hands the share sheet the API text without its paired markers, line breaks and spaces kept, and shows nothing after', async () => {
  const text = '🌿 **CATÁLOGO** 🌿\n\n  🥇 **24K Gold**  \n• Precio x gramo: $11.000\n\n'
  renderCatalogo(catalogFetch({ ...CATALOG, text }))

  await userEvent.click(await screen.findByRole('button', { name: 'Share' }))

  expect(share.shareText).toHaveBeenCalledTimes(1)
  expect(vi.mocked(share.shareText).mock.calls[0]?.[0]).toBe(
    '🌿 CATÁLOGO 🌿\n\n  🥇 24K Gold  \n• Precio x gramo: $11.000\n\n',
  )
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByText('Catalog copied')).not.toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('a cancelled share shows nothing at all', async () => {
  vi.mocked(share.shareText).mockResolvedValueOnce('cancelled')
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await userEvent.click(await screen.findByRole('button', { name: 'Share' }))

  await waitFor(() => expect(share.shareText).toHaveBeenCalled())
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByText('Could not share.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled()
})

test('a failed share shows only the fixed message and leaves Copiar available', async () => {
  vi.mocked(share.shareText).mockResolvedValueOnce('failed')
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await userEvent.click(await screen.findByRole('button', { name: 'Share' }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(/^Could not share\.$/)
  expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled()
  await userEvent.click(screen.getByRole('button', { name: 'Copy' }))
  expect(clipboard.copyText).toHaveBeenCalledWith(CATALOG_PLAIN)
})

test('where the browser cannot share, Compartir is not shown and Copiar remains', async () => {
  vi.mocked(share.canShare).mockReturnValue(false)
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  expect(await screen.findByRole('button', { name: 'Copy' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
})

test('sharing and copying write nothing to the console or to browser storage', async () => {
  vi.mocked(share.shareText).mockResolvedValueOnce('failed')
  vi.mocked(clipboard.copyText).mockResolvedValueOnce(false)
  const spies = (['log', 'warn', 'error', 'info', 'debug'] as const).map((method) =>
    vi.spyOn(globalThis.console, method).mockImplementation(() => {}),
  )
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await userEvent.click(await screen.findByRole('button', { name: 'Share' }))
  await userEvent.click(screen.getByRole('button', { name: 'Copy' }))
  await screen.findAllByRole('alert')

  for (const spy of spies) expect(spy).not.toHaveBeenCalled()
  expect(window.localStorage.length).toBe(0)
  expect(window.sessionStorage.length).toBe(0)
  vi.restoreAllMocks()
})

test('Copiar copies the API text without its paired markers through copyText and shows the toast', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await userEvent.click(await screen.findByRole('button', { name: 'Copy' }))

  expect(clipboard.copyText).toHaveBeenCalledTimes(1)
  expect(clipboard.copyText).toHaveBeenCalledWith(CATALOG_PLAIN)
  expect(await screen.findByText('Catalog copied')).toBeInTheDocument()
})

test('Compartir hands out the same plain text as Copiar while the preview still reads bold', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await userEvent.click(await screen.findByRole('button', { name: 'Share' }))

  expect(share.shareText).toHaveBeenCalledWith(CATALOG_PLAIN)
  const preview = document.querySelector('.catalogo__vista-previa') as HTMLElement
  expect(within(preview).getByText('24K Gold').tagName).toBe('STRONG')
})

test('a failed copy shows the fixed message and no toast', async () => {
  vi.mocked(clipboard.copyText).mockResolvedValueOnce(false)
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await userEvent.click(await screen.findByRole('button', { name: 'Copy' }))

  expect(await screen.findByText('Could not copy.')).toBeInTheDocument()
  expect(screen.queryByText('Catalog copied')).not.toBeInTheDocument()
})

test('the catalog screen offers no header or footer editing, only the link out', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  expect(await screen.findByRole('link', { name: 'Edit header and footer' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Header')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Footer')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Save the message' })).not.toBeInTheDocument()
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

  expect(await screen.findByText('How it looks in Telegram')).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Copy' })).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Publish' })).toBeInTheDocument()
  expect(await screen.findByText('Up to date')).toBeInTheDocument()
})

test('"Edit header and footer" opens Settings → Catalog message', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await userEvent.click(await screen.findByRole('link', { name: 'Edit header and footer' }))

  expect(await screen.findByText('Aterrizaste en el mensaje del catálogo')).toBeInTheDocument()
})

test('the catalog screen offers no bot settings: they live in Integraciones', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await screen.findByRole('button', { name: 'Publish' })
  expect(screen.queryByLabelText('Bot token')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Test it' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Your chat', { exact: false })).not.toBeInTheDocument()
})

test('the catalog screen edits no variety attribute: no Editar button and no field', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await screen.findByRole('link', { name: 'Edit header and footer' })
  expect(screen.queryByRole('button', { name: /^Editar / })).not.toBeInTheDocument()
  expect(screen.queryByText('Atributos en el catálogo')).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
})

test('Publicar is icon + text: the icon is hidden, so the name stays the word', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  const publish = await screen.findByRole('button', { name: 'Publish' })
  const icon = publish.querySelector('svg')
  expect(icon).not.toBeNull()
  expect(icon).toHaveAttribute('aria-hidden', 'true')
})

test('"Edit header and footer" is a text link with no icon', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  const link = await screen.findByRole('link', { name: 'Edit header and footer' })
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

test('Compartir keeps its word and Copiar is icon + text, the icons hidden; "Edit header and footer" stays a text link', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  const share = await screen.findByRole('button', { name: 'Share' })
  const copy = screen.getByRole('button', { name: 'Copy' })

  for (const button of [share, copy]) {
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(button).not.toHaveClass('boton-icono')
  }
  expect(share).toHaveTextContent('Share')
  expect(copy).toHaveTextContent('Copy')
  const edit = screen.getByRole('link', { name: 'Edit header and footer' })
  expect(edit.querySelector('svg')).toBeNull()
  expect(screen.queryByText('Volver')).not.toBeInTheDocument()
  // The variety name links of "What does not go out and why" are plain row links, not controls of the rule.
  const problems = iconAndTextProblems(document.body).filter((problem) => !problem.includes('catalogo__fila-nombre'))
  expect(problems).toEqual([])
})

// A share or copy promise the test settles by hand: what the iOS sheet that spins forever
// (never) or that closes late (later) looks like from the screen.
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

test('a share that never settles holds neither Compartir nor Copiar, and another tap shares again', async () => {
  vi.mocked(share.shareText)
    .mockReturnValueOnce(new Promise(() => {}))
    .mockReturnValueOnce(new Promise(() => {}))
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await userEvent.click(await screen.findByRole('button', { name: 'Share' }))

  expect(screen.getByRole('button', { name: 'Share' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled()
  await userEvent.click(screen.getByRole('button', { name: 'Share' }))
  expect(share.shareText).toHaveBeenCalledTimes(2)
  expect(vi.mocked(share.shareText).mock.calls.map(([text]) => text)).toEqual([CATALOG_PLAIN, CATALOG_PLAIN])
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('an earlier share that fails after a newer one shared shows nothing', async () => {
  const first = deferred<'shared' | 'cancelled' | 'failed'>()
  vi.mocked(share.shareText).mockReturnValueOnce(first.promise).mockResolvedValueOnce('shared')
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await userEvent.click(await screen.findByRole('button', { name: 'Share' }))
  await userEvent.click(screen.getByRole('button', { name: 'Share' }))
  first.resolve('failed')
  await act(async () => {
    await first.promise
  })

  expect(share.shareText).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('an earlier share that shares after a newer one failed leaves the alert shown', async () => {
  const first = deferred<'shared' | 'cancelled' | 'failed'>()
  vi.mocked(share.shareText).mockReturnValueOnce(first.promise).mockResolvedValueOnce('failed')
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await userEvent.click(await screen.findByRole('button', { name: 'Share' }))
  await userEvent.click(screen.getByRole('button', { name: 'Share' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/^Could not share\.$/)
  first.resolve('shared')
  await act(async () => {
    await first.promise
  })

  expect(screen.getByRole('alert')).toHaveTextContent(/^Could not share\.$/)
})

test('with a share pending, Copiar copies the plain text and shows the toast', async () => {
  vi.mocked(share.shareText).mockReturnValueOnce(new Promise(() => {}))
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await userEvent.click(await screen.findByRole('button', { name: 'Share' }))
  await userEvent.click(screen.getByRole('button', { name: 'Copy' }))

  expect(clipboard.copyText).toHaveBeenCalledWith(CATALOG_PLAIN)
  expect(await screen.findByText('Catalog copied')).toBeInTheDocument()
})

test('a copy that never settles holds nothing, and the next copy shows its toast', async () => {
  vi.mocked(clipboard.copyText).mockReturnValueOnce(new Promise(() => {})).mockResolvedValueOnce(true)
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await userEvent.click(await screen.findByRole('button', { name: 'Copy' }))
  expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled()
  await userEvent.click(screen.getByRole('button', { name: 'Copy' }))

  expect(clipboard.copyText).toHaveBeenCalledTimes(2)
  expect(await screen.findByText('Catalog copied')).toBeInTheDocument()
})

test('an earlier copy that fails after a newer one succeeded shows no error', async () => {
  const first = deferred<boolean>()
  vi.mocked(clipboard.copyText).mockReturnValueOnce(first.promise).mockResolvedValueOnce(true)
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))

  await userEvent.click(await screen.findByRole('button', { name: 'Copy' }))
  await userEvent.click(screen.getByRole('button', { name: 'Copy' }))
  expect(await screen.findByText('Catalog copied')).toBeInTheDocument()
  first.resolve(false)
  await act(async () => {
    await first.promise
  })

  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByText('Catalog copied')).toBeInTheDocument()
})

test('Compartir calls shareText inside the tap itself, before any await', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))
  const button = await screen.findByRole('button', { name: 'Share' })

  fireEvent.click(button)

  expect(share.shareText).toHaveBeenCalledTimes(1)
})

test('Copiar calls copyText inside the tap itself, before any await', async () => {
  renderCatalogo(vi.fn((url: string) => Promise.resolve(defaultResponse(url))))
  const button = await screen.findByRole('button', { name: 'Copy' })

  fireEvent.click(button)

  expect(clipboard.copyText).toHaveBeenCalledTimes(1)
})
