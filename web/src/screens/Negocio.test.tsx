/**
 * `Negocio` at the screen seam (plan, "Negocio"; `accounts.md`): the business's
 * name and its users (the signed-in one marked "vos"), renaming, "Invitá a un
 * socio" and logging out. The API is faked at `fetch`, never mocked deeper
 * (CODING_STANDARDS §10).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import { SIN_CONEXION_TITULO } from '../components/SinConexion'
import * as clipboard from '../clipboard'
import Negocio, {
  BUSINESS_NAME_INVALID_MESSAGE,
  PASSWORD_CHANGED_SUCCESS,
  RENAME_SUCCESS,
  RETRY_MESSAGE,
} from './Negocio'
import { WRONG_CURRENT_PASSWORD_MESSAGE } from './CambiarContrasena'
import { WEAK_PASSWORD_MESSAGE } from './Invitacion'
import { BRAKE_MESSAGE } from './Entrar'

vi.mock('../clipboard', () => ({ copyText: vi.fn().mockResolvedValue(true) }))

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
  renderNegocio(fetchMock)

  await userEvent.click(await screen.findByRole('button', { name: 'Invitá a un socio' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Copiar' }))

  expect(clipboard.copyText).toHaveBeenCalledWith('https://apostrophe.app/invitation/abc123')
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

test('changing the password shows the fixed toast and closes the sheet, with no data', async () => {
  const fetchMock = vi.fn((url: string) => {
    if (url === '/auth/password') {
      return Promise.resolve(jsonResponse(200, { token: 'tok' }))
    }
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderNegocio(fetchMock)

  await userEvent.click(await screen.findByRole('button', { name: 'Cambiar contraseña' }))
  const sheet = within(screen.getByRole('presentation'))
  await userEvent.type(screen.getByLabelText('Contraseña actual'), 'viejaclave123')
  await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'nuevaclave123')
  await userEvent.click(sheet.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText(PASSWORD_CHANGED_SUCCESS)).toBeInTheDocument()
  expect(screen.queryByLabelText('Contraseña actual')).not.toBeInTheDocument()
})

test('a wrong current password clears it inline and keeps the new one, never navigating to Entrar', async () => {
  const fetchMock = vi.fn((url: string) => {
    if (url === '/auth/password') {
      return Promise.resolve(
        jsonResponse(422, { detail: 'wrong', code: 'account.current_password_wrong' }),
      )
    }
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderNegocio(fetchMock)

  await userEvent.click(await screen.findByRole('button', { name: 'Cambiar contraseña' }))
  const sheet = within(screen.getByRole('presentation'))
  const currentField = screen.getByLabelText('Contraseña actual')
  const newField = screen.getByLabelText('Contraseña nueva')
  await userEvent.type(currentField, 'viejaequivocada')
  await userEvent.type(newField, 'nuevaclave123')
  await userEvent.click(sheet.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText(WRONG_CURRENT_PASSWORD_MESSAGE)).toBeInTheDocument()
  expect(currentField).toHaveValue('')
  expect(newField).toHaveValue('nuevaclave123')
  expect(screen.queryByText('Pantalla de entrada')).not.toBeInTheDocument()
})

test('a short new password shows the invitation\'s own too-short text, keeping everything typed', async () => {
  const fetchMock = vi.fn((url: string) => {
    if (url === '/auth/password') {
      return Promise.resolve(jsonResponse(422, { detail: 'short', code: 'account.password_weak' }))
    }
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderNegocio(fetchMock)

  await userEvent.click(await screen.findByRole('button', { name: 'Cambiar contraseña' }))
  const sheet = within(screen.getByRole('presentation'))
  await userEvent.type(screen.getByLabelText('Contraseña actual'), 'viejaclave123')
  await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'corta')
  await userEvent.click(sheet.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText(WEAK_PASSWORD_MESSAGE)).toBeInTheDocument()
  expect(screen.getByLabelText('Contraseña actual')).toHaveValue('viejaclave123')
})

test('a lock shows the login brake\'s own message, keeping everything typed', async () => {
  const fetchMock = vi.fn((url: string) => {
    if (url === '/auth/password') {
      return Promise.resolve(jsonResponse(429, { detail: 'locked', code: 'account.login_locked' }))
    }
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderNegocio(fetchMock)

  await userEvent.click(await screen.findByRole('button', { name: 'Cambiar contraseña' }))
  const sheet = within(screen.getByRole('presentation'))
  await userEvent.type(screen.getByLabelText('Contraseña actual'), 'viejaclave123')
  await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'nuevaclave123')
  await userEvent.click(sheet.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText(BRAKE_MESSAGE)).toBeInTheDocument()
  expect(screen.getByLabelText('Contraseña nueva')).toHaveValue('nuevaclave123')
})

test('the reveal control toggles the new-password field between hidden and shown', async () => {
  renderNegocio(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))

  await userEvent.click(await screen.findByRole('button', { name: 'Cambiar contraseña' }))
  const field = screen.getByLabelText('Contraseña nueva')
  expect(field).toHaveAttribute('type', 'password')

  await userEvent.click(screen.getByRole('button', { name: 'Mostrar' }))
  expect(field).toHaveAttribute('type', 'text')
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
