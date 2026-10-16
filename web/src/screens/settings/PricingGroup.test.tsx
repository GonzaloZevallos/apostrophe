/**
 * `PricingGroup` at the screen seam (plan, "Configuración → Precios"; `pricing-settings.md`):
 * the two switches, the save and its toast, both fixed lines, and the unsaved-changes rule
 * measured against what the server last accepted. The API is faked at `fetch`.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { keys } from '../../api/keys'
import type { PricingSettings } from '../../api/pricingSettings'
import type { Me } from '../../api/me'
import { expectIconAndTextRule } from '../../test/iconAndTextRule'
import { inAppState } from '../../components/inAppState'
import { SIN_CONEXION_MENSAJE } from '../../components/estadosMessages'
import { SETTINGS as SETTINGS_PATH, SETTINGS_PRICES } from '../../routes'
import PricingGroup, { PAST_SALES_LINE, VIP_HELP_LINE } from './PricingGroup'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ME: Me = { email: 'vos@lahuerta.com', business_name: 'La Huerta', today: '2026-10-02' }

const SETTINGS: PricingSettings = { is_bulk_pricing: true, is_vip_customers: false }

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderGroup(fetchMock: ReturnType<typeof vi.fn>): QueryClient {
  const client = new QueryClient()
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter(
    [
      {
        element: <Outlet context={ME} />,
        children: [
          { path: SETTINGS_PATH, element: <div>Lista de grupos</div> },
          { path: SETTINGS_PRICES, element: <PricingGroup /> },
        ],
      },
    ],
    {
      initialEntries: [
        SETTINGS_PATH,
        { pathname: SETTINGS_PRICES, state: inAppState({ pathname: SETTINGS_PATH }) },
      ],
      initialIndex: 1,
    },
  )
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return client
}

function serving(put?: (body: PricingSettings) => Response) {
  return vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'PUT' && url === '/pricing-settings' && put !== undefined) {
      return Promise.resolve(put(JSON.parse(String(init.body)) as PricingSettings))
    }
    return Promise.resolve(jsonResponse(200, SETTINGS))
  })
}

test('shows the two switches as the server has them, told by aria-checked', async () => {
  renderGroup(serving())

  const bulk = await screen.findByRole('switch', { name: 'Precio por cantidad' })
  expect(bulk).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('switch', { name: 'Clientes VIP' })).toHaveAttribute('aria-checked', 'false')
})

test('shows both fixed lines, the VIP help whether the switch is on or off', async () => {
  renderGroup(serving())
  await screen.findByRole('switch', { name: 'Clientes VIP' })

  expect(screen.getByText(PAST_SALES_LINE)).toBeInTheDocument()
  expect(screen.getByText(VIP_HELP_LINE)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('switch', { name: 'Clientes VIP' }))
  expect(screen.getByText(VIP_HELP_LINE)).toBeInTheDocument()
  expect(VIP_HELP_LINE).toBe(
    'Cada variedad necesita su precio VIP: sin él, un cliente VIP paga como cualquiera.',
  )
})

test('saving sends both switches and shows the fixed toast "Precios guardados"', async () => {
  const fetchMock = serving((body) => jsonResponse(200, body))
  renderGroup(fetchMock)
  await screen.findByRole('switch', { name: 'Clientes VIP' })

  await userEvent.click(screen.getByRole('switch', { name: 'Clientes VIP' }))
  await userEvent.click(screen.getByRole('switch', { name: 'Precio por cantidad' }))
  await userEvent.click(screen.getByRole('button', { name: 'Guardá los precios' }))

  expect(await screen.findByText('Precios guardados')).toBeInTheDocument()
  const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
  expect(JSON.parse(String(put?.[1]?.body))).toEqual({
    is_bulk_pricing: false,
    is_vip_customers: true,
  })
  expect(screen.getByRole('switch', { name: 'Clientes VIP' })).toHaveAttribute('aria-checked', 'true')
})

test('touching a switch again clears the toast', async () => {
  renderGroup(serving((body) => jsonResponse(200, body)))
  await screen.findByRole('switch', { name: 'Clientes VIP' })
  await userEvent.click(screen.getByRole('switch', { name: 'Clientes VIP' }))
  await userEvent.click(screen.getByRole('button', { name: 'Guardá los precios' }))
  await screen.findByText('Precios guardados')

  await userEvent.click(screen.getByRole('switch', { name: 'Clientes VIP' }))

  expect(screen.queryByText('Precios guardados')).not.toBeInTheDocument()
})

test('a dropped network shows "Sin conexión" and keeps the switches as set', async () => {
  const fetchMock = vi.fn((url: string, init?: RequestInit) =>
    init?.method === 'PUT' && url === '/pricing-settings'
      ? Promise.reject(new TypeError('Failed to fetch'))
      : Promise.resolve(jsonResponse(200, SETTINGS)),
  )
  renderGroup(fetchMock)
  await screen.findByRole('switch', { name: 'Clientes VIP' })

  await userEvent.click(screen.getByRole('switch', { name: 'Clientes VIP' }))
  await userEvent.click(screen.getByRole('button', { name: 'Guardá los precios' }))

  expect(await screen.findByText(SIN_CONEXION_MENSAJE)).toBeInTheDocument()
  expect(screen.getByRole('switch', { name: 'Clientes VIP' })).toHaveAttribute('aria-checked', 'true')
})

test('an untouched group closes at once', async () => {
  renderGroup(serving())
  await screen.findByRole('switch', { name: 'Clientes VIP' })

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('Lista de grupos')).toBeInTheDocument()
})

test('closing with an unsaved switch asks first, and keeping stays on the group', async () => {
  renderGroup(serving())
  await screen.findByRole('switch', { name: 'Clientes VIP' })
  await userEvent.click(screen.getByRole('switch', { name: 'Clientes VIP' }))

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('¿Descartás los precios?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'No, seguí editando' }))
  expect(screen.getByRole('switch', { name: 'Clientes VIP' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.queryByText('Lista de grupos')).not.toBeInTheDocument()
})

test('discarding leaves the group; turning a switch back to its saved value is not a change', async () => {
  renderGroup(serving())
  await screen.findByRole('switch', { name: 'Clientes VIP' })
  await userEvent.click(screen.getByRole('switch', { name: 'Clientes VIP' }))
  await userEvent.click(screen.getByRole('switch', { name: 'Clientes VIP' }))
  await userEvent.click(screen.getByRole('switch', { name: 'Precio por cantidad' }))

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Sí, descartalo' }))

  expect(await screen.findByText('Lista de grupos')).toBeInTheDocument()
})

test('after saving, dirty is measured against what the server accepted, not the query cache', async () => {
  const client = renderGroup(serving((body) => jsonResponse(200, body)))
  await screen.findByRole('switch', { name: 'Clientes VIP' })
  await userEvent.click(screen.getByRole('switch', { name: 'Clientes VIP' }))
  await userEvent.click(screen.getByRole('button', { name: 'Guardá los precios' }))
  await screen.findByText('Precios guardados')

  act(() => {
    client.setQueryData(keys.pricingSettings(), { is_bulk_pricing: false, is_vip_customers: false })
  })
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  await waitFor(() => expect(screen.getByText('Lista de grupos')).toBeInTheDocument())
  expect(screen.queryByText('¿Descartás los precios?')).not.toBeInTheDocument()
})

test('the group obeys the icon and text rule: "Guardá los precios" is a text-only submit and Cerrar is icon-only', async () => {
  renderGroup(serving())

  const save = await screen.findByRole('button', { name: 'Guardá los precios' })
  expect(save).toHaveAttribute('type', 'submit')
  expect(save.querySelector('svg')).toBeNull()
  expect(screen.getByRole('button', { name: 'Cerrar' }).textContent).toBe('')
  expectIconAndTextRule(document.body)
})
