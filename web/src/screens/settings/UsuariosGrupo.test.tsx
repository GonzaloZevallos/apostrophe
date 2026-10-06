/**
 * `UsuariosGrupo` at the screen seam: the users with "vos" on the signed-in one and
 * "Invitá a un socio" (`accounts.md`). The API is faked at `fetch`.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SIN_CONEXION_TITULO } from '../../components/SinConexion'
import * as clipboard from '../../clipboard'
import UsuariosGrupo from './UsuariosGrupo'
import { RETRY_MESSAGE } from './NegocioGrupo'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import { paths } from '../../routes/paths'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

vi.mock('../../clipboard', () => ({ copyText: vi.fn().mockResolvedValue(true) }))

const ME: Me = { email: 'vos@lahuerta.com', business_name: 'La Huerta', today: '2026-10-02' }

function Provide() {
  return <Outlet context={ME} />
}

function renderGrupo(fetchMock: ReturnType<typeof vi.fn>): QueryClient {
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[paths.settingsUsers()]}>
        <Routes>
          <Route element={<Provide />}>
            <Route path={paths.settingsUsers()} element={<UsuariosGrupo />} />
          </Route>
          <Route path={paths.login()} element={<div>Pantalla de entrada</div>} />
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

test('lists the users and marks the signed-in one "vos", nobody else', async () => {
  renderGrupo(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))

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
  renderGrupo(fetchMock)

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
  renderGrupo(fetchMock)

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
  renderGrupo(fetchMock)

  await userEvent.click(await screen.findByRole('button', { name: 'Invitá a un socio' }))

  expect(await screen.findByText(SIN_CONEXION_TITULO)).toBeInTheDocument()
  expect(screen.queryByText(RETRY_MESSAGE)).not.toBeInTheDocument()
})
