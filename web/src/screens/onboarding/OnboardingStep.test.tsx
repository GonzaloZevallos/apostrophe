/**
 * The step frame on its own (`OnboardingStep`), rendered with a stub body and `fetch` faked:
 * which of "Atrás", "Saltar" and "Saltar el resto" it draws on each step, the skips on one
 * row, and which question the leave guard asks. The owners' forms have their own tests
 * (`Steps.test.tsx`), and the routes around the frame are in `Onboarding.test.tsx`.
 * The position helpers `isFirst` and `isLast` are checked here too.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type ComponentType } from 'react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import type { OnboardingProgress, StepSlug, StepState } from '../../api/onboarding'
import { HOME } from '../../routes'
import OnboardingStep, { DISCARD_DETAIL, PARTLY_SAVED_DETAIL } from './OnboardingStep'
import type { StepBodyProps } from './stepBodies'
import { isFirst, isLast, STEPS } from './steps'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03' }
const ORDER: StepSlug[] = ['variety', 'stock', 'header_footer', 'bot', 'partner', 'categories']

function progress(canSkipRest: boolean): OnboardingProgress {
  const states: StepState[] = ['done', 'done', 'pending', 'pending', 'pending', 'pending']
  return {
    offered: true,
    over: false,
    count: 2,
    resume: 'header_footer',
    steps: ORDER.map((step, index) => ({ step, state: states[index] ?? 'pending' })),
    can_skip_rest: canSkipRest,
    varieties_count: 1,
    stock_entries_count: 1,
    price_target: null,
    priced_target: null,
    stock_target: null,
  }
}

const calls: string[] = []

function renderFrame(
  slug: StepSlug,
  options: { canSkipRest?: boolean; Body?: ComponentType<StepBodyProps> } = {},
) {
  const { canSkipRest = true, Body = () => null } = options
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${String(input)}`)
      return Promise.resolve(
        new Response(JSON.stringify(progress(canSkipRest)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }),
  )
  const frame = (step: StepSlug) => (
    <OnboardingStep slug={step} me={ME} progress={progress(canSkipRest)} Body={Body} />
  )
  const router = createMemoryRouter(
    [
      {
        element: <Outlet />,
        children: [
          { path: HOME, element: <span>pantalla inicio</span> },
          ...STEPS.map((step) => ({ path: step.path, element: frame(step.slug) })),
        ],
      },
    ],
    { initialEntries: [STEPS.find((step) => step.slug === slug)?.path ?? HOME] },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  calls.length = 0
})

test('isFirst and isLast are decided by the position in the steps, one step each', () => {
  expect(ORDER.filter(isFirst)).toEqual(['variety'])
  expect(ORDER.filter(isLast)).toEqual(['categories'])
})

test('step 1 has no "Atrás": "Cerrar" is its only way out', async () => {
  renderFrame('variety')

  expect(await screen.findByText('Paso 1 de 6')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Atrás' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
})

test.each(ORDER.slice(1).map((slug, index) => [slug, index + 1] as const))(
  '"Atrás" on %s (step %i + 1) opens the step before',
  async (slug, beforeIndex) => {
    renderFrame(slug)

    await userEvent.click(await screen.findByRole('button', { name: 'Atrás' }))

    expect(await screen.findByText(`Paso ${beforeIndex} de 6`)).toBeInTheDocument()
  },
)

test.each(['header_footer', 'bot', 'partner'] as const)(
  '"Saltar el resto" shows on %s when the API allows it',
  async (slug) => {
    renderFrame(slug)
    expect(await screen.findByRole('button', { name: 'Saltar el resto' })).toBeInTheDocument()
  },
)

test('"Saltar el resto" is not drawn without can_skip_rest, but "Saltar" is', async () => {
  renderFrame('bot', { canSkipRest: false })

  expect(await screen.findByRole('button', { name: 'Saltar' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Saltar el resto' })).not.toBeInTheDocument()
})

test('step 6 shows "Saltar" only, even when the API allows skipping the rest', async () => {
  renderFrame('categories', { canSkipRest: true })

  expect(await screen.findByRole('button', { name: 'Saltar' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Saltar el resto' })).not.toBeInTheDocument()
})

test('a required step draws no skip at all', async () => {
  renderFrame('stock')

  expect(await screen.findByText('Paso 2 de 6')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Saltar' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Saltar el resto' })).not.toBeInTheDocument()
})

test('both skips are buttons on one row with nothing between them', async () => {
  renderFrame('bot')

  const skip = await screen.findByRole('button', { name: 'Saltar' })
  const rest = screen.getByRole('button', { name: 'Saltar el resto' })
  const row = skip.parentElement
  expect(row).not.toBeNull()
  expect(rest.parentElement).toBe(row)
  expect(row?.children).toHaveLength(2)
  expect(row?.firstElementChild).toBe(skip)
  expect(row?.lastElementChild).toBe(rest)
  expect(skip).toHaveClass('boton--enlace')
  expect(rest).toHaveClass('boton--enlace')
  // The "later" hint is a line under the row, not inside it.
  expect(screen.getByText(/Si lo salteás, lo hacés después en/)).not.toBe(row)
  expect(row).not.toContainElement(screen.getByText(/Si lo salteás/))
})

function TypingBody({ onDirtyChange }: StepBodyProps) {
  return <input aria-label="Algo" onChange={(event) => onDirtyChange(event.target.value !== '')} />
}

function PartlySavedBody({ onDirtyChange }: StepBodyProps) {
  return <input aria-label="Algo" onChange={(event) => onDirtyChange(true, event.target.value !== '')} />
}

test('a plain dirty body asks with the discard detail before "Cerrar" and "Saltar"', async () => {
  renderFrame('bot', { Body: TypingBody })
  await userEvent.type(await screen.findByLabelText('Algo'), 'x')

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  let dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText(DISCARD_DETAIL)).toBeInTheDocument()
  await userEvent.click(within(dialog).getByRole('button', { name: 'No, seguí escribiendo' }))

  await userEvent.click(screen.getByRole('button', { name: 'Saltar' }))
  dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText(DISCARD_DETAIL)).toBeInTheDocument()
  expect(calls).toEqual([])
})

test('a body that reports part of its work saved asks with the partly-saved detail', async () => {
  renderFrame('bot', { Body: PartlySavedBody })
  await userEvent.type(await screen.findByLabelText('Algo'), 'x')

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  let dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText(PARTLY_SAVED_DETAIL)).toBeInTheDocument()
  expect(within(dialog).queryByText(DISCARD_DETAIL)).not.toBeInTheDocument()
  await userEvent.click(within(dialog).getByRole('button', { name: 'No, seguí escribiendo' }))

  await userEvent.click(screen.getByRole('button', { name: 'Saltar' }))
  dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText(PARTLY_SAVED_DETAIL)).toBeInTheDocument()
  expect(calls).toEqual([])
})
