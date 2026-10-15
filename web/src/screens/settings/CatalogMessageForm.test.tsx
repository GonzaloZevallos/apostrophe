/**
 * `CatalogMessageForm` at the component seam: the header and footer form body that Configuración
 * and the Onboarding both draw. It saves through the owner's route, tells its host when a save
 * went through (`onSaved`) and when what is typed differs from what the server last accepted
 * (`onDirtyChange`). The API is faked at `fetch` (CODING_STANDARDS §10).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import CatalogMessageForm from './CatalogMessageForm'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
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

interface Sent {
  header: string
  footer: string
}

function renderForm(put?: (body: Sent) => Response) {
  const puts: Sent[] = []
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'PUT' && url === '/catalog/header-footer' && put !== undefined) {
      const body = JSON.parse(String(init.body)) as Sent
      puts.push(body)
      return Promise.resolve(put(body))
    }
    return Promise.resolve(jsonResponse(200, CATALOG))
  })
  vi.stubGlobal('fetch', fetchMock)
  const onSaved = vi.fn()
  const onDirtyChange = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CatalogMessageForm onSaved={onSaved} onDirtyChange={onDirtyChange} />
    </QueryClientProvider>,
  )
  return { puts, onSaved, onDirtyChange }
}

test('saves through the owner route, calls onSaved and shows the toast', async () => {
  const { puts, onSaved } = renderForm((body) => jsonResponse(200, { ...CATALOG, ...body }))

  const header = await screen.findByLabelText('Encabezado')
  await userEvent.clear(header)
  await userEvent.type(header, 'Hola')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá el mensaje' }))

  expect(await screen.findByText('Catálogo guardado')).toBeInTheDocument()
  expect(puts).toEqual([{ header: 'Hola', footer: CATALOG.footer }])
  expect(onSaved).toHaveBeenCalledTimes(1)
})

test('reports dirty while the fields differ from what the server accepted, and clean after a save', async () => {
  const { onDirtyChange } = renderForm((body) => jsonResponse(200, { ...CATALOG, ...body }))

  const footer = await screen.findByLabelText('Pie')
  expect(onDirtyChange).toHaveBeenLastCalledWith(false)

  await userEvent.type(footer, '!')
  await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true))

  await userEvent.click(screen.getByRole('button', { name: 'Guardá el mensaje' }))
  await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false))
})

test('a refusal shows inline, keeps what was typed and does not call onSaved', async () => {
  const { onSaved, onDirtyChange } = renderForm(() =>
    jsonResponse(422, { code: 'catalog.header_too_long' }),
  )

  const header = await screen.findByLabelText('Encabezado')
  await userEvent.type(header, ' de más')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá el mensaje' }))

  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(header).toHaveValue(`${CATALOG.header} de más`)
  expect(onSaved).not.toHaveBeenCalled()
  expect(onDirtyChange).toHaveBeenLastCalledWith(true)
})
