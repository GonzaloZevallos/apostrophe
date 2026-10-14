/**
 * `CatalogMessageStep` at the component seam (Testing Library, `fetch` faked): "Guardar"
 * saves through the owner's route and then passes the step; "Dejar así" passes it with
 * nothing written to the catalog.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { OnboardingProgress } from '../../api/onboarding'
import { HOME } from '../../routes'
import CatalogMessageStep from './CatalogMessageStep'

const CATALOG = { text: null, header: 'H', footer: 'F', varieties: [] }
const ME = {
  email: 'ana@x.com',
  business_name: 'La Huerta',
  today: '2026-10-03',
}
const PROGRESS: OnboardingProgress = {
  offered: true,
  over: false,
  count: 3,
  resume: 'bot',
  steps: [
    { step: 'variety', state: 'done' },
    { step: 'stock', state: 'done' },
    { step: 'header_footer', state: 'done' },
    { step: 'bot', state: 'pending' },
    { step: 'partner', state: 'pending' },
    { step: 'categories', state: 'pending' },
  ],
  can_skip_rest: true,
  varieties_count: 1,
  stock_entries_count: 1,
  price_target: null,
  stock_target: null,
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function setup() {
  const calls: string[] = []
  const passes: unknown[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${String(input)}`
      calls.push(key)
      if (key === 'GET /catalog') return Promise.resolve(json(CATALOG))
      if (key === 'PUT /catalog/header-footer')
        return Promise.resolve(json({ ...CATALOG, header: 'H!' }))
      if (key === 'POST /onboarding-progress/passes') {
        passes.push(JSON.parse(String(init?.body)))
        return Promise.resolve(json(PROGRESS))
      }
      return Promise.resolve(json({}, 404))
    }),
  )
  const onProgress = vi.fn()
  const router = createMemoryRouter([
    {
      path: HOME,
      element: (
        <CatalogMessageStep
          me={ME}
          progress={PROGRESS}
          onDirtyChange={() => undefined}
          onProgress={onProgress}
        />
      ),
    },
  ])
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { calls, passes, onProgress }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('"Guardar" saves through the owner route and only then passes the step', async () => {
  const { calls, passes, onProgress } = setup()
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Encabezado'), '!')
  expect(screen.queryByRole('button', { name: 'Guardá el mensaje' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Guardar' }))

  await waitFor(() => expect(onProgress).toHaveBeenCalledTimes(1))
  expect(passes).toEqual([{ step: 'header_footer', as: 'done' }])
  expect(calls.indexOf('PUT /catalog/header-footer')).toBeLessThan(
    calls.indexOf('POST /onboarding-progress/passes'),
  )
})

test('"Dejar así" passes the step with no catalog write', async () => {
  const { calls, passes, onProgress } = setup()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Dejar así' }))

  await waitFor(() => expect(onProgress).toHaveBeenCalledTimes(1))
  expect(passes).toEqual([{ step: 'header_footer', as: 'done' }])
  expect(calls).not.toContain('PUT /catalog/header-footer')
})
