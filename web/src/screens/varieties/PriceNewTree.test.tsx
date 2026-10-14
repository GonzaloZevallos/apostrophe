/**
 * `PriceNew` inside the app's real route table, so inside the real `VarietiesLayout` (the
 * list pane on a computer): the screen exposes one landmark and keeps what was typed when the
 * viewport flips. `fetch` is faked and the viewport comes from `matchMedia`, which a test can
 * flip as a browser resize does.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { router as appRouter } from '../../router'
import { VARIETY_PRICE_NEW, pathTo } from '../../routes'
import { stubFlippableViewport } from '../../test-viewport'
import { ME, VARIETY_ROW, HISTORY, SETTINGS_ON, jsonResponse } from './renderVarieties'

const NEW_PATH = pathTo(VARIETY_PRICE_NEW, { id: 1 })

const ANSWERS: Record<string, unknown> = {
  'GET /auth/me': ME,
  'GET /pricing-settings': SETTINGS_ON,
  'GET /varieties': [VARIETY_ROW],
  'GET /varieties/1': VARIETY_ROW,
  'GET /varieties/1/prices': HISTORY,
  'GET /stock': {
    total: 18,
    varieties: [{ variety_id: 1, grams: 18, status: 'low', sold_out_since: null, threshold: 20, days_left: 24 }],
    entries: [],
  },
  'GET /catalog': {
    text: 'texto',
    header: '',
    footer: '',
    varieties: [{ id: 1, name: '24K Gold', emoji: null, indica_share: null, aroma: null, shown: true, state: 'in' }],
  },
  'GET /stock/varieties/1/movements': [],
}

function renderApp(viewport: 'phone' | 'computer') {
  const { flip } = stubFlippableViewport(viewport)
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url}`
      const body = ANSWERS[key]
      return body === undefined ? Promise.reject(new Error(`unexpected request: ${key}`)) : Promise.resolve(jsonResponse(200, body))
    }),
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(appRouter.routes, { initialEntries: [NEW_PATH] })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { flip, router }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('on a computer the list pane is there, inert and hidden, and the price screen is the one accessible main', async () => {
  renderApp('computer')

  await screen.findByRole('dialog', { name: 'Nuevo precio' })
  const mains = screen.getAllByRole('main')
  expect(mains).toHaveLength(1)
  expect(mains[0]).toContainElement(screen.getByRole('dialog'))
  const hidden = screen.getAllByRole('main', { hidden: true })
  expect(hidden.length).toBeGreaterThan(1)
  const pane = hidden.find((main) => main !== mains[0])?.closest('.variedades-paneles__lista')
  expect(pane).not.toBeNull()
  expect(pane).toHaveAttribute('aria-hidden', 'true')
  expect(pane).toHaveAttribute('inert')
})

test('a value typed on the phone survives a flip to a computer and back, and "Cerrar" still asks', async () => {
  const user = userEvent.setup()
  const { flip } = renderApp('phone')

  const amount = await screen.findByLabelText(/^Precio de lista/)
  await user.type(amount, '12000')
  act(() => flip('computer'))
  expect(await screen.findByRole('dialog', { name: 'Nuevo precio' })).toBeInTheDocument()
  expect(screen.getByLabelText(/^Precio de lista/)).toBe(amount)
  expect(amount).toHaveValue('12000')

  await user.click(screen.getByRole('button', { name: 'Cerrar' }))
  expect(await screen.findByText('¿Descartás el precio?')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'No, seguí cargando' }))

  act(() => flip('phone'))
  expect(screen.getByLabelText(/^Precio de lista/)).toBe(amount)
  expect(amount).toHaveValue('12000')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
