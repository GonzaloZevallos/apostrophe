/**
 * The icon and text rule (`docs/product/icon-and-text-rule.md`) on the sale screens, at
 * the screen seam: Testing Library, `fetch` faked, `expectIconAndTextRule` over what each
 * screen shows. Every control is icon + text, a submit, a link/undo/back, a row, an
 * option or an answer, or an icon-only control with its exact name; the always-visible
 * copy fits its limit as rendered.
 *
 * "Close" on the sale form and its sheets is the icon-only close (`.boton-icono`, its
 * exact name kept).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, Outlet, Route, RouterProvider, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { stubViewport } from '../../test-viewport'
import type { Viewport } from '../../routes'
import type { Me } from '../../api/me'
import saleFixture from '../../api/fixtures/sale.json'
import SALE_DETAIL from '../../api/fixtures/sale-detail.json'
import { GRAMS_HELP } from '../../copy/sales'
import { LIMITS, SAMPLES } from '../../copy/limits'
import { saleJustSaved } from '../../components/feedback'
import { SheetRouterProvider } from '../../components/useSheetStack'
import { CUSTOMERS, pathTo, SALE, SALE_NEW, SALES } from '../../routes'
import { expectIconAndTextRule, iconAndTextProblems } from '../../test/iconAndTextRule'
import NuevaVenta from './NuevaVenta'
import VentaDetalle from './VentaDetalle'
import Ventas from './Ventas'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }
const ROSA = {
  id: 1,
  name: 'Rosa',
  current_price: { id: 9, effective_from: '2026-09-01', list_price: 1000, bulk_price: null, bulk_minimum: null },
}
const ANA = { id: 5, name: 'Ana', phone: '+5491100000000', vip: false }
const OPTIONS = { limits: LIMITS, samples: SAMPLES }

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

const VIEWPORTS: readonly Viewport[] = ['phone', 'computer']

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test.each(VIEWPORTS)("Ventas: an empty period shows its one line, within its limit, and the list rows are links (%s)", async (viewport) => {
  stubViewport(viewport)
  vi.mocked(fetch).mockImplementation(() => Promise.resolve(json([])))
  const { container } = render(
    <QueryClientProvider client={client()}>
      <MemoryRouter initialEntries={[SALES]}>
        <Routes>
          <Route element={<Outlet context={ME} />}>
            <Route path={SALES} element={<Ventas />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  const empty = await screen.findByText(/haven't recorded any sales/)
  expect(empty).toHaveAttribute('data-copy', 'emptyLine')
  expectIconAndTextRule(container, OPTIONS)
})

test.each(VIEWPORTS)("Ventas: a list of sales passes the rule with its rows kept as they are (%s)", async (viewport) => {
  stubViewport(viewport)
  vi.mocked(fetch).mockImplementation(() => Promise.resolve(json([saleFixture])))
  const { container } = render(
    <QueryClientProvider client={client()}>
      <MemoryRouter initialEntries={[SALES]}>
        <Routes>
          <Route element={<Outlet context={ME} />}>
            <Route path={SALES} element={<Ventas />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await screen.findAllByRole('link')
  expectIconAndTextRule(container, OPTIONS)
})

function renderDetalle(state?: unknown) {
  const router = createMemoryRouter([{ path: SALE, element: <VentaDetalle /> }], {
    initialEntries: [{ pathname: pathTo(SALE, { id: 10 }), state }],
  })
  return render(
    <QueryClientProvider client={client()}>
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )
}

test.each(VIEWPORTS)("VentaDetalle: Deshacer is an undo, the actions carry an icon and the Assign customer sheet passes (%s)", async (viewport) => {
  stubViewport(viewport)
  vi.mocked(fetch).mockImplementation((path) =>
    Promise.resolve(String(path).startsWith(pathTo(CUSTOMERS)) ? json([ANA]) : json({ ...SALE_DETAIL, customer: null })),
  )
  const user = userEvent.setup()
  const { container } = renderDetalle(saleJustSaved())
  await screen.findByRole('button', { name: 'Assign customer' })
  expect(screen.getByRole('button', { name: 'Undo' })).toHaveClass('boton--enlace')
  expectIconAndTextRule(container, OPTIONS)

  await user.click(screen.getByRole('button', { name: 'Assign customer' }))
  await screen.findByRole('button', { name: 'New customer' })
  expectIconAndTextRule(container, OPTIONS)

  await user.click(screen.getByRole('button', { name: 'New customer' }))
  expectIconAndTextRule(container, OPTIONS)
})

test.each(VIEWPORTS)("NuevaVenta: with two lines, Pick a customer and Nuevo cliente open, every control follows the rule (%s)", async (viewport) => {
  stubViewport(viewport)
  vi.mocked(fetch).mockImplementation((path) =>
    Promise.resolve(String(path).startsWith(pathTo(CUSTOMERS)) ? json([ANA]) : json([ROSA])),
  )
  const router = createMemoryRouter(
    [{ element: <Outlet context={ME} />, children: [{ path: SALE_NEW, element: <NuevaVenta /> }] }],
    { initialEntries: [SALE_NEW] },
  )
  const user = userEvent.setup()
  const { container } = render(
    <QueryClientProvider client={client()}>
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )
  await user.selectOptions(await screen.findByLabelText('Line 1 variety'), '1')
  await user.type(screen.getByLabelText('Line 1 grams'), '2')
  await user.click(await screen.findByRole('button', { name: 'Add another variety' }))
  expect(screen.getByRole('button', { name: 'Remove line 2' })).toHaveClass('boton-icono')
  expect(screen.getByText(GRAMS_HELP)).toHaveAttribute('data-copy', 'help')
  expectIconAndTextRule(container, OPTIONS)

  await user.click(screen.getByRole('button', { name: 'Pick a customer' }))
  await screen.findByRole('button', { name: 'New customer' })
  expectIconAndTextRule(container, OPTIONS)

  await user.click(screen.getByRole('button', { name: 'New customer' }))
  expectIconAndTextRule(container, OPTIONS)
})

test('the helper rejects a text-only action on these screens (a link-styled "Add another variety" would fail)', () => {
  const { container } = render(
    <div>
      <button type="button" className="boton--fila-x">
        Agregar otra variedad
      </button>
    </div>,
  )
  expect(iconAndTextProblems(container, OPTIONS)).toHaveLength(1)
})
