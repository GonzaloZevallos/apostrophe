/**
 * `VentaDetalle`'s Assign customer sheet at the screen seam, through a real data router
 * (`createMemoryRouter` + `RouterProvider`) with `fetch` faked: the sheet is a history entry
 * (ADR-0027), so the system back gesture closes only the sheet, asks nothing and stays on
 * the detail.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import SALE_DETAIL from '../../api/fixtures/sale-detail.json'
import { SheetRouterProvider, sheetDepth } from '../../components/useSheetStack'
import { CUSTOMERS, pathTo, SALE, SALES } from '../../routes'
import VentaDetalle from './VentaDetalle'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) =>
      Promise.resolve(
        path.startsWith(pathTo(CUSTOMERS)) ? jsonResponse(200, []) : jsonResponse(200, { ...SALE_DETAIL, customer: null }),
      ),
    ),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('back with Assign customer open closes only the sheet and stays on the detail', async () => {
  const user = userEvent.setup()
  const router = createMemoryRouter(
    [
      { path: SALES, element: <h1>Lista de ventas</h1> },
      { path: SALE, element: <VentaDetalle /> },
    ],
    { initialEntries: [SALES, pathTo(SALE, { id: 10 })], initialIndex: 1 },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )

  await user.click(await screen.findByRole('button', { name: 'Assign customer' }))
  expect(screen.getByText('Choose customer')).toBeInTheDocument()
  expect(sheetDepth(router.state.location.state)).toBe(1)

  await act(() => router.navigate(-1))

  expect(screen.queryByText('Choose customer')).not.toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(router.state.location.pathname).toBe(pathTo(SALE, { id: 10 }))
  expect(screen.getByRole('button', { name: 'Assign customer' })).toBeInTheDocument()
})

test('"Close" on the sheet is the same move as back', async () => {
  const user = userEvent.setup()
  const router = createMemoryRouter([{ path: SALE, element: <VentaDetalle /> }], {
    initialEntries: [pathTo(SALE, { id: 10 })],
  })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )

  await user.click(await screen.findByRole('button', { name: 'Assign customer' }))
  await user.click(screen.getByRole('button', { name: 'Close' }))

  expect(screen.queryByText('Choose customer')).not.toBeInTheDocument()
  expect(sheetDepth(router.state.location.state)).toBe(0)
  expect(router.state.location.pathname).toBe(pathTo(SALE, { id: 10 }))
})
