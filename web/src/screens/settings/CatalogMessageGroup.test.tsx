/**
 * `CatalogMessageGroup` at the screen seam (plan, "Mensaje del catálogo"; `catalog.md`): the
 * header and footer, inline refusals that keep what was typed, and the unsaved-changes rule
 * measured against what the server last accepted. The API is faked at `fetch`, never mocked
 * deeper (CODING_STANDARDS §10).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import { SIN_CONEXION_TITULO } from '../../components/SinConexion'
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

function renderGroup(fetchMock: ReturnType<typeof vi.fn>): void {
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter(
    [
      {
        element: <Provide />,
        children: [
          { path: '/settings', element: <div>Lista de grupos</div> },
          { path: '/settings/catalog-message', element: <CatalogMessageGroup /> },
        ],
      },
    ],
    {
      initialEntries: ['/settings', { pathname: '/settings/catalog-message', state: { inApp: true } }],
      initialIndex: 1,
    },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
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

  expect(await screen.findByText(SIN_CONEXION_TITULO)).toBeInTheDocument()
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

test('after saving, "Cerrar" closes at once even while the refetch is pending', async () => {
  let reads = 0
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'PUT' && url === '/catalog/header-footer') {
      const body = JSON.parse(String(init.body)) as { header: string; footer: string }
      return Promise.resolve(jsonResponse(200, { ...CATALOG, ...body }))
    }
    reads += 1
    // The first read answers; any later one (a refetch after the save) never does.
    return reads === 1 ? Promise.resolve(jsonResponse(200, CATALOG)) : new Promise<Response>(() => {})
  })
  renderGroup(fetchMock)
  await screen.findByLabelText('Encabezado')

  await type('Pie', 'Guardado')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá el mensaje' }))
  await screen.findByText('Catálogo guardado')
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  await waitFor(() => expect(screen.getByText('Lista de grupos')).toBeInTheDocument())
  expect(screen.queryByText('¿Descartás el mensaje?')).not.toBeInTheDocument()
})
