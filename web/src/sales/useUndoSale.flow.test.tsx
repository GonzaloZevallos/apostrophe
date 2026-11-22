/**
 * `useUndoSale().announceSaved` through `FlashProvider` and a memory data router, `fetch` faked
 * and the clock fake (CODING_STANDARDS §10). A minimal harness route stands in for the host: it
 * calls `announceSaved` and then navigates, as the host's leaving path does. The host's own wiring
 * is the next subtask's seam.
 */

import { MutationCache, QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { createMemoryRouter, Link, Outlet, RouterProvider, useNavigate } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError, get } from '../api/client'
import { keys } from '../api/keys'
import ContentArea from '../components/ContentArea'
import { panelQuery } from '../api/panel'
import FlashProvider, { SALE_SAVED_TOAST_MS } from '../flash/FlashProvider'
import { useUndoSale } from './useUndoSale'

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** The route that stands for the host: announce the saved sale, then leave. */
function NewSale({ name = 'Ana', saleId = 7 }: { name?: string | null; saleId?: number }) {
  const { announceSaved } = useUndoSale()
  const navigate = useNavigate()
  return (
    <ContentArea as="main">
      <h1>New sale</h1>
      <button
        onClick={() => {
          announceSaved({ saleId, name })
          void navigate('/home')
        }}
      >
        save
      </button>
    </ContentArea>
  )
}

function Panel() {
  useQuery(panelQuery)
  return <p>panel mounted</p>
}

/** Mounts the reads an Undo refreshes: Sales, Stock, a customer's account, and Home's panel. */
function Home() {
  const [showPanel, setShowPanel] = useState(true)
  const [renders, setRenders] = useState(0)
  useQuery({ queryKey: keys.sales('2026-11-01', '2026-11-30'), queryFn: () => get('/sales-list') })
  useQuery({ queryKey: keys.stock(), queryFn: () => get('/stock-list') })
  useQuery({ queryKey: keys.customerAccount('3'), queryFn: () => get('/customers/3/account') })
  return (
    <ContentArea as="main">
      <h1>Home</h1>
      <p>renders {renders}</p>
      {showPanel && <Panel />}
      <button onClick={() => setRenders((n) => n + 1)}>re-render</button>
      <button onClick={() => setShowPanel((on) => !on)}>toggle panel</button>
      <Link to="/other">go elsewhere</Link>
    </ContentArea>
  )
}

function Layout() {
  return (
    <FlashProvider>
      <Outlet />
    </FlashProvider>
  )
}

const fetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>()
const onMutationError = vi.fn()
let client: QueryClient
let releaseDelete: (response: Response) => void = () => undefined

