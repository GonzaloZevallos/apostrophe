/**
 * `NuevaVenta`'s Save before and after the payment choice (GH-319, "Save does not look ready
 * before the choice is made"), at the screen seam (Testing Library, `fetch` faked). Save is
 * never disabled and never dimmed: it keeps its name, its `type=submit` and its place, and
 * is drawn as the secondary button until Cash, Transfer or Owing is chosen, then as the
 * primary one. The class is the look (`boton` alone is primary, `boton--suave` secondary).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SheetRouterProvider } from '../../components/useSheetStack'
import { SALE_NEW } from '../../routes'
import { stubViewport } from '../../test-viewport'
import NuevaVenta from './NuevaVenta'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }

beforeEach(() => {
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
  document.documentElement.classList.remove('html--formulario-fijo')
  vi.unstubAllGlobals()
})

function renderForm(viewport: 'phone' | 'computer' = 'phone') {
  stubViewport(viewport)
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

test('Save is the secondary button until a payment is chosen, then the primary one, enabled throughout', async () => {
  renderForm()
  const save = await screen.findByRole('button', { name: 'Save sale' })

  expect(save).toBeEnabled()
  expect(save).not.toHaveAttribute('aria-disabled')
  expect(save).toHaveAttribute('type', 'submit')
  expect(save).toHaveClass('boton--suave')

  await userEvent.click(screen.getByRole('radio', { name: 'Cash' }))

  const after = screen.getByRole('button', { name: 'Save sale' })
  expect(after).toBe(save)
  expect(after).toBeEnabled()
  expect(after).not.toHaveClass('boton--suave')
  expect(after).toHaveClass('boton')
})

test('on a computer Save is the primary button before the choice too, as it always was', async () => {
  renderForm('computer')
  const save = await screen.findByRole('button', { name: 'Save sale' })

  expect(save).toBeEnabled()
  expect(save).not.toHaveClass('boton--suave')
  expect(save).toHaveClass('boton')
})
