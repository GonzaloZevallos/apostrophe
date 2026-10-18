/**
 * `NuevaVenta`'s loading states at the screen seam (Testing Library, `fetch` faked with
 * deferred answers): the shared `Loading` stands where prices are still coming — on opening
 * (the whole body) and after a date change (each line's figures and the footer's total, one
 * visually hidden announcer) — and Choose customer's results show it before their first
 * answer. None of them shows a digit, a currency symbol or a placeholder figure, and the
 * screen never shows more than one progressbar.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SheetRouterProvider } from '../../components/useSheetStack'
import { CUSTOMERS, pathTo, SALE_NEW, VARIETIES } from '../../routes'
import NuevaVenta from './NuevaVenta'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }
const price = (list: number) => ({
  id: 9,
  effective_from: '2026-09-01',
  list_price: list,
  bulk_price: null,
  bulk_minimum: null,
})
const ROSA_TODAY = { id: 1, name: 'Rosa', current_price: price(1000) }
const ROSA_YESTERDAY = { id: 1, name: 'Rosa', current_price: price(1500) }
const ANA = { id: 5, name: 'Ana', phone: '+5491100000000', vip: false }

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

/** Every GET waits for the test to answer it, keyed by its path. */
let pending: Map<string, (body: unknown) => void>

function answer(path: string, body: unknown): void {
  const resolve = pending.get(path)
  if (resolve === undefined) throw new Error(`nobody asked for ${path}`)
  pending.delete(path)
  act(() => resolve(body))
}

beforeEach(() => {
  pending = new Map()
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (path: string) =>
        path === '/pricing-settings'
          ? Promise.resolve(jsonResponse({ is_bulk_pricing: true, is_vip_customers: true }))
          : new Promise<Response>((resolve) => {
              pending.set(path, (body) => resolve(jsonResponse(body)))
            }),
    ),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [{ element: <Outlet context={ME} />, children: [{ path: SALE_NEW, element: <NuevaVenta /> }] }],
    { initialEntries: [SALE_NEW] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )
}

async function openAndPriceToday() {
  renderForm()
  answer(`${pathTo(VARIETIES)}?on=2026-10-02`, [ROSA_TODAY])
  await screen.findByRole('button', { name: 'Save sale' })
}

function noFigure(element: HTMLElement): void {
  expect(element.textContent).not.toMatch(/[\d$]/)
}

test('opening shows the loading state in the body, with the header and its way out', () => {
  renderForm()

  expect(screen.getAllByRole('progressbar')).toHaveLength(1)
  noFigure(screen.getByRole('progressbar'))
  expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  expect(screen.getByLabelText('Date')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Save sale' })).not.toBeInTheDocument()
  expect(screen.queryByText('Total')).not.toBeInTheDocument()
  expect(document.body.textContent).not.toContain('$')
})

test('once the prices arrive the loading state gives way to the form', async () => {
  await openAndPriceToday()

  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Grams line 1')).toBeInTheDocument()
  expect(screen.getByText('$ 0')).toBeInTheDocument()
})

test('a date change keeps what was typed and shows compact bars where prices were, then reprices', async () => {
  const user = userEvent.setup()
  await openAndPriceToday()
  await user.selectOptions(screen.getByLabelText('Variety line 1'), '1')
  await user.type(screen.getByLabelText('Grams line 1'), '2')
  await user.type(screen.getByLabelText('Shipping'), '00')
  expect(screen.getAllByText('$ 2.000').length).toBeGreaterThanOrEqual(1)

  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-01' } })

  // Everything typed is still there, and the form never went blank.
  expect(screen.getByLabelText('Grams line 1')).toHaveValue('2')
  expect(screen.getByLabelText('Variety line 1')).toHaveValue('1')
  expect(screen.getByLabelText('Shipping')).toHaveValue('000')
  // Exactly one progressbar, the visually hidden announcer; the figures wait behind bars.
  expect(screen.getAllByRole('progressbar')).toHaveLength(1)
  const form = document.querySelector<HTMLElement>('form.nueva-venta')
  expect(form?.querySelector('[aria-busy="true"].nueva-venta__cuerpo')).not.toBeNull()
  expect(screen.queryByText('$ 1.000 / g')).not.toBeInTheDocument()
  expect(screen.queryByText('$ 2.000')).not.toBeInTheDocument()
  expect(screen.queryByText('$ 0')).not.toBeInTheDocument()
  expect(document.querySelectorAll('.cargando--compacto').length).toBeGreaterThanOrEqual(2)
  const footer = screen.getByRole('button', { name: 'Save sale' }).parentElement as HTMLElement
  expect(footer.querySelector('.cargando--compacto')).not.toBeNull()
  noFigure(screen.getByRole('progressbar'))
  expect(screen.getByRole('button', { name: 'Save sale' })).toBeDisabled()
  // Grams stay: they are what was typed, not a price.
  expect(within(footer).getByText('2 g sold')).toBeInTheDocument()

  answer(`${pathTo(VARIETIES)}?on=2026-10-01`, [ROSA_YESTERDAY])

  expect(await screen.findByText('$ 1.500 / g')).toBeInTheDocument()
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  expect(document.querySelector('.cargando--compacto')).toBeNull()
  expect(screen.getByLabelText('Grams line 1')).toHaveValue('2')
  expect(screen.getByRole('button', { name: 'Save sale' })).toBeEnabled()
})

test('Choose customer shows the loading state before its first answer', async () => {
  const user = userEvent.setup()
  await openAndPriceToday()

  await user.click(screen.getByRole('button', { name: 'Choose customer' }))

  const sheet = document.querySelector<HTMLElement>('.cliente-sheet')
  expect(sheet).not.toBeNull()
  expect(within(sheet as HTMLElement).getAllByRole('progressbar')).toHaveLength(1)
  expect(screen.getAllByRole('progressbar')).toHaveLength(1)
  noFigure(screen.getByRole('progressbar'))
  expect(screen.getByRole('button', { name: 'No customer' })).toBeInTheDocument()

  answer(pathTo(CUSTOMERS), [ANA])

  expect(await screen.findByText('Ana')).toBeInTheDocument()
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
})

test('Choose customer opened during a date change still leaves one progressbar on screen', async () => {
  const user = userEvent.setup()
  await openAndPriceToday()
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-01' } })
  expect(screen.getAllByRole('progressbar')).toHaveLength(1)

  await user.click(screen.getByRole('button', { name: 'Choose customer' }))

  expect(screen.getAllByRole('progressbar')).toHaveLength(1)
})
