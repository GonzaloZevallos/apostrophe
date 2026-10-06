/**
 * `ClienteForm` at the screen seam: add and edit share the form; a refusal maps
 * to its field and keeps what was typed (`customers.md`); a save on a `gone`
 * customer closes the form and shows `GONE_NOTICE` instead of "Cliente guardado"
 * (plan, "Gone records").
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { queryClient, setCurrentPath, setNavigate } from '../../queryClient'
import ClienteForm from './ClienteForm'
import { paths } from '../../routes/paths'

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

function FichaStub() {
  const location = useLocation()
  const state = location.state as { toast?: string; notice?: string } | null
  return (
    <div>
      <span>la ficha</span>
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
  const router = createMemoryRouter(
    [
      { path: paths.newCustomer(), element: <ClienteForm mode="nuevo" /> },
      { path: paths.editCustomer(':id'), element: <ClienteForm mode="editar" /> },
      { path: paths.customers(), element: <ListStub /> },
      { path: paths.customer(':id'), element: <FichaStub /> },
    ],
    { initialEntries: [initialPath] },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
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
  renderForm(paths.newCustomer())

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
  renderForm(paths.newCustomer())

  expect(screen.getByLabelText('Nombre')).toBeRequired()
  expect(screen.getByLabelText('Teléfono')).not.toBeRequired()
})

test('registering with no phone sends the request and shows the saved toast', async () => {
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(201, { id: 10, name: 'Sol', phone: null, channel: null, vip: false }),
  )
  renderForm(paths.newCustomer())

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
  renderForm(paths.editCustomer(7))

  expect(await screen.findByLabelText('Teléfono')).toHaveValue('+5491144861258')
  await userEvent.clear(screen.getByLabelText('Teléfono'))
  await userEvent.click(screen.getByRole('button', { name: 'Guardá y usá' }))

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(screen.getByText('Cliente guardado')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith(
    '/customers/7',
    expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Tincho', phone: '', channel: null, vip: false }) }),
  )
})

test('a duplicate phone is refused on the phone field, keeping what was typed', async () => {
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(409, { detail: 'taken', code: 'customer.phone_taken' }),
  )
  renderForm(paths.newCustomer())

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
  renderForm(paths.editCustomer(7))

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
  renderForm(paths.editCustomer(7))

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
  setCurrentPath(paths.newCustomer())

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider
        router={createMemoryRouter([{ path: paths.newCustomer(), element: <ClienteForm mode="nuevo" /> }], {
          initialEntries: [paths.newCustomer()],
        })}
      />
    </QueryClientProvider>,
  )

  await userEvent.type(screen.getByLabelText('Teléfono'), '+5491131785094')
  await userEvent.type(screen.getByLabelText('Nombre'), 'Nico')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá y usá' }))

  await waitFor(() => expect(navigate).toHaveBeenCalledWith(paths.login(), { replace: true }))
  expect(queryClient.getQueryData(['me'])).toBeUndefined()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

function renderFromList() {
  const router = renderForm(paths.newCustomer())
  return router
}

test('an untouched form closes at once on Cerrar and on browser Back', async () => {
  const router = createMemoryRouter(
    [
      { path: paths.newCustomer(), element: <ClienteForm mode="nuevo" /> },
      { path: paths.customers(), element: <ListStub /> },
    ],
    { initialEntries: [paths.customers(), paths.newCustomer()], initialIndex: 1 },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  expect(await screen.findByText('la lista')).toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

  await act(() => router.navigate(paths.newCustomer()))
  await act(() => router.navigate(-1))
  expect(await screen.findByText('la lista')).toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('a touched form asks with the shared wording; "No, seguí" keeps what was typed, "Sí, descartalos" leaves', async () => {
  const router = createMemoryRouter(
    [
      { path: paths.newCustomer(), element: <ClienteForm mode="nuevo" /> },
      { path: paths.customers(), element: <ListStub /> },
    ],
    { initialEntries: [paths.customers(), paths.newCustomer()], initialIndex: 1 },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  await userEvent.type(screen.getByLabelText('Nombre'), 'Nico')
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  expect(await screen.findByText('¿Descartás los cambios?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'No, seguí' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Nombre')).toHaveValue('Nico')

  // Browser Back is caught by the same dialog.
  await act(() => router.navigate(-1))
  expect(await screen.findByText('¿Descartás los cambios?')).toBeInTheDocument()
  expect(screen.queryByText('la lista')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Sí, descartalos' }))
  expect(await screen.findByText('la lista')).toBeInTheDocument()
})

test('after a successful save nothing asks', async () => {
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(201, { id: 9, name: 'Nico', phone: '+5491131785094', channel: null, vip: false }),
  )
  renderFromList()
  await userEvent.type(screen.getByLabelText('Nombre'), 'Nico')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá y usá' }))
  expect(await screen.findByText('la lista')).toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})
