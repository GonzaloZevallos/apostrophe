/**
 * `AccountGroup` at the screen seam (plan, "Tu cuenta"; `accounts.md`): "Cambiar contraseña"
 * and "Cerrar sesión". The API is faked at `fetch`, never mocked deeper (CODING_STANDARDS §10).
 */

import { LOGIN, SETTINGS, SETTINGS_ACCOUNT } from '../../routes'
import { inAppState } from '../../components/inAppState'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import { SIN_CONEXION_MENSAJE } from '../../copy/states'
import { WRONG_CURRENT_PASSWORD_MESSAGE } from '../CambiarContrasena'
import { WEAK_PASSWORD_MESSAGE } from '../Invitacion'
import { BRAKE_MESSAGE } from '../Entrar'
import AccountGroup from './AccountGroup'
import { PASSWORD_CHANGED_SUCCESS } from '../../copy/settings'
import { expectIconAndTextRule } from '../../test/iconAndTextRule'

function noContent(): Response {
  return new Response(null, { status: 204 })
}

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

function renderAccount(fetchMock: ReturnType<typeof vi.fn>): QueryClient {
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = new QueryClient()
  const router = createMemoryRouter(
    [
      {
        element: <Provide />,
        children: [
          { path: SETTINGS, element: <div>Lista de grupos</div> },
          { path: SETTINGS_ACCOUNT, element: <AccountGroup /> },
        ],
      },
      { path: LOGIN, element: <div>Pantalla de entrada</div> },
    ],
    {
      initialEntries: [SETTINGS, { pathname: SETTINGS_ACCOUNT, state: inAppState({ pathname: SETTINGS }) }],
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

test('logging out posts to /auth/logout, clears the query cache and navigates to Entrar', async () => {
  const calls: string[] = []
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`)
    if (url === '/auth/logout') return Promise.resolve(noContent())
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  const queryClient = renderAccount(fetchMock)
  await screen.findByRole('button', { name: 'Cerrar sesión' })
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
  renderAccount(fetchMock)

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
  renderAccount(fetchMock)

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
  renderAccount(fetchMock)

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
  renderAccount(fetchMock)

  await userEvent.click(await screen.findByRole('button', { name: 'Cambiar contraseña' }))
  const sheet = within(screen.getByRole('presentation'))
  await userEvent.type(screen.getByLabelText('Contraseña actual'), 'viejaclave123')
  await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'nuevaclave123')
  await userEvent.click(sheet.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText(BRAKE_MESSAGE)).toBeInTheDocument()
  expect(screen.getByLabelText('Contraseña nueva')).toHaveValue('nuevaclave123')
})

test('the reveal control toggles the new-password field between hidden and shown', async () => {
  renderAccount(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))

  await userEvent.click(await screen.findByRole('button', { name: 'Cambiar contraseña' }))
  const field = screen.getByLabelText('Contraseña nueva')
  expect(field).toHaveAttribute('type', 'password')

  await userEvent.click(screen.getByRole('button', { name: 'Show' }))
  expect(field).toHaveAttribute('type', 'text')
})

test('a dropped network while logging out shows "Sin conexión" and re-enables the button', async () => {
  const fetchMock = vi.fn((url: string) => {
    if (url === '/auth/logout') return Promise.reject(new TypeError('network error'))
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderAccount(fetchMock)

  const button = await screen.findByRole('button', { name: 'Cerrar sesión' })
  await userEvent.click(button)

  expect(await screen.findByText(SIN_CONEXION_MENSAJE)).toBeInTheDocument()
  expect(button).not.toBeDisabled()
})

test('an untouched group closes at once, with no confirmation, and "Cerrar" never logs out', async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS))
  renderAccount(fetchMock)

  await userEvent.click(await screen.findByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('Lista de grupos')).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

test('Cambiar contraseña and Cerrar sesión are icon + text, "Cerrar" the icon-only close', async () => {
  renderAccount(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))

  for (const name of ['Cambiar contraseña', 'Cerrar sesión']) {
    const button = await screen.findByRole('button', { name })
    expect(button).toHaveTextContent(name)
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  }
  const close = screen.getByRole('button', { name: 'Cerrar' })
  expect(close).toHaveClass('boton-icono')
  expect(close).toHaveTextContent('')
  expect(screen.queryByText('Volver')).not.toBeInTheDocument()
  expectIconAndTextRule(document.body)
})

test('the password sheet follows the icon and text rule', async () => {
  renderAccount(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))
  await userEvent.click(await screen.findByRole('button', { name: 'Cambiar contraseña' }))
  await screen.findByLabelText('Contraseña actual')

  expectIconAndTextRule(document.body)
})
