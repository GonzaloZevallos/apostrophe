/**
 * `/invitation/:token` at the screen seam: a join invitation shows the business's
 * name and takes only email and password; a new-business one also asks the business
 * name — both in the design's own words. An unusable invitation shows the fixed
 * "Esta invitación ya no sirve" (plan, "Gone records": the override for
 * `account.invitation_not_usable`), not the generic gone notice. Every mount logs out
 * first, through the backend, before the lookup. Every other refusal on accept is
 * dispatched through `refusals.ts`, never a raw code comparison.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import Invitacion, {
  EMAIL_INVALID_MESSAGE,
  GENERIC_REFUSAL_MESSAGE,
  NOT_USABLE_TITLE,
  RETRY_MESSAGE,
} from './Invitacion'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function noContent(): Response {
  return new Response(null, { status: 204 })
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
    if (url === '/auth/logout') return Promise.resolve(noContent())
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

  expect(await screen.findByText('La Esquina')).toBeInTheDocument()
  expect(screen.getByText('Te invitaron a')).toBeInTheDocument()
  expect(
    screen.getByText(
      'Creá tu usuario y vas a ver las ventas, el stock y los clientes de este negocio. Sólo de este.',
    ),
  ).toBeInTheDocument()
  expect(calls).toEqual(['/auth/logout', '/invitations/tok123'])
  expect(screen.queryByLabelText('Nombre del negocio')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Sumate a La Esquina' })).toBeInTheDocument()
  expect(screen.getByText('Esta invitación vence el 09/10 y se usa una sola vez.')).toBeInTheDocument()
})

test('a new-business invitation also asks for the business name, in the design\'s own words', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/auth/logout') return Promise.resolve(noContent())
      return Promise.resolve(
        jsonResponse(200, { kind: 'new_business', business_name: null, expires_at: '2026-10-09T00:00:00Z' }),
      )
    }),
  )

  renderInvitacion()

  expect(await screen.findByText('Invitación válida')).toBeInTheDocument()
  expect(screen.getByText('Armá tu negocio')).toBeInTheDocument()
  expect(
    screen.getByText('Ponele un nombre y creá tu usuario. Después podés invitar a un socio.'),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Nombre del negocio')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Creá el negocio' })).toBeInTheDocument()
  expect(screen.getByText('La invitación se usa una sola vez y vence el 09/10.')).toBeInTheDocument()
})

test('an unusable invitation shows the fixed notice, not the form', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/auth/logout') return Promise.resolve(noContent())
      return Promise.resolve(
        jsonResponse(404, { detail: 'gone', code: 'account.invitation_not_usable' }),
      )
    }),
  )

  renderInvitacion()

  expect(await screen.findByText(NOT_USABLE_TITLE)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Sumate a/ })).not.toBeInTheDocument()
})

test('a refusal named by the contract (account.email_invalid) shows its own inline message', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/auth/logout') return Promise.resolve(noContent())
      if (url === '/invitations/tok123') {
        return Promise.resolve(
          jsonResponse(200, {
            kind: 'join_business',
            business_name: 'La Esquina',
            expires_at: '2026-10-09T00:00:00Z',
          }),
        )
      }
      if (init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(422, { detail: 'not an email', code: 'account.email_invalid' }),
        )
      }
      throw new Error(`unexpected request: ${url}`)
    }),
  )

  renderInvitacion()

  // Uppercase still passes the input's own `type="email"` constraint validation; the
  // backend's stricter rule (lowercased, trimmed) is what actually refuses it.
  await userEvent.type(await screen.findByLabelText('Email'), 'ANA@X.COM')
  await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta123')
  await userEvent.click(screen.getByRole('button', { name: 'Sumate a La Esquina' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(EMAIL_INVALID_MESSAGE)
})

test('an unmapped refusal (RequestInvalid) shows the generic inline message, never the retry banner', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/auth/logout') return Promise.resolve(noContent())
      if (url === '/invitations/tok123') {
        return Promise.resolve(
          jsonResponse(200, {
            kind: 'join_business',
            business_name: 'La Esquina',
            expires_at: '2026-10-09T00:00:00Z',
          }),
        )
      }
      if (init?.method === 'POST') {
        return Promise.resolve(jsonResponse(422, { detail: 'bad request', code: 'RequestInvalid' }))
      }
      throw new Error(`unexpected request: ${url}`)
    }),
  )

  renderInvitacion()

  await userEvent.type(await screen.findByLabelText('Email'), 'ana@x.com')
  await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta123')
  await userEvent.click(screen.getByRole('button', { name: 'Sumate a La Esquina' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_REFUSAL_MESSAGE)
})

test('a server error on accepting shows the generic retry, never a refusal', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/auth/logout') return Promise.resolve(noContent())
      if (url === '/invitations/tok123') {
        return Promise.resolve(
          jsonResponse(200, {
            kind: 'join_business',
            business_name: 'La Esquina',
            expires_at: '2026-10-09T00:00:00Z',
          }),
        )
      }
      if (init?.method === 'POST') {
        return Promise.resolve(new Response('internal error', { status: 500 }))
      }
      throw new Error(`unexpected request: ${url}`)
    }),
  )

  renderInvitacion()

  await userEvent.type(await screen.findByLabelText('Email'), 'ana@x.com')
  await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta123')
  await userEvent.click(screen.getByRole('button', { name: 'Sumate a La Esquina' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(RETRY_MESSAGE)
})

test('a server error on the lookup itself shows the generic retry, not a refusal', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/auth/logout') return Promise.resolve(noContent())
      return Promise.resolve(new Response('internal error', { status: 500 }))
    }),
  )

  renderInvitacion()

  expect(await screen.findByText(RETRY_MESSAGE)).toBeInTheDocument()
  expect(screen.queryByText(GENERIC_REFUSAL_MESSAGE)).not.toBeInTheDocument()
})

test('shows the Cargando progressbar, and no text of its own, while the lookup is pending', () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)))
  renderInvitacion()

  expect(screen.getByRole('progressbar', { name: 'Cargando' })).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})

async function acceptAs(kind: 'new_business' | 'join_business'): Promise<void> {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/auth/logout') return Promise.resolve(noContent())
      if (url.endsWith('/accept')) return Promise.resolve(jsonResponse(200, {}))
      return Promise.resolve(
        jsonResponse(200, {
          kind,
          business_name: kind === 'join_business' ? 'La Esquina' : null,
          expires_at: '2026-10-09T00:00:00Z',
        }),
      )
    }),
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/invitation/tok123']}>
        <Routes>
          <Route path="/invitation/:token" element={<Invitacion />} />
          <Route index element={<span>pantalla inicio</span>} />
          <Route path="/onboarding" element={<span>pantalla onboarding</span>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await userEvent.type(await screen.findByLabelText('Email'), 'ana@x.com')
  await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta123')
  if (kind === 'new_business') await userEvent.type(screen.getByLabelText('Nombre del negocio'), 'La Huerta')
  await userEvent.click(screen.getByRole('button', { name: /Creá el negocio|Sumate a/ }))
}

test('accepting a new-business invitation lands in the Onboarding', async () => {
  await acceptAs('new_business')

  expect(await screen.findByText('pantalla onboarding')).toBeInTheDocument()
})

test('accepting a join invitation still lands on Inicio', async () => {
  await acceptAs('join_business')

  expect(await screen.findByText('pantalla inicio')).toBeInTheDocument()
})
