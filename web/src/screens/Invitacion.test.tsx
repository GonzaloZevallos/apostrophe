/**
 * `/invitation/:token` at the screen seam: a join invitation shows the business's
 * name and takes only email and password; a new-business one also asks the business
 * name. An unusable invitation shows the fixed "Esta invitación ya no sirve" (plan,
 * "Gone records": the override for `account.invitation_not_usable`), not the generic
 * gone notice. Every mount logs out first, through the backend, before the lookup.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import Invitacion, { NOT_USABLE_TITLE } from './Invitacion'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderInvitacion(token = 'tok123') {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/invitation/${token}`]}>
        <Routes>
          <Route path="/invitation/:token" element={<Invitacion />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('logs out before looking the invitation up, and asks only email and password to join', async () => {
  const calls: string[] = []
  const fetchMock = vi.fn((url: string) => {
    calls.push(String(url))
    if (url === '/auth/logout') return Promise.resolve(new Response(null, { status: 204 }))
    return Promise.resolve(
      jsonResponse(200, {
        kind: 'join_business',
        business_name: 'La Esquina',
        expires_at: '2026-10-09T00:00:00Z',
      }),
    )
  })
  vi.stubGlobal('fetch', fetchMock)

  renderInvitacion()

  expect(await screen.findByText('La Esquina te invitó a sumarte.')).toBeInTheDocument()
  expect(calls).toEqual(['/auth/logout', '/invitations/tok123'])
  expect(screen.queryByLabelText('Nombre del negocio')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Sumarme' })).toBeInTheDocument()
})

test('a new-business invitation also asks for the business name', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/auth/logout') return Promise.resolve(new Response(null, { status: 204 }))
      return Promise.resolve(
        jsonResponse(200, { kind: 'new_business', business_name: null, expires_at: '2026-10-09T00:00:00Z' }),
      )
    }),
  )

  renderInvitacion()

  expect(await screen.findByLabelText('Nombre del negocio')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Crear negocio' })).toBeInTheDocument()
})

test('an unusable invitation shows the fixed notice, not the form', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/auth/logout') return Promise.resolve(new Response(null, { status: 204 }))
      return Promise.resolve(
        jsonResponse(404, { detail: 'gone', code: 'account.invitation_not_usable' }),
      )
    }),
  )

  renderInvitacion()

  expect(await screen.findByText(NOT_USABLE_TITLE)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Sumarme' })).not.toBeInTheDocument()
})
