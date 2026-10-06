/**
 * Every old Spanish path, one by one (plan, seams: "router (createMemoryRouter over the
 * exported routes, Testing Library)" and "legacy.ts table"). The list below is
 * hard-coded, not read from `LEGACY_REDIRECTS`, so a row dropped or added there fails a
 * cross-check instead of vanishing from the test with it.
 *
 * Each path is visited signed in and signed out, with an id (where it has one), a query
 * string and a hash: it reaches its English route, carries the query and the hash,
 * leaves no history entry (every move after the first is a replace, and going back lands
 * on the entry before it), and signed out ends at `/login`. A gone or foreign id still
 * redirects first and the new route shows "Eso ya no está.".
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { queryClient } from '../queryClient'
import { routes } from '../router'
import { LEGACY_REDIRECTS } from './legacy'
import { paths } from './paths'

interface Case {
  /** The key `LEGACY_REDIRECTS` must have. */
  pattern: string
  /** A real visit, with an id where the pattern has one. */
  visit: string
  /** Where it must end, signed in. */
  target: string
}

const CASES: Case[] = [
  { pattern: '/entrar', visit: '/entrar', target: '/login' },
  { pattern: '/ventas', visit: '/ventas', target: '/sales' },
  { pattern: '/ventas/nueva', visit: '/ventas/nueva', target: '/sales/new' },
  { pattern: '/ventas/:id', visit: '/ventas/12', target: '/sales/12' },
  { pattern: '/clientes', visit: '/clientes', target: '/customers' },
  { pattern: '/clientes/nuevo', visit: '/clientes/nuevo', target: '/customers/new' },
  { pattern: '/clientes/:id', visit: '/clientes/12', target: '/customers/12' },
  { pattern: '/clientes/:id/editar', visit: '/clientes/12/editar', target: '/customers/12/edit' },
  { pattern: '/clientes/deben', visit: '/clientes/deben', target: '/customers/owing' },
  { pattern: '/variedades', visit: '/variedades', target: '/varieties' },
  { pattern: '/variedades/:id', visit: '/variedades/12', target: '/varieties/12' },
  { pattern: '/catalogo', visit: '/catalogo', target: '/varieties/catalog' },
  { pattern: '/mi-stock', visit: '/mi-stock', target: '/varieties/entries' },
  { pattern: '/mi-stock/nueva-entrada', visit: '/mi-stock/nueva-entrada', target: '/varieties/entries/new' },
  { pattern: '/mi-stock/entradas/:id', visit: '/mi-stock/entradas/12', target: '/varieties/entries/12' },
  { pattern: '/gastos', visit: '/gastos', target: '/expenses' },
  { pattern: '/analisis', visit: '/analisis', target: '/analysis' },
  { pattern: '/mas', visit: '/mas', target: '/more' },
  { pattern: '/negocio', visit: '/negocio', target: '/settings' },
  { pattern: '/gastos/categorias', visit: '/gastos/categorias', target: '/settings/expense-categories' },
]

const GONE: { visit: string; code: string }[] = [
  { visit: '/ventas/99', code: 'sale.not_found' },
  { visit: '/clientes/99', code: 'customer.not_found' },
  { visit: '/clientes/99/editar', code: 'customer.not_found' },
  { visit: '/variedades/99', code: 'variety.not_found' },
  { visit: '/mi-stock/entradas/99', code: 'stock.entry_not_found' },
]

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** `/auth/me` answers as the session says; every other call answers `otherwise`. */
function stubApi(signedIn: boolean, otherwise: () => Response): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        url === '/auth/me' ? (signedIn ? jsonResponse(200, ME) : jsonResponse(401, {})) : otherwise(),
      ),
    ),
  )
}

/** Opens the app on `visit` with one entry behind it. */
function open(visit: string) {
  const router = createMemoryRouter(routes, { initialEntries: [paths.login(), visit], initialIndex: 1 })
  const actions: string[] = []
  router.subscribe((state) => actions.push(state.historyAction))
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router, actions }
}

afterEach(() => {
  vi.unstubAllGlobals()
  queryClient.clear()
})

test('the table has exactly the old paths of the PRD, no more and no fewer', () => {
  expect(Object.keys(LEGACY_REDIRECTS).sort()).toEqual(CASES.map((c) => c.pattern).sort())
})

test.each(CASES)('signed in, $visit goes to $target, replacing, with its query and hash', async (c) => {
  stubApi(true, () => jsonResponse(404, { code: 'x' }))
  const { router, actions } = open(`${c.visit}?q=1&p=2#frag`)

  await waitFor(() => expect(router.state.location.pathname).toBe(c.target))
  expect(router.state.location.search).toBe('?q=1&p=2')
  expect(router.state.location.hash).toBe('#frag')
  expect(actions).not.toContain('PUSH')

  // No history entry of the old path: back lands on the entry before it.
  await act(() => router.navigate(-1))
  expect(router.state.location.pathname).toBe(paths.login())
})

test.each(CASES.filter((c) => c.target !== paths.login()))(
  'signed out, $visit ends at /login without a history entry',
  async (c) => {
    stubApi(false, () => jsonResponse(401, {}))
    const { router, actions } = open(`${c.visit}?q=1`)

    await waitFor(() => expect(actions.length).toBeGreaterThan(1))
    await waitFor(() => expect(router.state.location.pathname).toBe(paths.login()))
    expect(actions).not.toContain('PUSH')

    await act(() => router.navigate(-1))
    expect(router.state.location.pathname).toBe(paths.login())
    expect(router.state.location.search).toBe('')
  },
)

test('the old login path signed out ends at /login too, as one replace', async () => {
  stubApi(false, () => jsonResponse(401, {}))
  const { router, actions } = open(`${CASES[0]?.visit}?q=1`)

  await waitFor(() => expect(router.state.location.pathname).toBe(paths.login()))
  expect(actions).toEqual(['REPLACE'])
})

test.each(GONE)('$visit with a gone or foreign id redirects, then says "Eso ya no está."', async (g) => {
  stubApi(true, () => jsonResponse(404, { code: g.code }))
  const { router } = open(g.visit)

  expect(await screen.findByText('Eso ya no está.')).toBeInTheDocument()
  expect(router.state.location.pathname).toMatch(/^\/(sales|customers|varieties)\//)
})

test.each([paths.invitation('tok'), paths.reset('tok')])('%s is not redirected', async (link) => {
  stubApi(true, () => jsonResponse(404, { code: 'x' }))
  const { router, actions } = open(link)

  await waitFor(() => expect(router.state.location.pathname).toBe(link))
  expect(actions).toEqual([])
})

test('an unknown path goes to Inicio with one replace', async () => {
  stubApi(true, () => jsonResponse(404, { code: 'x' }))
  const unknown = open(`${paths.settings()}/appearance`)

  await waitFor(() => expect(unknown.router.state.location.pathname).toBe(paths.home()))
  expect(unknown.actions).toEqual(['REPLACE'])
})
