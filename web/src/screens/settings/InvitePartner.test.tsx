/**
 * `InvitePartner` at the component seam (the Onboarding's "partner" step reuses it): one tap
 * is one `POST /invitations`, the link shows on screen, `onLinkCreated` fires, and the token
 * reaches neither the console nor browser storage. The API is faked at `fetch`.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { SIN_CONEXION_MENSAJE } from '../../copy/common'
import * as clipboard from '../../clipboard'
import * as share from '../../share'
import InvitePartner from './InvitePartner'

vi.mock('../../clipboard', () => ({ copyText: vi.fn().mockResolvedValue(true) }))
vi.mock('../../share', () => ({
  canShare: () => true,
  shareText: vi.fn(),
}))

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
  expect(screen.queryByText('Invitación lista')).not.toBeInTheDocument()
})

test('a failed tap does not tell the parent a link was created', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network error')))
  const onLinkCreated = vi.fn()
  render(<InvitePartner onLinkCreated={onLinkCreated} />)

  await userEvent.click(screen.getByRole('button', { name: 'Invite a partner' }))

  expect(await screen.findByText(SIN_CONEXION_MENSAJE)).toBeInTheDocument()
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
  render(<InvitePartner onLinkCreated={() => undefined} action={{ label: 'Create the link', variant: 'primary' }} />)

  expect(screen.queryByRole('button', { name: 'Invitá a un socio' })).not.toBeInTheDocument()
  const button = screen.getByRole('button', { name: 'Create the link' })
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

async function renderWithLink(): Promise<void> {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(jsonResponse(201, { url: LINK_URL, expires_at: '2026-10-09T00:00:00Z' })),
  )
  render(<InvitePartner onLinkCreated={() => undefined} />)
  await userEvent.click(screen.getByRole('button', { name: 'Invite a partner' }))
  await screen.findByText(LINK_URL)
}

test('a share that never settles holds nothing: Copy, Share again and the invite button all work', async () => {
  vi.mocked(share.shareText).mockReturnValueOnce(new Promise(() => {})).mockReturnValueOnce(new Promise(() => {}))
  await renderWithLink()

  await userEvent.click(screen.getByRole('button', { name: 'Share' }))
  await userEvent.click(screen.getByRole('button', { name: 'Copy' }))
  await userEvent.click(screen.getByRole('button', { name: 'Share' }))

  expect(share.shareText).toHaveBeenCalledTimes(2)
  expect(vi.mocked(share.shareText).mock.calls.map(([text]) => text)).toEqual([LINK_URL, LINK_URL])
  expect(clipboard.copyText).toHaveBeenCalledWith(LINK_URL)
  expect(screen.getByRole('button', { name: 'Invite a partner' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Share' })).toBeEnabled()
})

test.each(['failed', 'cancelled'] as const)('a share that resolves %s shows nothing new', async (outcome) => {
  vi.mocked(share.shareText).mockResolvedValueOnce(outcome)
  await renderWithLink()
  const before = document.body.innerHTML

  await userEvent.click(screen.getByRole('button', { name: 'Share' }))

  expect(share.shareText).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(document.body.innerHTML).toBe(before)
})
