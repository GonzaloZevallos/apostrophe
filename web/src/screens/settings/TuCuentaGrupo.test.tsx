/**
 * `TuCuentaGrupo` at the screen seam: "Cambiar contraseña" and "Cerrar sesión"
 * (`accounts.md`). The API is faked at `fetch`.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SIN_CONEXION_TITULO } from '../../components/SinConexion'
import { WRONG_CURRENT_PASSWORD_MESSAGE } from '../CambiarContrasena'
import { WEAK_PASSWORD_MESSAGE } from '../Invitacion'
import { BRAKE_MESSAGE } from '../Entrar'
import TuCuentaGrupo, { PASSWORD_CHANGED_SUCCESS } from './TuCuentaGrupo'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import { paths } from '../../routes/paths'

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

function renderGrupo(fetchMock: ReturnType<typeof vi.fn>): QueryClient {
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider
        router={createMemoryRouter(
          [
            { element: <Provide />, children: [{ path: paths.settingsAccount(), element: <TuCuentaGrupo /> }] },
            { path: paths.login(), element: <div>Pantalla de entrada</div> },
          ],
          { initialEntries: [paths.settingsAccount()] },
        )}
      />
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

test('logging out posts to /auth/logout, clears the query cache and navigates to Entrar', async () => {
  const calls: string[] = []
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`)
    if (url === '/auth/logout') return Promise.resolve(noContent())
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  const queryClient = renderGrupo(fetchMock)
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
  renderGrupo(fetchMock)

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
  renderGrupo(fetchMock)

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
  renderGrupo(fetchMock)

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
  renderGrupo(fetchMock)

  await userEvent.click(await screen.findByRole('button', { name: 'Cambiar contraseña' }))
  const sheet = within(screen.getByRole('presentation'))
  await userEvent.type(screen.getByLabelText('Contraseña actual'), 'viejaclave123')
  await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'nuevaclave123')
  await userEvent.click(sheet.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText(BRAKE_MESSAGE)).toBeInTheDocument()
  expect(screen.getByLabelText('Contraseña nueva')).toHaveValue('nuevaclave123')
})

test('the reveal control toggles the new-password field between hidden and shown', async () => {
  renderGrupo(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))

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
  renderGrupo(fetchMock)

  const button = await screen.findByRole('button', { name: 'Cerrar sesión' })
  await userEvent.click(button)

  expect(await screen.findByText(SIN_CONEXION_TITULO)).toBeInTheDocument()
  expect(button).not.toBeDisabled()
})

test('the password sheet is a Sheet: untouched Cerrar closes at once, touched asks, "No, seguí" keeps what was typed', async () => {
  const user = userEvent.setup()
  renderGrupo(vi.fn())

  await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
  await user.click(screen.getByRole('button', { name: 'Cerrar' }))
  expect(screen.queryByLabelText('Contraseña actual')).not.toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
  await user.type(screen.getByLabelText('Contraseña actual'), 'abc')
  await user.click(screen.getByRole('button', { name: 'Cerrar' }))
  expect(await screen.findByText('¿Descartás los cambios?')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'No, seguí' }))
  expect(screen.getByLabelText('Contraseña actual')).toHaveValue('abc')

  await user.click(screen.getByRole('button', { name: 'Cerrar' }))
  await user.click(await screen.findByRole('button', { name: 'Sí, descartalos' }))
  expect(screen.queryByLabelText('Contraseña actual')).not.toBeInTheDocument()
})
