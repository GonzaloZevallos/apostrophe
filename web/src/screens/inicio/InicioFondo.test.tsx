/**
 * Home's background under Record payment (Testing Library, `fetch` faked): Today's figures
 * straight from `/panel`, nothing while `/panel` is held, and no read of first-run,
 * onboarding or the pinned catalog (ADR-0046: the background stamps and onboards nothing).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import panelFixture from '../../api/fixtures/panel.json'
import type { Me } from '../../api/me'
import { SHOWN_EN } from '../../test/shownLanguage'
import type { PanelAnswer } from '../../api/panel'
import InicioFondo from './InicioFondo'

const PANEL: PanelAnswer = panelFixture as PanelAnswer
const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03', shown_language: SHOWN_EN }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Every URL the stub saw. A held `/panel` never answers until `release` is called. */
function stubFetch(options: { holdPanel?: boolean } = {}) {
  const urls: string[] = []
  let release: () => void = () => undefined
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      urls.push(url)
      if (url.includes('/panel')) {
        if (options.holdPanel === true) await held
        return jsonResponse(200, PANEL)
      }
      return jsonResponse(500, { detail: `unexpected fetch: ${url}` })
    }),
  )
  return { urls, release }
}

function renderFondo() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Routes>
          <Route element={<Outlet context={ME} />}>
            <Route path="*" element={<InicioFondo />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('shows Today\'s figures from /panel', async () => {
  stubFetch()
  renderFondo()

  expect(await screen.findByRole('button', { name: 'Today', pressed: true })).toBeVisible()
  expect(screen.getByText('Owed to you')).toBeVisible()
})

test('reads no first-run, onboarding or pinned-catalog status', async () => {
  const { urls } = stubFetch()
  renderFondo()
  await screen.findByRole('button', { name: 'Today', pressed: true })

  expect(urls.filter((url) => url.includes('/panel'))).toHaveLength(1)
  expect(urls.filter((url) => !url.includes('/panel'))).toEqual([])
})

test('draws nothing while /panel is held, then the figures', async () => {
  const { release } = stubFetch({ holdPanel: true })
  const { container } = renderFondo()

  expect(container).toBeEmptyDOMElement()
  expect(screen.queryByRole('button')).toBeNull()

  release()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Today' })).toBeVisible())
})

test('draws nothing when /panel fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(jsonResponse(500, { detail: 'boom' }))),
  )
  const { container } = renderFondo()

  await waitFor(() => expect(fetch).toHaveBeenCalled())
  expect(container).toBeEmptyDOMElement()
})
