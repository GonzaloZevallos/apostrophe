/**
 * The step frame on its own (`OnboardingStep`), rendered with a stub body and `fetch` faked:
 * which of "Back", "Skip" and "Skip the rest" it draws on each step, the skips on one
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
import { SHOWN_EN } from '../../test/shownLanguage'
import type { OnboardingProgress, StepSlug, StepState } from '../../api/onboarding'
import { HOME } from '../../routes'
import OnboardingStep, { DISCARD_DETAIL, PARTLY_SAVED_DETAIL } from './OnboardingStep'
import type { StepBodyProps } from './stepBodies'
import { isFirst, isLast, STEPS } from './steps'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03', shown_language: SHOWN_EN }
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

test('step 1 has no "Back": "Close" is its only way out', async () => {
  renderFrame('variety')

  expect(await screen.findByText('Step 1 of 6')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
})

test('the first step opens with the lockup, in the main region', async () => {
  renderFrame('variety')

  await screen.findByText('Step 1 of 6')
  const lockup = within(screen.getByRole('main')).getByRole('img', { name: 'apostrophe' })
  expect(lockup).toHaveTextContent('apostrophe’')
})

test('no other step shows the brand', async () => {
  renderFrame('stock')

  await screen.findByText('Step 2 of 6')
  expect(within(screen.getByRole('main')).queryByRole('img', { name: 'apostrophe' })).not.toBeInTheDocument()
})

test.each(ORDER.slice(1).map((slug, index) => [slug, index + 1] as const))(
  '"Back" on %s (step %i + 1) opens the step before',
  async (slug, beforeIndex) => {
    renderFrame(slug)

    await userEvent.click(await screen.findByRole('button', { name: 'Back' }))

    expect(await screen.findByText(`Step ${beforeIndex} of 6`)).toBeInTheDocument()
  },
)

test.each(['header_footer', 'bot', 'partner'] as const)(
  '"Skip the rest" shows on %s when the API allows it',
  async (slug) => {
    renderFrame(slug)
    expect(await screen.findByRole('button', { name: 'Skip the rest' })).toBeInTheDocument()
  },
)

test('"Skip the rest" is not drawn without can_skip_rest, but "Skip" is', async () => {
  renderFrame('bot', { canSkipRest: false })

  expect(await screen.findByRole('button', { name: 'Skip' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Skip the rest' })).not.toBeInTheDocument()
})

test('step 6 shows "Skip" only, even when the API allows skipping the rest', async () => {
  renderFrame('categories', { canSkipRest: true })

  expect(await screen.findByRole('button', { name: 'Skip' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Skip the rest' })).not.toBeInTheDocument()
})

test('a required step draws no skip at all', async () => {
  renderFrame('stock')

  expect(await screen.findByText('Step 2 of 6')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Skip the rest' })).not.toBeInTheDocument()
})

test('both skips are buttons on one row with nothing between them', async () => {
  renderFrame('bot')

  const skip = await screen.findByRole('button', { name: 'Skip' })
  const rest = screen.getByRole('button', { name: 'Skip the rest' })
  const row = skip.parentElement
  expect(row).not.toBeNull()
  expect(rest.parentElement).toBe(row)
  expect(row?.children).toHaveLength(2)
  expect(row?.firstElementChild).toBe(skip)
  expect(row?.lastElementChild).toBe(rest)
  expect(skip).toHaveClass('boton--enlace')
  expect(rest).toHaveClass('boton--enlace')
  // The "later" hint is a line under the row, not inside it.
  expect(screen.getByText(/If you skip it, you can do it later in/)).not.toBe(row)
  expect(row).not.toContainElement(screen.getByText(/If you skip it/))
})

function TypingBody({ onDirtyChange }: StepBodyProps) {
  return <input aria-label="Algo" onChange={(event) => onDirtyChange(event.target.value !== '')} />
}

function PartlySavedBody({ onDirtyChange }: StepBodyProps) {
  return <input aria-label="Algo" onChange={(event) => onDirtyChange(true, event.target.value !== '')} />
}

test('a plain dirty body asks with the discard detail before "Close" and "Skip"', async () => {
  renderFrame('bot', { Body: TypingBody })
  await userEvent.type(await screen.findByLabelText('Algo'), 'x')

  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  let dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText(DISCARD_DETAIL)).toBeInTheDocument()
  await userEvent.click(within(dialog).getByRole('button', { name: 'No, keep typing' }))

  await userEvent.click(screen.getByRole('button', { name: 'Skip' }))
  dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText(DISCARD_DETAIL)).toBeInTheDocument()
  expect(calls).toEqual([])
})

test('a body that reports part of its work saved asks with the partly-saved detail', async () => {
  renderFrame('bot', { Body: PartlySavedBody })
  await userEvent.type(await screen.findByLabelText('Algo'), 'x')

  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  let dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText(PARTLY_SAVED_DETAIL)).toBeInTheDocument()
  expect(within(dialog).queryByText(DISCARD_DETAIL)).not.toBeInTheDocument()
  await userEvent.click(within(dialog).getByRole('button', { name: 'No, keep typing' }))

  await userEvent.click(screen.getByRole('button', { name: 'Skip' }))
  dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText(PARTLY_SAVED_DETAIL)).toBeInTheDocument()
  expect(calls).toEqual([])
})
