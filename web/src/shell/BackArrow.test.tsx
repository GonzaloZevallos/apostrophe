/**
 * `BackArrow` and `useBackParent` at the shell seam: a real data router, `Shell`, and stand-in
 * screens that load a variety through `fetch` and then declare their back word the way a
 * record-labelled screen does. Nothing waits on a timer (ADR-0038): a fetch is held open by a
 * deferred promise, and `findBy*` waits for what it settles.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { createMemoryRouter, Outlet, RouterProvider, useParams, type RouteObject } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import {
  ANALYSIS,
  ARCHIVED_VARIETIES,
  SALE,
  SCREENS,
  VARIETIES,
  VARIETY,
  VARIETY_ENTRIES,
  VARIETY_PRICES,
  pathTo,
  type RecordLabelledScreen,
} from '../routes'
import Shell from './Shell'
import { BackParentContext, useBackParent } from './useBackParent'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03' }

interface Detail {
  id: number
  name: string
  archived: boolean
}

interface Deferred {
  promise: Promise<Response>
  settle: (response: Response) => void
}

function deferred(): Deferred {
  let settle: (response: Response) => void = () => undefined
  const promise = new Promise<Response>((resolve) => {
    settle = resolve
  })
  return { promise, settle }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** The API faked at `fetch`: `GET /varieties/{id}` answers what `answers[id]` holds. */
function fakeApi(answers: Record<number, Response | Deferred>) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const id = Number(String(input).slice(pathTo(VARIETY, { id: '' }).length))
    const answer = answers[id]
    if (answer === undefined) return Promise.resolve(json({ detail: 'not found' }, 404))
    return 'promise' in answer ? answer.promise : Promise.resolve(answer.clone())
  })
  vi.stubGlobal('fetch', fetchMock)
}

/** Declares the back word once the record is known: the archived page goes to Archivadas, any
 * other says its name. */
function Declare({ screen: id, detail }: { screen: RecordLabelledScreen; detail: Detail }) {
  useBackParent(id, detail.archived ? { parent: 'varieties-archived' } : { title: detail.name })
  return <p>{`Cargada ${detail.name}`}</p>
}

/** A record screen: it asks the API for its variety and shows "Cargando" while it waits, also
 * when the route's `:id` changes under it (a query under a new key is pending again). A 404
 * declares nothing. */
function RecordStub({ screen: id }: { screen: RecordLabelledScreen }) {
  const { id: param } = useParams<{ id: string }>()
  const [loaded, setLoaded] = useState<{ param: string | undefined; detail: Detail | null }>()
  useEffect(() => {
    let current = true
    void fetch(pathTo(VARIETY, { id: param ?? '' })).then(async (response) => {
      const detail = response.ok ? ((await response.json()) as Detail) : null
      if (current) setLoaded({ param, detail })
    })
    return () => {
      current = false
    }
  }, [param])
  const shown = loaded?.param === param ? loaded : undefined
  if (shown === undefined) return <p>Cargando</p>
  return shown.detail === null ? <p>That's gone.</p> : <Declare screen={id} detail={shown.detail} />
}

/** The shell asks `GET /first-run` on a root, so it needs a client; the read fails here and the
 * shell draws normally. */
