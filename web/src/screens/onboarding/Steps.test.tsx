/**
 * The six Onboarding steps at the screen seam (Testing Library, `fetch` faked): each step
 * saves through its owner's route first and only then sends the Onboarding write; a failed
 * save sends no pass and keeps what was typed; step 1 in price-only mode and after a
 * variety is named; step 2 aimed at the API's `stock_target` with "Agregar otra variedad".
 * Nothing is written to the console or the browser's storage.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider, type RouteObject } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import type { OnboardingProgress, StepSlug, StepState } from '../../api/onboarding'
import Listo from './Listo'
import OnboardingLayout from './OnboardingLayout'
import { OnboardingEntry, OnboardingStepRoute } from './OnboardingRoutes'
import { ONBOARDING_BOT, ONBOARDING_CATALOG_MESSAGE, ONBOARDING_CATEGORIES, ONBOARDING_PARTNER, ONBOARDING_STOCK, ONBOARDING_VARIETY } from '../../routes'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03' }
const ORDER: StepSlug[] = ['variety', 'stock', 'header_footer', 'bot', 'partner', 'categories']
const PATHS: Record<StepSlug, string> = {
  variety: 'variety',
  stock: 'stock',
  header_footer: 'catalog-message',
  bot: 'bot',
  partner: 'partner',
  categories: 'categories',
}

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
    varieties_count: 1,
    stock_entries_count: 0,
    price_target: null,
    stock_target: null,
    ...overrides,
  }
}

const NONE: StepState[] = ['pending', 'pending', 'pending', 'pending', 'pending', 'pending']
const REQUIRED: StepState[] = ['done', 'done', 'pending', 'pending', 'pending', 'pending']
const MANGO = { id: 7, name: 'Mango Bomb' }

type Handler = (body: unknown) => Response

const calls: string[] = []
let handlers: Record<string, Handler> = {}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function stubFetch(read: OnboardingProgress, extra: Record<string, Handler>): void {
  handlers = {
    'GET /onboarding-progress': () => json(read),
    // A new business starts with both pricing switches off (pricing-settings.md).
    'GET /pricing-settings': () => json({ is_bulk_pricing: false, is_vip_customers: false }),
    ...extra,
  }
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${String(input)}`
      calls.push(key)
      const handler = handlers[key]
      if (handler === undefined) return Promise.resolve(json({}, 404))
      const raw = init?.body
      return Promise.resolve(handler(typeof raw === 'string' ? JSON.parse(raw) : undefined))
    }),
  )
}

function renderAt(path: string) {
  const routes: RouteObject[] = [
    {
      element: <Outlet context={ME} />,
      children: [
        { index: true, element: <span>pantalla inicio</span> },
        {
          path: 'onboarding',
          element: <OnboardingLayout />,
          children: [
            { index: true, element: <OnboardingEntry /> },
            ...ORDER.map((slug) => ({
              path: PATHS[slug],
              element: <OnboardingStepRoute slug={slug} />,
            })),
            { path: 'done', element: <Listo /> },
          ],
        },
      ],
    },
  ]
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

const logs = ['log', 'warn', 'error', 'info', 'debug'] as const
const spies = logs.map((name) => vi.spyOn(console, name).mockImplementation(() => undefined))

beforeEach(() => {
  spies.forEach((spy) => spy.mockClear())
})

afterEach(() => {
  vi.unstubAllGlobals()
  calls.length = 0
  handlers = {}
  spies.forEach((spy) => expect(spy).not.toHaveBeenCalled())
  expect(window.localStorage.length).toBe(0)
  expect(window.sessionStorage.length).toBe(0)
})

const STOCK_FORM_READS = {
  'GET /varieties': () => json([{ id: 7, name: 'Mango Bomb', current_price: null }]),
  'GET /stock': () => json({ total: 0, varieties: [], entries: [] }),
}

test('step 1 with a price target shows the price form only and ends with one variety: no name field, no POST /varieties', async () => {
  const afterPrice = answer(['done', 'pending', 'pending', 'pending', 'pending', 'pending'], {
    stock_target: MANGO,
  })
  const priceBodies: unknown[] = []
  stubFetch(answer(NONE, { price_target: MANGO }), {
    'POST /varieties/7/prices': (body) => {
      priceBodies.push(body)
      return json({})
    },
    'GET /onboarding-progress': () => json(calls.includes('POST /varieties/7/prices') ? afterPrice : answer(NONE, { price_target: MANGO })),
  })
  const user = userEvent.setup()
  renderAt(ONBOARDING_VARIETY)

  expect(await screen.findByText('Variedad: Mango Bomb')).toBeInTheDocument()
  expect(screen.queryByLabelText(/^Nombre/)).not.toBeInTheDocument()
  // The price is effective today: there is no date to change.
  expect(screen.queryByLabelText('Rige desde')).not.toBeInTheDocument()
  // Both pricing switches are off: no bulk or VIP field, as on a variety's page.
  expect(screen.queryByLabelText(/^Precio por cantidad/)).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/^Precio VIP/)).not.toBeInTheDocument()
  // One "Cerrar", the frame's own: the price form draws no title row here.
  expect(screen.getAllByRole('button', { name: 'Cerrar' })).toHaveLength(1)
  await user.type(screen.getByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  expect(await screen.findByRole('heading', { name: 'Cargá lo que tenés hoy' })).toBeInTheDocument()
  expect(calls).not.toContain('POST /varieties')
  expect(priceBodies).toEqual([{ effective_from: '2026-10-03', list_price: 12000 }])
})

test('step 1 follows the pricing switches: with both on, the price form offers the bulk and VIP prices', async () => {
  stubFetch(answer(NONE, { price_target: MANGO }), {
    'GET /pricing-settings': () => json({ is_bulk_pricing: true, is_vip_customers: true }),
  })
  renderAt(ONBOARDING_VARIETY)

  expect(await screen.findByLabelText(/^Precio por cantidad/)).toBeInTheDocument()
  expect(screen.getByLabelText(/^Mínimo en gramos/)).toBeInTheDocument()
  expect(screen.getByLabelText(/^Precio VIP/)).toBeInTheDocument()
  expect(screen.queryByLabelText('Rige desde')).not.toBeInTheDocument()
})

test('step 1 with no target names the variety, then a refused price keeps what was typed and the retry sends only the price', async () => {
  let refuse = true
  stubFetch(answer(NONE), {
    'POST /varieties': () => json({ id: 7, name: 'Mango Bomb', current_price: null }, 201),
    'POST /varieties/7/prices': () =>
      refuse ? json({ code: 'variety.price_entry_invalid' }, 422) : json({}),
  })
  const user = userEvent.setup()
  renderAt(ONBOARDING_VARIETY)

  await user.type(await screen.findByLabelText(/^Nombre/), 'Mango Bomb')
  await user.click(screen.getByRole('button', { name: 'Agregá la variedad' }))
  const list = await screen.findByLabelText(/^Precio de lista/)
  await user.type(list, '12000')
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Revisá los precios cargados')
  expect(screen.getByLabelText(/^Precio de lista/)).toHaveValue('12000')

  refuse = false
  await user.click(screen.getByRole('button', { name: 'Guardá el precio' }))
  await waitFor(() => expect(calls.filter((call) => call === 'POST /varieties/7/prices')).toHaveLength(2))
  expect(calls.filter((call) => call === 'POST /varieties')).toHaveLength(1)
})

test('step 2 saves the opening stock of the stock target through the owner, then offers Seguir (advance) and Agregar otra variedad', async () => {
  const bodies: unknown[] = []
  const before = answer(['done', 'pending', 'pending', 'pending', 'pending', 'pending'], {
    stock_target: MANGO,
  })
  const after = answer(['done', 'done', 'pending', 'pending', 'pending', 'pending'], {
    stock_entries_count: 1,
  })
  stubFetch(before, {
    ...STOCK_FORM_READS,
    'POST /stock/entries': (body) => {
      bodies.push(body)
      return json({}, 201)
    },
    'GET /onboarding-progress': () => json(calls.includes('POST /stock/entries') ? after : before),
    'POST /onboarding-progress/advance': () => json(after),
  })
  const user = userEvent.setup()
  renderAt(ONBOARDING_STOCK)

  expect(await screen.findByText('Variedad: Mango Bomb')).toBeInTheDocument()
  expect(screen.getByText('Si no cargás el costo, el lote cuesta $ 0.')).toBeInTheDocument()
  await user.type(screen.getByLabelText('Gramos'), '500')
  await user.click(screen.getByRole('button', { name: 'Guardá la entrada' }))

  expect(await screen.findByRole('button', { name: 'Agregar otra variedad' })).toBeInTheDocument()
  expect(bodies).toEqual([
    { date: '2026-10-03', variety_id: 7, origin: 'opening_stock', grams: '500' },
  ])
  // Saving the stock is not an Onboarding write: nothing was sent to it yet.
  expect(calls.filter((call) => call.startsWith('POST /onboarding-progress'))).toEqual([])

  await user.click(screen.getByRole('button', { name: 'Seguir' }))
  expect(await screen.findByRole('heading', { name: 'Cómo sale tu catálogo' })).toBeInTheDocument()
  expect(calls).toContain('POST /onboarding-progress/advance')
})

test('"Agregar otra variedad" goes back to step 1 with the progress still on steps 1 and 2', async () => {
  const done = answer(REQUIRED, { stock_entries_count: 1 })
  stubFetch(done, {})
  const user = userEvent.setup()
  const router = renderAt(ONBOARDING_STOCK)

  await user.click(await screen.findByRole('button', { name: 'Agregar otra variedad' }))
  expect(await screen.findByRole('heading', { name: 'Cargá tu primera variedad' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(ONBOARDING_VARIETY)
  expect(screen.getByLabelText(/^Nombre/)).toBeInTheDocument()
  expect(calls.filter((call) => call.startsWith('POST'))).toEqual([])
})

test('step 3 sends the pass done only after the save answered, and a refused save sends none and keeps what was typed', async () => {
  const catalog = { text: null, header: 'H', footer: 'F', varieties: [] }
  let refuse = true
  stubFetch(answer(REQUIRED, { stock_entries_count: 1 }), {
    'GET /catalog': () => json(catalog),
    'PUT /catalog/header-footer': () =>
      refuse ? json({ code: 'catalog.header_too_long' }, 422) : json({ ...catalog, header: 'H!' }),
    'POST /onboarding-progress/passes': () =>
      json(answer(['done', 'done', 'done', 'pending', 'pending', 'pending'])),
  })
  const user = userEvent.setup()
  renderAt(ONBOARDING_CATALOG_MESSAGE)

  const header = await screen.findByLabelText('Encabezado')
  await user.type(header, '!')
  expect(screen.queryByRole('button', { name: 'Dejar así' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Guardá el mensaje' }))
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(header).toHaveValue('H!')
  expect(calls).not.toContain('POST /onboarding-progress/passes')

  refuse = false
  await user.click(screen.getByRole('button', { name: 'Guardá el mensaje' }))
  expect(await screen.findByRole('heading', { name: 'Conectá tu bot de Telegram' })).toBeInTheDocument()
  expect(calls.indexOf('PUT /catalog/header-footer')).toBeLessThan(
    calls.indexOf('POST /onboarding-progress/passes'),
  )
})

test('step 3 "Dejar así" passes it done with the defaults kept, and sends no catalog write', async () => {
  const bodies: unknown[] = []
  stubFetch(answer(REQUIRED, { stock_entries_count: 1 }), {
    'GET /catalog': () => json({ text: null, header: 'H', footer: 'F', varieties: [] }),
    'POST /onboarding-progress/passes': (body) => {
      bodies.push(body)
      return json(answer(['done', 'done', 'done', 'pending', 'pending', 'pending']))
    },
  })
  const user = userEvent.setup()
  renderAt(ONBOARDING_CATALOG_MESSAGE)

  await user.click(await screen.findByRole('button', { name: 'Dejar así' }))
  expect(await screen.findByRole('heading', { name: 'Conectá tu bot de Telegram' })).toBeInTheDocument()
  expect(bodies).toEqual([{ step: 'header_footer', as: 'done' }])
  expect(calls.filter((call) => call.startsWith('PUT'))).toEqual([])
})

test('step 4 passes done after a successful Probarlo, says where to publish and shows no catalog link; a failed Probarlo sends no pass', async () => {
  const bodies: unknown[] = []
  let refuse = true
  stubFetch(answer(['done', 'done', 'done', 'pending', 'pending', 'pending'], { stock_entries_count: 1 }), {
    'GET /pinned-catalog': () => json({ token_saved_on: null, own_chat: null, channel_chat: null }),
    'POST /pinned-catalog/test': () =>
      refuse
        ? json({ code: 'pinned_catalog.telegram_refused' }, 422)
        : json({ token_saved_on: '2026-10-03', own_chat: '555', channel_chat: null, previous_pin_left: false }),
    'POST /onboarding-progress/passes': (body) => {
      bodies.push(body)
      return json(answer(['done', 'done', 'done', 'done', 'pending', 'pending']))
    },
  })
  const user = userEvent.setup()
  renderAt(ONBOARDING_BOT)

  expect(await screen.findByText('Cuando quieras, publicalo desde Variedades → Mandar catálogo')).toBeInTheDocument()
  expect(screen.queryByText('Ir al catálogo')).not.toBeInTheDocument()
  await user.type(screen.getByLabelText('Token del bot'), '123:abc')
  await user.type(screen.getByLabelText('Tu chat'), '555')
  await user.click(screen.getByRole('button', { name: 'Probarlo' }))
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(bodies).toEqual([])
  expect(screen.getByLabelText('Tu chat')).toHaveValue('555')

  refuse = false
  await user.click(screen.getByRole('button', { name: 'Probarlo' }))
  expect(await screen.findByRole('heading', { name: 'Enviale el link a tu socio' })).toBeInTheDocument()
  expect(bodies).toEqual([{ step: 'bot', as: 'done' }])
})

test('step 5 offers Seguir only once a link is created, and passes done', async () => {
  const bodies: unknown[] = []
  stubFetch(answer(['done', 'done', 'done', 'done', 'pending', 'pending'], { stock_entries_count: 1 }), {
    'POST /invitations': () => json({ url: 'http://x/invitation/abc', expires_at: '2026-10-10T00:00:00Z' }, 201),
    'POST /onboarding-progress/passes': (body) => {
      bodies.push(body)
      return json(answer(['done', 'done', 'done', 'done', 'done', 'pending']))
    },
  })
  const user = userEvent.setup()
  renderAt(ONBOARDING_PARTNER)

  expect(await screen.findByRole('heading', { name: 'Enviale el link a tu socio' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Seguir' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Invitá a un socio' }))
  await user.click(await screen.findByRole('button', { name: 'Seguir' }))

  expect(await screen.findByRole('heading', { name: 'Categorías de gastos' })).toBeInTheDocument()
  expect(bodies).toEqual([{ step: 'partner', as: 'done' }])
})

test('step 6 adding a category saves at once and passes nothing; only Seguir passes, and the last pass opens Listo', async () => {
  const bodies: unknown[] = []
  stubFetch(answer(['done', 'done', 'done', 'done', 'done', 'pending'], { stock_entries_count: 1 }), {
    'GET /expense-categories': () => json([{ id: 1, name: 'Insumos' }]),
    'POST /expense-categories': () => json({ id: 2, name: 'Luz' }, 201),
    'POST /onboarding-progress/passes': (body) => {
      bodies.push(body)
      return json(
        answer(['done', 'done', 'done', 'done', 'done', 'done'], {
          over: true,
          resume: null,
          stock_entries_count: 1,
        }),
      )
    },
  })
  const user = userEvent.setup()
  renderAt(ONBOARDING_CATEGORIES)

  expect(await screen.findByText('Insumos')).toBeInTheDocument()
  await user.type(screen.getByLabelText('Nueva categoría'), 'Luz')
  await user.click(screen.getByRole('button', { name: '+ Categoría' }))
  await waitFor(() => expect(calls).toContain('POST /expense-categories'))
  expect(bodies).toEqual([])

  await user.click(screen.getByRole('button', { name: 'Seguir' }))
  expect(await screen.findByRole('heading', { name: 'Listo' })).toBeInTheDocument()
  expect(bodies).toEqual([{ step: 'categories', as: 'done' }])
})

test('a failed Onboarding write after a saved step shows the retry and the same tap sends it again', async () => {
  let fail = true
  stubFetch(answer(['done', 'done', 'done', 'done', 'done', 'pending'], { stock_entries_count: 1 }), {
    'GET /expense-categories': () => json([{ id: 1, name: 'Insumos' }]),
    'POST /onboarding-progress/passes': () =>
      fail ? json({}, 500) : json(answer(['done', 'done', 'done', 'done', 'done', 'done'], { over: true, resume: null })),
  })
  const user = userEvent.setup()
  renderAt(ONBOARDING_CATEGORIES)

  await user.click(await screen.findByRole('button', { name: 'Seguir' }))
  expect(await screen.findByText('Algo falló. Probá de nuevo.')).toBeInTheDocument()
  expect(screen.getByText('Insumos')).toBeInTheDocument()

  fail = false
  await user.click(screen.getByRole('button', { name: 'Seguir' }))
  expect(await screen.findByRole('heading', { name: 'Listo' })).toBeInTheDocument()
})