function renderApp(newSale: React.ReactElement = <NewSale />) {
  client = new QueryClient({
    mutationCache: new MutationCache({ onError: onMutationError }),
    defaultOptions: { queries: { retry: false } },
  })
  const router = createMemoryRouter(
    [
      {
        element: <Layout />,
        children: [
          { path: '/new', element: newSale },
          { path: '/home', element: <Home /> },
          { path: '/other', element: <h1>Other</h1> },
        ],
      },
    ],
    { initialEntries: ['/new'] },
  )
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

function calls(method: string, path: string): number {
  return fetchMock.mock.calls.filter(([url, init]) => url === `/${path}` && (init?.method ?? 'GET') === method).length
}

/** The sale's DELETE answers `answer`; every other read answers an empty list. */
function deleteAnswers(answer: () => Promise<Response>): void {
  fetchMock.mockImplementation((_path, init) =>
    init?.method === 'DELETE' ? answer() : Promise.resolve(json(200, [])),
  )
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-11-19T12:00:00Z'), shouldAdvanceTime: true })
  fetchMock.mockReset()
  onMutationError.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function saveAndOpenUndo() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await user.click(screen.getByRole('button', { name: 'save' }))
  return { user, undo: await screen.findByRole('button', { name: 'Undo' }) }
}

test('Undo sends one DELETE for the sale and shows that it was deleted', async () => {
  deleteAnswers(() => Promise.resolve(json(200, { returned: [] })))
  renderApp()
  const { user, undo } = await saveAndOpenUndo()
  expect(screen.getByRole('status')).toHaveTextContent('Sale to Ana saved')

  await user.click(undo)

  expect(await screen.findByText(/Sale deleted/)).toBeInTheDocument()
  expect(calls('DELETE', 'sales/7')).toBe(1)
})

test('a sale with no customer is announced with the existing No customer text', async () => {
  renderApp(<NewSale name={null} />)
  await saveAndOpenUndo()

  expect(screen.getByRole('status')).toHaveTextContent('Sale to No customer saved')
})

test('a 404 sale.not_found shows that it is already gone', async () => {
  deleteAnswers(() => Promise.resolve(json(404, { code: 'sale.not_found' })))
  renderApp()
  const { user, undo } = await saveAndOpenUndo()

  await user.click(undo)

  expect(await screen.findByText(/That is gone/)).toBeInTheDocument()
  expect(screen.queryByText(/Sale deleted/)).not.toBeInTheDocument()
})

test('a network failure shows the offline notice', async () => {
  deleteAnswers(() => Promise.reject(new TypeError('Failed to fetch')))
  renderApp()
  const { user, undo } = await saveAndOpenUndo()

  await user.click(undo)

  expect(await screen.findByText(/Offline/)).toBeInTheDocument()
  expect(screen.queryByText(/Sale deleted/)).not.toBeInTheDocument()
})

test('another refusal shows the generic failure and never "deleted"', async () => {
  deleteAnswers(() => Promise.resolve(json(409, { code: 'sale.something_else' })))
  renderApp()
  const { user, undo } = await saveAndOpenUndo()

  await user.click(undo)

  expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument()
  expect(screen.queryByText(/Sale deleted/)).not.toBeInTheDocument()
})

test('a 401 shows no result of its own and reaches the mutation cache', async () => {
  deleteAnswers(() => Promise.resolve(json(401, { code: 'auth.unauthorized' })))
  renderApp()
  const { user, undo } = await saveAndOpenUndo()

  await user.click(undo)

  await waitFor(() => expect(onMutationError).toHaveBeenCalledTimes(1))
  expect(onMutationError.mock.calls[0]?.[0]).toBeInstanceOf(ApiError)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('two taps in one act send one DELETE and show deleted, never gone', async () => {
  deleteAnswers(() => Promise.resolve(json(200, { returned: [] })))
  renderApp()
  await saveAndOpenUndo()
  const undo = screen.getByRole('button', { name: 'Undo' })

  act(() => {
    fireEvent.click(undo)
    fireEvent.click(undo)
  })

  expect(await screen.findByText(/Sale deleted/)).toBeInTheDocument()
  expect(calls('DELETE', 'sales/7')).toBe(1)
  expect(screen.queryByText(/That is gone/)).not.toBeInTheDocument()
})

test('the result shows after the host unmounted, the route changed and 5 s passed', async () => {
  deleteAnswers(() => new Promise<Response>((resolve) => (releaseDelete = resolve)))
  const router = renderApp()
  const { user, undo } = await saveAndOpenUndo()
  await user.click(undo)
  expect(screen.queryByText(/Sale deleted/)).not.toBeInTheDocument()

  await user.click(screen.getByRole('link', { name: 'go elsewhere' }))
  expect(screen.getByRole('heading', { name: 'Other' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/other')
  act(() => {
    vi.advanceTimersByTime(SALE_SAVED_TOAST_MS + 1000)
  })
  expect(screen.queryByRole('status')).not.toBeInTheDocument()

  await act(async () => {
    releaseDelete(json(200, { returned: [] }))
  })

  expect(await screen.findByText(/Sale deleted/)).toBeInTheDocument()
})

test('the saved toast is on the destination at 4.9 s and gone at 5 s', async () => {
  renderApp()
  await saveAndOpenUndo()
  expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument()

  act(() => {
    vi.advanceTimersByTime(SALE_SAVED_TOAST_MS - 100)
  })
  expect(screen.getByRole('status')).toHaveTextContent('Sale to Ana saved')
  act(() => {
    vi.advanceTimersByTime(100)
  })

  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('after success the mounted sales, stock and account reads are fetched again and suggestions are stale', async () => {
  deleteAnswers(() => Promise.resolve(json(200, { returned: [] })))
  renderApp()
  const { user, undo } = await saveAndOpenUndo()
  await waitFor(() => expect(calls('GET', 'sales-list')).toBe(1))
  await waitFor(() => expect(calls('GET', 'stock-list')).toBe(1))
  await waitFor(() => expect(calls('GET', 'customers/3/account')).toBe(1))
  client.setQueryData(keys.saleFormSuggestions('2026-11-19'), { recent_customer_ids: [] })
  expect(client.getQueryState(keys.saleFormSuggestions('2026-11-19'))?.isInvalidated).toBe(false)

  await user.click(undo)

  await waitFor(() => expect(calls('GET', 'sales-list')).toBe(2))
  await waitFor(() => expect(calls('GET', 'stock-list')).toBe(2))
  await waitFor(() => expect(calls('GET', 'customers/3/account')).toBe(2))
  expect(client.getQueryState(keys.saleFormSuggestions('2026-11-19'))?.isInvalidated).toBe(true)
})

test("Home's panel keeps its figures through Undo and a re-render, and is fetched again when Home remounts", async () => {
  deleteAnswers(() => Promise.resolve(json(200, { returned: [] })))
  renderApp()
  const { user, undo } = await saveAndOpenUndo()
  await waitFor(() => expect(calls('GET', 'panel')).toBe(1))

  await user.click(undo)
  expect(await screen.findByText(/Sale deleted/)).toBeInTheDocument()
  await waitFor(() => expect(calls('GET', 'sales-list')).toBe(2))
  await user.click(screen.getByRole('button', { name: 're-render' }))

  expect(calls('GET', 'panel')).toBe(1)
  expect(client.getQueryState(keys.panel())?.isInvalidated).toBe(false)

  await user.click(screen.getByRole('button', { name: 'toggle panel' }))
  await user.click(screen.getByRole('button', { name: 'toggle panel' }))

  await waitFor(() => expect(calls('GET', 'panel')).toBe(2))
})
