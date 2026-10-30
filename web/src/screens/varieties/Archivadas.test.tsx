/**
 * Archivadas at the screen seam (`varieties.md`, "Archived"): the count at the foot of
 * Variedades and its absence, the card listing only archived varieties by name with
 * "Archived" and "Restore", restore in one tap from the card and from the archived
 * variety's read-only page, and that page offering no action but "Restore".
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, RouterProvider, createMemoryRouter, type InitialEntry } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import { SHOWN_EN } from '../../test/shownLanguage'
import { inAppState } from '../../components/inAppState'
import FlashProvider from '../../flash/FlashProvider'
import { ARCHIVED_VARIETIES, VARIETIES, VARIETY, pathTo, relative } from '../../routes'
import { LIMITS, SAMPLES } from '../../copy/limits'
import { iconAndTextProblems, expectIconAndTextRule } from '../../test/iconAndTextRule'
import Shell from '../../shell/Shell'
import Variedades from '../Variedades'
import ArchivedIndex from './ArchivedIndex'
import ArchivedVarieties from './ArchivedVarieties'
import VarietiesIndex from './VarietiesIndex'
import VarietiesLayout from './VarietiesLayout'
import VarietyPage from './VarietyPage'
import VarietyRoute from './VarietyRoute'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02', shown_language: SHOWN_EN }

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Variedades, then Archivadas opened by the foot link (an in-app entry). */
const FROM_FOOT_LINK: InitialEntry[] = [VARIETIES, { pathname: ARCHIVED_VARIETIES, state: inAppState({ pathname: VARIETIES }) }]
const NAMES: Record<number, string> = { 4: 'Alfa Vieja', 5: 'Zeta Vieja' }
const GRAMS: Record<number, number> = { 4: 7, 5: 3 }
const CATALOG = { text: '', header: '', footer: '', products: [] }

type Answers = Record<string, () => Response>

/** The faked API for two archived varieties (4 Alfa, 5 Zeta; the API lists Zeta first). A restore
 * makes the variety live for every later answer, as the server would. */
function fakeApi(hidden: readonly number[] = [], overrides: Answers = {}): Answers {
  const live = new Set<number>()
  const archivedIds = () => [5, 4].filter((id) => !live.has(id))
  const rowOf = (id: number) => ({ id, name: NAMES[id], archived: !live.has(id), current_price: null })
  const answers: Answers = {
    'GET /api/products': () => json(200, [4, 5].filter((id) => live.has(id)).map(rowOf)),
    'GET /api/products?archived=true': () => json(200, archivedIds().map(rowOf)),
    'GET /stock': () =>
      json(200, {
        total: 0,
        products: [...live].map((id) => ({ product_id: id, quantity: GRAMS[id], status: 'ok', sold_out_since: null, threshold: null, days_left: null })),
        entries: [],
      }),
    'GET /stock?archived=true': () =>
      json(200, {
        total: 10,
        products: archivedIds().map((id) => ({ product_id: id, quantity: GRAMS[id], status: 'ok', sold_out_since: null, threshold: null, days_left: null })),
        entries: [],
      }),
    'GET /catalog': () => json(200, CATALOG),
    'GET /catalog/archived': () =>
      json(
        200,
        archivedIds().map((id) => ({ product_id: id, name: NAMES[id], shown: !hidden.includes(id), emoji: null, indica_share: null, aroma: null })),
      ),
  }
  for (const id of [4, 5]) {
    answers[`GET /api/products/${id}`] = () =>
      json(200, { ...rowOf(id), removal: live.has(id) ? 'archive' : null })
    answers[`GET /api/products/${id}/prices`] = () => json(200, [])
    answers[`GET /stock/products/${id}/movements`] = () => json(200, [])
    answers[`POST /api/products/${id}/restore`] = () => {
      live.add(id)
      return json(200, { id, name: NAMES[id], archived: false, removal: 'archive' })
    }
  }
  return { ...answers, ...overrides }
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

function stubFetch(answers: Answers) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const answer = answers[`${init?.method ?? 'GET'} ${url}`]
    if (answer === undefined) return Promise.reject(new Error(`unexpected request: ${init?.method ?? 'GET'} ${url}`))
    return Promise.resolve(answer())
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderAt(path: string | InitialEntry[], overrides: Answers = {}, hidden: readonly number[] = []) {
  setComputer(false)
  const fetchMock = stubFetch(fakeApi(hidden, overrides))
  const entries = Array.isArray(path) ? path : [path]
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
            element: <Shell />,
            children: [
              { path: relative(VARIETIES), element: <Variedades />, handle: { screen: 'varieties' } },
              { path: relative(ARCHIVED_VARIETIES), element: <ArchivedVarieties />, handle: { screen: 'varieties-archived' } },
              {
                path: relative(VARIETY),
                element: <VarietyRoute render={(id) => <VarietyPage varietyId={id} />} />,
                handle: { screen: 'variety' },
              },
            ],
          },
        ],
      },
    ],
    { initialEntries: entries },
  )
  render(<RouterProvider router={router} />)
  return { fetchMock, router }
}

