/**
 * `Inicio` at the screen seam: the business's name from the outlet context (plan,
 * "Shell"), and "Arrancá por las variedades" exactly when no variety of the business
 * has a current price today (PM round 1). No figures (PRD, "Nada inventado").
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import Inicio, { EMPTY_TITLE, PINNED_CATALOG_OUT_OF_DATE } from './Inicio'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }

function Provide() {
  return <Outlet context={ME} />
}

function renderInicio(
  varieties: Array<{ current_price: unknown }>,
  pinnedCatalogStatus: unknown = { status: null },
) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/pinned-catalog/status') return Promise.resolve(jsonResponse(200, pinnedCatalogStatus))
      return Promise.resolve(jsonResponse(200, varieties))
    }),
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Provide />}>
            <Route index element={<Inicio />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('shows the business name from the session, not a URL or a prop of its own', async () => {
  renderInicio([{ current_price: { id: 1 } }])

  expect(await screen.findByText('La Huerta')).toBeInTheDocument()
});

test('shows "Arrancá por las variedades" when no variety has a price today', async () => {
  renderInicio([{ current_price: null }, { current_price: null }])

  expect(await screen.findByText(EMPTY_TITLE)).toBeInTheDocument()
})

test('an empty varieties list also counts as none priced', async () => {
  renderInicio([])

  expect(await screen.findByText(EMPTY_TITLE)).toBeInTheDocument()
})

test('does not show the empty state once a variety has a price today', async () => {
  renderInicio([{ current_price: null }, { current_price: { id: 2 } }])

  await screen.findByText('La Huerta')
  expect(screen.queryByText(EMPTY_TITLE)).not.toBeInTheDocument()
})

test('shows the fixed pinned-catalog notice while the pin is out of date', async () => {
  renderInicio([{ current_price: { id: 1 } }], {
    status: { state: 'out_of_date', reason: 'telegram_unreachable', last_published_on: '2026-09-29' },
  })

  const notice = await screen.findByText(PINNED_CATALOG_OUT_OF_DATE)
  expect(notice.closest('a')).toHaveAttribute('href', '/catalogo')
})

test('shows no pinned-catalog line before the first Publicar', async () => {
  renderInicio([{ current_price: { id: 1 } }], { status: null })

  await screen.findByText('La Huerta')
  expect(screen.queryByText(PINNED_CATALOG_OUT_OF_DATE)).not.toBeInTheDocument()
})

test('shows no pinned-catalog line while the pin is up to date', async () => {
  renderInicio([{ current_price: { id: 1 } }], {
    status: { state: 'up_to_date', reason: null, last_published_on: '2026-09-29' },
  })

  await screen.findByText('La Huerta')
  expect(screen.queryByText(PINNED_CATALOG_OUT_OF_DATE)).not.toBeInTheDocument()
})
