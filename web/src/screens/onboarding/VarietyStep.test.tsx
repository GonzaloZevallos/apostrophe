/**
 * Step 1 (`VarietyStep`) at the screen seam: Testing Library inside a real data router, with
 * `fetch` faked by a small stand-in for the API that answers `/onboarding-progress` from the
 * varieties it holds. One form with one primary action saves the variety and then its price;
 * a refused price keeps the variety and the retry sends only the price; a return to a done
 * step 1 shows the saved variety ("Hecho") and writes nothing; "Add another variety" opens
 * the form again through a bare history flag.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider, type RouteObject } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import type { OnboardingProgress, OnboardingTarget, StepSlug } from '../../api/onboarding'
import { inAppState } from '../../components/inAppState'
import { ONBOARDING_STOCK, ONBOARDING_VARIETY } from '../../routes'
import Listo from './Listo'
import OnboardingLayout from './OnboardingLayout'
import { OnboardingEntry, OnboardingStepRoute } from './OnboardingRoutes'
import { DISCARD_DETAIL, PARTLY_SAVED_DETAIL } from '../../copy/onboarding'
import { CHECKLIST_DONE } from '../../copy/inicio'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03' }

interface Stored {
  id: number
  name: string
  price: number | null
}

/** The API's side: the varieties it holds, and what it answers from them. */
let varieties: Stored[] = []
let nextId = 1
let nameRefusal: string | null = null
let priceRefusals = 0
let stocked = false
const calls: string[] = []
const bodies: Record<string, unknown[]> = {}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function byName(): Stored[] {
  return [...varieties].sort((a, b) => a.name.localeCompare(b.name))
}

function target(item: Stored | undefined): OnboardingTarget | null {
  return item === undefined ? null : { id: item.id, name: item.name }
}

function progress(): OnboardingProgress {
  const sorted = byName()
  const pricedOne = sorted.find((item) => item.price !== null)
  const varietyDone = pricedOne !== undefined
  const order: StepSlug[] = ['variety', 'stock', 'header_footer', 'bot', 'partner', 'categories']
  return {
    offered: true,
    over: false,
    count: (varietyDone ? 1 : 0) + (stocked ? 1 : 0),
    resume: !varietyDone ? 'variety' : !stocked ? 'stock' : 'header_footer',
    steps: order.map((step) => ({
      step,
      state: (step === 'variety' && varietyDone) || (step === 'stock' && stocked) ? 'done' : 'pending',
    })),
    can_skip_rest: varietyDone && stocked,
    varieties_count: varieties.length,
    stock_entries_count: stocked ? 1 : 0,
    price_target: target(sorted.find((item) => item.price === null)),
    priced_target: target(pricedOne),
    stock_target: varietyDone && !stocked ? target(pricedOne) : null,
  }
}

function record(key: string, raw: RequestInit | undefined): void {
  calls.push(key)
  const text = raw?.body
  if (typeof text === 'string') (bodies[key] ??= []).push(JSON.parse(text))
}

function fakeApi(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const path = String(input)
  const method = init?.method ?? 'GET'
  const key = `${method} ${path}`
  record(key, init)
  if (key === 'GET /onboarding-progress') return Promise.resolve(json(progress()))
  if (key === 'GET /pricing-settings') {
    return Promise.resolve(json({ is_bulk_pricing: false, is_vip_customers: false }))
  }
  if (key === 'POST /varieties') {
    if (nameRefusal !== null) return Promise.resolve(json({ code: nameRefusal }, 422))
    const body = JSON.parse(String(init?.body)) as { name: string }
    const created: Stored = { id: nextId++, name: body.name, price: null }
    varieties.push(created)
    return Promise.resolve(json({ id: created.id, name: created.name, archived: false, current_price: null }, 201))
  }
  const price = /^\/varieties\/(\d+)\/prices$/.exec(path)
  if (method === 'POST' && price !== null) {
    if (priceRefusals > 0) {
      priceRefusals -= 1
      return Promise.resolve(json({ code: 'variety.price_entry_invalid' }, 422))
    }
    const found = varieties.find((item) => item.id === Number(price[1]))
    if (found === undefined) return Promise.resolve(json({ code: 'variety.not_found' }, 404))
    found.price = (JSON.parse(String(init?.body)) as { list_price: number }).list_price
    return Promise.resolve(json({ id: 1, list_price: found.price }, 201))
  }
  const read = /^\/varieties\/(\d+)$/.exec(path)
  if (method === 'GET' && read !== null) {
    const found = varieties.find((item) => item.id === Number(read[1]))
    if (found === undefined) return Promise.resolve(json({ code: 'variety.not_found' }, 404))
    return Promise.resolve(
      json({
        id: found.id,
        name: found.name,
        archived: false,
        current_price:
          found.price === null
            ? null
            : { id: 1, effective_from: '2026-10-03', list_price: found.price, bulk_price: null, bulk_minimum: null, vip_price: null },
      }),
    )
  }
  return Promise.resolve(json({}, 404))
}

