/**
 * `ClienteForm` at the screen seam: add and edit share the form; a refusal maps
 * to its field and keeps what was typed (`customers.md`); a save on a `gone`
 * customer closes the form and shows `GONE_NOTICE` instead of "Cliente guardado"
 * (plan, "Gone records").
 */

import { CUSTOMER, CUSTOMERS, CUSTOMER_EDIT, CUSTOMER_NEW, LOGIN, pathTo } from '../../routes'
import { GONE_NOTICE } from '../../api/refusals'
import { useGoneNotice } from '../../components/goneExit'
import { SheetRouterProvider } from '../../components/useSheetStack'
import { stubViewport } from '../../test-viewport'
import { StrictMode } from 'react'
import { inAppState } from '../../components/inAppState'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, Outlet, RouterProvider, useLocation } from 'react-router'
import FlashProvider from '../../flash/FlashProvider'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { queryClient, setCurrentPath, setNavigate } from '../../queryClient'
import ClienteForm from './ClienteForm'
import { stubFetchWithSettings } from '../stubFetchWithSettings'


function ListStub() {
  const location = useLocation()
  const state = location.state as { toast?: string } | null
  const goneShown = useGoneNotice()
  return (
    <div>
      <span>la lista</span>
      {state?.toast !== undefined && <span>{state.toast}</span>}
      {goneShown && <span>{GONE_NOTICE}</span>}
    </div>
  )
}

