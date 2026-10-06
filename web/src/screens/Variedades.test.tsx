/**
 * `Variedades` at the screen seam (`varieties.md`, "On screen"): today's prices per
 * variety, "Sin precio: no se puede vender" when none is in force, and adding a
 * variety. The API is faked at `../api/client` (plan, invariant: it is the only
 * module that calls `fetch`), never at `fetch` itself.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import * as client from '../api/client'
import { ApiError, NetworkError } from '../api/client'
import type { Me } from '../api/me'
import { SIN_CONEXION_TITULO } from '../components/SinConexion'
import Variedades, { NAME_TAKEN_MESSAGE, NO_PRICE_TODAY, VARIETY_SAVED } from './Variedades'
import { paths } from '../routes/paths'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof client>('../api/client')
  return { ...actual, get: vi.fn(), post: vi.fn() }
})

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }

const EMPTY_STOCK = { total: 0, varieties: [], entries: [] }

function renderScreen() {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider
        router={createMemoryRouter(
          [{ element: <Outlet context={ME} />, children: [{ path: paths.varieties(), element: <Variedades /> }] }],
          { initialEntries: [paths.varieties()] },
        )}
      />
    </QueryClientProvider>,
  )
}

function mockGet(varieties: unknown[], stock: unknown = EMPTY_STOCK) {
  vi.mocked(client.get).mockImplementation((path: string) => {
    if (path === '/varieties') return Promise.resolve(varieties)
    if (path === '/stock') return Promise.resolve(stock)
    return Promise.reject(new Error(`unexpected path: ${path}`))
  })
}

beforeEach(() => {
  vi.mocked(client.get).mockReset()
  vi.mocked(client.post).mockReset()
})

test('shows today\'s list and bulk prices, and the no-price state', async () => {
  mockGet([
    {
      id: 1,
      name: '24K Gold',
      current_price: { id: 10, effective_from: '2026-09-25', list_price: 11000, bulk_price: 10000, bulk_minimum: 10 },
    },
    { id: 2, name: 'Mango Bomb', current_price: null },
  ])

  renderScreen()

  expect(await screen.findByText('24K Gold')).toBeInTheDocument()
  expect(screen.getByText('$ 11.000')).toBeInTheDocument()
  expect(screen.getByText('$ 10.000')).toBeInTheDocument()
  expect(screen.getByText('Mango Bomb')).toBeInTheDocument()
  expect(screen.getByText(NO_PRICE_TODAY)).toBeInTheDocument()
})

test('a variety links to its own detail, with no business id in the path', async () => {
  mockGet([{ id: 7, name: 'Sir Jack', current_price: null }])

  renderScreen()

  const link = await screen.findByRole('link', { name: /Sir Jack/ })
  expect(link).toHaveAttribute('href', paths.variety(7))
})

describe('adding a variety', () => {
  test('saves it, toasts, and clears the form', async () => {
    const user = userEvent.setup()
    mockGet([])
    vi.mocked(client.post).mockResolvedValue({ id: 3, name: 'Golden Cookies', current_price: null })

    renderScreen()
    await screen.findByText(NO_PRICE_TODAY, {}, { timeout: 3000 }).catch(() => undefined)

    await user.click(screen.getByRole('button', { name: 'Nueva variedad' }))
    await user.type(screen.getByRole('textbox'), 'Golden Cookies')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText(VARIETY_SAVED)).toBeInTheDocument()
    expect(client.post).toHaveBeenCalledWith('/varieties', { name: 'Golden Cookies' })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  test('a duplicate name is refused inline, keeping what was typed', async () => {
    const user = userEvent.setup()
    mockGet([])
    vi.mocked(client.post).mockRejectedValue(new ApiError(409, 'variety.name_taken'))

    renderScreen()

    await user.click(screen.getByRole('button', { name: 'Nueva variedad' }))
    await user.type(screen.getByRole('textbox'), '24K Gold')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText(NAME_TAKEN_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('24K Gold')
  })

  test('a dropped network shows "Sin conexión", keeping what was typed', async () => {
    const user = userEvent.setup()
    mockGet([])
    vi.mocked(client.post).mockRejectedValue(new NetworkError())

    renderScreen()

    await user.click(screen.getByRole('button', { name: 'Nueva variedad' }))
    await user.type(screen.getByRole('textbox'), 'Golden Cookies')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText(SIN_CONEXION_TITULO)).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('Golden Cookies')
  })
})

describe('status mark and low-stock warning', () => {
  test('a threshold set, not low, shows the ok mark by shape and word plus "Avisame abajo de N g"', async () => {
    mockGet([{ id: 1, name: 'Sir Jack', current_price: null }], {
      total: 40,
      varieties: [{ variety_id: 1, grams: 40, status: 'ok', sold_out_since: null, threshold: 15, days_left: 12 }],
      entries: [],
    })

    renderScreen()

    expect(await screen.findByText('Sir Jack')).toBeInTheDocument()
    expect(screen.getByText('ok')).toBeInTheDocument()
    expect(screen.getByText('Avisame abajo de 15 g')).toBeInTheDocument()
  })

  test('low shows the baja mark and "Avisando: quedan N g"', async () => {
    mockGet([{ id: 1, name: 'Sir Jack', current_price: null }], {
      total: 10,
      varieties: [{ variety_id: 1, grams: 10, status: 'low', sold_out_since: null, threshold: 15, days_left: 3 }],
      entries: [],
    })

    renderScreen()

    expect(await screen.findByText('Sir Jack')).toBeInTheDocument()
    expect(screen.getByText('baja')).toBeInTheDocument()
    expect(screen.getByText('Avisando: quedan 10 g')).toBeInTheDocument()
  })

  test('no threshold shows "Aviso apagado", even when sold out', async () => {
    mockGet([{ id: 1, name: 'Sir Jack', current_price: null }], {
      total: -4,
      varieties: [
        { variety_id: 1, grams: -4, status: 'sold_out', sold_out_since: '2026-09-28', threshold: null, days_left: null },
      ],
      entries: [],
    })

    renderScreen()

    expect(await screen.findByText('Sir Jack')).toBeInTheDocument()
    // The mark still shows (shape plus word), threshold or not.
    expect(screen.getByText('agotada')).toBeInTheDocument()
    expect(screen.getByText('Aviso apagado')).toBeInTheDocument()
  })
})
