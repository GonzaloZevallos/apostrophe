/**
 * `ClienteForm` at the screen seam: add and edit share the form; a refusal maps
 * to its field and keeps what was typed (`customers.md`); a save on a `gone`
 * customer closes the form and shows `'That is gone. The list is up to date.'` instead of "Customer saved"
 * (plan, "Gone records").
 */

import { CUSTOMER, CUSTOMERS, CUSTOMER_EDIT, CUSTOMER_NEW, LOGIN, pathTo, SETTINGS_CUSTOMER_TYPES } from '../../routes'
import { useGoneNotice } from '../../components/goneExit'
import { readFeedback } from '../../components/feedback'
import Notice from '../../components/Notice'
import { SheetRouterProvider } from '../../components/useSheetStack'
import { stubViewport } from '../../test-viewport'
import { StrictMode } from 'react'
import { inAppState } from '../../components/inAppState'
import { expectIconAndTextRule } from '../../test/iconAndTextRule'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, Outlet, RouterProvider, useLocation } from 'react-router'
import FlashProvider from '../../flash/FlashProvider'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { queryClient, setCurrentPath, setNavigate } from '../../queryClient'
import ClienteForm from './ClienteForm'
import { stubFetchWithSettings } from '../stubFetchWithSettings'
import { CUSTOMERS_TEXT } from '../../copy/customers'


function ListStub() {
  const location = useLocation()
  const feedback = readFeedback(location.state)
  const goneShown = useGoneNotice()
  return (
    <div>
      <span>la lista</span>
      {feedback?.kind === 'toast' && <Notice {...feedback} />}
      {goneShown && <span>{'That is gone. The list is up to date.'}</span>}
    </div>
  )
}

function FichaStub() {
  const location = useLocation()
  const feedback = readFeedback(location.state)
  const goneShown = useGoneNotice()
  return (
    <div>
      <span>la ficha</span>
      {feedback?.kind === 'toast' && <Notice {...feedback} />}
      {goneShown && <span>{'That is gone. The list is up to date.'}</span>}
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
    jsonResponse(201, { id: 9, name: 'Nico', phone: '+5491131785094', vip: false }),
  )
  renderForm(CUSTOMER_NEW)

  await userEvent.type(screen.getByLabelText('Phone'), '+5491131785094')
  await userEvent.type(screen.getByLabelText('Name'), 'Nico')
  await userEvent.click(screen.getByRole('button', { name: 'Save and use' }))

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith(
    '/customers',
    expect.objectContaining({ method: 'POST' }),
  )
})

test('only Nombre is marked required; Teléfono stays optional', () => {
  renderForm(CUSTOMER_NEW)

  expect(screen.getByLabelText('Name')).toBeRequired()
  expect(screen.getByLabelText('Phone')).not.toBeRequired()
})