function count(key: string): number {
  return calls.filter((call) => call === key).length
}

function renderAt(entries: Parameters<typeof createMemoryRouter>[1]) {
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
            { path: 'variety', element: <OnboardingStepRoute slug="variety" /> },
            { path: 'stock', element: <span>paso dos</span> },
            { path: 'done', element: <Listo /> },
          ],
        },
      ],
    },
  ]
  const router = createMemoryRouter(routes, entries)
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

function renderStep(state?: unknown) {
  return renderAt({ initialEntries: [{ pathname: ONBOARDING_VARIETY, state }] })
}

const logs = ['log', 'warn', 'error', 'info', 'debug'] as const
const spies = logs.map((name) => vi.spyOn(console, name).mockImplementation(() => undefined))

beforeEach(() => {
  varieties = []
  nextId = 1
  nameRefusal = null
  priceRefusals = 0
  stocked = false
  calls.length = 0
  Object.keys(bodies).forEach((key) => delete bodies[key])
  spies.forEach((spy) => spy.mockClear())
  vi.stubGlobal('fetch', vi.fn(fakeApi))
})

afterEach(() => {
  vi.unstubAllGlobals()
  spies.forEach((spy) => expect(spy).not.toHaveBeenCalled())
  expect(window.localStorage.length).toBe(0)
  expect(window.sessionStorage.length).toBe(0)
})

test('one primary action saves the variety and then its price', async () => {
  const user = userEvent.setup()
  const router = renderStep()

  await user.type(await screen.findByLabelText(/^Name/), 'Mango Bomb')
  await user.type(screen.getByLabelText(/^Precio de lista/), '12000')
  expect(screen.getAllByRole('button', { name: /Save|Add/ })).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: 'Save the variety' }))

  await waitFor(() => expect(router.state.location.pathname).toBe(ONBOARDING_STOCK))
  expect(bodies['POST /varieties']).toEqual([{ name: 'Mango Bomb' }])
  expect(bodies['POST /varieties/1/prices']).toEqual([{ effective_from: '2026-10-03', list_price: 12000 }])
  // The progress is read again between the two writes.
  expect(calls.indexOf('POST /varieties')).toBeLessThan(calls.indexOf('POST /varieties/1/prices'))
  expect(calls.slice(calls.indexOf('POST /varieties'), calls.indexOf('POST /varieties/1/prices'))).toContain(
    'GET /onboarding-progress',
  )
})

test('a name refusal sends no price request and keeps what was typed', async () => {
  nameRefusal = 'variety.name_taken'
  const user = userEvent.setup()
  renderStep()

  await user.type(await screen.findByLabelText(/^Name/), 'Mango Bomb')
  await user.type(screen.getByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Save the variety' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe una variedad con ese nombre')
  expect(screen.getByLabelText(/^Name/)).toHaveValue('Mango Bomb')
  expect(screen.getByLabelText(/^Precio de lista/)).toHaveValue('12000')
  expect(calls.filter((call) => call.endsWith('/prices'))).toEqual([])
})

