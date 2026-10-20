/**
 * `VarietiesIndex`'s first-variety selection on a computer, and the one case it must leave
 * alone: when the browser's history has already moved to an entry the seller pushed (a tap
 * that left Varieties while the viewport turned computer), the stale index never replaces
 * it (`isStillCurrent`). The varieties list is faked at `fetch`.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { VARIETIES, VARIETY, pathTo } from '../../routes'
import { stubViewport } from '../../test-viewport'
import VarietiesIndex from './VarietiesIndex'
import { isStillCurrent } from './isStillCurrent'

const VARIETY_ROWS = [
  { id: 2, name: 'Zkittlez', current_price: null },
  { id: 1, name: 'Amnesia', current_price: null },
]

function Where() {
  return <output aria-label="ubicación">{useLocation().pathname}</output>
}

function renderIndex(): void {
  let answer: (response: Response) => void = () => undefined
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))),
  )
  const router = createMemoryRouter(
    [
      { path: VARIETIES, element: <><VarietiesIndex /><Where /></> },
      { path: VARIETY, element: <Where /> },
    ],
    { initialEntries: [VARIETIES] },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  respond = () =>
    answer(new Response(JSON.stringify(VARIETY_ROWS), { status: 200, headers: { 'Content-Type': 'application/json' } }))
}

let respond: () => void = () => undefined

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState(null, '')
})

test('on a computer the index selects the first variety by name', async () => {
  stubViewport('computer')
  renderIndex()
  respond()

  expect(await screen.findByText(pathTo(VARIETY, { id: 1 }))).toBeInTheDocument()
})

test('a history entry pushed after the index rendered is never replaced by the selection', async () => {
  stubViewport('computer')
  renderIndex()
  // The browser moved on (a tap's entry, with its own key) before the list arrived.
  window.history.pushState({ usr: null, key: 'a-newer-entry', idx: 1 }, '')
  respond()

  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(screen.getByLabelText('ubicación')).toHaveTextContent(VARIETIES)
  expect(screen.queryByText(pathTo(VARIETY, { id: 1 }))).not.toBeInTheDocument()
})

test('isStillCurrent: no key in history state means nothing newer; a different key means moved on', () => {
  expect(isStillCurrent({ key: 'abc' }, null)).toBe(true)
  expect(isStillCurrent({ key: 'default' }, { idx: 0 })).toBe(true)
  expect(isStillCurrent({ key: 'abc' }, { usr: null, key: 'abc', idx: 2 })).toBe(true)
  expect(isStillCurrent({ key: 'abc' }, { usr: null, key: 'xyz', idx: 3 })).toBe(false)
})
