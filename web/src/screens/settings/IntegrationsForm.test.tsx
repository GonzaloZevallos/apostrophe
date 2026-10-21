/**
 * `IntegrationsForm` at the component seam, with no group chrome and the API faked at
 * `fetch`: a successful Probarlo tells its host (`onSaved`), a failed one shows its reason
 * and tells nobody, and Buscar mi chat marks the form dirty (`onDirtyChange`).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { IntegrationsForm, type PinnedCatalog } from './IntegrationsGroup'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const EMPTY: PinnedCatalog = { token_saved_on: null, own_chat: null, channel_chat: null }
const SAVED = { token_saved_on: '2026-08-12', own_chat: '555', channel_chat: null }

function renderForm(
  testAnswer: Response = jsonResponse(200, { ...SAVED, previous_pin_left: false }),
  initial: PinnedCatalog = EMPTY,
) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/pinned-catalog/test' && init?.method === 'POST') return Promise.resolve(testAnswer)
      if (url === '/pinned-catalog/own-chat-lookup' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse(200, { own_chat: '777' }))
      }
      return Promise.resolve(jsonResponse(404, {}))
    }),
  )
  const onSaved = vi.fn()
  const onDirtyChange = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <IntegrationsForm
        initial={initial}
        onSaved={onSaved}
        onDirtyChange={onDirtyChange}
        showCatalogLink={false}
      />
    </QueryClientProvider>,
  )
  return { onSaved, onDirtyChange }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('a successful Probarlo calls onSaved', async () => {
  const { onSaved } = renderForm()

  await userEvent.type(screen.getByLabelText('Bot token'), '123:secret')
  await userEvent.type(screen.getByLabelText('Your chat'), '555')
  await userEvent.click(screen.getByRole('button', { name: 'Test it' }))

  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  expect(await screen.findByText('Test sent')).toBeInTheDocument()
})

test('a failed Probarlo shows its reason and does not call onSaved', async () => {
  const { onSaved } = renderForm(
    jsonResponse(422, { detail: 'refused', code: 'pinned_catalog.telegram_unreachable' }),
  )

  await userEvent.type(screen.getByLabelText('Bot token'), '123:secret')
  await userEvent.type(screen.getByLabelText('Your chat'), '555')
  await userEvent.click(screen.getByRole('button', { name: 'Test it' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Telegram did not respond')
  expect(onSaved).not.toHaveBeenCalled()
})

test('Buscar mi chat marks the form dirty', async () => {
  // A saved token enables the lookup with nothing typed: the looked-up chat is the only change.
  const { onDirtyChange } = renderForm(undefined, { ...EMPTY, token_saved_on: '2026-08-12' })
  expect(screen.getByLabelText('Your chat')).toHaveValue('')
  expect(onDirtyChange).toHaveBeenLastCalledWith(false)

  await userEvent.click(screen.getByRole('button', { name: 'Find my chat' }))

  await waitFor(() => expect(screen.getByLabelText('Your chat')).toHaveValue('777'))
  expect(onDirtyChange).toHaveBeenLastCalledWith(true)
})

test('the catalog link is the host\'s to show', () => {
  renderForm()

  expect(screen.queryByRole('link', { name: 'Go to the catalog' })).not.toBeInTheDocument()
})
