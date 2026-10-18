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
import { SETTINGS as SETTINGS_PATH, SETTINGS_PRICES } from '../../routes'
import PricingGroup from './PricingGroup'

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

  const bulk = await screen.findByRole('switch', { name: 'Bulk pricing' })
  expect(bulk).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('switch', { name: 'VIP customers' })).toHaveAttribute('aria-checked', 'false')
})

test('shows both fixed lines, the VIP help whether the switch is on or off', async () => {
  renderGroup(serving())
  await screen.findByRole('switch', { name: 'VIP customers' })

  expect(screen.getByText('Past sales keep their recorded price. Turning an option off deletes nothing.')).toBeInTheDocument()
  expect(screen.getByText('Each variety needs a VIP price: without one, VIP customers pay the usual price.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('switch', { name: 'VIP customers' }))
  expect(screen.getByText('Each variety needs a VIP price: without one, VIP customers pay the usual price.')).toBeInTheDocument()
  expect(screen.getByText('Each variety needs a VIP price: without one, VIP customers pay the usual price.').textContent).toBe(
    'Each variety needs a VIP price: without one, VIP customers pay the usual price.',
  )
})

test('saving sends both switches and shows the fixed toast "Prices saved"', async () => {
  const fetchMock = serving((body) => jsonResponse(200, body))
  renderGroup(fetchMock)
  await screen.findByRole('switch', { name: 'VIP customers' })

  await userEvent.click(screen.getByRole('switch', { name: 'VIP customers' }))
  await userEvent.click(screen.getByRole('switch', { name: 'Bulk pricing' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save the prices' }))

  expect(await screen.findByText('Prices saved')).toBeInTheDocument()
  const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
  expect(JSON.parse(String(put?.[1]?.body))).toEqual({
    is_bulk_pricing: false,
    is_vip_customers: true,
  })
  expect(screen.getByRole('switch', { name: 'VIP customers' })).toHaveAttribute('aria-checked', 'true')
})

test('touching a switch again clears the toast', async () => {
  renderGroup(serving((body) => jsonResponse(200, body)))
  await screen.findByRole('switch', { name: 'VIP customers' })
  await userEvent.click(screen.getByRole('switch', { name: 'VIP customers' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save the prices' }))
  await screen.findByText('Prices saved')

  await userEvent.click(screen.getByRole('switch', { name: 'VIP customers' }))

  expect(screen.queryByText('Prices saved')).not.toBeInTheDocument()
})

test('a dropped network shows "No connection" and keeps the switches as set', async () => {
  const fetchMock = vi.fn((url: string, init?: RequestInit) =>
    init?.method === 'PUT' && url === '/pricing-settings'
      ? Promise.reject(new TypeError('Failed to fetch'))
      : Promise.resolve(jsonResponse(200, SETTINGS)),
  )
  renderGroup(fetchMock)
  await screen.findByRole('switch', { name: 'VIP customers' })

  await userEvent.click(screen.getByRole('switch', { name: 'VIP customers' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save the prices' }))

  expect(await screen.findByText('No connection: check your internet and try again.')).toBeInTheDocument()
  expect(screen.getByRole('switch', { name: 'VIP customers' })).toHaveAttribute('aria-checked', 'true')
})

test('an untouched group closes at once', async () => {
  renderGroup(serving())
  await screen.findByRole('switch', { name: 'VIP customers' })

  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  expect(await screen.findByText('Lista de grupos')).toBeInTheDocument()
})

test('closing with an unsaved switch asks first, and keeping stays on the group', async () => {
  renderGroup(serving())
  await screen.findByRole('switch', { name: 'VIP customers' })
  await userEvent.click(screen.getByRole('switch', { name: 'VIP customers' }))

  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  expect(await screen.findByText('Discard the prices?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'No, keep editing' }))
  expect(screen.getByRole('switch', { name: 'VIP customers' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.queryByText('Lista de grupos')).not.toBeInTheDocument()
})

test('discarding leaves the group; turning a switch back to its saved value is not a change', async () => {
  renderGroup(serving())
  await screen.findByRole('switch', { name: 'VIP customers' })
  await userEvent.click(screen.getByRole('switch', { name: 'VIP customers' }))
  await userEvent.click(screen.getByRole('switch', { name: 'VIP customers' }))
  await userEvent.click(screen.getByRole('switch', { name: 'Bulk pricing' }))

  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Yes, discard them' }))

  expect(await screen.findByText('Lista de grupos')).toBeInTheDocument()
})

test('after saving, dirty is measured against what the server accepted, not the query cache', async () => {
  const client = renderGroup(serving((body) => jsonResponse(200, body)))
  await screen.findByRole('switch', { name: 'VIP customers' })
  await userEvent.click(screen.getByRole('switch', { name: 'VIP customers' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save the prices' }))
  await screen.findByText('Prices saved')

  act(() => {
    client.setQueryData(keys.pricingSettings(), { is_bulk_pricing: false, is_vip_customers: false })
  })
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  await waitFor(() => expect(screen.getByText('Lista de grupos')).toBeInTheDocument())
  expect(screen.queryByText('Discard the prices?')).not.toBeInTheDocument()
})

test('the group obeys the icon and text rule: "Save the prices" is a text-only submit and Cerrar is icon-only', async () => {
  renderGroup(serving())

  const save = await screen.findByRole('button', { name: 'Save the prices' })
  expect(save).toHaveAttribute('type', 'submit')
  expect(save.querySelector('svg')).toBeNull()
  expect(screen.getByRole('button', { name: 'Close' }).textContent).toBe('')
  expectIconAndTextRule(document.body)
})