test('a refused price keeps everything typed, shows on its field, and the retry sends only the price', async () => {
  priceRefusals = 1
  const user = userEvent.setup()
  const router = renderStep()

  await user.type(await screen.findByLabelText(/^Name/), 'Mango Bomb')
  await user.type(screen.getByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Save the variety' }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Revisá los precios cargados')
  expect(screen.getByLabelText(/^Precio de lista/)).toHaveValue('12000')
  expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument()
  expect(screen.getByText('Variety: Mango Bomb')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Save the variety' }))
  await waitFor(() => expect(router.state.location.pathname).toBe(ONBOARDING_STOCK))
  expect(count('POST /varieties')).toBe(1)
  expect(count('POST /varieties/1/prices')).toBe(2)
})

test('a double tap sends one POST /varieties', async () => {
  const user = userEvent.setup()
  renderStep()

  await user.type(await screen.findByLabelText(/^Name/), 'Mango Bomb')
  await user.type(screen.getByLabelText(/^Precio de lista/), '12000')
  const save = screen.getByRole('button', { name: 'Save the variety' })
  await user.dblClick(save)

  await waitFor(() => expect(count('POST /varieties/1/prices')).toBeGreaterThan(0))
  expect(count('POST /varieties')).toBe(1)
})

test('the price input keeps its DOM node and value across the variety write and the refresh', async () => {
  priceRefusals = 1
  const user = userEvent.setup()
  renderStep()

  await user.type(await screen.findByLabelText(/^Name/), 'Mango Bomb')
  const price = screen.getByLabelText(/^Precio de lista/)
  await user.type(price, '12000')
  await user.click(screen.getByRole('button', { name: 'Save the variety' }))

  await screen.findByRole('alert')
  expect(screen.getByLabelText(/^Precio de lista/)).toBe(price)
  expect(price).toHaveValue('12000')
  expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument()
  expect(bodies['POST /varieties/1/prices']).toEqual([{ effective_from: '2026-10-03', list_price: 12000 }])
})

test('variety saved and price refused, then step 2 and back with no reload: the price form of that variety, no second POST /varieties', async () => {
  priceRefusals = 1
  const user = userEvent.setup()
  const router = renderStep()

  await user.type(await screen.findByLabelText(/^Name/), 'Mango Bomb')
  await user.type(screen.getByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Save the variety' }))
  await screen.findByRole('alert')

  await act(() => router.navigate(ONBOARDING_STOCK))
  // The price typed is lost on leaving: the frame asks first.
  await user.click(await screen.findByRole('button', { name: 'Yes, discard it' }))
  expect(await screen.findByText('paso dos')).toBeInTheDocument()
  await act(() => router.navigate(-1))

  expect(await screen.findByText('Variety: Mango Bomb')).toBeInTheDocument()
  expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument()
  await user.type(screen.getByLabelText(/^Precio de lista/), '9000')
  await user.click(screen.getByRole('button', { name: 'Save the variety' }))
  await waitFor(() => expect(router.state.location.pathname).toBe(ONBOARDING_STOCK))
  expect(count('POST /varieties')).toBe(1)
})

test('with one variety priced and a second saved with no price, step 1 shows the second and only its price', async () => {
  varieties = [
    { id: 1, name: 'Amapola', price: 9000 },
    { id: 2, name: 'Mango Bomb', price: null },
  ]
  nextId = 3
  const user = userEvent.setup()
  const router = renderStep()

  expect(await screen.findByText('Variety: Mango Bomb')).toBeInTheDocument()
  expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument()
  await user.type(screen.getByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Save the variety' }))

  await waitFor(() => expect(router.state.location.pathname).toBe(ONBOARDING_STOCK))
  expect(count('POST /varieties')).toBe(0)
  expect(varieties).toHaveLength(2)
})

test('two unpriced varieties and one priced: the first price save stays on step 1 with the second, the second goes to step 2', async () => {
  varieties = [
    { id: 1, name: 'Amapola', price: 9000 },
    { id: 2, name: 'Begonia', price: null },
    { id: 3, name: 'Caléndula', price: null },
  ]
  const user = userEvent.setup()
  const router = renderStep()

  expect(await screen.findByText('Variety: Begonia')).toBeInTheDocument()
  await user.type(screen.getByLabelText(/^Precio de lista/), '5000')
  await user.click(screen.getByRole('button', { name: 'Save the variety' }))

  expect(await screen.findByText('Variety: Caléndula')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(ONBOARDING_VARIETY)
  expect(screen.getByLabelText(/^Precio de lista/)).toHaveValue('')
  await user.type(screen.getByLabelText(/^Precio de lista/), '6000')
  await user.click(screen.getByRole('button', { name: 'Save the variety' }))
  await waitFor(() => expect(router.state.location.pathname).toBe(ONBOARDING_STOCK))
  expect(count('POST /varieties')).toBe(0)
})

test('arriving with only a priced variety shows "Hecho" with its name and price; its action goes to step 2 and writes nothing', async () => {
  varieties = [{ id: 1, name: 'Mango Bomb', price: 11000 }]
  const user = userEvent.setup()
  const router = renderStep()

  expect(await screen.findByText('Mango Bomb')).toBeInTheDocument()
  expect(await screen.findByText('$ 11.000 x g')).toBeInTheDocument()
  expect(screen.getByText(CHECKLIST_DONE)).toBeInTheDocument()
  expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/^Precio de lista/)).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Continue' }))

  await waitFor(() => expect(router.state.location.pathname).toBe(ONBOARDING_STOCK))
  expect(calls.filter((call) => call.startsWith('POST'))).toEqual([])
})

test('a "Hecho" read that answers no price today refetches the progress and shows the price form', async () => {
  varieties = [{ id: 1, name: 'Mango Bomb', price: 11000 }]
  const real = fakeApi
  let served = 0
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (`${init?.method ?? 'GET'} ${String(input)}` === 'GET /varieties/1' && served === 0) {
        served += 1
        calls.push('GET /varieties/1')
        // The price went away between the two reads (a partner removed it).
        const only = varieties[0]
        if (only !== undefined) only.price = null
        return Promise.resolve(
          json({ id: 1, name: 'Mango Bomb', archived: false, current_price: null }),
        )
      }
      return real(input, init)
    }),
  )
  renderStep()

  expect(await screen.findByText('Variety: Mango Bomb')).toBeInTheDocument()
  expect(screen.getByLabelText(/^Precio de lista/)).toBeInTheDocument()
  expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument()
})

