/**
 * `CatalogMessageGroup` at the screen seam (plan, "Mensaje del catálogo"; `catalog.md`): the
 * header and footer, inline refusals that keep what was typed, and the unsaved-changes rule
 * measured against what the server last accepted. The API is faked at `fetch`, never mocked
 * deeper (CODING_STANDARDS §10).
 */

import { SETTINGS, SETTINGS_CATALOG_MESSAGE } from '../../routes'
import { inAppState } from '../../components/inAppState'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { keys } from '../../api/keys'
import type { Me } from '../../api/me'
import { SIN_CONEXION_MENSAJE } from '../../copy/common'
import { expectIconAndTextRule } from '../../test/iconAndTextRule'
import CatalogMessageGroup from './CatalogMessageGroup'

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

const CATALOG = {
  text: null,
  header: '🌿 **CATÁLOGO** 🌿',
  footer: '📩 Consultas y pedidos por privado.',
  varieties: [],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderGroup(fetchMock: ReturnType<typeof vi.fn>): QueryClient {
  const client = new QueryClient()
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter(
    [
      {
        element: <Provide />,
        children: [
          { path: SETTINGS, element: <div>Lista de grupos</div> },
          { path: SETTINGS_CATALOG_MESSAGE, element: <CatalogMessageGroup /> },
        ],
      },
    ],
    {
      initialEntries: [SETTINGS, { pathname: SETTINGS_CATALOG_MESSAGE, state: inAppState({ pathname: SETTINGS }) }],
      initialIndex: 1,
    },
  )
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return client
}

function serving(put?: (body: { header: string; footer: string }) => Response) {
  return vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'PUT' && url === '/catalog/header-footer' && put !== undefined) {
      return Promise.resolve(put(JSON.parse(String(init.body)) as { header: string; footer: string }))
    }
    return Promise.resolve(jsonResponse(200, CATALOG))
  })
}

async function type(label: string, text: string): Promise<void> {
  const field = screen.getByLabelText(label)
  await userEvent.clear(field)
  await userEvent.type(field, text)
}

test('shows the saved header and footer in two multi-line fields', async () => {
  renderGroup(serving())

  const header = await screen.findByLabelText('Encabezado')
  expect(header).toHaveValue('🌿 **CATÁLOGO** 🌿')
  expect(header.tagName).toBe('TEXTAREA')
  expect(screen.getByLabelText('Pie')).toHaveValue('📩 Consultas y pedidos por privado.')
})

test('saving sends both fields and shows the fixed toast', async () => {
  const fetchMock = serving((body) => jsonResponse(200, { ...CATALOG, ...body }))
  renderGroup(fetchMock)
  await screen.findByLabelText('Encabezado')

  await type('Encabezado', 'Nuevo encabezado')
  await type('Pie', 'Nuevo pie')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá el mensaje' }))

  expect(await screen.findByText('Catálogo guardado')).toBeInTheDocument()
  const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
  expect(JSON.parse(String(put?.[1]?.body))).toEqual({
    header: 'Nuevo encabezado',
    footer: 'Nuevo pie',
  })
})

test('a blank header and footer are saved as they are', async () => {
  const fetchMock = serving((body) => jsonResponse(200, { ...CATALOG, ...body }))
  renderGroup(fetchMock)
  await screen.findByLabelText('Encabezado')

  await userEvent.clear(screen.getByLabelText('Encabezado'))
  await userEvent.clear(screen.getByLabelText('Pie'))
  await userEvent.click(screen.getByRole('button', { name: 'Guardá el mensaje' }))

  expect(await screen.findByText('Catálogo guardado')).toBeInTheDocument()
})

test('a too-long header shows inline and keeps what was typed', async () => {
  renderGroup(serving(() => jsonResponse(422, { code: 'catalog.header_too_long' })))
  await screen.findByLabelText('Encabezado')

  await type('Encabezado', 'demasiado')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá el mensaje' }))

  expect(await screen.findByText('El encabezado es demasiado largo')).toBeInTheDocument()
  expect(screen.getByLabelText('Encabezado')).toHaveValue('demasiado')
  expect(screen.queryByText('Catálogo guardado')).not.toBeInTheDocument()
})

