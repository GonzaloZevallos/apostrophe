/**
 * `/reset/:token` at the screen seam (plan, "Reset"): every mount logs out first,
 * through the backend, before the lookup — exactly like `Invitacion`. A live link
 * shows the one-field form; a dead link (open or submit) shows the fixed
 * dead-link notice, never the generic gone notice, and keeps nothing typed. The
 * API is faked at `fetch`.
 */

import { HOME, LOGIN, RESET, pathTo } from '../routes'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { expectIconAndTextRule } from '../test/iconAndTextRule'
import Reset from './Reset'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function noContent(): Response {
  return new Response(null, { status: 204 })
}

function renderReset(token = 'tok123') {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[pathTo(RESET, { token })]}>
        <Routes>
          <Route path={RESET} element={<Reset />} />
          <Route path={HOME} element={<div>Pantalla de inicio</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('logs out before looking the link up, then shows the one-field form', async () => {
  const calls: string[] = []
  const fetchMock = vi.fn((url: string) => {
    calls.push(String(url))
    if (url === '/auth/logout') return Promise.resolve(noContent())
    return Promise.resolve(noContent())
  })
  vi.stubGlobal('fetch', fetchMock)

  renderReset()

  expect(await screen.findByText('Choose your new password')).toBeInTheDocument()
  expect(calls).toEqual(['/auth/logout', '/reset-links/tok123'])
  expect(screen.getByRole('button', { name: 'Save and sign in' })).toBeInTheDocument()
})

test('while the lookup is pending it shows the Cargando progressbar and no form', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/auth/logout') return Promise.resolve(noContent())
      return new Promise<Response>(() => {})
    }),
  )

  renderReset()

  expect(await screen.findByRole('progressbar', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Save and sign in' })).not.toBeInTheDocument()
})

test('the dead link offers a router link to Log in, not a page reload', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/auth/logout') return Promise.resolve(noContent())
      return Promise.resolve(jsonResponse(404, { detail: 'gone', code: 'account.reset_link_gone' }))
    }),
  )

  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[pathTo(RESET, { token: 'tok123' })]}>
        <Routes>
          <Route path={RESET} element={<Reset />} />
          <Route path={LOGIN} element={<div>Pantalla de entrar</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

  await screen.findByText('This link no longer works. Ask whoever sent it for a new one.')
  // "Log in" is a link kind drawn by BotonLink, never a raw action-styled link.
  expect(screen.getByRole('link', { name: 'Log in' })).toHaveClass('boton--enlace')
  expectIconAndTextRule(document.body)
  const user = userEvent.setup()
  await user.click(screen.getByRole('link', { name: 'Log in' }))
  expect(await screen.findByText('Pantalla de entrar')).toBeInTheDocument()
})

test('a dead link on open shows the fixed notice, never the form', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/auth/logout') return Promise.resolve(noContent())
      return Promise.resolve(jsonResponse(404, { detail: 'gone', code: 'account.reset_link_gone' }))
    }),
  )

  renderReset()

  expect(await screen.findByText('This link no longer works. Ask whoever sent it for a new one.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Save and sign in' })).not.toBeInTheDocument()
})

test('submitting a live link signs the device in and lands on Inicio, with no toast', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/auth/logout') return Promise.resolve(noContent())
      if (url === '/reset-links/tok123' && init?.method === 'GET') return Promise.resolve(noContent())
      if (url === '/reset-links/tok123' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse(200, { token: 'tok' }))
      }
      throw new Error(`unexpected request: ${url}`)
    }),
  )

  renderReset()

  await userEvent.type(await screen.findByLabelText('New password'), 'nuevaclave123')
  await userEvent.click(screen.getByRole('button', { name: 'Save and sign in' }))

  expect(await screen.findByText('Pantalla de inicio')).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('a short new password shows the invitation\'s own too-short text, keeping it typed', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/auth/logout') return Promise.resolve(noContent())
      if (init?.method === 'POST') {
        return Promise.resolve(jsonResponse(422, { detail: 'short', code: 'account.password_weak' }))
      }
      return Promise.resolve(noContent())
    }),
  )

  renderReset()

  const field = await screen.findByLabelText('New password')
  await userEvent.type(field, 'corta')
  await userEvent.click(screen.getByRole('button', { name: 'Save and sign in' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('The password must have at least 10 characters')
  expect(field).toHaveValue('corta')
})

test('a link that goes stale between opening and submitting answers the same dead-link state', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/auth/logout') return Promise.resolve(noContent())
      if (init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(404, { detail: 'gone', code: 'account.reset_link_gone' }),
        )
      }
      return Promise.resolve(noContent())
    }),
  )

  renderReset()

  await userEvent.type(await screen.findByLabelText('New password'), 'nuevaclave123')
  await userEvent.click(screen.getByRole('button', { name: 'Save and sign in' }))

  expect(await screen.findByText('This link no longer works. Ask whoever sent it for a new one.')).toBeInTheDocument()
})

test('the reveal control toggles the field between hidden and shown', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/auth/logout') return Promise.resolve(noContent())
      return Promise.resolve(noContent())
    }),
  )

  renderReset()

  const field = await screen.findByLabelText('New password')
  expect(field).toHaveAttribute('type', 'password')

  await userEvent.click(screen.getByRole('button', { name: 'Show' }))
  expect(field).toHaveAttribute('type', 'text')
})