test('the add-another flag opens the empty form, a reload keeps it, and the variety write clears it from the entry', async () => {
  varieties = [{ id: 1, name: 'Amapola', price: 9000 }]
  nextId = 2
  const user = userEvent.setup()
  const router = renderStep(inAppState({ pathname: ONBOARDING_STOCK }, { anotherVariety: true }))

  const name = await screen.findByLabelText(/^Name/)
  expect(calls.filter((call) => call.startsWith('POST'))).toEqual([])
  expect(router.state.location.state).toMatchObject({ anotherVariety: true })

  await user.type(name, 'Begonia')
  await user.type(screen.getByLabelText(/^Precio de lista/), '5000')
  await user.click(screen.getByRole('button', { name: 'Save the variety' }))
  await waitFor(() => expect(router.state.location.pathname).toBe(ONBOARDING_STOCK))
  // The step-1 entry the add-another opened is now stateless: history back shows "Hecho".
  await act(() => router.navigate(-1))
  expect(await screen.findByText(CHECKLIST_DONE)).toBeInTheDocument()
  expect(router.state.location.state).toBeNull()
  expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument()
})

test('a reload with the add-another flag and nothing written draws the name field again and writes nothing', async () => {
  varieties = [{ id: 1, name: 'Amapola', price: 9000 }]
  nextId = 2
  const entry = inAppState({ pathname: ONBOARDING_STOCK }, { anotherVariety: true })
  renderStep(entry)
  expect(await screen.findByLabelText(/^Name/)).toBeInTheDocument()

  cleanup()
  renderStep(entry)

  expect(await screen.findByLabelText(/^Name/)).toBeInTheDocument()
  expect(screen.queryByText(CHECKLIST_DONE)).not.toBeInTheDocument()
  expect(calls.filter((call) => call.startsWith('POST'))).toEqual([])
})

test('with the frame, nothing written and a name typed: "Close" asks with the discard detail', async () => {
  const user = userEvent.setup()
  renderStep()

  await user.type(await screen.findByLabelText(/^Name/), 'Mango')
  await user.click(screen.getByRole('button', { name: 'Close' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText(DISCARD_DETAIL)).toBeInTheDocument()
})

test('with the frame, the variety saved and a price typed: "Close" asks with the partly-saved detail', async () => {
  priceRefusals = 1
  const user = userEvent.setup()
  renderStep()

  await user.type(await screen.findByLabelText(/^Name/), 'Mango')
  await user.type(screen.getByLabelText(/^Precio de lista/), '12000')
  await user.click(screen.getByRole('button', { name: 'Save the variety' }))
  await screen.findByRole('alert')
  await user.click(screen.getByRole('button', { name: 'Close' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText(PARTLY_SAVED_DETAIL)).toBeInTheDocument()
})
