/**
 * `PartnerStep` at the component seam (Testing Library, `fetch` faked): the primary
 * "Crear el link" is the one action (one `POST /invitations` per tap), and "Seguir" waits
 * for a link or an already-done step, then sends the `partner` pass.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { HOME } from '../../routes'
import type { Me } from '../../api/me'
import type { OnboardingProgress, StepSlug, StepState } from '../../api/onboarding'
import PartnerStep from './PartnerStep'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03' }
const ORDER: StepSlug[] = ['variety', 'stock', 'header_footer', 'bot', 'partner', 'categories']

function progress(partner: StepState): OnboardingProgress {
  return {
    offered: true,
    over: false,
    count: 4,
    resume: 'partner',
    steps: ORDER.map((step) => ({ step, state: step === 'partner' ? partner : 'done' })),
    can_skip_rest: true,
    varieties_count: 1,
    stock_entries_count: 1,
    price_target: null,
    stock_target: null,
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function renderStep(partner: StepState, onProgress = vi.fn()) {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
    Promise.resolve(
      init?.method === 'POST' && _url === '/invitations'
        ? json({ url: 'http://x/invitation/abc', expires_at: '2026-10-10T00:00:00Z' }, 201)
        : json(progress('done')),
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter(
    [
      {
        path: HOME,
        element: <PartnerStep me={ME} progress={progress(partner)} onDirtyChange={() => undefined} onProgress={onProgress} />,
      },
    ],
    { initialEntries: [HOME] },
  )
  render(<RouterProvider router={router} />)
  return { fetchMock, onProgress }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('the step offers the primary "Crear el link" and not the Configuración wording', () => {
  renderStep('pending')

  expect(screen.getByRole('button', { name: 'Crear el link' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Invitá a un socio' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Seguir' })).not.toBeInTheDocument()
})

test('each tap on "Crear el link" posts one invitation, then Seguir sends the partner pass', async () => {
  const { fetchMock, onProgress } = renderStep('pending')

  await userEvent.click(screen.getByRole('button', { name: 'Crear el link' }))
  expect(await screen.findByText('http://x/invitation/abc')).toBeInTheDocument()
  expect(fetchMock.mock.calls.filter(([url]) => url === '/invitations')).toHaveLength(1)

  await userEvent.click(screen.getByRole('button', { name: 'Seguir' }))
  const pass = fetchMock.mock.calls.find(([url]) => url === '/onboarding-progress/passes')
  expect(JSON.parse(String(pass?.[1]?.body))).toEqual({ step: 'partner', as: 'done' })
  await vi.waitFor(() => expect(onProgress).toHaveBeenCalledTimes(1))
})

test('a step already done shows Hecho and Seguir with no link made', () => {
  renderStep('done')

  expect(screen.getByText('Hecho')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Seguir' })).toBeInTheDocument()
})
