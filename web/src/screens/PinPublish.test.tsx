/**
 * `PinPublish` at the screen seam: Publicar's disabled reason and the link to Integraciones
 * come only from `publish_blocked_by`; the status line never shows the link and never
 * disables Publicar. The API is faked at `fetch`.
 */

import { SETTINGS_INTEGRATIONS } from '../routes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { PINNED_CATALOG_REASON_LABEL } from '../api/refusals'
import { measure } from '../copy/limits'
import PinPublish from './PinPublish'
import {
  INTEGRATIONS_LINK_WORD,
  LIMITED_COPY,
  NOT_READY_LINE,
  CHANNEL_MISSING_LINE,
} from './pinPublishMessages'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const UP_TO_DATE = { state: 'up_to_date', reason: null, last_published_on: '2026-09-29' }

function renderPin(
  pinned: unknown,
  overrides?: (url: string, init?: RequestInit) => Response | undefined,
) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) =>
    Promise.resolve(overrides?.(url, init) ?? jsonResponse(200, pinned)),
  )
  vi.stubGlobal('fetch', fetchMock)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <PinPublish />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('not_tested disables Publicar, says why and links to Integraciones', async () => {
  renderPin({ can_publish: false, publish_blocked_by: 'not_tested', status: null })

  expect(await screen.findByRole('button', { name: 'Publicar' })).toBeDisabled()
  expect(screen.getByText(/Probalo primero para ver cómo queda/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Integraciones' })).toHaveAttribute(
    'href',
    SETTINGS_INTEGRATIONS,
  )
})

test('channel_missing disables Publicar, says the channel is missing and links to Integraciones', async () => {
  renderPin({ can_publish: false, publish_blocked_by: 'channel_missing', status: null })

  expect(await screen.findByRole('button', { name: 'Publicar' })).toBeDisabled()
  expect(screen.getByText(/Falta el canal: cargalo en/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Integraciones' })).toHaveAttribute(
    'href',
    SETTINGS_INTEGRATIONS,
  )
})

test('null enables Publicar and shows neither reason nor link', async () => {
  renderPin({ can_publish: true, publish_blocked_by: null, status: UP_TO_DATE })

  expect(await screen.findByRole('button', { name: 'Publicar' })).toBeEnabled()
  expect(screen.queryByRole('link', { name: 'Integraciones' })).not.toBeInTheDocument()
  expect(screen.queryByText(/Probalo primero/)).not.toBeInTheDocument()
  expect(screen.getByText('Al día')).toBeInTheDocument()
  expect(screen.getByText(/El último fue el 29\/09/)).toBeInTheDocument()
})

test.each([
  ['telegram_unreachable', 'Telegram no respondió'],
  ['bot_cannot_post', 'El bot no puede publicar en el canal'],
  ['message_gone', 'El mensaje fijado ya no está: publicalo de nuevo'],
  ['missing_publish', 'Falta publicarlo con el bot o el canal nuevo'],
  ['too_long', 'Es demasiado largo para Telegram: acortá aromas u ocultá variedades.'],
] as const)(
  'Desactualizado for %s reads its reason, shows no link and keeps Publicar enabled',
  async (reason, text) => {
    renderPin({
      can_publish: true,
      publish_blocked_by: null,
      status: { state: 'out_of_date', reason, last_published_on: '2026-09-29' },
    })

    expect(await screen.findByText('Desactualizado')).toBeInTheDocument()
    expect(screen.getByText(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Integraciones' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeEnabled()
  },
)

test('missing_publish shows no "El último fue" line', async () => {
  renderPin({
    can_publish: true,
    publish_blocked_by: null,
    status: { state: 'out_of_date', reason: 'missing_publish', last_published_on: null },
  })

  expect(await screen.findByText('Desactualizado')).toBeInTheDocument()
  expect(screen.queryByText(/El último fue/)).not.toBeInTheDocument()
})

test('Publicar on success shows "Catálogo publicado" and refetches the status', async () => {
  const fetchMock = renderPin(
    { can_publish: true, publish_blocked_by: null, status: UP_TO_DATE },
    (url, init) =>
      url === '/pinned-catalog/publish' && init?.method === 'POST'
        ? jsonResponse(200, { can_publish: true, publish_blocked_by: null, status: UP_TO_DATE })
        : undefined,
  )

  await userEvent.click(await screen.findByRole('button', { name: 'Publicar' }))

  expect(await screen.findByText('Catálogo publicado')).toBeInTheDocument()
  const gets = fetchMock.mock.calls.filter(([url, init]) => url === '/pinned-catalog' && init?.method !== 'POST')
  expect(gets.length).toBeGreaterThanOrEqual(2)
})

test('a failed Publicar shows its fixed reason', async () => {
  renderPin({ can_publish: true, publish_blocked_by: null, status: UP_TO_DATE }, (url, init) =>
    url === '/pinned-catalog/publish' && init?.method === 'POST'
      ? jsonResponse(422, { detail: 'refused', code: 'pinned_catalog.bot_cannot_post' })
      : undefined,
  )

  await userEvent.click(await screen.findByRole('button', { name: 'Publicar' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('El bot no puede publicar en el canal')
})

test('the blocked lines and the out-of-date reasons are the registered, measured bindings', async () => {
  renderPin({ can_publish: false, publish_blocked_by: 'not_tested', status: null })
  await screen.findByRole('button', { name: 'Publicar' })
  expect(screen.getByText(/Probalo primero/).textContent).toBe(NOT_READY_LINE)

  const registered = LIMITED_COPY.map((entry) => entry.text)
  expect(registered).toContain(NOT_READY_LINE)
  expect(registered).toContain(CHANNEL_MISSING_LINE)
  for (const reason of Object.values(PINNED_CATALOG_REASON_LABEL)) {
    expect(registered).toContain(reason)
  }
  for (const entry of LIMITED_COPY) expect(measure(entry.text)).toBeLessThanOrEqual(80)
  expect(INTEGRATIONS_LINK_WORD).toBe('Integraciones')
})

test('channel_missing renders the registered line, link word included', async () => {
  renderPin({ can_publish: false, publish_blocked_by: 'channel_missing', status: null })
  await screen.findByRole('button', { name: 'Publicar' })
  expect(screen.getByText(/Falta el canal/).textContent).toBe(CHANNEL_MISSING_LINE)
})

test('the out-of-date status shows its registered reason', async () => {
  renderPin({
    can_publish: true,
    publish_blocked_by: null,
    status: { state: 'out_of_date', reason: 'bot_cannot_post', last_published_on: null },
  })
  expect(await screen.findByText(/Desactualizado/)).toBeInTheDocument()
  expect(screen.getByText(new RegExp(PINNED_CATALOG_REASON_LABEL.bot_cannot_post))).toBeInTheDocument()
})
