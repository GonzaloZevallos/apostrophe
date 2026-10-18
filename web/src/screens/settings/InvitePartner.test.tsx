/**
 * `InvitePartner` at the component seam (the Onboarding's "partner" step reuses it): one tap
 * is one `POST /invitations`, the link shows on screen, `onLinkCreated` fires, and the token
 * reaches neither the console nor browser storage. The API is faked at `fetch`.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import InvitePartner from './InvitePartner'

vi.mock('../../clipboard', () => ({ copyText: vi.fn().mockResolvedValue(true) }))

const LINK_URL = 'https://apostrophe.app/invitation/secret-token-123'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
  sessionStorage.clear()
})

test('a tap creates one link through the route and tells the parent', async () => {
  const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve(jsonResponse(201, { url: LINK_URL, expires_at: '2026-10-09T00:00:00Z' })),
  )
  vi.stubGlobal('fetch', fetchMock)
  const onLinkCreated = vi.fn()
  render(<InvitePartner onLinkCreated={onLinkCreated} />)

  await userEvent.click(screen.getByRole('button', { name: 'Invite a partner' }))

  expect(await screen.findByText(LINK_URL)).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0]?.[0]).toBe('/invitations')
  expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' })
  expect(onLinkCreated).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('Invitation ready')).not.toBeInTheDocument()
})

test('a failed tap does not tell the parent a link was created', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network error')))
  const onLinkCreated = vi.fn()
  render(<InvitePartner onLinkCreated={onLinkCreated} />)

  await userEvent.click(screen.getByRole('button', { name: 'Invite a partner' }))

  expect(await screen.findByText('No connection: check your internet and try again.')).toBeInTheDocument()
  expect(onLinkCreated).not.toHaveBeenCalled()
})

test('the token goes to no console and no browser storage', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(jsonResponse(201, { url: LINK_URL, expires_at: '2026-10-09T00:00:00Z' })),
  )
  const spies = [
    vi.spyOn(console, 'log'),
    vi.spyOn(console, 'info'),
    vi.spyOn(console, 'warn'),
    vi.spyOn(console, 'error'),
    vi.spyOn(console, 'debug'),
  ]
  render(<InvitePartner onLinkCreated={() => undefined} />)

  await userEvent.click(screen.getByRole('button', { name: 'Invite a partner' }))
  await screen.findByText(LINK_URL)

  for (const spy of spies) {
    expect(JSON.stringify(spy.mock.calls)).not.toContain('secret-token-123')
  }
  expect(JSON.stringify({ ...localStorage })).not.toContain('secret-token-123')
  expect(JSON.stringify({ ...sessionStorage })).not.toContain('secret-token-123')
})

test('with its own action the button says that word and still creates the link through the same route', async () => {
  const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve(jsonResponse(201, { url: LINK_URL, expires_at: '2026-10-09T00:00:00Z' })),
  )
  vi.stubGlobal('fetch', fetchMock)
  render(<InvitePartner onLinkCreated={() => undefined} action={{ label: 'Crear el link', variant: 'primary' }} />)

  expect(screen.queryByRole('button', { name: 'Invite a partner' })).not.toBeInTheDocument()
  const button = screen.getByRole('button', { name: 'Crear el link' })
  expect(button).toHaveClass('boton')
  expect(button).not.toHaveClass('boton--suave')
  await userEvent.click(button)

  expect(await screen.findByText(LINK_URL)).toBeInTheDocument()
  expect(fetchMock.mock.calls[0]?.[0]).toBe('/invitations')
})

test('with no action it renders today\'s soft "Invite a partner"', () => {
  render(<InvitePartner onLinkCreated={() => undefined} />)
  const button = screen.getByRole('button', { name: 'Invite a partner' })
  expect(button).toHaveClass('boton--suave')
})
