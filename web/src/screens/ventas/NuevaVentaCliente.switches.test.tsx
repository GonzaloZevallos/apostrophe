/**
 * `NuevaVentaCliente` (Pick a customer and its Nuevo cliente sheet) follows Clientes VIP
 * (`pricing-settings.md`): the VIP mark on a result and the VIP field of the new-customer form
 * show only while it is on. Through Nueva venta, Testing Library, `fetch` faked.
 */

import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import App from '../../App'
import { queryClient } from '../../queryClient'
import { router } from '../../router'
import { HOME, SALE_NEW } from '../../routes'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }
const VIP_ANA = { id: 7, name: 'Ana VIP', phone: '+5491100000001', vip: true }

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

async function openChooser(vip: boolean): Promise<ReturnType<typeof userEvent.setup>> {
  const answers: Record<string, unknown> = {
    'GET /auth/me': ME,
    'GET /api/products?on=2026-10-02': [],
    'GET /pricing-settings': { is_bulk_pricing: true, is_vip_customers: vip },
    'GET /customers': [VIP_ANA],
  }
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) =>
      `GET ${path}` in answers
        ? Promise.resolve(json(answers[`GET ${path}`]))
        : Promise.reject(new Error(`unexpected request: ${path}`)),
    ),
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

test('Pick a customer shows a VIP customer\'s mark and the new-customer form its VIP field while Clientes VIP is on', async () => {
  const user = await openChooser(true)
  expect(await screen.findByText('VIP')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'New customer' }))

  expect(await screen.findByRole('switch', { name: 'VIP' })).toBeInTheDocument()
})

test('Pick a customer shows no VIP mark and the new-customer form no VIP field while Clientes VIP is off', async () => {
  const user = await openChooser(false)
  expect(await screen.findByText('Ana VIP')).toBeInTheDocument()
  expect(screen.queryByText('VIP')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'New customer' }))

  expect(await screen.findByLabelText('Name')).toBeInTheDocument()
  expect(screen.queryByRole('switch', { name: 'VIP' })).not.toBeInTheDocument()
  expect(screen.queryByText('VIP')).not.toBeInTheDocument()
})

test('opening the new-customer form of Pick a customer puts the focus on Name', async () => {
  const user = await openChooser(false)
  await user.click(await screen.findByRole('button', { name: 'New customer' }))

  expect(await screen.findByLabelText('Name')).toHaveFocus()
})

test('the new-customer form of Pick a customer has Nombre required, a clearable optional phone and no Canal field', async () => {
  const user = await openChooser(false)
  await user.click(await screen.findByRole('button', { name: 'New customer' }))

  expect(await screen.findByLabelText('Name')).toBeRequired()
  expect(screen.getByLabelText('Phone')).not.toBeRequired()
  const sheet = screen.getByLabelText('Name').closest('form')
  expect(sheet).not.toBeNull()
  expect(within(sheet as HTMLElement).queryByRole('radio')).not.toBeInTheDocument()
  expect(screen.queryByText(/canal|whatsapp|telegram/i)).not.toBeInTheDocument()

  await user.type(screen.getByLabelText('Phone'), '+5491100000009')
  await user.clear(screen.getByLabelText('Phone'))
  expect(screen.getByLabelText('Phone')).toHaveValue('')
})
