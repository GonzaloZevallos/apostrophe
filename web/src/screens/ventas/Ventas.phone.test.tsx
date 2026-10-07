/**
 * `Ventas` on the phone, at the screen seam (CODING_STANDARDS §10): Testing Library,
 * `fetch` faked. The period tabs take `Pestanas`' equal-cells fit on the phone only: the
 * computer layout (`VentasCompu`) keeps the plain tab list, so its output is the one it
 * always had. The loading state before the list's first answer carries none of the list.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import { COMPUTER_QUERY } from '../../format/breakpoints'
import { SALES } from '../../routes'
import Ventas, { EMPTY_LIST } from './Ventas'

const ME: Me = { email: 'a@b.com', business_name: 'Negocio', today: '2026-10-03' }

function Context() {
  return <Outlet context={ME} />
}

function renderVentas() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[SALES]}>
        <Routes>
          <Route element={<Context />}>
            <Route path={SALES} element={<Ventas />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** A viewport whose only known query is the computer one. */
function stubViewport(computer: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    (query: string) => ({
      matches: query === COMPUTER_QUERY && computer,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  )
}

beforeEach(() => {
  // A request that never answers: the list stays before its first answer.
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('on the phone the period tabs sit in the equal-cells grid', () => {
  stubViewport(false)
  renderVentas()

  const group = screen.getByRole('group', { name: 'Período' })
  expect(group).toHaveClass('pestanas--celdas')
  expect(group.querySelectorAll('.pestanas__celdas > button')).toHaveLength(4)
})

test('on the computer the period tabs stay the plain tab list', () => {
  stubViewport(true)
  renderVentas()

  const group = screen.getByRole('group', { name: 'Período' })
  expect(group).not.toHaveClass('pestanas--celdas')
  expect(group.querySelector('.pestanas__celdas')).toBeNull()
})

test('before its first answer the list is only the loading state: no figure, no empty text', () => {
  stubViewport(false)
  renderVentas()

  expect(screen.getAllByRole('progressbar')).toHaveLength(1)
  expect(screen.queryByText(EMPTY_LIST)).not.toBeInTheDocument()
  expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})
