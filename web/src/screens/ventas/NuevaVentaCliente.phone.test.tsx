/**
 * The new-customer sheet of Pick a customer shows the two phone refusals on the phone field
 * (`customers.md`): the number needs its area code, or "+" and the country code; and with no
 * Phone country, the "+" and the country code. Through Nueva venta, Testing Library, `fetch` faked.
 */

import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import App from '../../App'
import { queryClient } from '../../queryClient'
import { router } from '../../router'
import { HOME, SALE_NEW } from '../../routes'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function refusePhoneWith(code: string): Promise<ReturnType<typeof userEvent.setup>> {
  const answers: Record<string, Response> = {
    'GET /auth/me': json(200, ME),
    'GET /api/products?on=2026-10-02': json(200, []),
    'GET /pricing-settings': json(200, { is_bulk_pricing: true, is_vip_customers: false }),
    'GET /customers': json(200, []),
    'POST /customers': json(422, { detail: 'refused', code }),
  }
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${path}`
      const answer = answers[key]
      return answer ? Promise.resolve(answer.clone()) : Promise.reject(new Error(`unexpected request: ${key}`))
    }),
  )
  await act(() => router.navigate(SALE_NEW))
  render(<App />)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Pick a customer' }))
  await user.click(await screen.findByRole('button', { name: 'New customer' }))
  await user.type(await screen.findByLabelText('Name'), 'Nico')
  await user.type(screen.getByLabelText('Phone'), '099 123 456')
  await user.click(screen.getByRole('button', { name: 'Create customer' }))
  return user
}

afterEach(async () => {
  vi.unstubAllGlobals()
  queryClient.clear()
  await act(() => router.navigate(HOME))
})

test('a number without + in a business with no Phone country asks for + and the country code', async () => {
  await refusePhoneWith('customer.phone_needs_country_code')

  expect(await screen.findByRole('alert')).toHaveTextContent('Start the number with + and the country code.')
  expect(screen.getByLabelText('Phone')).toHaveValue('099 123 456')
})

test('a number that does not fit asks for its area code, or + and the country code', async () => {
  await refusePhoneWith('customer.phone_invalid')

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Enter the number with its area code, or start with + and the country code.',
  )
})
