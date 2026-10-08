/**
 * `BusinessGroup` at the screen seam (plan, "Negocio"; `accounts.md`): renaming the
 * business, inline refusals, and the unsaved-changes rule measured against the name the
 * server last accepted. The API is faked at `fetch`, never mocked deeper (CODING_STANDARDS §10).
 */

import { LOGIN, SETTINGS, SETTINGS_BUSINESS } from '../../routes'
import { inAppState } from '../../components/inAppState'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import { SIN_CONEXION_TITULO } from '../../components/SinConexion'
import { expectIconAndTextRule } from '../../test/iconAndTextRule'
import BusinessGroup from './BusinessGroup'
import { BUSINESS_NAME_INVALID_MESSAGE, RENAME_SUCCESS } from './messages'

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

function renderBusiness(fetchMock: ReturnType<typeof vi.fn>): QueryClient {
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = new QueryClient()
  const router = createMemoryRouter(
    [
      {
        element: <Provide />,
        children: [
          { path: SETTINGS, element: <div>Lista de grupos</div> },
          { path: SETTINGS_BUSINESS, element: <BusinessGroup /> },
        ],
      },
      { path: LOGIN, element: <div>Pantalla de entrada</div> },
    ],
    {
      initialEntries: [SETTINGS, { pathname: SETTINGS_BUSINESS, state: inAppState({ pathname: SETTINGS }) }],
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

test('shows the business name', async () => {
  renderBusiness(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))

  expect(await screen.findByDisplayValue('La Huerta')).toBeInTheDocument()
})

test('renaming the business shows the fixed success toast, never the name or an id', async () => {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      return Promise.resolve(jsonResponse(200, { ...BUSINESS, name: 'La Huerta Nueva' }))
    }
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderBusiness(fetchMock)

  const input = await screen.findByLabelText('Nombre del negocio')
  await userEvent.clear(input)
  await userEvent.type(input, 'La Huerta Nueva')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá el nombre' }))

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
  renderBusiness(fetchMock)

  const input = await screen.findByLabelText('Nombre del negocio')
  await userEvent.clear(input)
  await userEvent.type(input, '   ')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá el nombre' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(BUSINESS_NAME_INVALID_MESSAGE)
  expect(screen.queryByText(RENAME_SUCCESS)).not.toBeInTheDocument()
  expect(input).toHaveValue('   ')
})

test('a dropped network while renaming shows "Sin conexión", never the generic retry', async () => {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') return Promise.reject(new TypeError('network error'))
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderBusiness(fetchMock)

  const input = await screen.findByLabelText('Nombre del negocio')
  await userEvent.clear(input)
  await userEvent.type(input, 'La Huerta Nueva')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá el nombre' }))

  expect(await screen.findByText(SIN_CONEXION_TITULO)).toBeInTheDocument()
  expect(screen.queryByText(ERROR_GENERICO_MENSAJE)).not.toBeInTheDocument()
  expect(screen.queryByText(RENAME_SUCCESS)).not.toBeInTheDocument()
})

test('"Cerrar" right after a save closes at once, with the refetch still pending: the saved name is not unsaved', async () => {
  let gets = 0
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      return Promise.resolve(jsonResponse(200, { ...BUSINESS, name: 'La Huerta Nueva' }))
    }
    gets += 1
    return gets === 1 ? Promise.resolve(jsonResponse(200, BUSINESS)) : new Promise<Response>(() => undefined)
  })
  renderBusiness(fetchMock)

  const input = await screen.findByLabelText('Nombre del negocio')
  await userEvent.clear(input)
  await userEvent.type(input, 'La Huerta Nueva')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá el nombre' }))
  await screen.findByText(RENAME_SUCCESS)
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('Lista de grupos')).toBeInTheDocument()
  expect(screen.queryByText('¿Descartás el nombre?')).not.toBeInTheDocument()
})

test('a real change after a save asks before closing, and keeping it leaves what was typed', async () => {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      return Promise.resolve(jsonResponse(200, { ...BUSINESS, name: 'La Huerta Nueva' }))
    }
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderBusiness(fetchMock)

  const input = await screen.findByLabelText('Nombre del negocio')
  await userEvent.clear(input)
  await userEvent.type(input, 'La Huerta Nueva')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá el nombre' }))
  await screen.findByText(RENAME_SUCCESS)
  await userEvent.type(input, ' 2')
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('¿Descartás el nombre?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'No, seguí editando' }))
  expect(screen.getByLabelText('Nombre del negocio')).toHaveValue('La Huerta Nueva 2')
  expect(screen.queryByText('Lista de grupos')).not.toBeInTheDocument()
})

test('an untouched name closes at once', async () => {
  renderBusiness(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))

  await screen.findByDisplayValue('La Huerta')
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('Lista de grupos')).toBeInTheDocument()
})

test('the group follows the icon and text rule: a text-only submit and a link close', async () => {
  renderBusiness(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))
  await screen.findByDisplayValue('La Huerta')

  expectIconAndTextRule(document.body)
})
