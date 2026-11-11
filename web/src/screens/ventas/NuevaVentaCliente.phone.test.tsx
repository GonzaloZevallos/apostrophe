/**
 * The new-customer sheet of Pick a customer shows the two phone refusals on the phone field
 * (`customers.md`): the number needs its area code, or "+" and the country code; and with no
 * Phone country, the "+" and the country code. Through Nueva venta, Testing Library, `fetch` faked.
 */

import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import App from '../../App'
import { queryClient } from '../../queryClient'
import { router } from '../../router'
import { HOME, SALE_NEW } from '../../routes'
import { PHONE_COUNTRIES } from '../stubFetchWithSettings'

const ME = {
  email: 'ana@x.com',
  business_name: 'La Huerta',
  today: '2026-10-02',
  money: { symbol: '$', decimals: 0 },
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function refusePhoneWith(code: string): Promise<ReturnType<typeof userEvent.setup>> {
  const answers: Record<string, Response> = {
    'GET /auth/me': json(200, ME),
    'GET /api/products?on=2026-10-02': json(200, []),
    'GET /pricing-settings': json(200, { is_bulk_pricing: true, is_vip_customers: false }),
    'GET /customers': json(200, []),
    'GET /phone-countries': json(200, PHONE_COUNTRIES),
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
  const create = screen.getByRole('button', { name: 'Create customer' })
  await waitFor(() => expect(create).toBeEnabled())
  await user.click(create)
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

test('a number that does not fit names the country and the lengths it needs', async () => {
  await refusePhoneWith('customer.phone_invalid')

  expect(await screen.findByRole('alert')).toHaveTextContent(
    "That doesn't look like an Argentine number. It needs 10 digits after the country code.",
  )
})

test('with the Phone country list open, system back closes only the list', async () => {
  const user = await refusePhoneWith('customer.phone_invalid')
  await screen.findByRole('alert')

  await user.click(screen.getByRole('button', { name: /^Phone country/ }))
  expect(await screen.findByRole('dialog', { name: 'Phone country options' })).toBeInTheDocument()
  await act(() => router.navigate(-1))

  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Phone country options' })).not.toBeInTheDocument())
  expect(screen.getByLabelText('Name')).toHaveValue('Nico')
  expect(screen.getByLabelText('Phone')).toHaveValue('099 123 456')
  expect(screen.getByRole('button', { name: 'Create customer' })).toBeInTheDocument()
})
