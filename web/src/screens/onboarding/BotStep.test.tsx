/**
 * `BotStep` at the component seam (Testing Library, `fetch` faked): the publish line and
 * "Seguir" show only once the bot is saved (a successful Probarlo, or the server's `done`),
 * "Hecho" comes only from `/onboarding-progress`, and a failed progress read sends no pass.
 */

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import {
  onboardingProgressQuery,
  type OnboardingProgress,
  type StepState,
} from '../../api/onboarding'
import BotStep from './BotStep'

const PUBLISH = 'Cuando quieras, publicalo desde Variedades → Mandar catálogo'
const ME = {
  email: 'ana@x.com',
  business_name: 'La Huerta',
  today: '2026-10-03',
}

function progress(bot: StepState): OnboardingProgress {
  return {
    offered: true,
    over: false,
    count: 3,
    resume: bot === 'done' ? 'partner' : 'bot',
    steps: [
      { step: 'variety', state: 'done' },
      { step: 'stock', state: 'done' },
      { step: 'header_footer', state: 'done' },
      { step: 'bot', state: bot },
      { step: 'partner', state: 'pending' },
      { step: 'categories', state: 'pending' },
    ],
    can_skip_rest: true,
    varieties_count: 1,
    stock_entries_count: 1,
    price_target: null,
    stock_target: null,
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const SAVED = {
  token_saved_on: '2026-10-03',
  own_chat: '555',
  channel_chat: null,
  previous_pin_left: false,
}
const EMPTY = { token_saved_on: null, own_chat: null, channel_chat: null }

/** Reads the progress the way the frame does, so a kept answer reaches the step. */
function Harness({ onProgress }: { onProgress: (answer: OnboardingProgress) => void }) {
  const { data } = useQuery(onboardingProgressQuery)
  if (data === undefined) return null
  return <BotStep me={ME} progress={data} onDirtyChange={() => undefined} onProgress={onProgress} />
}

interface Faked {
  test?: () => Response
  progressReads?: Array<() => Response>
  pass?: () => Response
}

function setup(initialBot: StepState, faked: Faked = {}) {
  const calls: string[] = []
  const reads = [...(faked.progressReads ?? [])]
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${String(input)}`
      calls.push(key)
      if (key === 'GET /pinned-catalog')
        return Promise.resolve(json(initialBot === 'done' ? SAVED : EMPTY))
      if (key === 'POST /pinned-catalog/test')
        return Promise.resolve((faked.test ?? (() => json(SAVED)))())
      if (key === 'GET /onboarding-progress') {
        const next = reads.shift()
        return Promise.resolve(next === undefined ? json(progress(initialBot)) : next())
      }
      if (key === 'POST /onboarding-progress/passes')
        return Promise.resolve((faked.pass ?? (() => json(progress('done'))))())
      return Promise.resolve(json({}, 404))
    }),
  )
  const onProgress = vi.fn()
  const router = createMemoryRouter([{ path: '/', element: <Harness onProgress={onProgress} /> }])
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { calls, onProgress }
}

async function probarlo(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Token del bot'), '123:abc')
  await user.type(screen.getByLabelText('Tu chat'), '555')
  await user.click(screen.getByRole('button', { name: 'Probarlo' }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('no publish line, no Hecho and no Seguir before Probarlo, nor after a failed one', async () => {
  const { calls } = setup('pending', {
    test: () => json({ code: 'pinned_catalog.telegram_refused' }, 422),
  })
  const user = userEvent.setup()
  await probarlo(user)

  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(screen.queryByText(PUBLISH)).not.toBeInTheDocument()
  expect(screen.queryByText('Hecho')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Seguir' })).not.toBeInTheDocument()
  expect(calls).not.toContain('POST /onboarding-progress/passes')
})

test('after a successful Probarlo the line shows and Hecho shows once progress answers done', async () => {
  const { calls, onProgress } = setup('pending', {
    progressReads: [() => json(progress('pending')), () => json(progress('done'))],
  })
  // The first read is the frame's own; the second is the one Probarlo asks for.
  const user = userEvent.setup()
  await probarlo(user)

  expect(await screen.findByText(PUBLISH)).toBeInTheDocument()
  expect(await screen.findByText('Hecho')).toBeInTheDocument()
  expect(onProgress).toHaveBeenCalledTimes(1)
  expect(calls.indexOf('GET /onboarding-progress', 1)).toBeLessThan(
    calls.indexOf('POST /onboarding-progress/passes'),
  )
})

test('on a fresh mount whose progress says bot done, both the line and Hecho show', async () => {
  setup('done')
  expect(await screen.findByText('Hecho')).toBeInTheDocument()
  expect(screen.getByText(PUBLISH)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Seguir' })).toBeInTheDocument()
})

test('Probarlo succeeds and the progress read fails: the error and the line show, no Hecho, no pass; Seguir then reads, passes and Hecho shows', async () => {
  const { calls, onProgress } = setup('pending', {
    progressReads: [
      () => json(progress('pending')),
      () => json({}, 500),
      () => json(progress('done')),
    ],
  })
  const user = userEvent.setup()
  await probarlo(user)

  expect(await screen.findByText('Algo falló. Probá de nuevo.')).toBeInTheDocument()
  expect(screen.getByText(PUBLISH)).toBeInTheDocument()
  expect(screen.queryByText('Hecho')).not.toBeInTheDocument()
  expect(calls).not.toContain('POST /onboarding-progress/passes')

  await user.click(screen.getByRole('button', { name: 'Seguir' }))
  expect(await screen.findByText('Hecho')).toBeInTheDocument()
  expect(calls).toContain('POST /onboarding-progress/passes')
  expect(onProgress).toHaveBeenCalledTimes(1)
})

test('Probarlo succeeds and the pass write fails: Hecho still shows from progress and Seguir retries', async () => {
  let fail = true
  const { calls, onProgress } = setup('pending', {
    progressReads: [
      () => json(progress('pending')),
      () => json(progress('done')),
      () => json(progress('done')),
    ],
    pass: () => (fail ? json({}, 500) : json(progress('done'))),
  })
  const user = userEvent.setup()
  await probarlo(user)

  expect(await screen.findByText('Algo falló. Probá de nuevo.')).toBeInTheDocument()
  expect(screen.getByText('Hecho')).toBeInTheDocument()
  expect(onProgress).not.toHaveBeenCalled()

  fail = false
  await user.click(screen.getByRole('button', { name: 'Seguir' }))
  await vi.waitFor(() => expect(onProgress).toHaveBeenCalledTimes(1))
  expect(calls.filter((call) => call === 'POST /onboarding-progress/passes')).toHaveLength(2)
})
