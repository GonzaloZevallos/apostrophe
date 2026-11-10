/**
 * The Onboarding's routes, step frame and "Done" at the screen seam (Testing Library,
 * `fetch` faked): where each path leads, the frame's controls and leave confirmation,
 * "Skip the rest" only when the API allows it, "Done" only after `over: true`, and
 * Nueva venta opened from "Done" going back to Inicio. Nothing is written to the console
 * or the browser's storage.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode, useEffect } from 'react'
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
  type RouteObject,
} from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { NetworkError } from '../../api/client'
import type { Me } from '../../api/me'
import { SHOWN_EN } from '../../test/shownLanguage'
import type { OnboardingProgress, StepSlug, StepState } from '../../api/onboarding'
import Listo from './Listo'
import OnboardingLayout from './OnboardingLayout'
import { OnboardingEntry, OnboardingStepRoute } from './OnboardingRoutes'
import OnboardingStep from './OnboardingStep'
import { STEP_BODIES, type StepBodyProps } from './stepBodies'
import {
  HOME,
  ONBOARDING,
  ONBOARDING_BOT,
  ONBOARDING_CATALOG_MESSAGE,
  ONBOARDING_CATEGORIES,
  ONBOARDING_DONE,
  SALE_NEW,
  SALES,
  SETTINGS,
} from '../../routes'
import { useBackOr } from '../../components/useBackOr'
import { expectIconAndTextRule } from '../../test/iconAndTextRule'
import { CHECKLIST_DONE } from '../../copy/inicio'
import { ONBOARDING_TEXT } from '../../copy/onboarding'
import { stepInfo } from './steps'
import { SheetRouterProvider } from '../../components/useSheetStack'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03', shown_language: SHOWN_EN }
const ORDER: StepSlug[] = ['variety', 'stock', 'header_footer', 'bot', 'partner', 'categories']

function answer(
  states: StepState[],
  overrides: Partial<OnboardingProgress> = {},
): OnboardingProgress {
  const first = states.findIndex((state) => state === 'pending')
  return {
    offered: true,
    over: false,
    count: states.filter((state) => state !== 'pending').length,
    resume: first === -1 ? 'finish' : (ORDER[first] ?? null),
    steps: ORDER.map((step, index) => ({ step, state: states[index] ?? 'pending' })),
    can_skip_rest: states[0] === 'done' && states[1] === 'done',
    products_count: 2,
    stock_entries_count: 2,
    price_target: null,
    priced_target: null,
    stock_target: null,
    ...overrides,
  }
}

const FRESH = answer(['pending', 'pending', 'pending', 'pending', 'pending', 'pending'])
const REQUIRED_DONE = answer(['done', 'done', 'pending', 'pending', 'pending', 'pending'])

const calls: string[] = []
const writes: Record<string, OnboardingProgress> = {}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function stubProgress(read: OnboardingProgress): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      calls.push(`${method} ${url}${init?.body ? ` ${String(init.body)}` : ''}`)
      return Promise.resolve(json(writes[`${method} ${url}`] ?? read))
    }),
  )
}

/** Closes the way Nueva venta does: back by history only when the entry is in-app. */
function NewSaleStub() {
  const close = useBackOr(SALES)
  return (
    <button type="button" onClick={close}>
      cerrar nueva venta
    </button>
  )
}

function Provide() {
  return <Outlet context={ME} />
}

function Spy({ onMount }: { onMount: () => void }) {
  useEffect(onMount, [onMount])
  return null
}