function Client({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function renderAt(entries: string[]) {
  const leaf = (path: string, id: string): RouteObject => {
    const marked = id === 'variety' || id === 'variety-prices' || id === 'variety-entries'
    return {
      path,
      handle: { screen: id },
      element: marked ? <RecordStub screen={id} /> : <p>{id}</p>,
    }
  }
  const router = createMemoryRouter(
    [
      {
        element: <Outlet context={ME} />,
        children: [{ element: <Shell />, children: SCREENS.map((entry) => leaf(entry.path, entry.id)) }],
      },
    ],
    { initialEntries: entries },
  )
  const view = render(
    <Client>
      <RouterProvider router={router} />
    </Client>,
  )
  return { router, ...view }
}

const backs = (): string[] => screen.queryAllByRole('button', { name: /^‹ / }).map((back) => back.textContent ?? '')

afterEach(() => {
  vi.unstubAllGlobals()
})

test('a marked leaf shows no back, and no placeholder word, until its screen declares one', async () => {
  const pending = deferred()
  fakeApi({ 1: pending })
  renderAt([pathTo(VARIETY_PRICES, { id: 1 })])

  expect(await screen.findByText('Cargando')).toBeInTheDocument()
  expect(backs()).toEqual([])
  expect(screen.queryByText('‹')).not.toBeInTheDocument()
  expect(screen.queryByText(/Variedad$/)).not.toBeInTheDocument()

  await act(async () => pending.settle(json({ id: 1, name: '24K Gold', archived: false })))
  expect(await screen.findAllByRole('button', { name: /^‹ / })).toHaveLength(1)
  expect(backs()).toEqual(['‹ 24K Gold'])
})

test('the accessible name is the visible text', async () => {
  fakeApi({ 1: json({ id: 1, name: '24K Gold', archived: false }) })
  renderAt([pathTo(VARIETY_ENTRIES, { id: 1 })])

  const back = await screen.findByRole('button', { name: '‹ 24K Gold' })
  expect(back).toHaveTextContent('‹ 24K Gold')
  expect(back).not.toHaveAttribute('aria-label')
  expect(screen.queryByRole('button', { name: 'Volver' })).not.toBeInTheDocument()
})

test("from variety A's prices to variety B's entries, '‹ A' is gone while B loads and exactly '‹ B' shows after", async () => {
  const b = deferred()
  fakeApi({ 1: json({ id: 1, name: 'Alpha', archived: false }), 2: b })
  const { router } = renderAt([pathTo(VARIETY_PRICES, { id: 1 })])
  expect(await screen.findByRole('button', { name: '‹ Alpha' })).toBeInTheDocument()

  await act(async () => router.navigate(pathTo(VARIETY_ENTRIES, { id: 2 })))
  expect(await screen.findByText('Cargando')).toBeInTheDocument()
  expect(backs()).toEqual([])

  await act(async () => b.settle(json({ id: 2, name: 'Beta', archived: false })))
  expect(await screen.findByRole('button', { name: '‹ Beta' })).toBeInTheDocument()
  expect(backs()).toEqual(['‹ Beta'])
})

test("from variety A to variety B on the same screen, '‹ A' is gone while B loads and exactly '‹ B' shows after", async () => {
  const b = deferred()
  fakeApi({ 1: json({ id: 1, name: 'Alpha', archived: false }), 2: b })
  const { router } = renderAt([pathTo(VARIETY, { id: 1 })])
  expect(await screen.findByRole('button', { name: '‹ Alpha' })).toBeInTheDocument()

  await act(async () => router.navigate(pathTo(VARIETY, { id: 2 })))
  expect(await screen.findByText('Cargando')).toBeInTheDocument()
  expect(backs()).toEqual([])

  await act(async () => b.settle(json({ id: 2, name: 'Beta', archived: false })))
  expect(await screen.findByRole('button', { name: '‹ Beta' })).toBeInTheDocument()
  expect(backs()).toEqual(['‹ Beta'])
})

test("an archived variety shows only '‹ Archived', never a flash of '‹ Varieties'", async () => {
  const pending = deferred()
  fakeApi({ 5: pending })
  const seen: string[] = []
  const watch = new MutationObserver(() => {
    for (const back of screen.queryAllByRole('button', { name: /^‹ / })) seen.push(back.textContent ?? '')
  })
  watch.observe(document.body, { childList: true, subtree: true, characterData: true })
  renderAt([pathTo(VARIETY, { id: 5 })])
  expect(await screen.findByText('Cargando')).toBeInTheDocument()

  await act(async () => pending.settle(json({ id: 5, name: 'Vieja', archived: true })))
  expect(await screen.findByRole('button', { name: '‹ Archived' })).toBeInTheDocument()
  watch.disconnect()

  expect(backs()).toEqual(['‹ Archived'])
  expect(seen.filter((word) => word !== '‹ Archived')).toEqual([])
})

/** Writes the slot for variety 1 once and never clears it: a declaration left behind. */
function LeftBehind({ screen: id }: { screen: RecordLabelledScreen }) {
  const write = useContext(BackParentContext)?.write
  useLayoutEffect(() => write?.({ screen: id, param: '1', override: { title: 'Alpha' } }), [write, id])
  return <p>Left behind</p>
}

test("a declaration for another record or another screen is ignored, even if it was left in the slot", async () => {
  const router = createMemoryRouter(
    [
      {
        element: <Outlet context={ME} />,
        children: [
          {
            element: <Shell />,
            children: [
              { path: VARIETY, handle: { screen: 'variety' }, element: <LeftBehind screen="variety" /> },
              { path: VARIETY_PRICES, handle: { screen: 'variety-prices' }, element: <p>Precios</p> },
            ],
          },
        ],
      },
    ],
    { initialEntries: [pathTo(VARIETY, { id: 1 })] },
  )
  render(
    <Client>
      <RouterProvider router={router} />
    </Client>,
  )
  expect(await screen.findByRole('button', { name: '‹ Alpha' })).toBeInTheDocument()

  await act(async () => router.navigate(pathTo(VARIETY, { id: 2 })))
  expect(await screen.findByText('Left behind')).toBeInTheDocument()
  expect(backs()).toEqual([])

  await act(async () => router.navigate(pathTo(VARIETY_PRICES, { id: 1 })))
  expect(await screen.findByText('Precios')).toBeInTheDocument()
  expect(backs()).toEqual([])
})

test('a marked screen whose fetch answers 404 shows no back', async () => {
  fakeApi({})
  renderAt([pathTo(VARIETY_ENTRIES, { id: 9 })])

  expect(await screen.findByText("That's gone.")).toBeInTheDocument()
  expect(backs()).toEqual([])
})

test("back with no history goes to the parent's path with its params filled, never ':id'", async () => {
  const user = userEvent.setup()
  fakeApi({ 1: json({ id: 1, name: '24K Gold', archived: false }) })
  const { router } = renderAt([pathTo(VARIETY_PRICES, { id: 1 })])

  await user.click(await screen.findByRole('button', { name: '‹ 24K Gold' }))

  expect(router.state.location.pathname).toBe(pathTo(VARIETY, { id: 1 }))
})

test("an archived variety's back with no history goes to Archivadas; an active page's to Variedades", async () => {
  const user = userEvent.setup()
  fakeApi({
    5: json({ id: 5, name: 'Vieja', archived: true }),
    6: json({ id: 6, name: 'Nueva', archived: false }),
  })
  const first = renderAt([pathTo(VARIETY, { id: 5 })])
  await user.click(await screen.findByRole('button', { name: '‹ Archived' }))
  expect(first.router.state.location.pathname).toBe(ARCHIVED_VARIETIES)
  first.unmount()

  const second = renderAt([pathTo(VARIETY, { id: 6 })])
  await user.click(await screen.findByRole('button', { name: '‹ Nueva' }))
  expect(second.router.state.location.pathname).toBe(VARIETIES)
})

test('an unmarked card still prints its registry parent, a tab root no back', () => {
  fakeApi({})
  const card = renderAt([pathTo(SALE, { id: 7 })])
  expect(backs()).toEqual(['‹ Sales'])
  card.unmount()
  renderAt([ANALYSIS])
  expect(backs()).toEqual([])
})

