/**
 * `CategoriesStep` at the component seam (Testing Library, `fetch` faked): the "Nueva
 * categoría" input waits behind "+ Categoría", the line saying the categories save on their
 * own is always there, and only "Seguir" sends the `categories` pass (an add sends none).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { HOME } from '../../routes'
import type { Me } from '../../api/me'
import type { OnboardingProgress, StepSlug } from '../../api/onboarding'
import CategoriesStep from './CategoriesStep'
import { CATEGORIES_SAVE_LINE } from './onboardingMessages'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03' }
const ORDER: StepSlug[] = ['variety', 'stock', 'header_footer', 'bot', 'partner', 'categories']
const PROGRESS: OnboardingProgress = {
  offered: true,
  over: false,
  count: 5,
  resume: 'categories',
  steps: ORDER.map((step) => ({ step, state: step === 'categories' ? 'pending' : 'done' })),
  can_skip_rest: true,
  varieties_count: 1,
  stock_entries_count: 1,
  price_target: null,
  stock_target: null,
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function renderStep(onDirtyChange: (dirty: boolean) => void = () => undefined) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/expense-categories' && init?.method === 'POST') {
      return Promise.resolve(json({ id: 2, name: 'Luz' }, 201))
    }
    if (url === '/expense-categories') return Promise.resolve(json([{ id: 1, name: 'Insumos' }]))
    return Promise.resolve(json(PROGRESS))
  })
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter(
    [
      {
        path: HOME,
        element: <CategoriesStep me={ME} progress={PROGRESS} onDirtyChange={onDirtyChange} onProgress={() => undefined} />,
      },
    ],
    { initialEntries: [HOME] },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('the add input is closed behind "+ Categoría" and the save line is always shown', async () => {
  renderStep()

  expect(await screen.findByText('Insumos')).toBeInTheDocument()
  expect(screen.getByText(CATEGORIES_SAVE_LINE)).toBeInTheDocument()
  expect(screen.queryByLabelText('Nueva categoría')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: '+ Categoría' }))
  expect(screen.getByLabelText('Nueva categoría')).toBeInTheDocument()
  expect(screen.getByText(CATEGORIES_SAVE_LINE)).toBeInTheDocument()
})

test('opening the add input is not dirty; an add saves at once and sends no pass; Seguir sends it', async () => {
  const onDirtyChange = vi.fn()
  const fetchMock = renderStep(onDirtyChange)

  await screen.findByText('Insumos')
  await userEvent.click(screen.getByRole('button', { name: '+ Categoría' }))
  expect(onDirtyChange).not.toHaveBeenCalledWith(true)

  await userEvent.type(screen.getByLabelText('Nueva categoría'), 'Luz')
  await userEvent.click(screen.getByRole('button', { name: '+ Categoría' }))
  expect(await screen.findByText('Categoría guardada')).toBeInTheDocument()
  expect(fetchMock.mock.calls.some(([url]) => url === '/onboarding-progress/passes')).toBe(false)

  await userEvent.click(screen.getByRole('button', { name: 'Seguir' }))
  const pass = fetchMock.mock.calls.find(([url]) => url === '/onboarding-progress/passes')
  expect(JSON.parse(String(pass?.[1]?.body))).toEqual({ step: 'categories', as: 'done' })
})
