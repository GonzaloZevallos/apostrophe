/**
 * `NuevaVentaCliente` (Elegir cliente and its Nuevo cliente sheet) follows Clientes VIP
 * (`pricing-settings.md`): the VIP mark on a result and the VIP field of the new-customer form
 * show only while it is on. Through Nueva venta, Testing Library, `fetch` faked.
 */

import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import App from '../../App'
import { queryClient } from '../../queryClient'
import { router } from '../../router'
import { HOME, SALE_NEW } from '../../routes'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }
const VIP_ANA = { id: 7, name: 'Ana VIP', phone: '+5491100000001', channel: null, vip: true }

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

async function openChooser(vip: boolean): Promise<ReturnType<typeof userEvent.setup>> {
  const answers: Record<string, unknown> = {
    'GET /auth/me': ME,
    'GET /varieties?on=2026-10-02': [],
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
  await user.click(await screen.findByRole('button', { name: 'Elegir cliente' }))
  return user
}

afterEach(async () => {
  vi.unstubAllGlobals()
  queryClient.clear()
  await act(() => router.navigate(HOME))
})

test('Elegir cliente shows a VIP customer\'s mark and the new-customer form its VIP field while Clientes VIP is on', async () => {
  const user = await openChooser(true)
  expect(await screen.findByText('VIP')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Nuevo cliente' }))

  expect(await screen.findByLabelText('VIP')).toBeInTheDocument()
})

test('Elegir cliente shows no VIP mark and the new-customer form no VIP field while Clientes VIP is off', async () => {
  const user = await openChooser(false)
  expect(await screen.findByText('Ana VIP')).toBeInTheDocument()
  expect(screen.queryByText('VIP')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Nuevo cliente' }))

  expect(await screen.findByLabelText('Nombre')).toBeInTheDocument()
  expect(screen.queryByLabelText('VIP')).not.toBeInTheDocument()
  expect(screen.queryByText('VIP')).not.toBeInTheDocument()
})
