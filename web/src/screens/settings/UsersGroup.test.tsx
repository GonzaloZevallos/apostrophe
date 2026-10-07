/**
 * `UsersGroup` at the screen seam (plan, "Usuarios"; `accounts.md`): the business's users
 * (the signed-in one marked "vos") and "Invitá a un socio". The API is faked at `fetch`,
 * never mocked deeper (CODING_STANDARDS §10).
 */

import { LOGIN, SETTINGS, SETTINGS_USERS } from '../../routes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import { SIN_CONEXION_TITULO } from '../../components/SinConexion'
import * as clipboard from '../../clipboard'
import UsersGroup from './UsersGroup'

vi.mock('../../clipboard', () => ({ copyText: vi.fn().mockResolvedValue(true) }))

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ME: Me = { email: 'vos@lahuerta.com', business_name: 'La Huerta', today: '2026-10-02' }

function Provide() {
  return <Outlet context={ME} />
}

const BUSINESS = {
  name: 'La Huerta',
  users: [{ email: 'vos@lahuerta.com' }, { email: 'juli@lahuerta.com' }],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderUsers(fetchMock: ReturnType<typeof vi.fn>): QueryClient {
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = new QueryClient()
  const router = createMemoryRouter(
    [
      {
        element: <Provide />,
        children: [
          { path: SETTINGS, element: <div>Lista de grupos</div> },
          { path: SETTINGS_USERS, element: <UsersGroup /> },
        ],
      },
      { path: LOGIN, element: <div>Pantalla de entrada</div> },
    ],
    {
      initialEntries: [SETTINGS, { pathname: SETTINGS_USERS, state: { inApp: true } }],
      initialIndex: 1,
    },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return queryClient
}

test('marks the signed-in user "vos", nobody else, with the users sorted as answered', async () => {
  renderUsers(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))

  const vosRow = (await screen.findByText('vos@lahuerta.com')).closest('li')
  const juliRow = screen.getByText('juli@lahuerta.com').closest('li')
  expect(vosRow).toHaveTextContent('vos')
  expect(juliRow).not.toHaveTextContent('vos')
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
  renderUsers(fetchMock)

  await userEvent.click(await screen.findByRole('button', { name: 'Invitá a un socio' }))

  expect(await screen.findByText('https://apostrophe.app/invitation/abc123')).toBeInTheDocument()
  expect(await screen.findByText('Un link de un solo uso, vence el 09/10')).toBeInTheDocument()
  expect(screen.queryByText('Invitación lista')).not.toBeInTheDocument()
})

test('"Copiar" copies the invite link through copyText, the only clipboard path', async () => {
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
  renderUsers(fetchMock)

  await userEvent.click(await screen.findByRole('button', { name: 'Invitá a un socio' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Copiar' }))

  expect(clipboard.copyText).toHaveBeenCalledWith('https://apostrophe.app/invitation/abc123')
})

test('a dropped network while inviting shows "Sin conexión", never the generic retry', async () => {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'POST' && url === '/invitations') {
      return Promise.reject(new TypeError('network error'))
    }
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderUsers(fetchMock)

  await userEvent.click(await screen.findByRole('button', { name: 'Invitá a un socio' }))

  expect(await screen.findByText(SIN_CONEXION_TITULO)).toBeInTheDocument()
  expect(screen.queryByText(ERROR_GENERICO_MENSAJE)).not.toBeInTheDocument()
})

test('an untouched group closes at once, with no confirmation', async () => {
  renderUsers(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))

  await userEvent.click(await screen.findByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('Lista de grupos')).toBeInTheDocument()
})