/** Notes whether a live-only action ever appears, however briefly, while a test runs. */
function watchForLiveActions(): { seen: () => boolean; stop: () => void } {
  let seen = false
  const look = () => {
    if (/Eliminar variety|Archive variety|Editar|New price/.test(document.body.textContent ?? '')) seen = true
  }
  const observer = new MutationObserver(look)
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  return { seen: () => seen, stop: () => observer.disconnect() }
}

afterEach(() => vi.unstubAllGlobals())

describe('Archivadas (N) on Variedades', () => {
  test('shows the count of archived varieties and links to the card', async () => {
    renderAt(VARIETIES)
    const link = await screen.findByRole('link', { name: /Archived \(2\)/ })
    expect(link.getAttribute('href')).toBe(ARCHIVED_VARIETIES)
  })

  test('shows nothing when there are none', async () => {
    renderAt(VARIETIES, { 'GET /api/products?archived=true': () => json(200, []) })
    await screen.findByText('All entries')
    await waitFor(() => expect(screen.queryByText(/Archived \(/)).toBeNull())
  })
})

describe('the Archivadas card', () => {
  test('its empty state is measured copy and the screen follows the rule', async () => {
    renderAt(ARCHIVED_VARIETIES, { 'GET /api/products?archived=true': () => json(200, []) })
    const title = await screen.findByText('You have no archived varieties')

    expect(title).toHaveAttribute('data-copy', 'emptyTitle')
    expectIconAndTextRule(screen.getByRole('main'), { limits: LIMITS, samples: SAMPLES })
    title.textContent = 'x'.repeat(LIMITS.emptyTitle + 1)
    expect(iconAndTextProblems(screen.getByRole('main'), { limits: LIMITS, samples: SAMPLES })).toHaveLength(1)
  })

  test('with archived varieties, Restore has its icon and the screen follows the rule', async () => {
    renderAt(ARCHIVED_VARIETIES)
    await screen.findByText('Alfa Vieja')

    expectIconAndTextRule(screen.getByRole('main'), { optionClasses: ['variedad-fila'] })
  })

  test('lists the archived varieties by name, each marked Archived with Restore', async () => {
    renderAt(ARCHIVED_VARIETIES)
    await screen.findByText('Alfa Vieja')
    const names = screen.getAllByText(/Vieja$/).map((node) => node.textContent)
    expect(names).toEqual(['Alfa Vieja', 'Zeta Vieja'])
    expect(screen.getAllByText('Archived', { selector: '.insignia' })).toHaveLength(2)
    for (const mark of screen.getAllByText('Archived', { selector: '.insignia' })) expect(mark.className).toBe('insignia')
    expect(screen.queryByText('Hidden')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Restore' })).toHaveLength(2)
    expect(screen.getByRole('button', { name: '‹ Varieties' })).toBeTruthy()
    expect(screen.queryByText('+ New sale')).toBeNull()
  })

  test('marks Hidden, from the stored catalog attributes, only on the hidden archived variety', async () => {
    renderAt(ARCHIVED_VARIETIES, {}, [5])
    await screen.findByText('Alfa Vieja')
    const hiddenRow = (await screen.findByText('Hidden')).closest('.variedad-archivada')
    expect(hiddenRow).toHaveTextContent('Zeta Vieja')
    expect(screen.getAllByText('Hidden')).toHaveLength(1)
  })

  test('an empty list reached by an in-app link goes on to Variedades (a typed address keeps the fixed line, below)', async () => {
    const { router } = renderAt(
      [{ pathname: VARIETIES }, { pathname: ARCHIVED_VARIETIES, state: inAppState({ pathname: VARIETIES }) }],
      { 'GET /api/products?archived=true': () => json(200, []) },
    )
    await waitFor(() => expect(router.state.location.pathname).toBe(VARIETIES))
  })

  test('says so with a fixed line when there are none', async () => {
    renderAt(ARCHIVED_VARIETIES, { 'GET /api/products?archived=true': () => json(200, []) })
    expect(await screen.findByText('You have no archived varieties')).toBeTruthy()
  })

  test('restores in one tap, with the toast and no confirmation', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderAt(ARCHIVED_VARIETIES)
    await screen.findByText('Alfa Vieja')
    await user.click(screen.getAllByRole('button', { name: 'Restore' })[0]!)
    expect(await screen.findByText('Variety restored')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    const requested = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').map(([url]) => url)
    expect(requested).toEqual(['/api/products/4/restore'])
  })

  test('a variety already gone shows the generic gone notice', async () => {
    const user = userEvent.setup()
    renderAt(ARCHIVED_VARIETIES, {
      'POST /api/products/4/restore': () => json(404, { code: 'variety.not_found', detail: 'x' }),
    })
    await screen.findByText('Alfa Vieja')
    await user.click(screen.getAllByRole('button', { name: 'Restore' })[0]!)
    expect(await screen.findByText('That is gone. The list is up to date.')).toBeTruthy()
  })
})

describe("an archived variety's page", () => {
  test('is read-only: back to Archivadas, Archived in words, and Restore the one action', async () => {
    const { router } = renderAt(pathTo(VARIETY, { id: 4 }))
    expect(await screen.findByRole('heading', { name: 'Alfa Vieja' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '‹ Archived' })).toBeTruthy()
    expect(screen.getByText('Archived')).toBeTruthy()
    expect(screen.getByText('7 g', { exact: false })).toBeTruthy()
    for (const gone of [
      '+ Entry',
      'New price',
      'Take from stock',
      'Delete variety',
      'Archive variety',
      'Delete',
      'Edit',
    ]) {
      expect(screen.queryByText(gone)).toBeNull()
    }
    expect(screen.queryByRole('button', { name: /Editar|Delete/ })).toBeNull()
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['‹ Archived', 'Restore'])
    // With no history to go back to, the one back goes to Archivadas.
    await userEvent.click(screen.getByRole('button', { name: '‹ Archived' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(ARCHIVED_VARIETIES))
  })

  test('Restore goes back to Archivadas in one move: toast, no restored row, no live page, no repeated entry', async () => {
    const user = userEvent.setup()
    const { router, fetchMock } = renderAt(FROM_FOOT_LINK)
    const watch = watchForLiveActions()
    await user.click(await screen.findByRole('link', { name: /Alfa Vieja/ }))
    await user.click(await screen.findByRole('button', { name: 'Restore' }))

    expect(await screen.findByRole('heading', { name: 'Archived' })).toBeTruthy()
    expect(router.state.location.pathname).toBe(ARCHIVED_VARIETIES)
    expect(await screen.findByText('Variety restored')).toBeTruthy()
    expect(screen.queryByText('Alfa Vieja')).toBeNull()
    expect(screen.getByText('Zeta Vieja')).toBeTruthy()
    // Nothing refetched the page under the seller's finger before it left.
    const posted = fetchMock.mock.calls.findIndex(([, init]) => init?.method === 'POST')
    const requested = fetchMock.mock.calls.slice(posted + 1).map(([url]) => url)
    expect(requested).not.toContain('/api/products/4')
    expect(requested).not.toContain('/stock?archived=true')
    watch.stop()
    expect(watch.seen()).toBe(false)
    // One entry back is Variedades: Archivadas was not pushed a second time.
    await act(() => router.navigate(-1))
    expect(router.state.location.pathname).toBe(VARIETIES)
  })

  test('while the pop is delayed, the page stays archived: no live action is ever drawn', async () => {
    const user = userEvent.setup()
    const { router, fetchMock } = renderAt(FROM_FOOT_LINK)
    await user.click(await screen.findByRole('link', { name: /Alfa Vieja/ }))
    const restoreButton = await screen.findByRole('button', { name: 'Restore' })
    // Hold every navigation open: the restore resolves and the caches are rewritten while the
    // archived page is still on screen, the window a slow pop leaves.
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const navigate = router.navigate.bind(router)
    vi.spyOn(router, 'navigate').mockImplementation(async (...args: Parameters<typeof navigate>) => {
      await gate
      return navigate(...args)
    })
    const watch = watchForLiveActions()
    await user.click(restoreButton)
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true))
    await waitFor(() => expect(restoreButton).toBeEnabled())
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)))

    expect(router.state.location.pathname).toBe(pathTo(VARIETY, { id: 4 }))
    expect(screen.getByRole('heading', { name: 'Alfa Vieja' })).toBeTruthy()
    for (const name of ['Delete variety', 'Archive variety', 'Edit', 'New price']) {
      expect(screen.queryByRole('button', { name })).toBeNull()
      expect(screen.queryByRole('link', { name })).toBeNull()
    }
    release()
    expect(await screen.findByRole('heading', { name: 'Archived' })).toBeTruthy()
    watch.stop()
    expect(watch.seen()).toBe(false)
    expect(screen.queryByText('Alfa Vieja')).toBeNull()
  })

  test('the last archived variety restored lands on Variedades, never on an empty Archivadas', async () => {
    const user = userEvent.setup()
    const { router } = renderAt(FROM_FOOT_LINK)
    await user.click(await screen.findByRole('link', { name: /Alfa Vieja/ }))
    await user.click(await screen.findByRole('button', { name: 'Restore' }))
    await screen.findByRole('heading', { name: 'Archived' })
    await user.click(screen.getByRole('link', { name: /Zeta Vieja/ }))
    await user.click(await screen.findByRole('button', { name: 'Restore' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(VARIETIES))
    expect(await screen.findByText('Variety restored')).toBeTruthy()
    expect(screen.queryByText('You have no archived varieties')).toBeNull()
    await act(() => router.navigate(-1))
    expect(router.state.location.pathname).toBe(VARIETIES)
  })

  test('reached by a typed address (nothing cached), it lands on Archivadas', async () => {
    const user = userEvent.setup()
    const { router } = renderAt(pathTo(VARIETY, { id: 4 }))
    await user.click(await screen.findByRole('button', { name: 'Restore' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(ARCHIVED_VARIETIES))
    expect(await screen.findByText('Variety restored')).toBeTruthy()
    expect(await screen.findByText('Zeta Vieja')).toBeTruthy()
    expect(screen.queryByText('Alfa Vieja')).toBeNull()
  })

  test('a variety gone meanwhile shows the gone notice and navigates nowhere', async () => {
    const user = userEvent.setup()
    const { router } = renderAt([VARIETIES, ARCHIVED_VARIETIES], {
      'POST /api/products/4/restore': () => json(404, { code: 'variety.not_found', detail: 'x' }),
    })
    await user.click(await screen.findByRole('link', { name: /Alfa Vieja/ }))
    await user.click(await screen.findByRole('button', { name: 'Restore' }))
    await waitFor(() => expect(screen.queryByText('Variety restored')).toBeNull())
    expect(router.state.location.pathname).toBe(pathTo(VARIETY, { id: 4 }))
  })
})

describe('on a computer (two panes)', () => {
  function renderComputer(path: string | InitialEntry[], overrides: Answers = {}) {
    setComputer(true)
    const fetchMock = stubFetch(fakeApi([], overrides))
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
              element: <Shell />,
              children: [
                {
                  path: VARIETIES,
                  element: <VarietiesLayout />,
                  children: [
                    { index: true, element: <VarietiesIndex />, handle: { screen: 'varieties' } },
                    { path: ARCHIVED_VARIETIES, element: <ArchivedIndex />, handle: { screen: 'varieties-archived' } },
                    {
                      path: VARIETY,
                      element: <VarietyRoute render={(id) => <VarietyPage varietyId={id} />} />,
                      handle: { screen: 'variety' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      { initialEntries: Array.isArray(path) ? path : [path] },
    )
    render(<RouterProvider router={router} />)
    return { router, fetchMock }
  }

  test('Archivadas selects the first archived variety by name, not the first the API sent', async () => {
    const { router } = renderComputer(ARCHIVED_VARIETIES)
    await waitFor(() => expect(router.state.location.pathname).toBe(pathTo(VARIETY, { id: 4 })))
    expect(await screen.findByRole('heading', { name: 'Alfa Vieja' })).toBeTruthy()
    expect(router.state.location.pathname).not.toBe(pathTo(VARIETY, { id: 5 }))
  })

  test('with none archived, Archivadas selects nothing and says so on the left', async () => {
    const { router } = renderComputer(ARCHIVED_VARIETIES, { 'GET /api/products?archived=true': () => json(200, []) })
    expect(await screen.findByText('You have no archived varieties')).toBeTruthy()
    expect(router.state.location.pathname).toBe(ARCHIVED_VARIETIES)
  })

  test('the left pane is the Archivadas card beside an archived variety', async () => {
    renderComputer(pathTo(VARIETY, { id: 4 }))
    expect(await screen.findByRole('heading', { name: 'Archived' })).toBeTruthy()
    expect(await screen.findAllByRole('button', { name: /^‹ / })).toHaveLength(1)
    expect(screen.getByRole('button', { name: '‹ Archived' })).toBeTruthy()
    expect(screen.getAllByText('Zeta Vieja')).toHaveLength(1)
    expect(screen.queryByText('All entries')).toBeNull()
  })

  /** One entry back is Variedades, not Archivadas again; the restored variety is live there, so a
   * computer's list selects it, as it would any live variety. */
  async function goBackToTheList(router: ReturnType<typeof renderComputer>['router']) {
    await act(() => router.navigate(-1))
    await waitFor(() => expect(router.state.location.pathname).not.toBe(pathTo(VARIETY, { id: 5 })))
    expect(router.state.location.pathname).not.toBe(ARCHIVED_VARIETIES)
    expect(await screen.findByText('All entries')).toBeTruthy()
  }

  function pageRestore(): HTMLElement {
    const pane = document.querySelector<HTMLElement>('.variedades-paneles__detalle')!
    return within(pane).getByRole('button', { name: 'Restore' })
  }

  test('Restore selects the next archived variety by name, replacing the entry', async () => {
    const user = userEvent.setup()
    const { router } = renderComputer([VARIETIES, pathTo(VARIETY, { id: 4 })])
    const watch = watchForLiveActions()
    await screen.findByText('Zeta Vieja')
    await user.click(pageRestore())

    await waitFor(() => expect(router.state.location.pathname).toBe(pathTo(VARIETY, { id: 5 })))
    expect(await screen.findByRole('heading', { name: 'Zeta Vieja' })).toBeTruthy()
    expect(await screen.findByText('Variety restored')).toBeTruthy()
    // The card is still on the left, without the restored variety.
    await waitFor(() => expect(screen.queryByText('Alfa Vieja')).toBeNull())
    expect(screen.getByRole('heading', { name: 'Archived' })).toBeTruthy()
    watch.stop()
    expect(watch.seen()).toBe(false)
    await goBackToTheList(router)
  })

  test('Restore on the last by name selects the previous one', async () => {
    const user = userEvent.setup()
    const { router } = renderComputer([VARIETIES, pathTo(VARIETY, { id: 5 })])
    await screen.findByText('Alfa Vieja')
    await user.click(pageRestore())

    await waitFor(() => expect(router.state.location.pathname).toBe(pathTo(VARIETY, { id: 4 })))
    expect(await screen.findByRole('heading', { name: 'Alfa Vieja' })).toBeTruthy()
  })

  test('with none left, Restore goes to Variedades, where the restored varieties are listed', async () => {
    const user = userEvent.setup()
    const { router } = renderComputer([VARIETIES, pathTo(VARIETY, { id: 4 })])
    await screen.findByText('Zeta Vieja')
    await user.click(pageRestore())
    await screen.findByRole('heading', { name: 'Zeta Vieja' })
    await user.click(pageRestore())

    await waitFor(() => expect(router.state.location.pathname).toBe(VARIETIES))
    expect(await screen.findByText('All entries')).toBeTruthy()
    // The list takes the left pane back one render after the path changes: wait for it.
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Archived' })).toBeNull())
    // The list selects its first variety, so the page of Alfa Vieja is drawn on the right as soon
    // as that fetch lands: both panes may name it. The restored varieties are listed on the left.
    const livePane = within(document.querySelector<HTMLElement>('.variedades-paneles__lista')!)
    expect(await livePane.findByText('Alfa Vieja')).toBeTruthy()
    expect(await livePane.findByText('Zeta Vieja')).toBeTruthy()
    await waitFor(() => expect(screen.queryByText('You have no archived varieties')).toBeNull())
    await goBackToTheList(router)
  })

  test('when the next one was restored elsewhere meanwhile, it is shown as the live variety it is', async () => {
    const user = userEvent.setup()
    let elsewhere = false
    const api = fakeApi()
    const { router } = renderComputer([VARIETIES, pathTo(VARIETY, { id: 4 })], {
      'GET /api/products/5': () =>
        elsewhere
          ? json(200, { id: 5, name: 'Zeta Vieja', archived: false, removal: 'archive', current_price: null })
          : api['GET /api/products/5']!(),
    })
    await screen.findByText('Zeta Vieja')
    elsewhere = true
    await user.click(pageRestore())

    await waitFor(() => expect(router.state.location.pathname).toBe(pathTo(VARIETY, { id: 5 })))
    expect(await screen.findByRole('heading', { name: 'Zeta Vieja' })).toBeTruthy()
  })

  test('history Back from a second row lands on Variedades, with no archived variety selected again', async () => {
    const user = userEvent.setup()
    const { router } = renderComputer([
      VARIETIES,
      { pathname: ARCHIVED_VARIETIES, state: inAppState({ pathname: VARIETIES }) },
    ])
    await waitFor(() => expect(router.state.location.pathname).toBe(pathTo(VARIETY, { id: 4 })))
    await screen.findByRole('heading', { name: 'Alfa Vieja' })
    await user.click(await screen.findByRole('link', { name: /Zeta Vieja/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe(pathTo(VARIETY, { id: 5 })))
    await act(() => router.navigate(-1))
    expect(router.state.location.pathname).toBe(VARIETIES)
  })
})
