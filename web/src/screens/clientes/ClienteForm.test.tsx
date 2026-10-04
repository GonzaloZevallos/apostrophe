/**
 * `ClienteForm` at the screen seam: add and edit share the form; a refusal maps
 * to its field and keeps what was typed (`customers.md`); a save on a `gone`
 * customer closes the form and shows `GONE_NOTICE` instead of "Cliente guardado"
 * (plan, "Gone records").
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { queryClient, setCurrentPath, setNavigate } from '../../queryClient'
import ClienteForm from './ClienteForm'

function ListStub() {
  const location = useLocation()
  const state = location.state as { toast?: string; notice?: string } | null
  return (
    <div>
      <span>la lista</span>
      {state?.toast !== undefined && <span>{state.toast}</span>}
      {state?.notice !== undefined && <span>{state.notice}</span>}
    </div>
  )
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderForm(initialPath: string) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/clientes/nuevo" element={<ClienteForm mode="nuevo" />} />
          <Route path="/clientes/:id/editar" element={<ClienteForm mode="editar" />} />
          <Route path="/clientes" element={<ListStub />} />
          <Route path="/clientes/:id" element={<span>la ficha</span>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('registers a customer and lands back on the list', async () => {
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(201, { id: 9, name: 'Nico', phone: '+5491131785094', channel: null, vip: false }),
  )
  renderForm('/clientes/nuevo')

  await userEvent.type(screen.getByLabelText('Teléfono'), '+5491131785094')
  await userEvent.type(screen.getByLabelText('Nombre'), 'Nico')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá y usá' }))

  expect(await screen.findByText('la lista')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith(
    '/customers',
    expect.objectContaining({ method: 'POST' }),
  )
})

test('only Nombre is marked required; Teléfono stays optional', () => {
  renderForm('/clientes/nuevo')

  expect(screen.getByLabelText('Nombre')).toBeRequired()
  expect(screen.getByLabelText('Teléfono')).not.toBeRequired()
})

test('registering with no phone sends the request and shows the saved toast', async () => {
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(201, { id: 10, name: 'Sol', phone: null, channel: null, vip: false }),
  )
  renderForm('/clientes/nuevo')

  await userEvent.type(screen.getByLabelText('Nombre'), 'Sol')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá y usá' }))

  expect(await screen.findByText('Cliente guardado')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith(
    '/customers',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Sol', phone: '', channel: null, vip: false }) }),
  )
})

test('clearing a phone when editing sends it and shows the saved toast', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    jsonResponse(200, { id: 7, name: 'Tincho', phone: '+5491144861258', channel: null, vip: false }),
  )
  vi.mocked(fetch).mockResolvedValueOnce(
    jsonResponse(200, { id: 7, name: 'Tincho', phone: null, channel: null, vip: false }),
  )
  renderForm('/clientes/7/editar')

  expect(await screen.findByLabelText('Teléfono')).toHaveValue('+5491144861258')
  await userEvent.clear(screen.getByLabelText('Teléfono'))
  await userEvent.click(screen.getByRole('button', { name: 'Guardá y usá' }))

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith(
    '/customers/7',
    expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Tincho', phone: '', channel: null, vip: false }) }),
  )
})

test('a duplicate phone is refused on the phone field, keeping what was typed', async () => {
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(409, { detail: 'taken', code: 'customer.phone_taken' }),
  )
  renderForm('/clientes/nuevo')

  await userEvent.type(screen.getByLabelText('Teléfono'), '+5491131785094')
  await userEvent.type(screen.getByLabelText('Nombre'), 'Nico')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá y usá' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Ese teléfono ya es de otro cliente')
  expect(screen.getByLabelText('Teléfono')).toHaveValue('+5491131785094')
  expect(screen.getByLabelText('Nombre')).toHaveValue('Nico')
})

test('edit loads the existing customer and saves the change', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    jsonResponse(200, {
      id: 7,
      name: 'Tincho',
      phone: '+5491144861258',
      channel: 'whatsapp',
      vip: false,
    }),
  )
  vi.mocked(fetch).mockResolvedValueOnce(
    jsonResponse(200, {
      id: 7,
      name: 'Tincho Aguirre',
      phone: '+5491144861258',
      channel: 'whatsapp',
      vip: false,
    }),
  )
  renderForm('/clientes/7/editar')

  expect(await screen.findByLabelText('Nombre')).toHaveValue('Tincho')

  await userEvent.clear(screen.getByLabelText('Nombre'))
  await userEvent.type(screen.getByLabelText('Nombre'), 'Tincho Aguirre')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá y usá' }))

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/customers/7', expect.objectContaining({ method: 'PATCH' }))
})

test('saving an edit on a customer that is gone shows the gone notice, not the toast', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    jsonResponse(200, { id: 7, name: 'Tincho', phone: '+5491144861258', channel: null, vip: false }),
  )
  vi.mocked(fetch).mockResolvedValueOnce(
    jsonResponse(404, { detail: 'no such customer', code: 'customer.not_found' }),
  )
  renderForm('/clientes/7/editar')

  expect(await screen.findByLabelText('Nombre')).toHaveValue('Tincho')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá y usá' }))

  await waitFor(() => expect(screen.getByText('la lista')).toBeInTheDocument())
  expect(screen.getByText('Eso ya no está. La lista ya está al día.')).toBeInTheDocument()
  expect(screen.queryByText('Cliente guardado')).not.toBeInTheDocument()
})

test('a 401 on save clears the cache and goes to Entrar, through the session boundary', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(401, { detail: 'not signed in' }))
  queryClient.setQueryData(['me'], { businessName: 'stale' })
  const navigate = vi.fn()
  setNavigate(navigate)
  setCurrentPath('/clientes/nuevo')

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/clientes/nuevo']}>
        <Routes>
          <Route path="/clientes/nuevo" element={<ClienteForm mode="nuevo" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

  await userEvent.type(screen.getByLabelText('Teléfono'), '+5491131785094')
  await userEvent.type(screen.getByLabelText('Nombre'), 'Nico')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá y usá' }))

  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/entrar'))
  expect(queryClient.getQueryData(['me'])).toBeUndefined()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
