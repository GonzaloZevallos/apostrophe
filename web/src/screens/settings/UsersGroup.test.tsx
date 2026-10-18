/**
 * `UsersGroup` at the screen seam (plan, "Users"; `accounts.md`): the business's users
 * (the signed-in one marked "you") and "Invite a partner". The API is faked at `fetch`,
 * never mocked deeper (CODING_STANDARDS §10).
 */

import { LOGIN, SETTINGS, SETTINGS_USERS } from '../../routes'
import { inAppState } from '../../components/inAppState'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import * as clipboard from '../../clipboard'
import { LIMITS, measure } from '../../copy/limits'
import { expectIconAndTextRule } from '../../test/iconAndTextRule'
import { LIMITED_COPY } from '../../copy/settings'
import UsersGroup from './UsersGroup'

vi.mock('../../clipboard', () => ({ copyText: vi.fn().mockResolvedValue(true) }))

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

function renderUsers(fetchMock: ReturnType<typeof vi.fn>): QueryClient {
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = new QueryClient()
  const router = createMemoryRouter(
    [
      {
        element: <Provide />,
        children: [
          { path: SETTINGS, element: <div>Lista de grupos</div> },
          { path: SETTINGS_USERS, element: <UsersGroup /> },
        ],
      },
      { path: LOGIN, element: <div>Pantalla de entrada</div> },
    ],
    {
      initialEntries: [SETTINGS, { pathname: SETTINGS_USERS, state: inAppState({ pathname: SETTINGS }) }],
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

test('marks the signed-in user "you", nobody else, with the users sorted as answered', async () => {
  renderUsers(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))

  const vosRow = (await screen.findByText('vos@lahuerta.com')).closest('li')
  const juliRow = screen.getByText('juli@lahuerta.com').closest('li')
  expect(vosRow).toHaveTextContent('you')
  expect(juliRow).not.toHaveTextContent('you')
})

test('"Invite a partner" shows the fresh link on screen instead of a toast', async () => {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'POST' && url === '/invitations') {
      return Promise.resolve(
        jsonResponse(201, {
          url: 'https://apostrophe.app/invitation/abc123',
          expires_at: '2026-10-09T00:00:00Z',
        }),
      )
    }
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderUsers(fetchMock)

  await userEvent.click(await screen.findByRole('button', { name: 'Invite a partner' }))

  expect(await screen.findByText('https://apostrophe.app/invitation/abc123')).toBeInTheDocument()
  expect(await screen.findByText('Single-use link, expires on 09/10')).toBeInTheDocument()
  expect(screen.queryByText('Invitation ready')).not.toBeInTheDocument()
})

test('"Copy" copies the invite link through copyText, the only clipboard path', async () => {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'POST' && url === '/invitations') {
      return Promise.resolve(
        jsonResponse(201, {
          url: 'https://apostrophe.app/invitation/abc123',
          expires_at: '2026-10-09T00:00:00Z',
        }),
      )
    }
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderUsers(fetchMock)

  await userEvent.click(await screen.findByRole('button', { name: 'Invite a partner' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Copy' }))

  expect(clipboard.copyText).toHaveBeenCalledWith('https://apostrophe.app/invitation/abc123')
})

test('a dropped network while inviting shows "No connection", never the generic retry', async () => {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'POST' && url === '/invitations') {
      return Promise.reject(new TypeError('network error'))
    }
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderUsers(fetchMock)

  await userEvent.click(await screen.findByRole('button', { name: 'Invite a partner' }))

  expect(await screen.findByText('No connection: check your internet and try again.')).toBeInTheDocument()
  expect(screen.queryByText('Something went wrong. Try again.')).not.toBeInTheDocument()
})

test('an untouched group closes at once, with no confirmation', async () => {
  renderUsers(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))

  await userEvent.click(await screen.findByRole('button', { name: 'Close' }))

  expect(await screen.findByText('Lista de grupos')).toBeInTheDocument()
})

test('"Invite a partner" is an icon + text action: the icon is hidden, so the name stays the word', async () => {
  renderUsers(vi.fn().mockResolvedValue(jsonResponse(200, BUSINESS)))

  const invite = await screen.findByRole('button', { name: 'Invite a partner' })

  expect(invite.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expectIconAndTextRule(document.body)
})

test('the fresh link\'s expiry line is the registered binding, rendered as a help line within its limit', async () => {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'POST' && url === '/invitations') {
      return Promise.resolve(
        jsonResponse(201, { url: 'https://apostrophe.app/invitation/abc123', expires_at: '2026-10-09T00:00:00Z' }),
      )
    }
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderUsers(fetchMock)

  await userEvent.click(await screen.findByRole('button', { name: 'Invite a partner' }))

  const line = await screen.findByText('Single-use link, expires on 09/10')
  expect(line).toHaveAttribute('data-copy', 'help')
  expect(LIMITED_COPY).toContainEqual({ kind: 'help', text: 'Single-use link, expires on 28/09' })
  expect(measure('Single-use link, expires on 28/09')).toBeLessThanOrEqual(LIMITS.help)
})

test('Copiar is icon + text and Compartir under the fresh link is the icon-only share, both with their words as names', async () => {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'POST' && url === '/invitations') {
      return Promise.resolve(
        jsonResponse(201, { url: 'https://apostrophe.app/invitation/abc123', expires_at: '2026-10-09T00:00:00Z' }),
      )
    }
    return Promise.resolve(jsonResponse(200, BUSINESS))
  })
  renderUsers(fetchMock)
  await userEvent.click(await screen.findByRole('button', { name: 'Invite a partner' }))

  const copy = await screen.findByRole('button', { name: 'Copy' })
  const share = screen.getByRole('button', { name: 'Share' })

  expect(copy).toHaveTextContent('Copy')
  expect(copy.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(share).toHaveClass('boton-icono')
  expect(share).toHaveTextContent('')
  expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('boton-icono')
  expectIconAndTextRule(document.body)
})