function FichaStub() {
  const location = useLocation()
  const state = location.state as { toast?: string } | null
  const goneShown = useGoneNotice()
  return (
    <div>
      <span>la ficha</span>
      {state?.toast !== undefined && <span>{state.toast}</span>}
      {goneShown && <span>{GONE_NOTICE}</span>}
    </div>
  )
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ROUTES = [
  {
    element: (
      <FlashProvider>
        <Outlet />
      </FlashProvider>
    ),
    children: [
      {
        path: CUSTOMERS,
        element: (
          <>
            <ListStub />
            <Link to={CUSTOMER_NEW} state={inAppState({ pathname: CUSTOMERS })}>
              Abrir el formulario
            </Link>
          </>
        ),
      },
      { path: CUSTOMER_NEW, element: <ClienteForm mode="nuevo" /> },
      { path: CUSTOMER_EDIT, element: <ClienteForm mode="editar" /> },
      {
        path: CUSTOMER,
        element: (
          <>
            <FichaStub />
            <Link to={pathTo(CUSTOMER_EDIT, { id: 7 })} state={inAppState({ pathname: CUSTOMERS })}>
              Editar
            </Link>
          </>
        ),
      },
    ],
  },
]

function renderForm(initialPath: string, previous?: string) {
  const router = createMemoryRouter(
    ROUTES,
    previous === undefined
      ? { initialEntries: [initialPath] }
      : { initialEntries: [previous, initialPath], initialIndex: 1 },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

let api: ReturnType<typeof stubFetchWithSettings>

beforeEach(() => {
  api = stubFetchWithSettings()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('registers a customer and lands on its card', async () => {
  api.mockResolvedValue(
    jsonResponse(201, { id: 9, name: 'Nico', phone: '+5491131785094', channel: null, vip: false }),
  )
  renderForm(CUSTOMER_NEW)

  await userEvent.type(screen.getByLabelText('Teléfono'), '+5491131785094')
  await userEvent.type(screen.getByLabelText('Nombre'), 'Nico')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá y usá' }))

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith(
    '/customers',
    expect.objectContaining({ method: 'POST' }),
  )
})

test('only Nombre is marked required; Teléfono stays optional', () => {
  renderForm(CUSTOMER_NEW)

  expect(screen.getByLabelText('Nombre')).toBeRequired()
  expect(screen.getByLabelText('Teléfono')).not.toBeRequired()
})

test('registering with no phone sends the request and shows the saved toast', async () => {
  api.mockResolvedValue(
    jsonResponse(201, { id: 10, name: 'Sol', phone: null, channel: null, vip: false }),
  )
  renderForm(CUSTOMER_NEW)

  await userEvent.type(screen.getByLabelText('Nombre'), 'Sol')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá y usá' }))

  expect(await screen.findByText('Cliente guardado')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith(
    '/customers',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Sol', phone: '', channel: null, vip: false }) }),
  )
})

test('clearing a phone when editing sends it and shows the saved toast', async () => {
  api.mockResolvedValueOnce(
    jsonResponse(200, { id: 7, name: 'Tincho', phone: '+5491144861258', channel: null, vip: false }),
  )
  api.mockResolvedValueOnce(
    jsonResponse(200, { id: 7, name: 'Tincho', phone: null, channel: null, vip: false }),
  )
  renderForm(pathTo(CUSTOMER_EDIT, { id: 7 }))

  expect(await screen.findByLabelText('Teléfono')).toHaveValue('+5491144861258')
  await userEvent.clear(screen.getByLabelText('Teléfono'))
  await userEvent.click(screen.getByRole('button', { name: 'Guardá y usá' }))

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(await screen.findByText('Cliente guardado')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith(
    '/customers/7',
    expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Tincho', phone: '', channel: null, vip: false }) }),
  )
})

test('a duplicate phone is refused on the phone field, keeping what was typed', async () => {
  api.mockResolvedValue(
    jsonResponse(409, { detail: 'taken', code: 'customer.phone_taken' }),
  )
  renderForm(CUSTOMER_NEW)

  await userEvent.type(screen.getByLabelText('Teléfono'), '+5491131785094')
  await userEvent.type(screen.getByLabelText('Nombre'), 'Nico')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá y usá' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Ese teléfono ya es de otro cliente')
  expect(screen.getByLabelText('Teléfono')).toHaveValue('+5491131785094')
  expect(screen.getByLabelText('Nombre')).toHaveValue('Nico')
})

test('edit loads the existing customer and saves the change', async () => {
  api.mockResolvedValueOnce(
    jsonResponse(200, {
      id: 7,
      name: 'Tincho',
      phone: '+5491144861258',
      channel: 'whatsapp',
      vip: false,
    }),
  )
  api.mockResolvedValueOnce(
    jsonResponse(200, {
      id: 7,
      name: 'Tincho Aguirre',
      phone: '+5491144861258',
      channel: 'whatsapp',
      vip: false,
    }),
  )
  renderForm(pathTo(CUSTOMER_EDIT, { id: 7 }))

  expect(await screen.findByLabelText('Nombre')).toHaveValue('Tincho')

  await userEvent.clear(screen.getByLabelText('Nombre'))
  await userEvent.type(screen.getByLabelText('Nombre'), 'Tincho Aguirre')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá y usá' }))

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith('/customers/7', expect.objectContaining({ method: 'PATCH' }))
})

test('saving an edit on a customer that is gone shows the gone notice, not the toast', async () => {
  api.mockResolvedValueOnce(
    jsonResponse(200, { id: 7, name: 'Tincho', phone: '+5491144861258', channel: null, vip: false }),
  )
  api.mockResolvedValueOnce(
    jsonResponse(404, { detail: 'no such customer', code: 'customer.not_found' }),
  )
  renderForm(pathTo(CUSTOMER_EDIT, { id: 7 }))

  expect(await screen.findByLabelText('Nombre')).toHaveValue('Tincho')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá y usá' }))

  await waitFor(() => expect(screen.getByText('la ficha')).toBeInTheDocument())
  expect(screen.getByText('Eso ya no está. La lista ya está al día.')).toBeInTheDocument()
  expect(screen.queryByText('Cliente guardado')).not.toBeInTheDocument()
})

test('a 401 on save clears the cache and goes to Entrar, through the session boundary', async () => {
  api.mockResolvedValue(jsonResponse(401, { detail: 'not signed in' }))
  queryClient.setQueryData(['me'], { businessName: 'stale' })
  const navigate = vi.fn()
  setNavigate(navigate)
  setCurrentPath(CUSTOMER_NEW)

  const router = createMemoryRouter(
    [
      {
        element: (
          <FlashProvider>
            <Outlet />
          </FlashProvider>
        ),
        children: [{ path: CUSTOMER_NEW, element: <ClienteForm mode="nuevo" /> }],
      },
    ],
    { initialEntries: [CUSTOMER_NEW] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )

  await userEvent.type(screen.getByLabelText('Teléfono'), '+5491131785094')
  await userEvent.type(screen.getByLabelText('Nombre'), 'Nico')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá y usá' }))

  await waitFor(() => expect(navigate).toHaveBeenCalledWith(LOGIN))
  expect(queryClient.getQueryData(['me'])).toBeUndefined()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

async function openFromList(): Promise<ReturnType<typeof renderForm>> {
  const router = renderForm(CUSTOMERS)
  await userEvent.click(screen.getByRole('link', { name: 'Abrir el formulario' }))
  expect(router.state.location.pathname).toBe(CUSTOMER_NEW)
  return router
}

test('closing, or going back by history, with something typed asks the same question', async () => {
  const router = await openFromList()
  await userEvent.type(screen.getByLabelText('Nombre'), 'Sol')

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  const viaCerrar = screen.getByRole('alertdialog').textContent
  await userEvent.click(screen.getByRole('button', { name: 'No, seguí cargando' }))
  expect(router.state.location.pathname).toBe(CUSTOMER_NEW)
  expect(screen.getByLabelText('Nombre')).toHaveValue('Sol')

  await act(() => router.navigate(-1))
  expect(screen.getByRole('alertdialog').textContent).toBe(viaCerrar)
  expect(viaCerrar).toContain('¿Descartás el cliente?')
  expect(router.state.location.pathname).toBe(CUSTOMER_NEW)

  await userEvent.click(screen.getByRole('button', { name: 'Sí, descartalo' }))
  expect(await screen.findByText('la lista')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(CUSTOMERS)
})

test('an untouched form closes at once, by history', async () => {
  const router = await openFromList()

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(router.state.location.pathname).toBe(CUSTOMERS)
  expect(router.state.historyAction).toBe('POP')
})

test('with no in-app history, Cerrar goes to the parent replacing the form', async () => {
  const router = renderForm(CUSTOMER_NEW, '/otra')

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('la lista')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('REPLACE')
})

test('editing, Cerrar with no in-app history goes to the customer card', async () => {
  api.mockResolvedValue(
    jsonResponse(200, { id: 7, name: 'Tincho', phone: '+5491144861258', channel: null, vip: false }),
  )
  const router = renderForm(pathTo(CUSTOMER_EDIT, { id: 7 }))

  await userEvent.click(await screen.findByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(pathTo(CUSTOMER, { id: 7 }))
})

test('after registering, the form is replaced by the new customer card and Back skips the form', async () => {
  api.mockResolvedValue(
    jsonResponse(201, { id: 10, name: 'Sol', phone: null, channel: null, vip: false }),
  )
  const router = await openFromList()
  await userEvent.type(screen.getByLabelText('Nombre'), 'Sol')

  await userEvent.click(screen.getByRole('button', { name: 'Guardá y usá' }))

  expect(await screen.findByText('Cliente guardado')).toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(router.state.location.pathname).toBe(pathTo(CUSTOMER, { id: 10 }))
  expect(router.state.historyAction).toBe('REPLACE')
  await act(() => router.navigate(-1))
  expect(router.state.location.pathname).toBe(CUSTOMERS)
})

test('after editing from the card, the save goes back by history: no second card behind it', async () => {
  api.mockImplementation(() =>
    Promise.resolve(
      jsonResponse(200, { id: 7, name: 'Tincho', phone: '+5491144861258', channel: null, vip: false }),
    ),
  )
  const router = renderForm(CUSTOMERS)
  await act(() => router.navigate(pathTo(CUSTOMER, { id: 7 })))
  await userEvent.click(screen.getByRole('link', { name: 'Editar' }))
  await userEvent.type(await screen.findByLabelText('Nombre'), ' Aguirre')

  await userEvent.click(screen.getByRole('button', { name: 'Guardá y usá' }))

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(await screen.findByText('Cliente guardado')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('POP')
  await act(() => router.navigate(-1))
  expect(router.state.location.pathname).toBe(CUSTOMERS)
})

// The gone exit (navigation.md, "A gone exit is the same move as Cerrar").
type HistoryEntry = string | { pathname: string; state: unknown }

function fakeGoneCustomer() {
  api.mockImplementation((input, init) => {
    const method = init?.method ?? 'GET'
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (method === 'GET' && url === '/customers/7') {
      return Promise.resolve(jsonResponse(200, { id: 7, name: 'Tincho', phone: null, channel: null, vip: false }))
    }
    return Promise.resolve(jsonResponse(404, { detail: 'no such customer', code: 'customer.not_found' }))
  })
}

/** The real data router under StrictMode, with the router handle the gone notice follows. */
function renderGone(entries: HistoryEntry[]) {
  const router = createMemoryRouter(ROUTES, { initialEntries: entries, initialIndex: entries.length - 1 })
  const app = (
    <StrictMode>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SheetRouterProvider router={router}>
          <RouterProvider router={router} />
        </SheetRouterProvider>
      </QueryClientProvider>
    </StrictMode>
  )
  const view = render(app)
  return { router, view, app }
}

async function saveTheGoneEdit() {
  await userEvent.type(await screen.findByLabelText('Nombre'), ' R')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá y usá' }))
}

const CARD = pathTo(CUSTOMER, { id: 7 })
const EDIT = pathTo(CUSTOMER_EDIT, { id: 7 })

test('a gone edit opened from the card goes back to it: the card is in history once, with the notice once, and Clientes is not repeated', async () => {
  fakeGoneCustomer()
  const { router } = renderGone([CUSTOMERS, CARD, { pathname: EDIT, state: inAppState({ pathname: CARD }) }])

  await saveTheGoneEdit()

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(CARD)
  expect(router.state.historyAction).toBe('POP')
  expect(screen.getAllByText(GONE_NOTICE)).toHaveLength(1)
  await act(() => router.navigate(-1))
  expect(router.state.location.pathname).toBe(CUSTOMERS)
  expect(screen.queryByText(GONE_NOTICE)).not.toBeInTheDocument()
})

test('a gone edit opened from a search replaces the form with the card and leaves the list behind alone', async () => {
  fakeGoneCustomer()
  const { router } = renderGone([CUSTOMERS, { pathname: EDIT, state: inAppState({ pathname: CUSTOMERS }) }])

  await saveTheGoneEdit()

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('REPLACE')
  expect(screen.getAllByText(GONE_NOTICE)).toHaveLength(1)
  await act(() => router.navigate(-1))
  expect(router.state.location.pathname).toBe(CUSTOMERS)
  expect(screen.queryByText(GONE_NOTICE)).not.toBeInTheDocument()
})

test('a gone edit on a direct link replaces the form with the card and shows the notice', async () => {
  fakeGoneCustomer()
  const { router } = renderGone([EDIT])

  await saveTheGoneEdit()

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('REPLACE')
  expect(screen.getAllByText(GONE_NOTICE)).toHaveLength(1)
})

test('after a reload of the form, the gone exit still goes back once', async () => {
  fakeGoneCustomer()
  const { router, view, app } = renderGone([CUSTOMERS, CARD, { pathname: EDIT, state: inAppState({ pathname: CARD }) }])
  await screen.findByLabelText('Nombre')
  view.unmount()
  render(app)

  await saveTheGoneEdit()

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('POP')
  expect(screen.getAllByText(GONE_NOTICE)).toHaveLength(1)
})

test('a resize across 900 px between opening and leaving does not change where the exit goes', async () => {
  fakeGoneCustomer()
  stubViewport('phone')
  const { router } = renderGone([CUSTOMERS, CARD, { pathname: EDIT, state: inAppState({ pathname: CARD }) }])
  await screen.findByLabelText('Nombre')
  stubViewport('computer')

  await saveTheGoneEdit()

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('POP')
})

test.each([
  ['a query string', `${CARD}?x=1`],
  ['a trailing slash', `${CARD}/`],
])('a from with %s still counts as the parent: the exit goes back', async (_name, from) => {
  fakeGoneCustomer()
  const { router } = renderGone([CUSTOMERS, CARD, { pathname: EDIT, state: inAppState({ pathname: from }) }])

  await saveTheGoneEdit()

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('POP')
  expect(screen.getAllByText(GONE_NOTICE)).toHaveLength(1)
})
