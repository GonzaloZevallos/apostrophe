/**
 * `Negocio` at the screen seam (plan, "Negocio"; `accounts.md`): the business's
 * name and its users (the signed-in one marked "vos"), renaming, "Invitá a un
 * socio" and logging out. The API is faked at `fetch`, never mocked deeper
 * (CODING_STANDARDS §10).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import { SIN_CONEXION_TITULO } from '../components/SinConexion'
import Negocio, { BUSINESS_NAME_INVALID_MESSAGE, RENAME_SUCCESS, RETRY_MESSAGE } from './Negocio'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function noContent(): Response {
  return new Response(null, { status: 204 })
}

const ME: Me = { email: 'vos@lahuerta.com', business_name: 'La Huerta', today: '2026-10-02' }

function Provide() {
  return <Outlet context={ME} />
}

function renderNegocio(fetchMock: ReturnType<typeof vi.fn>): QueryClient {
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/negocio']}>
        <Routes>
          <Route element={<Provide />}>
            <Route path="/negocio" element={<Negocio />} />
          </Route>
          <Route path="/entrar" element={<div>Pantalla de entrada</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return queryClient
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const BUSINESS = {
  name: 'La Huerta',
  users: [{ email: 'vos@lahuerta.com' }, { email: 'juli@lahuerta.com' }],
}

test('shows the business name and marks the signed-in user "vos", nobody else', async () => {
  renderNegocio(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))

  expect(await screen.findByDisplayValue('La Huerta')).toBeInTheDocument()
  const vosRow = (await screen.findByText('vos@lahuerta.com')).closest('li')
  const juliRow = screen.getByText('juli@lahuerta.com').closest('li')
  expect(vosRow).toHaveTextContent('vos')
  expect(juliRow).not.toHaveTextContent('vos')
})

test('renaming the business shows the fixed success toast, never the name or an id', async () => {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      return Promise.resolve(jsonResponse(200, { ...BUSINESS, name: 'La Huerta Nueva' }))
    }
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderNegocio(fetchMock)

  const input = await screen.findByLabelText('Nombre del negocio')
  await userEvent.clear(input)
  await userEvent.type(input, 'La Huerta Nueva')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText(RENAME_SUCCESS)).toBeInTheDocument()
  expect(screen.getByDisplayValue('La Huerta Nueva')).toBeInTheDocument()
})

test('a rejected name keeps what was typed and shows the inline refusal, not a toast', async () => {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      return Promise.resolve(
        jsonResponse(422, { detail: 'blank', code: 'account.business_name_invalid' }),
      )
    }
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderNegocio(fetchMock)

  const input = await screen.findByLabelText('Nombre del negocio')
  await userEvent.clear(input)
  await userEvent.type(input, '   ')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(BUSINESS_NAME_INVALID_MESSAGE)
  expect(screen.queryByText(RENAME_SUCCESS)).not.toBeInTheDocument()
  expect(input).toHaveValue('   ')
})

test('"Invitá a un socio" shows the fresh link on screen instead of a toast', async () => {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'POST' && url === '/invitations') {
      return Promise.resolve(
        jsonResponse(201, {
          url: 'https://apostrophe.app/invitation/abc123',
          expires_at: '2026-10-09T00:00:00Z',
        }),
      )
    }
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderNegocio(fetchMock)

  await userEvent.click(await screen.findByRole('button', { name: 'Invitá a un socio' }))

  expect(await screen.findByText('https://apostrophe.app/invitation/abc123')).toBeInTheDocument()
  expect(await screen.findByText('Un link de un solo uso, vence el 09/10')).toBeInTheDocument()
  expect(screen.queryByText('Invitación lista')).not.toBeInTheDocument()
})

test('a dropped network while renaming shows "Sin conexión", never the generic retry', async () => {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') return Promise.reject(new TypeError('network error'))
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderNegocio(fetchMock)

  const input = await screen.findByLabelText('Nombre del negocio')
  await userEvent.clear(input)
  await userEvent.type(input, 'La Huerta Nueva')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText(SIN_CONEXION_TITULO)).toBeInTheDocument()
  expect(screen.queryByText(RETRY_MESSAGE)).not.toBeInTheDocument()
  expect(screen.queryByText(RENAME_SUCCESS)).not.toBeInTheDocument()
})

test('a dropped network while inviting shows "Sin conexión", never the generic retry', async () => {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'POST' && url === '/invitations') {
      return Promise.reject(new TypeError('network error'))
    }
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderNegocio(fetchMock)

  await userEvent.click(await screen.findByRole('button', { name: 'Invitá a un socio' }))

  expect(await screen.findByText(SIN_CONEXION_TITULO)).toBeInTheDocument()
  expect(screen.queryByText(RETRY_MESSAGE)).not.toBeInTheDocument()
})

test('logging out posts to /auth/logout, clears the query cache and navigates to Entrar', async () => {
  const calls: string[] = []
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`)
    if (url === '/auth/logout') return Promise.resolve(noContent())
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  const queryClient = renderNegocio(fetchMock)
  await screen.findByDisplayValue('La Huerta')
  queryClient.setQueryData(['something-else'], { stale: true })

  await userEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))

  expect(await screen.findByText('Pantalla de entrada')).toBeInTheDocument()
  expect(calls).toContain('POST /auth/logout')
  expect(queryClient.getQueryData(['something-else'])).toBeUndefined()
})

test('a dropped network while logging out shows "Sin conexión" and re-enables the button', async () => {
  const fetchMock = vi.fn((url: string) => {
    if (url === '/auth/logout') return Promise.reject(new TypeError('network error'))
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderNegocio(fetchMock)

  const button = await screen.findByRole('button', { name: 'Cerrar sesión' })
  await userEvent.click(button)

  expect(await screen.findByText(SIN_CONEXION_TITULO)).toBeInTheDocument()
  expect(button).not.toBeDisabled()
})