test('the form has Nombre required, an optional phone and no Canal field', async () => {
  renderForm(CUSTOMER_NEW)

  expect(await screen.findByLabelText('Name')).toBeRequired()
  expect(screen.queryByRole('switch', { name: 'VIP' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Phone')).not.toBeRequired()
  expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  expect(screen.queryByText(/canal|whatsapp|telegram/i)).not.toBeInTheDocument()
})

test('with Customer types off the form has no type field and no notice', async () => {
  api = stubFetchWithSettings(false)
  renderForm(CUSTOMER_NEW)

  expect(await screen.findByLabelText('Name')).toBeInTheDocument()
  expect(screen.queryByLabelText('Customer type')).not.toBeInTheDocument()
  expect(screen.queryByText('Add a customer type')).not.toBeInTheDocument()
})

test('on open the Name field has focus and comes before Phone', async () => {
  renderForm(CUSTOMER_NEW)

  const name = await screen.findByLabelText('Name')
  expect(name).toHaveFocus()
  const phone = screen.getByLabelText('Phone')
  expect(name.compareDocumentPosition(phone) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByText('(optional)')).toBeInTheDocument()
  expect(name).toHaveClass('campo__input--enfoque')
  expect(phone).toHaveClass('campo__input--enfoque')
})

test('registering with no phone sends the request and shows the saved toast', async () => {
  api.mockResolvedValue(
    jsonResponse(201, { id: 10, name: 'Sol', phone: null, vip: false }),
  )
  renderForm(CUSTOMER_NEW)

  await userEvent.type(screen.getByLabelText('Name'), 'Sol')
  await userEvent.click(screen.getByRole('button', { name: 'Save and use' }))

  expect(await screen.findByText('Customer saved')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith(
    '/customers',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Sol', phone: '', customer_type_id: null }) }),
  )
})

test('clearing a phone when editing sends it and shows the saved toast', async () => {
  api.mockResolvedValueOnce(
    jsonResponse(200, { id: 7, name: 'Tincho', phone: '+5491144861258', vip: false }),
  )
  api.mockResolvedValueOnce(
    jsonResponse(200, { id: 7, name: 'Tincho', phone: null, vip: false }),
  )
  renderForm(pathTo(CUSTOMER_EDIT, { id: 7 }))

  expect(await screen.findByLabelText('Phone')).toHaveValue('+5491144861258')
  await userEvent.clear(screen.getByLabelText('Phone'))
  await userEvent.click(screen.getByRole('button', { name: 'Save and use' }))

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(await screen.findByText('Customer saved')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith(
    '/customers/7',
    expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Tincho', phone: '', customer_type_id: null }) }),
  )
})

test('a duplicate phone is refused on the phone field, keeping what was typed', async () => {
  api.mockResolvedValue(
    jsonResponse(409, { detail: 'taken', code: 'customer.phone_taken' }),
  )
  renderForm(CUSTOMER_NEW)

  await userEvent.type(screen.getByLabelText('Phone'), '+5491131785094')
  await userEvent.type(screen.getByLabelText('Name'), 'Nico')
  await userEvent.click(screen.getByRole('button', { name: 'Save and use' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('That phone number already belongs to another customer')
  expect(screen.getByLabelText('Phone')).toHaveValue('+5491131785094')
  expect(screen.getByLabelText('Name')).toHaveValue('Nico')
})

test('a number without + in a business with no Phone country asks for + and the country code', async () => {
  api.mockResolvedValue(
    jsonResponse(422, { detail: 'refused', code: 'customer.phone_needs_country_code' }),
  )
  renderForm(CUSTOMER_NEW)

  await userEvent.type(screen.getByLabelText('Phone'), '099 123 456')
  await userEvent.type(screen.getByLabelText('Name'), 'Nico')
  await userEvent.click(screen.getByRole('button', { name: 'Save and use' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Start the number with + and the country code.')
  expect(screen.getByLabelText('Phone')).toHaveValue('099 123 456')
})

test('a number that does not fit asks for its area code, or + and the country code', async () => {
  api.mockResolvedValue(
    jsonResponse(422, { detail: 'refused', code: 'customer.phone_invalid' }),
  )
  renderForm(CUSTOMER_NEW)

  await userEvent.type(screen.getByLabelText('Phone'), '2345')
  await userEvent.type(screen.getByLabelText('Name'), 'Nico')
  await userEvent.click(screen.getByRole('button', { name: 'Save and use' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Enter the number with its area code, or start with + and the country code.',
  )
})

test('edit loads the existing customer and saves the change', async () => {
  api.mockResolvedValueOnce(
    jsonResponse(200, {
      id: 7,
      name: 'Tincho',
      phone: '+5491144861258',
      vip: false,
    }),
  )
  api.mockResolvedValueOnce(
    jsonResponse(200, {
      id: 7,
      name: 'Tincho Aguirre',
      phone: '+5491144861258',
      vip: false,
    }),
  )
  renderForm(pathTo(CUSTOMER_EDIT, { id: 7 }))

  expect(await screen.findByLabelText('Name')).toHaveValue('Tincho')

  await userEvent.clear(screen.getByLabelText('Name'))
  await userEvent.type(screen.getByLabelText('Name'), 'Tincho Aguirre')
  await userEvent.click(screen.getByRole('button', { name: 'Save and use' }))

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith('/customers/7', expect.objectContaining({ method: 'PATCH' }))
})

test('saving an edit on a customer that is gone shows the gone notice, not the toast', async () => {
  api.mockResolvedValueOnce(
    jsonResponse(200, { id: 7, name: 'Tincho', phone: '+5491144861258', vip: false }),
  )
  api.mockResolvedValueOnce(
    jsonResponse(404, { detail: 'no such customer', code: 'customer.not_found' }),
  )
  renderForm(pathTo(CUSTOMER_EDIT, { id: 7 }))

  expect(await screen.findByLabelText('Name')).toHaveValue('Tincho')
  await userEvent.click(screen.getByRole('button', { name: 'Save and use' }))

  await waitFor(() => expect(screen.getByText('la ficha')).toBeInTheDocument())
  expect(screen.getByText('That is gone. The list is up to date.')).toBeInTheDocument()
  expect(screen.queryByText('Customer saved')).not.toBeInTheDocument()
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

  await userEvent.type(screen.getByLabelText('Phone'), '+5491131785094')
  await userEvent.type(screen.getByLabelText('Name'), 'Nico')
  await userEvent.click(screen.getByRole('button', { name: 'Save and use' }))

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
  await userEvent.type(screen.getByLabelText('Name'), 'Sol')

  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  const viaCerrar = screen.getByRole('alertdialog').textContent
  await userEvent.click(screen.getByRole('button', { name: 'No, keep entering' }))
  expect(router.state.location.pathname).toBe(CUSTOMER_NEW)
  expect(screen.getByLabelText('Name')).toHaveValue('Sol')

  await act(() => router.navigate(-1))
  expect(screen.getByRole('alertdialog').textContent).toBe(viaCerrar)
  expect(viaCerrar).toContain('Discard the customer?')
  expect(router.state.location.pathname).toBe(CUSTOMER_NEW)

  await userEvent.click(screen.getByRole('button', { name: 'Yes, discard it' }))
  expect(await screen.findByText('la lista')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(CUSTOMERS)
})

test('an untouched form closes at once, by history', async () => {
  const router = await openFromList()

  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(router.state.location.pathname).toBe(CUSTOMERS)
  expect(router.state.historyAction).toBe('POP')
})

test('with no in-app history, Cerrar goes to the parent replacing the form', async () => {
  const router = renderForm(CUSTOMER_NEW, '/otra')

  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  expect(await screen.findByText('la lista')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('REPLACE')
})

test('editing, Cerrar with no in-app history goes to the customer card', async () => {
  api.mockResolvedValue(
    jsonResponse(200, { id: 7, name: 'Tincho', phone: '+5491144861258', vip: false }),
  )
  const router = renderForm(pathTo(CUSTOMER_EDIT, { id: 7 }))

  await userEvent.click(await screen.findByRole('button', { name: 'Close' }))

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(pathTo(CUSTOMER, { id: 7 }))
})

test('after registering, the form is replaced by the new customer card and Back skips the form', async () => {
  api.mockResolvedValue(
    jsonResponse(201, { id: 10, name: 'Sol', phone: null, vip: false }),
  )
  const router = await openFromList()
  await userEvent.type(screen.getByLabelText('Name'), 'Sol')

  await userEvent.click(screen.getByRole('button', { name: 'Save and use' }))

  expect(await screen.findByText('Customer saved')).toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(router.state.location.pathname).toBe(pathTo(CUSTOMER, { id: 10 }))
  expect(router.state.historyAction).toBe('REPLACE')
  await act(() => router.navigate(-1))
  expect(router.state.location.pathname).toBe(CUSTOMERS)
})

test('after editing from the card, the save goes back by history: no second card behind it', async () => {
  api.mockImplementation(() =>
    Promise.resolve(
      jsonResponse(200, { id: 7, name: 'Tincho', phone: '+5491144861258', vip: false }),
    ),
  )
  const router = renderForm(CUSTOMERS)
  await act(() => router.navigate(pathTo(CUSTOMER, { id: 7 })))
  await userEvent.click(screen.getByRole('link', { name: 'Editar' }))
  await userEvent.type(await screen.findByLabelText('Name'), ' Aguirre')

  await userEvent.click(screen.getByRole('button', { name: 'Save and use' }))

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(await screen.findByText('Customer saved')).toBeInTheDocument()
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
      return Promise.resolve(jsonResponse(200, { id: 7, name: 'Tincho', phone: null, vip: false }))
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
  await userEvent.type(await screen.findByLabelText('Name'), ' R')
  await userEvent.click(screen.getByRole('button', { name: 'Save and use' }))
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
  expect(screen.getAllByText('That is gone. The list is up to date.')).toHaveLength(1)
  await act(() => router.navigate(-1))
  expect(router.state.location.pathname).toBe(CUSTOMERS)
  expect(screen.queryByText('That is gone. The list is up to date.')).not.toBeInTheDocument()
})

test('a gone edit opened from a search replaces the form with the card and leaves the list behind alone', async () => {
  fakeGoneCustomer()
  const { router } = renderGone([CUSTOMERS, { pathname: EDIT, state: inAppState({ pathname: CUSTOMERS }) }])

  await saveTheGoneEdit()

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('REPLACE')
  expect(screen.getAllByText('That is gone. The list is up to date.')).toHaveLength(1)
  await act(() => router.navigate(-1))
  expect(router.state.location.pathname).toBe(CUSTOMERS)
  expect(screen.queryByText('That is gone. The list is up to date.')).not.toBeInTheDocument()
})

test('a gone edit on a direct link replaces the form with the card and shows the notice', async () => {
  fakeGoneCustomer()
  const { router } = renderGone([EDIT])

  await saveTheGoneEdit()

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('REPLACE')
  expect(screen.getAllByText('That is gone. The list is up to date.')).toHaveLength(1)
})

test('after a reload of the form, the gone exit still goes back once', async () => {
  fakeGoneCustomer()
  const { router, view, app } = renderGone([CUSTOMERS, CARD, { pathname: EDIT, state: inAppState({ pathname: CARD }) }])
  await screen.findByLabelText('Name')
  view.unmount()
  render(app)

  await saveTheGoneEdit()

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('POP')
  expect(screen.getAllByText('That is gone. The list is up to date.')).toHaveLength(1)
})

test('a resize across 900 px between opening and leaving does not change where the exit goes', async () => {
  fakeGoneCustomer()
  stubViewport('phone')
  const { router } = renderGone([CUSTOMERS, CARD, { pathname: EDIT, state: inAppState({ pathname: CARD }) }])
  await screen.findByLabelText('Name')
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
  expect(screen.getAllByText('That is gone. The list is up to date.')).toHaveLength(1)
})

test('the form follows the icon and text rule: its submit and its Cerrar are text controls of the closed kinds', () => {
  renderForm(CUSTOMER_NEW)

  expect(screen.getByRole('button', { name: 'Save and use' })).toHaveAttribute('type', 'submit')
  expectIconAndTextRule(document.body)
})

const TYPES = [
  { id: 1, name: 'Friends', icon: 'heart', is_vip: false },
  { id: 2, name: 'Wholesale', icon: 'star', is_vip: true },
]

test('the Customer type field offers No type first, then each type with its icon', async () => {
  api = stubFetchWithSettings(true, true, TYPES)
  renderForm(CUSTOMER_NEW)

  const field = await screen.findByLabelText('Customer type')
  const options = within(field).getAllByRole('option').map((option) => option.textContent)
  expect(options).toEqual(['No type', '♡ Friends', '★ Wholesale'])
  expect(field).toHaveValue('')
  expect(screen.queryByText('Add a customer type')).not.toBeInTheDocument()
})

test('a type is set on a new customer and sent as customer_type_id', async () => {
  api = stubFetchWithSettings(true, true, TYPES)
  api.mockResolvedValue(jsonResponse(201, { id: 12, name: 'Ana', phone: null, vip: false, customer_type_id: 1 }))
  renderForm(CUSTOMER_NEW)

  await userEvent.type(await screen.findByLabelText('Name'), 'Ana')
  await userEvent.selectOptions(await screen.findByLabelText('Customer type'), '♡ Friends')
  await userEvent.click(screen.getByRole('button', { name: 'Save and use' }))

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith(
    '/customers',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Ana', phone: '', customer_type_id: 1 }) }),
  )
})

test('editing shows the current type and clears it with No type', async () => {
  api = stubFetchWithSettings(true, true, TYPES)
  api.mockResolvedValueOnce(jsonResponse(200, { id: 7, name: 'Tincho', phone: null, vip: false, customer_type_id: 1 }))
  api.mockResolvedValue(jsonResponse(200, { id: 7, name: 'Tincho', phone: null, vip: false, customer_type_id: null }))
  renderForm(pathTo(CUSTOMER_EDIT, { id: 7 }))

  const field = await screen.findByLabelText('Customer type')
  await waitFor(() => expect(field).toHaveValue('1'))
  await userEvent.selectOptions(field, 'No type')
  await userEvent.click(screen.getByRole('button', { name: 'Save and use' }))

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith(
    '/customers/7',
    expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Tincho', phone: '', customer_type_id: null }) }),
  )
})

test('editing changes a customer\'s type from one type to another', async () => {
  api = stubFetchWithSettings(true, true, TYPES)
  api.mockResolvedValueOnce(jsonResponse(200, { id: 7, name: 'Tincho', phone: null, vip: false, customer_type_id: 1 }))
  api.mockResolvedValue(jsonResponse(200, { id: 7, name: 'Tincho', phone: null, vip: true, customer_type_id: 2 }))
  renderForm(pathTo(CUSTOMER_EDIT, { id: 7 }))

  const field = await screen.findByLabelText('Customer type')
  await waitFor(() => expect(field).toHaveValue('1'))
  await userEvent.selectOptions(field, '★ Wholesale')
  expect(field).toHaveValue('2')
  await userEvent.click(screen.getByRole('button', { name: 'Save and use' }))

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith(
    '/customers/7',
    expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Tincho', phone: '', customer_type_id: 2 }) }),
  )
})

test('with no types the field is the notice Add a customer type, leading to Settings Prices', async () => {
  renderForm(CUSTOMER_NEW)

  const notice = await screen.findByRole('link', { name: 'Add a customer type' })
  expect(notice).toHaveAttribute('href', SETTINGS_CUSTOMER_TYPES)
  expect(screen.queryByRole('combobox', { name: 'Customer type' })).not.toBeInTheDocument()
})

test('with Customer types off the save sends no customer_type_id', async () => {
  api = stubFetchWithSettings(false, true, TYPES)
  api.mockResolvedValue(jsonResponse(201, { id: 13, name: 'Zoe', phone: null, vip: false, customer_type_id: null }))
  renderForm(CUSTOMER_NEW)

  await userEvent.type(await screen.findByLabelText('Name'), 'Zoe')
  await userEvent.click(screen.getByRole('button', { name: 'Save and use' }))

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith(
    '/customers',
    expect.objectContaining({ body: JSON.stringify({ name: 'Zoe', phone: '' }) }),
  )
})

test('a type deleted meanwhile (404 customer_type.not_found) shows the inline error and keeps the form', async () => {
  api = stubFetchWithSettings(true, true, TYPES)
  api.mockResolvedValue(jsonResponse(404, { detail: 'gone', code: 'customer_type.not_found' }))
  renderForm(CUSTOMER_NEW)

  await userEvent.type(await screen.findByLabelText('Name'), 'Ana')
  await userEvent.selectOptions(await screen.findByLabelText('Customer type'), '★ Wholesale')
  await userEvent.click(screen.getByRole('button', { name: 'Save and use' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('That type no longer exists. Pick another one.')
  expect(screen.getByLabelText('Name')).toHaveValue('Ana')
  expect(screen.getByLabelText('Customer type')).toHaveValue('')
  expect(screen.queryByText('la ficha')).not.toBeInTheDocument()
})

const PLACEHOLDERS: readonly (readonly [string | null, string])[] = [
  ['AR', CUSTOMERS_TEXT.phoneHintAR],
  ['UY', CUSTOMERS_TEXT.phoneHintUY],
  ['CL', CUSTOMERS_TEXT.phoneHintCL],
  ['PY', CUSTOMERS_TEXT.phoneHintPY],
  ['BR', CUSTOMERS_TEXT.phoneHintBR],
  ['MX', CUSTOMERS_TEXT.phoneHintMX],
  ['ES', CUSTOMERS_TEXT.phoneHintES],
  ['US', CUSTOMERS_TEXT.phoneHintUS],
  [null, CUSTOMERS_TEXT.phoneHintNone],
]

test.each(PLACEHOLDERS)('the phone field shows the example of the business Phone country %s', async (country, hint) => {
  stubFetchWithSettings(true, true, [], country)
  renderForm(CUSTOMER_NEW)

  await waitFor(() => {
    expect(screen.getByLabelText('Phone')).toHaveAttribute('placeholder', hint)
  })
})
