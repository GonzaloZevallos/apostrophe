/**
 * `NuevaVenta`'s phone shell at the screen seam (Testing Library, `fetch` faked): the form
 * is one element pinned to the visual viewport (ADR-0028), and the sale's total and
 * "Guardá la venta" stay in its footer zone. jsdom loads no stylesheet, so what the
 * keyboard hides is checked in the Playwright phone spec; here, that the form is the
 * element the pin and the keyboard flag land on, and that total and button are there both
 * with and without the keyboard.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SheetRouterProvider } from '../../components/useSheetStack'
import { SALE_NEW } from '../../routes'
import NuevaVenta from './NuevaVenta'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }

class FakeVisualViewport extends EventTarget {
  offsetTop = 0
  height = 800
  scale = 1
}

let viewport: FakeVisualViewport

beforeEach(() => {
  viewport = new FakeVisualViewport()
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }),
      ),
    ),
  )
})

afterEach(() => {
  Reflect.deleteProperty(window, 'visualViewport')
  document.documentElement.classList.remove('html--formulario-fijo')
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

function theForm(): HTMLElement {
  const form = document.querySelector<HTMLElement>('form.nueva-venta')
  if (!form) throw new Error('the sale form is not on screen')
  return form
}

test('the form is pinned to the visual viewport and its footer holds the total and the save button', async () => {
  renderForm()
  await screen.findByRole('button', { name: 'Guardá la venta' })

  expect(theForm().style.getPropertyValue('--vv-alto')).toBe('800px')
  expect(document.documentElement).toHaveClass('html--formulario-fijo')

  const footer = screen.getByRole('button', { name: 'Guardá la venta' }).parentElement as HTMLElement
  expect(within(footer).getByText('Total')).toBeInTheDocument()
  expect(within(footer).getByText('$ 0')).toBeInTheDocument()
})

test('with the keyboard open the form says so and the footer keeps the total and the button', async () => {
  renderForm()
  await screen.findByRole('button', { name: 'Guardá la venta' })

  act(() => {
    viewport.height = 420
    viewport.dispatchEvent(new Event('resize'))
  })

  expect(theForm()).toHaveAttribute('data-teclado', 'abierto')
  const footer = screen.getByRole('button', { name: 'Guardá la venta' }).parentElement as HTMLElement
  expect(within(footer).getByText('Total')).toBeInTheDocument()
  expect(within(footer).getByText('$ 0')).toBeInTheDocument()
  expect(within(footer).getByText('0 g sold')).toBeInTheDocument()
})

test('pinch zoom never counts as a keyboard', async () => {
  renderForm()
  await screen.findByRole('button', { name: 'Guardá la venta' })

  act(() => {
    viewport.height = 420
    viewport.scale = 2
    viewport.dispatchEvent(new Event('resize'))
  })

  expect(theForm()).not.toHaveAttribute('data-teclado')
})
