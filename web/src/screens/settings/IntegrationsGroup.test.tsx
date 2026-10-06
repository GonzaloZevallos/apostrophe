/**
 * `IntegrationsGroup` at the screen seam, under a memory data router (the leave guard
 * needs one), with the API faked at `fetch`: the saved token is never shown, Probarlo is
 * the only save, a refusal keeps everything typed, and there is no pin status nor Publicar.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import IntegrationsGroup from './IntegrationsGroup'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const SAVED = {
  token_saved_on: '2026-08-12',
  own_chat: '123456789',
  channel_chat: '@mi_canal',
  can_publish: true,
  publish_blocked_by: null,
  status: { state: 'out_of_date', reason: 'message_gone', last_published_on: '2026-09-29' },
}
const EMPTY = {
  token_saved_on: null,
  own_chat: null,
  channel_chat: null,
  can_publish: false,
  publish_blocked_by: 'not_tested',
  status: null,
}

function renderGroup(
  initial: unknown,
  onTest?: (init: RequestInit) => Response,
  options: { refetchPending?: boolean } = {},
) {
  let reads = 0
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/pinned-catalog/test' && init?.method === 'POST') {
      return Promise.resolve((onTest ?? (() => jsonResponse(200, { ...SAVED, previous_pin_left: false })))(init))
    }
    if (url === '/pinned-catalog') {
      reads += 1
      if (options.refetchPending === true && reads > 1) return new Promise<Response>(() => undefined)
      return Promise.resolve(jsonResponse(200, initial))
    }
    return Promise.resolve(jsonResponse(404, {}))
  })
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter(
    [
      { path: '/settings', element: <h1>Lista</h1> },
      { path: '/varieties/catalog', element: <h1>Catálogo</h1> },
      { path: '/settings/integrations', element: <IntegrationsGroup /> },
    ],
    { initialEntries: ['/settings', { pathname: '/settings/integrations', state: { inApp: true } }], initialIndex: 1 },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('shows the saved token masked with Cambiar and the saved chats', async () => {
  renderGroup(SAVED)

  expect(await screen.findByText('Guardado el 12/08 · no se muestra más')).toBeInTheDocument()
  expect(screen.getByLabelText('Tu chat')).toHaveValue('123456789')
  expect(screen.getByLabelText('Chat del canal')).toHaveValue('@mi_canal')
  await userEvent.click(screen.getByRole('button', { name: 'Cambiar' }))
  expect(screen.getByLabelText('Token del bot')).toHaveValue('')
})

test('an empty business shows empty fields and no "Guardado" line', async () => {
  renderGroup(EMPTY)

  expect(await screen.findByLabelText('Token del bot')).toHaveValue('')
  expect(screen.getByLabelText('Tu chat')).toHaveValue('')
  expect(screen.getByLabelText('Chat del canal')).toHaveValue('')
  expect(screen.queryByText(/Guardado el/)).not.toBeInTheDocument()
})

test('links to the catalog screen, with no pin status and no Publicar', async () => {
  renderGroup(SAVED)

  await screen.findByLabelText('Tu chat')
  expect(screen.getByRole('link', { name: 'Ir al catálogo' })).toHaveAttribute('href', '/varieties/catalog')
  expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument()
  expect(screen.queryByText('Desactualizado')).not.toBeInTheDocument()
  expect(screen.queryByText('Al día')).not.toBeInTheDocument()
})

test('Probarlo saves, clears the token, shows the toast and the "desfijalo" line', async () => {
  const fetchMock = renderGroup(EMPTY, () =>
    jsonResponse(200, { ...SAVED, previous_pin_left: true }),
  )

  await userEvent.type(await screen.findByLabelText('Token del bot'), '123:secret')
  await userEvent.type(screen.getByLabelText('Tu chat'), '123456789')
  await userEvent.click(screen.getByRole('button', { name: 'Probarlo' }))

  expect(await screen.findByText('Prueba enviada')).toBeInTheDocument()
  expect(
    screen.getByText('El mensaje fijado anterior queda como está; desfijalo vos en Telegram.'),
  ).toBeInTheDocument()
  expect(screen.getByText('Guardado el 12/08 · no se muestra más')).toBeInTheDocument()
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
  expect(JSON.parse(call?.[1]?.body as string)).toEqual({
    token: '123:secret',
    own_chat: '123456789',
    channel_chat: null,
  })
  expect(screen.queryByDisplayValue('123:secret')).not.toBeInTheDocument()
})

test('a refused Probarlo saves nothing and keeps everything typed, the token included', async () => {
  renderGroup(EMPTY, () =>
    jsonResponse(422, { detail: 'refused', code: 'pinned_catalog.telegram_unreachable' }),
  )

  await userEvent.type(await screen.findByLabelText('Token del bot'), '123:secret')
  await userEvent.type(screen.getByLabelText('Tu chat'), '555')
  await userEvent.type(screen.getByLabelText('Chat del canal'), '@probando')
  await userEvent.click(screen.getByRole('button', { name: 'Probarlo' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Telegram no respondió')
  expect(screen.queryByText('Prueba enviada')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Token del bot')).toHaveValue('123:secret')
  expect(screen.getByLabelText('Tu chat')).toHaveValue('555')
  expect(screen.getByLabelText('Chat del canal')).toHaveValue('@probando')
  expect(screen.queryByText(/Guardado el/)).not.toBeInTheDocument()
})

test('an untouched group closes at once; a typed change asks first', async () => {
  renderGroup(SAVED)

  await screen.findByLabelText('Tu chat')
  await userEvent.type(screen.getByLabelText('Chat del canal'), 'x')
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('¿Descartás el cambio?')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Lista' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Sí, descartalo' }))
  expect(await screen.findByRole('heading', { name: 'Lista' })).toBeInTheDocument()
})

test('an untouched group closes with no confirmation', async () => {
  renderGroup(SAVED)

  await screen.findByLabelText('Tu chat')
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByRole('heading', { name: 'Lista' })).toBeInTheDocument()
  expect(screen.queryByText('¿Descartás el cambio?')).not.toBeInTheDocument()
})

test('after saving, Cerrar closes at once even while the refetch is pending', async () => {
  renderGroup(EMPTY, undefined, { refetchPending: true })

  await userEvent.type(await screen.findByLabelText('Token del bot'), '123:secret')
  await userEvent.type(screen.getByLabelText('Tu chat'), '123456789')
  await userEvent.click(screen.getByRole('button', { name: 'Probarlo' }))
  await screen.findByText('Prueba enviada')
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByRole('heading', { name: 'Lista' })).toBeInTheDocument()
  expect(screen.queryByText('¿Descartás el cambio?')).not.toBeInTheDocument()
})
