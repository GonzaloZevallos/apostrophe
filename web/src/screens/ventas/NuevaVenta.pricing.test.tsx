/**
 * `NuevaVenta` follows the business's pricing switches (`pricing-settings.md`): the preview
 * runs `pricing.ts` with the switches `GET /pricing-settings` answers, loaded with each day's
 * prices, and shows no badge or mark for a rule that is off. Testing Library, `fetch` faked.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import App from '../../App'
import { queryClient } from '../../queryClient'
import { router } from '../../router'
import { HOME, SALE_NEW } from '../../routes'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }
const VIP_ANA = { id: 7, name: 'Ana VIP', phone: '+5491100000001', vip: true }

function variety(vipPrice: number | null) {
  return {
    id: 3,
    name: 'Jazmín',
    current_price: {
      id: 11,
      effective_from: '2026-09-01',
      list_price: 1000,
      bulk_price: 800,
      bulk_minimum: 10,
      vip_price: vipPrice,
    },
  }
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function settings(bulk: boolean, vip: boolean): Response {
  return json({ is_bulk_pricing: bulk, is_vip_customers: vip })
}

function stubFetch(handlers: Record<string, () => Response>): ReturnType<typeof vi.fn> {
  const mock = vi.fn((path: string, init?: RequestInit) => {
    const handler = handlers[`${init?.method ?? 'GET'} ${path}`]
    return handler === undefined
      ? Promise.reject(new Error(`unexpected request: ${path}`))
      : Promise.resolve(handler())
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

async function openFor(handlers: Record<string, () => Response>): Promise<ReturnType<typeof vi.fn>> {
  const mock = stubFetch({ 'GET /auth/me': () => json(ME), 'GET /customers/7': () => json(VIP_ANA), ...handlers })
  await act(() => router.navigate(SALE_NEW, { state: { customerId: '7' } }))
  render(<App />)
  await screen.findByText('New sale')
  await screen.findByText('Ana VIP')
  return mock
}

async function line(grams: string) {
  const user = userEvent.setup()
  // The varieties arrive after the form mounts: wait until the line can offer them.
  const picker = await screen.findByLabelText('Variedad línea 1')
  await waitFor(() => expect(within(picker).getAllByRole('option').length).toBeGreaterThan(1))
  await user.selectOptions(picker, '3')
  await user.type(screen.getByLabelText('Gramos línea 1'), grams)
}

afterEach(async () => {
  vi.unstubAllGlobals()
  queryClient.clear()
  await act(() => router.navigate(HOME))
})

test('a VIP customer below the bulk minimum is priced at the VIP price, with the VIP mark', async () => {
  await openFor({
    'GET /varieties?on=2026-10-02': () => json([variety(700)]),
    'GET /pricing-settings': () => settings(true, true),
  })
  await line('1')

  expect(await screen.findByText('$ 700 x g')).toBeInTheDocument()
  expect(screen.getAllByText('VIP').length).toBeGreaterThanOrEqual(2)
})

test('at the bulk minimum the lowest rule wins: a VIP price above the bulk price gives the bulk price', async () => {
  await openFor({
    'GET /varieties?on=2026-10-02': () => json([variety(900)]),
    'GET /pricing-settings': () => settings(true, true),
  })
  await line('10')

  expect(await screen.findByText('$ 800 x g')).toBeInTheDocument()
  expect(screen.getByText('por cantidad')).toBeInTheDocument()
})

test('with Clientes VIP off there is no VIP mark and the line is priced as anyone', async () => {
  await openFor({
    'GET /varieties?on=2026-10-02': () => json([variety(700)]),
    'GET /pricing-settings': () => settings(true, false),
  })
  await line('1')

  expect(await screen.findByText('$ 1.000 x g')).toBeInTheDocument()
  expect(screen.queryByText('VIP')).not.toBeInTheDocument()
})

test('with Precio por cantidad off a line at the minimum is priced at list, with no bulk badge', async () => {
  await openFor({
    'GET /varieties?on=2026-10-02': () => json([variety(null)]),
    'GET /pricing-settings': () => settings(false, true),
  })
  await line('10')

  expect(await screen.findByText('$ 1.000 x g')).toBeInTheDocument()
  expect(screen.queryByText('por cantidad')).not.toBeInTheDocument()
})

test('a date change loads the switches again', async () => {
  const mock = await openFor({
    'GET /varieties?on=2026-10-02': () => json([variety(700)]),
    'GET /varieties?on=2026-10-01': () => json([variety(700)]),
    'GET /pricing-settings': () => settings(true, true),
  })
  const asked = () => mock.mock.calls.filter(([path]) => path === '/pricing-settings').length
  await waitFor(() => expect(asked()).toBeGreaterThanOrEqual(1))
  const before = asked()

  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-01' } })

  await waitFor(() => expect(asked()).toBeGreaterThan(before))
})