function renderAt(
  initial: string | { pathname: string; state: unknown },
  index = 0,
  before: string[] = [],
  strict = false,
) {
  const routes: RouteObject[] = [
    {
      element: <Provide />,
      children: [
        { index: true, element: <span>pantalla inicio</span> },
        { path: 'settings', element: <span>pantalla ajustes</span> },
        { path: SALE_NEW, element: <NewSaleStub /> },
        {
          path: 'onboarding',
          element: <OnboardingLayout />,
          children: [
            { index: true, element: <OnboardingEntry /> },
            ...ORDER.map((slug) => ({
              path: slug === 'header_footer' ? 'catalog-message' : slug,
              element: <OnboardingStepRoute slug={slug} />,
            })),
            { path: 'done', element: <Listo /> },
          ],
        },
      ],
    },
  ]
  const router = createMemoryRouter(routes, { initialEntries: [...before, initial], initialIndex: index })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const tree = (
    <QueryClientProvider client={queryClient}>
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>
  )
  render(strict ? <StrictMode>{tree}</StrictMode> : tree)
  return router
}

const logs = ['log', 'warn', 'error', 'info', 'debug'] as const
const spies = logs.map((name) => vi.spyOn(console, name).mockImplementation(() => undefined))

// The frame is tested here on its own: the owners' forms in the step slots have their own
// tests (`Steps.test.tsx`), so every slot holds nothing while these run.
const realBodies = { ...STEP_BODIES }
const emptyBody = (): null => null

beforeEach(() => {
  spies.forEach((spy) => spy.mockClear())
  for (const slug of ORDER) STEP_BODIES[slug] = emptyBody
})

afterEach(() => {
  Object.assign(STEP_BODIES, realBodies)
  vi.unstubAllGlobals()
  calls.length = 0
  for (const key of Object.keys(writes)) delete writes[key]
  // Nothing about the Onboarding reaches the console or the browser's storage.
  spies.forEach((spy) => expect(spy).not.toHaveBeenCalled())
  expect(window.localStorage.length).toBe(0)
  expect(window.sessionStorage.length).toBe(0)
})