test('a too-long footer shows inline and keeps what was typed', async () => {
  renderGroup(serving(() => jsonResponse(422, { code: 'catalog.footer_too_long' })))
  await screen.findByLabelText('Pie')

  await type('Pie', 'demasiado')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá el mensaje' }))

  expect(await screen.findByText('El pie es demasiado largo')).toBeInTheDocument()
  expect(screen.getByLabelText('Pie')).toHaveValue('demasiado')
})

test('a dropped network shows "Sin conexión" and keeps what was typed', async () => {
  const fetchMock = vi.fn((url: string, init?: RequestInit) =>
    init?.method === 'PUT' && url === '/catalog/header-footer'
      ? Promise.reject(new TypeError('Failed to fetch'))
      : Promise.resolve(jsonResponse(200, CATALOG)),
  )
  renderGroup(fetchMock)
  await screen.findByLabelText('Encabezado')

  await type('Encabezado', 'Nuevo')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá el mensaje' }))

  expect(await screen.findByText(SIN_CONEXION_MENSAJE)).toBeInTheDocument()
  expect(screen.getByLabelText('Encabezado')).toHaveValue('Nuevo')
})

test('an untouched group closes at once', async () => {
  renderGroup(serving())
  await screen.findByLabelText('Encabezado')

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('Lista de grupos')).toBeInTheDocument()
})

test('closing with unsaved changes asks first, and keeping stays on the group', async () => {
  renderGroup(serving())
  await screen.findByLabelText('Encabezado')
  await type('Pie', 'Sin guardar')

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('¿Descartás el mensaje?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'No, seguí editando' }))
  expect(screen.getByLabelText('Pie')).toHaveValue('Sin guardar')
  expect(screen.queryByText('Lista de grupos')).not.toBeInTheDocument()
})

test('discarding leaves the group', async () => {
  renderGroup(serving())
  await screen.findByLabelText('Encabezado')
  await type('Pie', 'Sin guardar')

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Sí, descartalo' }))

  expect(await screen.findByText('Lista de grupos')).toBeInTheDocument()
})

test('after saving, dirty is measured against what the server accepted, not the query cache', async () => {
  const client = renderGroup(
    serving((body) => jsonResponse(200, { ...CATALOG, ...body })),
  )
  await screen.findByLabelText('Encabezado')

  await type('Pie', 'Guardado')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá el mensaje' }))
  await screen.findByText('Catálogo guardado')
  // The cache moves to something else entirely (a refetch, a partner's edit): the group's
  // `accepted` is the PUT answer, so closing is still at once.
  act(() => {
    client.setQueryData(keys.catalog(), { ...CATALOG, header: 'Otro', footer: 'Otro' })
  })
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  await waitFor(() => expect(screen.getByText('Lista de grupos')).toBeInTheDocument())
  expect(screen.queryByText('¿Descartás el mensaje?')).not.toBeInTheDocument()
})

test('after saving, a real change asks again', async () => {
  renderGroup(serving((body) => jsonResponse(200, { ...CATALOG, ...body })))
  await screen.findByLabelText('Encabezado')

  await type('Pie', 'Guardado')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá el mensaje' }))
  await screen.findByText('Catálogo guardado')
  await type('Pie', 'Otra vez')
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('¿Descartás el mensaje?')).toBeInTheDocument()
})

test('the header and footer fields never carry maxLength: the backend counts the 500', async () => {
  renderGroup(serving())
  const header = await screen.findByLabelText('Encabezado')

  expect(header).not.toHaveAttribute('maxlength')
  expect(screen.getByLabelText('Pie')).not.toHaveAttribute('maxlength')
})

test('the group follows the icon and text rule, with a saved header and footer and with none', async () => {
  renderGroup(serving())
  await screen.findByLabelText('Encabezado')
  expectIconAndTextRule(document.body)
})

test('with no varieties and an empty header and footer the group still follows the rule', async () => {
  renderGroup(vi.fn(() => Promise.resolve(jsonResponse(200, { ...CATALOG, header: '', footer: '' }))))
  expect(await screen.findByLabelText('Encabezado')).toHaveValue('')
  expectIconAndTextRule(document.body)
})
