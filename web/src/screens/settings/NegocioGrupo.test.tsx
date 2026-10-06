/**
 * `NegocioGrupo` at the screen seam: renaming the business (`accounts.md`). The API
 * is faked at `fetch`, never mocked deeper (CODING_STANDARDS §10).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SIN_CONEXION_TITULO } from '../../components/SinConexion'
import NegocioGrupo, { BUSINESS_NAME_INVALID_MESSAGE, RENAME_SUCCESS, RETRY_MESSAGE } from './NegocioGrupo'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import { paths } from '../../routes/paths'

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

function renderGrupo(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = new QueryClient()
  const router = createMemoryRouter(
    [
      { element: <Provide />, children: [{ path: paths.settingsBusiness(), element: <NegocioGrupo /> }] },
      { path: paths.settings(), element: <div>Configuración</div> },
      { path: paths.login(), element: <div>Pantalla de entrada</div> },
    ],
    { initialEntries: [paths.settings(), paths.settingsBusiness()], initialIndex: 1 },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { queryClient, router }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const BUSINESS = {
  name: 'La Huerta',
  users: [{ email: 'vos@lahuerta.com' }, { email: 'juli@lahuerta.com' }],
}

test('shows the business name to rename', async () => {
  renderGrupo(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))

  expect(await screen.findByDisplayValue('La Huerta')).toBeInTheDocument()
})

test('renaming the business shows the fixed success toast, never the name or an id', async () => {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      return Promise.resolve(jsonResponse(200, { ...BUSINESS, name: 'La Huerta Nueva' }))
    }
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderGrupo(fetchMock)

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
  renderGrupo(fetchMock)

  const input = await screen.findByLabelText('Nombre del negocio')
  await userEvent.clear(input)
  await userEvent.type(input, '   ')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(BUSINESS_NAME_INVALID_MESSAGE)
  expect(screen.queryByText(RENAME_SUCCESS)).not.toBeInTheDocument()
  expect(input).toHaveValue('   ')
})

test('a dropped network while renaming shows "Sin conexión", never the generic retry', async () => {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') return Promise.reject(new TypeError('network error'))
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderGrupo(fetchMock)

  const input = await screen.findByLabelText('Nombre del negocio')
  await userEvent.clear(input)
  await userEvent.type(input, 'La Huerta Nueva')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText(SIN_CONEXION_TITULO)).toBeInTheDocument()
  expect(screen.queryByText(RETRY_MESSAGE)).not.toBeInTheDocument()
  expect(screen.queryByText(RENAME_SUCCESS)).not.toBeInTheDocument()
})

describe('leaving the business page', () => {
  const ASK = '¿Descartás los cambios?'
  const fetchOk = () => vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS))

  test('untouched closes at once on Cerrar and on browser Back', async () => {
    const { router } = renderGrupo(fetchOk())
    await screen.findByDisplayValue('La Huerta')

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(await screen.findByText('Configuración')).toBeInTheDocument()
    expect(screen.queryByText(ASK)).not.toBeInTheDocument()

    await router.navigate(1)
    await screen.findByDisplayValue('La Huerta')
    await router.navigate(-1)
    expect(await screen.findByText('Configuración')).toBeInTheDocument()
    expect(screen.queryByText(ASK)).not.toBeInTheDocument()
  })

  test('touched asks; "No, seguí" keeps the name; "Sí, descartalos" leaves', async () => {
    renderGrupo(fetchOk())
    await userEvent.type(await screen.findByLabelText('Nombre del negocio'), ' Nueva')
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(screen.getByText(ASK)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'No, seguí' }))
    expect(screen.getByLabelText('Nombre del negocio')).toHaveValue('La Huerta Nueva')

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sí, descartalos' }))
    expect(await screen.findByText('Configuración')).toBeInTheDocument()
  })

  test('browser Back is caught while touched', async () => {
    const { router } = renderGrupo(fetchOk())
    await userEvent.type(await screen.findByLabelText('Nombre del negocio'), ' Nueva')
    await router.navigate(-1)

    expect(await screen.findByText(ASK)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(paths.settingsBusiness())
  })

  test('nothing asks after a successful save', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') return Promise.resolve(jsonResponse(200, { ...BUSINESS, name: 'La Huerta Nueva' }))
      return Promise.resolve(jsonResponse(200, BUSINESS))
    })
    renderGrupo(fetchMock)
    const input = await screen.findByLabelText('Nombre del negocio')
    await userEvent.clear(input)
    await userEvent.type(input, 'La Huerta Nueva')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await screen.findByText(RENAME_SUCCESS)

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(await screen.findByText('Configuración')).toBeInTheDocument()
    expect(screen.queryByText(ASK)).not.toBeInTheDocument()
  })
})
