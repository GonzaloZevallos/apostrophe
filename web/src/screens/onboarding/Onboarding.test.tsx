/**
 * The Onboarding's routes, step frame and "Listo" at the screen seam (Testing Library,
 * `fetch` faked): where each path leads, the frame's controls and leave confirmation,
 * "Saltar el resto" only when the API allows it, "Listo" only after `over: true`, and
 * Nueva venta opened from "Listo" going back to Inicio. Nothing is written to the console
 * or the browser's storage.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
  type RouteObject,
} from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
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
} from '../../routes'
import { useBackOr } from '../../components/useBackOr'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03' }
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
    varieties_count: 2,
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

function renderAt(initial: string | { pathname: string; state: unknown }, index = 0, before: string[] = []) {
  const routes: RouteObject[] = [
    {
      element: <Provide />,
      children: [
        { index: true, element: <span>pantalla inicio</span> },
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
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
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

test('the Onboarding entry opens the resume step with its title, "Paso N de 6" and its badge, and nothing to skip on a required step', async () => {
  stubProgress(answer(['done', 'pending', 'pending', 'pending', 'pending', 'pending']))
  renderAt(ONBOARDING)

  expect(await screen.findByText('Paso 2 de 6')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Cargá lo que tenés hoy' })).toBeInTheDocument()
  expect(screen.getByText('Obligatorio')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Saltar' })).not.toBeInTheDocument()
  expect(screen.queryByText('Nueva venta')).not.toBeInTheDocument()
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

test('a deep link to "Listo" without the flag goes to Inicio', async () => {
  stubProgress({ ...REQUIRED_DONE, over: true, resume: null })
  renderAt(ONBOARDING_DONE)

  expect(await screen.findByText('pantalla inicio')).toBeInTheDocument()
})

test('"Listo" entered with the flag has one line per step and never an amount', async () => {
  stubProgress(
    answer(['done', 'done', 'done', 'skipped', 'skipped', 'done'], { over: true, resume: null }),
  )
  renderAt({ pathname: ONBOARDING_DONE, state: { listo: true } })

  expect(await screen.findByRole('heading', { name: 'Listo' })).toBeInTheDocument()
  expect(screen.getByText('6 de 6 pasos')).toBeInTheDocument()
  expect(screen.getByText('Hecho · 2 variedades')).toBeInTheDocument()
  expect(screen.getByText('Hecho · 2 entradas')).toBeInTheDocument()
  expect(screen.getByText('Para después — en Configuración → Integraciones')).toBeInTheDocument()
  expect(screen.getByText('Para después — en Configuración → Usuarios')).toBeInTheDocument()
  expect(screen.getAllByText('Hecho')).toHaveLength(2)
})

test('"Saltar el resto" is hidden until both required steps are done', async () => {
  stubProgress(answer(['done', 'pending', 'pending', 'pending', 'pending', 'pending']))
  const { unmount } = renderHidden(ONBOARDING_BOT)
  await screen.findByText('Paso 4 de 6')
  expect(screen.queryByRole('button', { name: 'Saltar el resto' })).not.toBeInTheDocument()
  unmount()
})

function renderHidden(path: string) {
  const router = renderAt(path)
  return { unmount: () => router.dispose() }
}

test('with both required steps done "Saltar el resto" sends skip-rest and "Listo" opens only after over: true', async () => {
  stubProgress(REQUIRED_DONE)
  writes['POST /onboarding-progress/skip-rest'] = answer(['done', 'done', 'skipped', 'skipped', 'skipped', 'skipped'], {
    over: true,
    resume: null,
  })
  renderAt(ONBOARDING_BOT)

  await userEvent.click(await screen.findByRole('button', { name: 'Saltar el resto' }))

  expect(await screen.findByRole('heading', { name: 'Listo' })).toBeInTheDocument()
  expect(calls).toContain('POST /onboarding-progress/skip-rest {}')
})

test('"Saltar" sends a skipped pass for the step and opens the step the answer resumes at', async () => {
  stubProgress(REQUIRED_DONE)
  writes['POST /onboarding-progress/passes'] = answer(['done', 'done', 'pending', 'skipped', 'pending', 'pending'])
  renderAt(ONBOARDING_BOT)

  await userEvent.click(await screen.findByRole('button', { name: 'Saltar' }))

  expect(await screen.findByText('Paso 3 de 6')).toBeInTheDocument()
  expect(calls).toContain('POST /onboarding-progress/passes {"step":"bot","as":"skipped"}')
  expect(screen.getByText('Si lo salteás, lo hacés después en Configuración → Mensaje del catálogo.')).toBeInTheDocument()
})

test('a skip answered with required steps unmet does not draw "Listo"', async () => {
  stubProgress(REQUIRED_DONE)
  writes['POST /onboarding-progress/passes'] = answer(['pending', 'done', 'skipped', 'skipped', 'skipped', 'skipped'])
  renderAt(ONBOARDING_CATEGORIES)

  await userEvent.click(await screen.findByRole('button', { name: 'Saltar' }))

  expect(await screen.findByText('Paso 1 de 6')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Listo' })).not.toBeInTheDocument()
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
    await screen.findByText('Paso 4 de 6')

    await userEvent.type(screen.getByLabelText('Algo'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'No, seguí escribiendo' }))
    expect(screen.getByLabelText('Algo')).toHaveValue('x')

    await userEvent.click(screen.getByRole('button', { name: 'Saltar' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(calls.filter((call) => call.startsWith('POST'))).toEqual([])

    await userEvent.click(screen.getByRole('button', { name: 'No, seguí escribiendo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, descartalo' }))
    expect(await screen.findByText('pantalla inicio')).toBeInTheDocument()
  } finally {
    STEP_BODIES.bot = original
  }
  expect(calls.filter((call) => call.startsWith('POST'))).toEqual([])
})

test('"Cerrar" on an untouched step leaves at once to Inicio and sends nothing', async () => {
  stubProgress(REQUIRED_DONE)
  renderAt(ONBOARDING_BOT)

  await userEvent.click(await screen.findByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('pantalla inicio')).toBeInTheDocument()
  expect(calls.filter((call) => call.startsWith('POST'))).toEqual([])
})

test('"Atrás" opens the step before', async () => {
  stubProgress(REQUIRED_DONE)
  renderAt(ONBOARDING_BOT)

  await userEvent.click(await screen.findByRole('button', { name: 'Atrás' }))

  expect(await screen.findByText('Paso 3 de 6')).toBeInTheDocument()
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
    expect(await screen.findByText('Paso 4 de 6')).toBeInTheDocument()
  } finally {
    STEP_BODIES.header_footer = original
  }
})

test('Nueva venta opened from "Listo" goes back to Inicio when closed', async () => {
  stubProgress(answer(['done', 'done', 'done', 'done', 'done', 'done'], { over: true, resume: null }))
  renderAt({ pathname: ONBOARDING_DONE, state: { listo: true } }, 1, [HOME])

  await userEvent.click(await screen.findByRole('button', { name: 'Cargar mi primera venta' }))
  await userEvent.click(await screen.findByRole('button', { name: 'cerrar nueva venta' }))

  await waitFor(() => expect(screen.getByText('pantalla inicio')).toBeInTheDocument())
})

test('"Ir a Inicio" opens Inicio', async () => {
  stubProgress(answer(['done', 'done', 'done', 'done', 'done', 'done'], { over: true, resume: null }))
  renderAt({ pathname: ONBOARDING_DONE, state: { listo: true } })

  await userEvent.click(await screen.findByRole('button', { name: 'Ir a Inicio' }))

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
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )

  expect(await screen.findByText('Paso 5 de 6')).toBeInTheDocument()
  expect(calls).toEqual([])
})
