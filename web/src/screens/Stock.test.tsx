/**
 * `Stock` at the screen seam (`stock.md`, "On screen"): the total, each variety's own
 * status and detail exactly as `GET /stock` answers them, the empty state only when
 * nothing has moved for any variety (PM round 1: a sold-out variety with sales but no
 * entries keeps its own row, never hidden behind the empty state), and a link to
 * record a new entry — nothing here is computed by the front (plan, invariants).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import Stock from './Stock'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03' }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function Provide() {
  return <Outlet context={ME} />
}

function renderStock(fetchImpl: (url: string) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl))
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/mi-stock']}>
        <Routes>
          <Route element={<Provide />}>
            <Route path="/mi-stock" element={<Stock />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('shows the total and each variety by shape, word and detail, never color alone', async () => {
  renderStock(async (url) => {
    if (url.startsWith('/stock')) {
      return jsonResponse(200, {
        total: 82.5,
        varieties: [
          {
            variety_id: 1,
            grams: 0,
            status: 'sold_out',
            sold_out_since: '2026-09-30',
            threshold: null,
            days_left: null,
          },
          {
            variety_id: 2,
            grams: 18.5,
            status: 'low',
            sold_out_since: null,
            threshold: 20,
            days_left: 6,
          },
        ],
        entries: [
          {
            id: 9,
            date: '2026-09-12',
            variety_id: 2,
            origin: 'purchase',
            grams: 18.5,
            total_cost: 157_250,
            cost_per_gram: 8_500,
            note: null,
          },
        ],
      })
    }
    return jsonResponse(200, [
      { id: 1, name: 'Sir Jack', current_price: null },
      { id: 2, name: 'Golden Cookies', current_price: null },
    ])
  })

  expect(await screen.findByText('82,5 g en total')).toBeInTheDocument()
  expect(await screen.findByText('Sir Jack')).toBeInTheDocument()
  // "agotada" appears twice: MarcaEstado's own accessible word (hidden off-screen)
  // and the visible inverted chip next to the variety's grams (PRD: "the inverted
  // chip, not red") — distinct elements, told apart by class.
  const agotadaMatches = screen.getAllByText('agotada')
  expect(agotadaMatches).toHaveLength(2)
  const visibleChip = agotadaMatches.find((el) => el.className.includes('fila-stock__insignia'))
  expect(visibleChip).toBeDefined()
  expect(visibleChip?.className).toContain('fila-stock__insignia--sold_out')
  expect(screen.getByText('Sin gramos desde el 30/09')).toBeInTheDocument()
  expect(screen.getByText('baja')).toBeInTheDocument()
  expect(screen.getByText('Avisás abajo de 20 g')).toBeInTheDocument()
  expect(screen.getByText('6 días')).toBeInTheDocument()
})

test('no entries at all shows the empty state, with a way to record the first entry', async () => {
  renderStock(async (url) => {
    if (url.startsWith('/stock')) return jsonResponse(200, { total: 0, varieties: [], entries: [] })
    return jsonResponse(200, [])
  })

  expect(await screen.findByText('Sin entradas de stock')).toBeInTheDocument()
  expect(screen.getByText('Cargá tu stock inicial o una compra')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Nueva entrada' })).toHaveAttribute(
    'href',
    '/mi-stock/nueva-entrada',
  )
})

test('a business with varieties but no entries at all still shows the empty state', async () => {
  renderStock(async (url) => {
    if (url.startsWith('/stock')) {
      return jsonResponse(200, {
        total: 0,
        varieties: [
          {
            variety_id: 1,
            grams: 0,
            status: 'no_entries',
            sold_out_since: null,
            threshold: null,
            days_left: null,
          },
        ],
        entries: [],
      })
    }
    return jsonResponse(200, [{ id: 1, name: 'Sir Jack', current_price: null }])
  })

  expect(await screen.findByText('Sin entradas de stock')).toBeInTheDocument()
  expect(screen.queryByText('Sir Jack')).not.toBeInTheDocument()
})

test('a variety with sales but no stock entry reads sold out, never hidden behind the empty state', async () => {
  renderStock(async (url) => {
    if (url.startsWith('/stock')) {
      return jsonResponse(200, {
        total: -4,
        varieties: [
          {
            variety_id: 1,
            grams: -4,
            status: 'sold_out',
            sold_out_since: '2026-09-28',
            threshold: null,
            days_left: null,
          },
        ],
        entries: [],
      })
    }
    return jsonResponse(200, [{ id: 1, name: 'Sir Jack', current_price: null }])
  })

  expect(await screen.findByText('Sir Jack')).toBeInTheDocument()
  expect(screen.queryByText('Sin entradas de stock')).not.toBeInTheDocument()
  expect(screen.getByText('Sin gramos desde el 28/09')).toBeInTheDocument()
  expect(screen.getByText('-4 g')).toBeInTheDocument()
  const agotadaMatches = screen.getAllByText('agotada')
  const visibleChip = agotadaMatches.find((el) => el.className.includes('fila-stock__insignia'))
  expect(visibleChip).toBeDefined()
})