test('the Onboarding entry opens the resume step with its title, "Step N of 6" and its badge, and nothing to skip on a required step', async () => {
  stubProgress(answer(['done', 'pending', 'pending', 'pending', 'pending', 'pending']))
  renderAt(ONBOARDING)

  expect(await screen.findByText('Step 2 of 6')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Add what you have today' })).toBeInTheDocument()
  expect(screen.getByText('Required')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
  expect(screen.queryByText('New sale')).not.toBeInTheDocument()
  expect(calls).toEqual(['GET /onboarding-progress'])
})

test.each([
  ['never offered', { ...FRESH, offered: false, resume: null, steps: [] }],
  ['over', { ...REQUIRED_DONE, over: true, resume: null }],
])('an Onboarding path of a business %s goes to Inicio', async (_name, read) => {
  stubProgress(read)
  renderAt(ONBOARDING_BOT)

  expect(await screen.findByText('pantalla inicio')).toBeInTheDocument()
})

test('a deep link to "Done" without the flag goes to Inicio', async () => {
  stubProgress({ ...REQUIRED_DONE, over: true, resume: null })
  renderAt(ONBOARDING_DONE)

  expect(await screen.findByText('pantalla inicio')).toBeInTheDocument()
})

test('"Done" entered with the flag has one line per step and never an amount', async () => {
  stubProgress(
    answer(['done', 'done', 'done', 'skipped', 'skipped', 'done'], { over: true, resume: null }),
  )
  renderAt({ pathname: ONBOARDING_DONE, state: { listo: true } })

  expect(await screen.findByRole('heading', { name: 'Done' })).toBeInTheDocument()
  expect(screen.getByText('6 of 6 steps')).toBeInTheDocument()
  expect(screen.getAllByText('Done · 2 products')).toHaveLength(1)
  expect(screen.getAllByText('Done · 2 entries')).toHaveLength(1)
  expect(screen.getByText('For later — in Settings → Integrations')).toBeInTheDocument()
  expect(screen.getByText('For later — in Settings → Users')).toBeInTheDocument()
  // The two done lines and the heading, which share the word.
  expect(screen.getAllByText(CHECKLIST_DONE)).toHaveLength(3)
})

test('the resume notice names the partner step in English', () => {
  const label = stepInfo('partner').shortName
  expect(label).toEqual({ kind: 'text', text: 'partner' })
  expect(ONBOARDING_TEXT.missing(label.kind === 'text' ? label.text : '')).toBe('Missing: partner')
})

test('"Skip the rest" is hidden until both required steps are done', async () => {
  stubProgress(answer(['done', 'pending', 'pending', 'pending', 'pending', 'pending']))
  const { unmount } = renderHidden(ONBOARDING_BOT)
  await screen.findByText('Step 4 of 6')
  expect(screen.queryByRole('button', { name: 'Skip the rest' })).not.toBeInTheDocument()
  unmount()
})

function renderHidden(path: string) {
  const router = renderAt(path)
  return { container: document.body, unmount: () => router.dispose() }
}

const renderOptional = () => renderHidden(ONBOARDING_BOT)

test('with both required steps done "Skip the rest" sends skip-rest and "Done" opens only after over: true', async () => {
  stubProgress(REQUIRED_DONE)
  writes['POST /onboarding-progress/skip-rest'] = answer(['done', 'done', 'skipped', 'skipped', 'skipped', 'skipped'], {
    over: true,
    resume: null,
  })
  renderAt(ONBOARDING_BOT)

  await userEvent.click(await screen.findByRole('button', { name: 'Skip the rest' }))

  expect(await screen.findByRole('heading', { name: 'Done' })).toBeInTheDocument()
  expect(calls).toContain('POST /onboarding-progress/skip-rest {}')
})

test('"Skip" sends a skipped pass for the step and opens the step the answer resumes at', async () => {
  stubProgress(REQUIRED_DONE)
  writes['POST /onboarding-progress/passes'] = answer(['done', 'done', 'pending', 'skipped', 'pending', 'pending'])
  renderAt(ONBOARDING_BOT)

  await userEvent.click(await screen.findByRole('button', { name: 'Skip' }))

  expect(await screen.findByText('Step 3 of 6')).toBeInTheDocument()
  expect(calls).toContain('POST /onboarding-progress/passes {"step":"bot","as":"skipped"}')
  expect(screen.getByText('If you skip it, you can do it later in Settings → Catalog message.')).toBeInTheDocument()
})

test('a skip answered with required steps unmet does not draw "Done"', async () => {
  stubProgress(REQUIRED_DONE)
  writes['POST /onboarding-progress/passes'] = answer(['pending', 'done', 'skipped', 'skipped', 'skipped', 'skipped'])
  renderAt(ONBOARDING_CATEGORIES)

  await userEvent.click(await screen.findByRole('button', { name: 'Skip' }))

  expect(await screen.findByText('Step 1 of 6')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Done' })).not.toBeInTheDocument()
})

function TypingBody({ onDirtyChange }: StepBodyProps) {
  return (
    <input
      aria-label="Algo"
      onChange={(event) => onDirtyChange(event.target.value !== '')}
    />
  )
}

test('leaving a step with something typed asks first; an untouched step leaves at once and writes nothing', async () => {
  stubProgress(REQUIRED_DONE)
  const original = STEP_BODIES.bot
  STEP_BODIES.bot = TypingBody
  try {
    renderAt(ONBOARDING_BOT)
    await screen.findByText('Step 4 of 6')

    await userEvent.type(screen.getByLabelText('Algo'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'No, keep typing' }))
    expect(screen.getByLabelText('Algo')).toHaveValue('x')

    await userEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(calls.filter((call) => call.startsWith('POST'))).toEqual([])

    await userEvent.click(screen.getByRole('button', { name: 'No, keep typing' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Yes, discard it' }))
    expect(await screen.findByText('pantalla inicio')).toBeInTheDocument()
  } finally {
    STEP_BODIES.bot = original
  }
  expect(calls.filter((call) => call.startsWith('POST'))).toEqual([])
})

test('"Close" on an untouched step leaves at once to Inicio and sends nothing', async () => {
  stubProgress(REQUIRED_DONE)
  renderAt(ONBOARDING_BOT)

  await userEvent.click(await screen.findByRole('button', { name: 'Close' }))

  expect(await screen.findByText('pantalla inicio')).toBeInTheDocument()
  expect(calls.filter((call) => call.startsWith('POST'))).toEqual([])
})

test('a body that saved hands its answer to the frame, which follows it', async () => {
  stubProgress(REQUIRED_DONE)
  function SavingBody({ onProgress }: StepBodyProps) {
    return (
      <button type="button" onClick={() => onProgress(answer(['done', 'done', 'done', 'pending', 'pending', 'pending']))}>
        Guardar
      </button>
    )
  }
  const original = STEP_BODIES.header_footer
  STEP_BODIES.header_footer = SavingBody
  try {
    renderAt(ONBOARDING_CATALOG_MESSAGE)
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Step 4 of 6')).toBeInTheDocument()
  } finally {
    STEP_BODIES.header_footer = original
  }
})

test('Nueva venta opened from "Done" goes back to Inicio when closed', async () => {
  stubProgress(answer(['done', 'done', 'done', 'done', 'done', 'done'], { over: true, resume: null }))
  renderAt({ pathname: ONBOARDING_DONE, state: { listo: true } }, 1, [HOME])

  await userEvent.click(await screen.findByRole('button', { name: 'Add my first sale' }))
  await userEvent.click(await screen.findByRole('button', { name: 'cerrar nueva venta' }))

  await waitFor(() => expect(screen.getByText('pantalla inicio')).toBeInTheDocument())
})

test('"Go to Home" opens Inicio', async () => {
  stubProgress(answer(['done', 'done', 'done', 'done', 'done', 'done'], { over: true, resume: null }))
  renderAt({ pathname: ONBOARDING_DONE, state: { listo: true } })

  await userEvent.click(await screen.findByRole('button', { name: 'Go to Home' }))

  expect(await screen.findByText('pantalla inicio')).toBeInTheDocument()
})

test('the frame is a plain step: rendered alone it sends nothing', async () => {
  stubProgress(REQUIRED_DONE)
  const router = createMemoryRouter([
    {
      path: HOME,
      element: <OnboardingStep slug="partner" me={ME} progress={REQUIRED_DONE} Body={() => <Spy onMount={() => undefined} />} />,
    },
  ])
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )

  expect(await screen.findByText('Step 5 of 6')).toBeInTheDocument()
  expect(calls).toEqual([])
})

test('"Close" is the icon-only close and "Back" keeps its word', async () => {
  stubProgress(REQUIRED_DONE)
  renderAt(ONBOARDING_BOT)

  const close = await screen.findByRole('button', { name: 'Close' })
  expect(close).toHaveClass('boton-icono')
  expect(close).toHaveTextContent('')
  const back = screen.getByRole('button', { name: 'Back' })
  expect(back).not.toHaveClass('boton-icono')
  expect(back).toHaveTextContent('Back')
})

test('"Back" asks first when something typed would be lost', async () => {
  stubProgress(REQUIRED_DONE)
  const original = STEP_BODIES.bot
  STEP_BODIES.bot = function TypingBody({ onDirtyChange }: StepBodyProps) {
    return <input aria-label="Algo" onChange={(event) => onDirtyChange(event.target.value !== '')} />
  }
  try {
    renderAt(ONBOARDING_BOT)
    await screen.findByText('Step 4 of 6')
    await userEvent.type(screen.getByLabelText('Algo'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
  } finally {
    STEP_BODIES.bot = original
  }
})

test('an optional step and "Done" obey the icon and text rule', async () => {
  stubProgress(REQUIRED_DONE)
  const { container, unmount } = renderOptional()
  await screen.findByText('Step 4 of 6')
  expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Skip the rest' })).toBeInTheDocument()
  expectIconAndTextRule(container)
  unmount()
})

test('"Done" obeys the icon and text rule and closes with the icon-only "Close"', async () => {
  stubProgress(answer(['done', 'done', 'done', 'skipped', 'skipped', 'done'], { over: true, resume: null }))
  renderAt({ pathname: ONBOARDING_DONE, state: { listo: true } })
  await screen.findByRole('heading', { name: 'Done' })

  expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('boton-icono')
  expect(screen.getByRole('button', { name: 'Add my first sale' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Go to Home' })).toBeInTheDocument()
  expectIconAndTextRule(document.body)
})

// The `finish` entry: opening `/onboarding` with every step done or passed sends `advance`.
const FINISH = answer(['done', 'done', 'done', 'skipped', 'skipped', 'done'])
const OVER = answer(['done', 'done', 'done', 'skipped', 'skipped', 'done'], { over: true, resume: null })
const STEP_2 = answer(['done', 'pending', 'pending', 'pending', 'pending', 'pending'])

/** Reads answer in turn (the last one repeats); `advance` runs `onAdvance`. */
function stubSequence(reads: OnboardingProgress[], onAdvance: () => Response | Promise<Response>) {
  let read = 0
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      calls.push(`${method} ${url}`)
      if (method === 'POST' && url === '/onboarding-progress/advance') {
        try {
          return Promise.resolve(onAdvance())
        } catch (caught) {
          return Promise.reject(caught instanceof Error ? caught : new Error('stub'))
        }
      }
      const next = reads[Math.min(read, reads.length - 1)]
      read += 1
      return Promise.resolve(json(next))
    }),
  )
}

const advances = () => calls.filter((call) => call === 'POST /onboarding-progress/advance').length
const reads = () => calls.filter((call) => call === 'GET /onboarding-progress').length

function refusal(status: number, code: string): Response {
  return new Response(JSON.stringify({ code }), { status, headers: { 'Content-Type': 'application/json' } })
}

test('opening /onboarding with every step done or passed sends advance once and shows "Done"', async () => {
  stubSequence([FINISH], () => json(OVER))
  renderAt(ONBOARDING)

  expect(await screen.findByRole('heading', { name: 'Done' })).toBeInTheDocument()
  expect(advances()).toBe(1)
})

test('while advance is in flight the entry shows the loading shape and no step', async () => {
  let release: (response: Response) => void = () => undefined
  const fetchStub = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${String(input)}`)
    if (method === 'POST') return new Promise<Response>((resolve) => (release = resolve))
    return Promise.resolve(json(FINISH))
  })
  vi.stubGlobal('fetch', fetchStub)
  renderAt(ONBOARDING)

  await waitFor(() => expect(advances()).toBe(1))
  expect(screen.getByRole('progressbar')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Done' })).not.toBeInTheDocument()
  expect(screen.queryByText('pantalla inicio')).not.toBeInTheDocument()
  release(json(OVER))
  expect(await screen.findByRole('heading', { name: 'Done' })).toBeInTheDocument()
})

test('the same entry under StrictMode still sends one advance', async () => {
  stubSequence([FINISH], () => json(OVER))
  renderAt(ONBOARDING, 0, [], true)

  expect(await screen.findByRole('heading', { name: 'Done' })).toBeInTheDocument()
  expect(advances()).toBe(1)
})

test('after "Done", reopening /onboarding on an ended Onboarding goes to Inicio with no new advance', async () => {
  stubSequence([FINISH, OVER], () => json(OVER))
  const router = renderAt(ONBOARDING)
  await screen.findByRole('heading', { name: 'Done' })

  await act(() => router.navigate(HOME))
  await screen.findByText('pantalla inicio')
  await act(() => router.navigate(ONBOARDING))

  expect(await screen.findByText('pantalla inicio')).toBeInTheDocument()
  expect(advances()).toBe(1)
})

test.each([
  ['a business with nothing left to resume', { ...OVER, resume: null }],
  ['a business never offered the Onboarding', { ...FRESH, offered: false, resume: null, steps: [] }],
])('opening /onboarding for %s goes to Inicio and sends no request but the read', async (_name, read) => {
  stubSequence([read], () => json(OVER))
  renderAt(ONBOARDING)

  expect(await screen.findByText('pantalla inicio')).toBeInTheDocument()
  expect(calls).toEqual(['GET /onboarding-progress'])
})

test('opening /onboarding with a step to resume opens it and sends no advance', async () => {
  stubSequence([STEP_2], () => json(OVER))
  renderAt(ONBOARDING)

  expect(await screen.findByText('Step 2 of 6')).toBeInTheDocument()
  expect(advances()).toBe(0)
})

test('an advance that answers not over with nothing to resume goes to Inicio, with one request', async () => {
  stubSequence([FINISH], () => json({ ...FINISH, resume: 'finish' }))
  renderAt(ONBOARDING)

  expect(await screen.findByText('pantalla inicio')).toBeInTheDocument()
  expect(advances()).toBe(1)
})

test('an advance that answers not over with a step to resume opens that step', async () => {
  stubSequence([FINISH], () => json(STEP_2))
  renderAt(ONBOARDING)

  expect(await screen.findByText('Step 2 of 6')).toBeInTheDocument()
  expect(advances()).toBe(1)
})

test('an advance that fails offline shows the offline state, and reopening it can reach "Done"', async () => {
  let attempt = 0
  stubSequence([FINISH], () => {
    attempt += 1
    if (attempt === 1) throw new NetworkError()
    return json(OVER)
  })
  const router = renderAt(ONBOARDING)

  expect(await screen.findByRole('status')).toBeInTheDocument()
  expect(screen.queryByText('pantalla inicio')).not.toBeInTheDocument()
  expect(advances()).toBe(1)

  await act(() => router.navigate(HOME))
  await screen.findByText('pantalla inicio')
  await act(() => router.navigate(ONBOARDING))

  expect(await screen.findByRole('heading', { name: 'Done' })).toBeInTheDocument()
  expect(advances()).toBe(2)
})

test('an advance refused as gone goes to Inicio', async () => {
  stubSequence([FINISH], () => refusal(404, 'account.invitation_not_usable'))
  renderAt(ONBOARDING)

  expect(await screen.findByText('pantalla inicio')).toBeInTheDocument()
})

test('an advance refused any other way shows the generic error and stays on the entry', async () => {
  stubSequence([FINISH], () => refusal(500, 'unknown'))
  renderAt(ONBOARDING)

  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(screen.queryByText('pantalla inicio')).not.toBeInTheDocument()
  expect(advances()).toBe(1)
})

test('"Done" replaces the entry in history: back lands on the screen before /onboarding', async () => {
  stubSequence([FINISH], () => json(OVER))
  const router = renderAt(ONBOARDING, 1, [SETTINGS])
  await screen.findByRole('heading', { name: 'Done' })
  expect(router.state.location.pathname).toBe(ONBOARDING_DONE)

  await act(() => router.navigate(-1))

  expect(await screen.findByText('pantalla ajustes')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(SETTINGS)
  await act(() => router.navigate(1))
  expect(router.state.location.pathname).toBe(ONBOARDING_DONE)
})

test('a second visit that finds every step done sends its own advance and shows "Done"', async () => {
  stubSequence([STEP_2, FINISH], () => json(OVER))
  const router = renderAt(ONBOARDING)
  await screen.findByText('Step 2 of 6')
  expect(advances()).toBe(0)

  await act(() => router.navigate(HOME))
  await screen.findByText('pantalla inicio')
  await act(() => router.navigate(ONBOARDING))

  expect(await screen.findByRole('heading', { name: 'Done' })).toBeInTheDocument()
  expect(advances()).toBe(1)
  expect(reads()).toBe(2)
})
