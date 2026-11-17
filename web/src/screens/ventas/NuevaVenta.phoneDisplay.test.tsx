/**
 * The Customer step of Nueva venta and the picker it fills show `phone_display` (the number the
 * API grouped) and never the stored `phone`; a Customer with no `phone_display` shows no number
 * line. Through Nueva venta, Testing Library, `fetch` faked.
 */

import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import App from '../../App'
import { queryClient } from '../../queryClient'
import { router } from '../../router'
import { HOME, SALE_NEW } from '../../routes'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02', money: { symbol: '$', decimals: 0 } }
const WITH_PHONE = { id: 5, name: 'Uri', phone: '+59899123456', phone_display: '+598 99 123 456', vip: false }
const WITHOUT_PHONE = { id: 6, name: 'Sin', phone: null, phone_display: null, vip: false }

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function openStep() {
  const answers: Record<string, Response> = {
    'GET /auth/me': json(200, ME),
    'GET /api/products?on=2026-10-02': json(200, []),
    'GET /pricing-settings': json(200, { is_bulk_pricing: true, is_vip_customers: false }),
    'GET /customers': json(200, [WITH_PHONE, WITHOUT_PHONE]),
    'GET /customers/5': json(200, WITH_PHONE),
  }
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init?: RequestInit) => {
      const answer = answers[`${init?.method ?? 'GET'} ${path}`]
      return answer ? Promise.resolve(answer.clone()) : Promise.resolve(json(404, {}))
    }),
  )
  await act(() => router.navigate(SALE_NEW))
  render(<App />)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Pick a customer' }))
  return user
}

afterEach(async () => {
  vi.unstubAllGlobals()
  queryClient.clear()
  await act(() => router.navigate(HOME))
})

test('the Customer step shows the grouped number, not the stored one, and nothing for a Customer without one', async () => {
  await openStep()

  const rowWith = await screen.findByRole('button', { name: /Uri/ })
  expect(within(rowWith).getByText('+598 99 123 456')).toBeInTheDocument()
  expect(screen.queryByText('+59899123456')).not.toBeInTheDocument()
  const rowWithout = screen.getByRole('button', { name: /Sin/ })
  expect(rowWithout).toHaveTextContent(/^Sin$/)
})

test('the picker shows the grouped number of the chosen Customer, not the stored one', async () => {
  const user = await openStep()

  await user.click(await screen.findByRole('button', { name: /Uri/ }))

  const picker = await screen.findByRole('button', { name: /Uri/ })
  expect(within(picker).getByText('+598 99 123 456')).toBeInTheDocument()
  expect(screen.queryByText('+59899123456')).not.toBeInTheDocument()
})

test('the picker shows no number line for a chosen Customer without phone_display', async () => {
  const user = await openStep()

  await user.click(await screen.findByRole('button', { name: /Sin/ }))

  const picker = await screen.findByRole('button', { name: /Sin/ })
  expect(picker).toHaveTextContent(/^Sin\s*Change$/)
})
