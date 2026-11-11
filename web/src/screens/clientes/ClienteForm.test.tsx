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
import { type ReactElement, type ReactNode, StrictMode } from 'react'
import { inAppState } from '../../components/inAppState'
import { expectIconAndTextRule } from '../../test/iconAndTextRule'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render as renderBare, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, Outlet, RouterProvider, useLocation } from 'react-router'
import FlashProvider from '../../flash/FlashProvider'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { queryClient, setCurrentPath, setNavigate } from '../../queryClient'
import ClienteForm from './ClienteForm'
import { PHONE_COUNTRIES, stubFetchWithSettings } from '../stubFetchWithSettings'
import { deviceLanguages, deviceTimeZone } from '../../phone/device'
import { CUSTOMERS_TEXT } from '../../copy/customers'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'

function Business({ children }: { children: ReactNode }) {
  return <MoneyFormatProvider format={{ symbol: '$', decimals: 0 }}>{children}</MoneyFormatProvider>
}

/** Rendered for a "$"/0-decimals business, the one the strings below were written for. */
function render(ui: ReactElement) {
  return renderBare(ui, { wrapper: Business })
}


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
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )
  return router
}

let api: ReturnType<typeof stubFetchWithSettings>

/** Save waits for the Phone country list (the Selector is loading and Save off until it is in). */
async function clickSave(): Promise<void> {
  const button = screen.getByRole('button', { name: 'Save and use' })
  await waitFor(() => expect(button).toBeEnabled())
  await userEvent.click(button)
}

beforeEach(() => {
  api = stubFetchWithSettings()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('registers a customer and lands on its card', async () => {
  api.mockResolvedValue(
    jsonResponse(201, { id: 9, name: 'Nico', phone: '+5491131785094', phone_display: '+5491131785094', vip: false }),
  )
  renderForm(CUSTOMER_NEW)

  await userEvent.type(screen.getByLabelText('Phone'), '+5491131785094')
  await userEvent.type(screen.getByLabelText('Name'), 'Nico')
  await clickSave()

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
    jsonResponse(201, { id: 10, name: 'Sol', phone: null, phone_display: null, vip: false }),
  )
  renderForm(CUSTOMER_NEW)

  await userEvent.type(screen.getByLabelText('Name'), 'Sol')
  await clickSave()

  expect(await screen.findByText('Customer saved')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith(
    '/customers',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Sol', phone: '', phone_country: 'AR', customer_type_id: null }) }),
  )
})

test('clearing a phone when editing sends it and shows the saved toast', async () => {
  api.mockResolvedValueOnce(
    jsonResponse(200, { id: 7, name: 'Tincho', phone: '+5491144861258', phone_display: '+5491144861258', vip: false }),
  )
  api.mockResolvedValueOnce(
    jsonResponse(200, { id: 7, name: 'Tincho', phone: null, phone_display: null, vip: false }),
  )
  renderForm(pathTo(CUSTOMER_EDIT, { id: 7 }))

  expect(await screen.findByLabelText('Phone')).toHaveValue('+5491144861258')
  await userEvent.clear(screen.getByLabelText('Phone'))
  await clickSave()

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(await screen.findByText('Customer saved')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith(
    '/customers/7',
    expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Tincho', phone: '', phone_country: 'AR', customer_type_id: null }) }),
  )
})

test('a duplicate phone is refused on the phone field, keeping what was typed', async () => {
  api.mockResolvedValue(
    jsonResponse(409, { detail: 'taken', code: 'customer.phone_taken' }),
  )
  renderForm(CUSTOMER_NEW)

  await userEvent.type(screen.getByLabelText('Phone'), '+5491131785094')
  await userEvent.type(screen.getByLabelText('Name'), 'Nico')
  await clickSave()

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
  await clickSave()

  expect(await screen.findByRole('alert')).toHaveTextContent('Start the number with + and the country code.')
  expect(screen.getByLabelText('Phone')).toHaveValue('099 123 456')
})

test('a number that does not fit names the country and the lengths it needs, not the number', async () => {
  api.mockResolvedValue(
    jsonResponse(422, { detail: 'refused', code: 'customer.phone_invalid' }),
  )
  renderForm(CUSTOMER_NEW)

  await userEvent.type(screen.getByLabelText('Phone'), '2345')
  await userEvent.type(screen.getByLabelText('Name'), 'Nico')
  await clickSave()

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(
    "That doesn't look like an Argentine number. It needs 10 digits after the country code.",
  )
  expect(alert).not.toHaveTextContent('2345')
})

test('a number refused with Other shown gets the generic phone text', async () => {
  api.mockResolvedValue(
    jsonResponse(422, { detail: 'refused', code: 'customer.phone_invalid' }),
  )
  renderForm(CUSTOMER_NEW)

  await userEvent.type(screen.getByLabelText('Phone'), '+99912')
  await userEvent.type(screen.getByLabelText('Name'), 'Nico')
  await clickSave()

  expect(await screen.findByRole('alert')).toHaveTextContent(CUSTOMERS_TEXT.notAPhone)
})

test('edit loads the existing customer and saves the change', async () => {
  api.mockResolvedValueOnce(
    jsonResponse(200, {
      id: 7,
      name: 'Tincho',
      phone: '+5491144861258',
      phone_display: '+5491144861258',
      vip: false,
    }),
  )
  api.mockResolvedValueOnce(
    jsonResponse(200, {
      id: 7,
      name: 'Tincho Aguirre',
      phone: '+5491144861258',
      phone_display: '+5491144861258',
      vip: false,
    }),
  )
  renderForm(pathTo(CUSTOMER_EDIT, { id: 7 }))

  expect(await screen.findByLabelText('Name')).toHaveValue('Tincho')

  await userEvent.clear(screen.getByLabelText('Name'))
  await userEvent.type(screen.getByLabelText('Name'), 'Tincho Aguirre')
  await clickSave()

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith('/customers/7', expect.objectContaining({ method: 'PATCH' }))
})

test('saving an edit on a customer that is gone shows the gone notice, not the toast', async () => {
  api.mockResolvedValueOnce(
    jsonResponse(200, { id: 7, name: 'Tincho', phone: '+5491144861258', phone_display: '+5491144861258', vip: false }),
  )
  api.mockResolvedValueOnce(
    jsonResponse(404, { detail: 'no such customer', code: 'customer.not_found' }),
  )
  renderForm(pathTo(CUSTOMER_EDIT, { id: 7 }))

  expect(await screen.findByLabelText('Name')).toHaveValue('Tincho')
  await clickSave()

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
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )

  await userEvent.type(screen.getByLabelText('Phone'), '+5491131785094')
  await userEvent.type(screen.getByLabelText('Name'), 'Nico')
  await clickSave()

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
    jsonResponse(200, { id: 7, name: 'Tincho', phone: '+5491144861258', phone_display: '+5491144861258', vip: false }),
  )
  const router = renderForm(pathTo(CUSTOMER_EDIT, { id: 7 }))

  await userEvent.click(await screen.findByRole('button', { name: 'Close' }))

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(pathTo(CUSTOMER, { id: 7 }))
})

test('after registering, the form is replaced by the new customer card and Back skips the form', async () => {
  api.mockResolvedValue(
    jsonResponse(201, { id: 10, name: 'Sol', phone: null, phone_display: null, vip: false }),
  )
  const router = await openFromList()
  await userEvent.type(screen.getByLabelText('Name'), 'Sol')

  await clickSave()

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
      jsonResponse(200, { id: 7, name: 'Tincho', phone: '+5491144861258', phone_display: '+5491144861258', vip: false }),
    ),
  )
  const router = renderForm(CUSTOMERS)
  await act(() => router.navigate(pathTo(CUSTOMER, { id: 7 })))
  await userEvent.click(screen.getByRole('link', { name: 'Editar' }))
  await userEvent.type(await screen.findByLabelText('Name'), ' Aguirre')

  await clickSave()

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(await screen.findByText('Customer saved')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('POP')
  await act(() => router.navigate(-1))
  expect(router.state.location.pathname).toBe(CUSTOMERS)
})

// The gone exit (navigation.md, "Salir porque el registro ya no existe es el mismo movimiento
// que "Close"").
type HistoryEntry = string | { pathname: string; state: unknown }

function fakeGoneCustomer() {
  api.mockImplementation((input, init) => {
    const method = init?.method ?? 'GET'
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (method === 'GET' && url === '/customers/7') {
      return Promise.resolve(jsonResponse(200, { id: 7, name: 'Tincho', phone: null, phone_display: null, vip: false }))
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
  await clickSave()
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

test('the form follows the icon and text rule: its submit and its Cerrar are text controls of the closed kinds', async () => {
  renderForm(CUSTOMER_NEW)
  // Once the Phone country list is in: the rule reads a control's text, which a busy Selector has none of.
  await waitFor(async () => expect(await countryField()).toHaveTextContent('Argentina'))

  expect(screen.getByRole('button', { name: 'Save and use' })).toHaveAttribute('type', 'submit')
  expectIconAndTextRule(document.body)
})


const TYPES = [
  { id: 1, name: 'Friends', icon: 'heart', is_vip: false },
  { id: 2, name: 'Wholesale', icon: 'star', is_vip: true },
]

const MANY_TYPES = Array.from({ length: 13 }, (_unused, index) => ({
  id: index + 1,
  name: `Kind ${String(index + 1).padStart(2, '0')}`,
  icon: 'star',
  is_vip: false,
}))

/** `fetch` with `/api/customer-types` answered by `answer`; the rest goes to the returned mock. */
function stubTypesAnswer(answer: () => Promise<Response>) {
  const other: typeof api = vi.fn()
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    if (input === '/pricing-settings') {
      return Promise.resolve(jsonResponse(200, { is_bulk_pricing: true, is_vip_customers: true }))
    }
    if (input === '/api/customer-types') return answer()
    if (input === '/phone-countries') return Promise.resolve(jsonResponse(200, PHONE_COUNTRIES))
    return other(input, init)
  })
  return other
}

function typeField() {
  return screen.findByRole('button', { name: /^Customer type/ })
}

async function chooseType(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await typeField())
  await user.click(await screen.findByRole('button', { name }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Customer type options' })).not.toBeInTheDocument())
}

test('13 types: the field is a Selector, no select, radio group or pressed button, and search finds and picks one', async () => {
  stubViewport('phone')
  api = stubFetchWithSettings(true, true, MANY_TYPES)
  api.mockResolvedValue(jsonResponse(201, { id: 12, name: 'Ana', phone: null, phone_display: null, vip: false, customer_type_id: 9 }))
  renderForm(CUSTOMER_NEW)
  const user = userEvent.setup()

  await waitFor(async () => expect(await typeField()).toHaveTextContent('No type'))
  const field = await typeField()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
  expect(screen.queryAllByRole('button', { pressed: false })).toHaveLength(0)

  await user.type(screen.getByLabelText('Name'), 'Ana')
  await user.click(field)
  await user.type(screen.getByRole('searchbox'), 'kind 09')
  await user.click(screen.getByRole('button', { name: 'Kind 09' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Customer type options' })).not.toBeInTheDocument())
  expect(await typeField()).toHaveTextContent('Kind 09')
  await clickSave()

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith(
    '/customers',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Ana', phone: '', phone_country: 'AR', customer_type_id: 9 }) }),
  )
})

test('a type is set on a new customer and sent as customer_type_id', async () => {
  api = stubFetchWithSettings(true, true, TYPES)
  api.mockResolvedValue(jsonResponse(201, { id: 12, name: 'Ana', phone: null, phone_display: null, vip: false, customer_type_id: 1 }))
  renderForm(CUSTOMER_NEW)
  const user = userEvent.setup()

  await user.type(await screen.findByLabelText('Name'), 'Ana')
  await chooseType(user, 'Friends')
  await clickSave()

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith(
    '/customers',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Ana', phone: '', phone_country: 'AR', customer_type_id: 1 }) }),
  )
})

test('the list has no clearing row with no type chosen, and the clearing row sets No type when one is', async () => {
  api = stubFetchWithSettings(true, true, TYPES)
  api.mockResolvedValueOnce(jsonResponse(200, { id: 7, name: 'Tincho', phone: null, phone_display: null, vip: false, customer_type_id: 1 }))
  api.mockResolvedValue(jsonResponse(200, { id: 7, name: 'Tincho', phone: null, phone_display: null, vip: false, customer_type_id: null }))
  renderForm(pathTo(CUSTOMER_EDIT, { id: 7 }))
  const user = userEvent.setup()

  await waitFor(async () => expect(await typeField()).toHaveTextContent('Friends'))
  await user.click(await typeField())
  const dialog = screen.getByRole('dialog', { name: 'Customer type options' })
  expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual([
    '',
    'No type',
    '♡Friends Selected',
    '★Wholesale',
  ])
  await user.click(within(dialog).getByRole('button', { name: 'No type' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Customer type options' })).not.toBeInTheDocument())
  expect(await typeField()).toHaveTextContent('No type')

  await user.click(await typeField())
  expect(within(screen.getByRole('dialog', { name: 'Customer type options' })).queryByRole('button', { name: 'No type' })).not.toBeInTheDocument()
  await user.click(within(screen.getByRole('dialog', { name: 'Customer type options' })).getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Customer type options' })).not.toBeInTheDocument())

  await clickSave()
  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith(
    '/customers/7',
    expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Tincho', customer_type_id: null }) }),
  )
})

test("editing changes a customer's type from one type to another", async () => {
  api = stubFetchWithSettings(true, true, TYPES)
  api.mockResolvedValueOnce(jsonResponse(200, { id: 7, name: 'Tincho', phone: null, phone_display: null, vip: false, customer_type_id: 1 }))
  api.mockResolvedValue(jsonResponse(200, { id: 7, name: 'Tincho', phone: null, phone_display: null, vip: true, customer_type_id: 2 }))
  renderForm(pathTo(CUSTOMER_EDIT, { id: 7 }))
  const user = userEvent.setup()

  await waitFor(async () => expect(await typeField()).toHaveTextContent('Friends'))
  await chooseType(user, 'Wholesale')
  expect(await typeField()).toHaveTextContent('Wholesale')
  await clickSave()

  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith(
    '/customers/7',
    expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Tincho', customer_type_id: 2 }) }),
  )
})

test('with no types the field is the notice Add a customer type, leading to Settings Prices', async () => {
  renderForm(CUSTOMER_NEW)

  const notice = await screen.findByRole('link', { name: 'Add a customer type' })
  expect(notice).toHaveAttribute('href', SETTINGS_CUSTOMER_TYPES)
  expect(screen.queryByRole('button', { name: /^Customer type/ })).not.toBeInTheDocument()
})

test('while the types load there is no No type, no notice and no empty wording; the field is busy', async () => {
  stubTypesAnswer(() => new Promise<Response>(() => undefined))
  renderForm(CUSTOMER_NEW)

  const field = await typeField()
  expect(field).toBeDisabled()
  expect(screen.queryByText('No type')).not.toBeInTheDocument()
  expect(screen.queryByText('Add a customer type')).not.toBeInTheDocument()
})

test('after a failed load the field stays busy with the failure line, described by it, and Save still sends the held type', async () => {
  const other = stubTypesAnswer(() => Promise.reject(new TypeError('offline')))
  other.mockImplementation(() =>
    Promise.resolve(jsonResponse(200, { id: 7, name: 'Tincho', phone: null, phone_display: null, vip: false, customer_type_id: 2 })),
  )
  renderForm(pathTo(CUSTOMER_EDIT, { id: 7 }))
  const user = userEvent.setup()

  const line = await screen.findByText('Offline: check your internet and try again.')
  const field = await typeField()
  expect(field).toBeDisabled()
  expect(screen.queryByText('No type')).not.toBeInTheDocument()
  expect(screen.queryByText('Add a customer type')).not.toBeInTheDocument()
  const describedBy = field.getAttribute('aria-describedby')
  expect(describedBy).not.toBeNull()
  expect(document.getElementById(describedBy ?? '')).toContainElement(line)

  await user.type(await screen.findByLabelText('Name'), ' R')
  await clickSave()
  expect(await screen.findByText('la ficha')).toBeInTheDocument()
  expect(other).toHaveBeenCalledWith(
    '/customers/7',
    expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Tincho R', customer_type_id: 2 }) }),
  )
})

test('a server error on the types shows the generic retry line, and a remount that succeeds shows the Selector instead', async () => {
  let answer: () => Promise<Response> = () => Promise.resolve(jsonResponse(500, { detail: 'boom' }))
  stubTypesAnswer(() => answer())
  const router = renderForm(CUSTOMER_NEW)
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(await typeField()).toBeDisabled()
  expect(screen.queryByText('No type')).not.toBeInTheDocument()
  await act(() => router.navigate(CUSTOMERS))

  answer = () => Promise.resolve(jsonResponse(200, TYPES))
  await act(() => router.navigate(CUSTOMER_NEW))
  await waitFor(async () => expect(await typeField()).toBeEnabled())
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(await typeField()).toHaveTextContent('No type')
})

test('a type deleted meanwhile (404 customer_type.not_found) clears the choice, shows its line and ties it to the field', async () => {
  api = stubFetchWithSettings(true, true, TYPES)
  api.mockResolvedValue(jsonResponse(404, { detail: 'gone', code: 'customer_type.not_found' }))
  renderForm(CUSTOMER_NEW)
  const user = userEvent.setup()

  await user.type(await screen.findByLabelText('Name'), 'Ana')
  await chooseType(user, 'Wholesale')
  await clickSave()

  const refusal = await screen.findByText('That type no longer exists. Pick another one.')
  expect(screen.getByLabelText('Name')).toHaveValue('Ana')
  const field = await typeField()
  expect(field).toHaveTextContent('No type')
  expect(field.getAttribute('aria-describedby')).toBe(refusal.id)
  expect(screen.queryByText('la ficha')).not.toBeInTheDocument()
})

// The Phone country Selector (docs/adr/0085): one country per number, detected on the device.

function countryField() {
  return screen.findByRole('button', { name: /^Phone country/ })
}

async function pickCountry(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await countryField())
  await user.click(await screen.findByRole('button', { name: new RegExp(`^${name}`) }))
}

/** The JSON body the last request with this method sent. */
function sentBody(method: string): Record<string, unknown> {
  const call = api.mock.calls.findLast(([, init]) => init?.method === method)
  return JSON.parse(String(call?.[1]?.body)) as Record<string, unknown>
}

const SAVED = { id: 9, name: 'Nico', phone: null, phone_display: null, vip: false }

function storedCustomer(phone: string | null) {
  return { id: 7, name: 'Tincho', phone, phone_display: phone, vip: false, customer_type_id: null }
}

async function openEdit7(phone: string | null) {
  api.mockResolvedValueOnce(jsonResponse(200, storedCustomer(phone)))
  api.mockResolvedValue(jsonResponse(200, storedCustomer(phone)))
  renderForm(pathTo(CUSTOMER_EDIT, { id: 7 }))
  await screen.findByDisplayValue('Tincho')
}

describe('the Phone country', () => {
  afterEach(() => {
    vi.mocked(deviceLanguages).mockReturnValue(['es-AR'])
    vi.mocked(deviceTimeZone).mockReturnValue('America/Argentina/Buenos_Aires')
  })

  test('a new form shows the detected country with its example, and sends it', async () => {
    api.mockResolvedValue(jsonResponse(201, SAVED))
    renderForm(CUSTOMER_NEW)

    await waitFor(async () => expect(await countryField()).toHaveTextContent('Argentina (+54)'))
    expect(await countryField()).not.toHaveAttribute('aria-disabled')
    expect(screen.getByLabelText('Phone')).toHaveAttribute('placeholder', 'example AR')
    await userEvent.type(screen.getByLabelText('Name'), 'Nico')
    await userEvent.type(screen.getByLabelText('Phone'), '11 3178 5094')
    await clickSave()

    await screen.findByText('la ficha')
    expect(sentBody('POST')).toMatchObject({ phone: '11 3178 5094', phone_country: 'AR' })
  })

  test('the detection follows the phone language, then the zone', async () => {
    vi.mocked(deviceLanguages).mockReturnValue(['es-UY'])
    renderForm(CUSTOMER_NEW)
    await waitFor(async () => expect(await countryField()).toHaveTextContent('Uruguay (+598)'))
  })

  test('a place with no listed country shows Other and its placeholder, and sends null', async () => {
    vi.mocked(deviceLanguages).mockReturnValue(['fr-FR'])
    vi.mocked(deviceTimeZone).mockReturnValue('Europe/Paris')
    api.mockResolvedValue(jsonResponse(201, SAVED))
    renderForm(CUSTOMER_NEW)

    await waitFor(async () => expect(await countryField()).toHaveTextContent('Other (type + and the code)'))
    expect(screen.getByLabelText('Phone')).toHaveAttribute('placeholder', CUSTOMERS_TEXT.phoneHintNone)
    await userEvent.type(screen.getByLabelText('Name'), 'Nico')
    await clickSave()
    await screen.findByText('la ficha')
    expect(sentBody('POST')).toMatchObject({ phone: '', phone_country: null })
  })

  test('a typed + and code lock the Selector on that country, and the request sends it', async () => {
    api.mockResolvedValue(jsonResponse(201, SAVED))
    renderForm(CUSTOMER_NEW)
    await waitFor(async () => expect(await countryField()).toHaveTextContent('Argentina'))

    await userEvent.type(screen.getByLabelText('Phone'), '+598 99 123 456')

    const field = await countryField()
    expect(field).toHaveTextContent('Uruguay (+598)')
    expect(field).toHaveAttribute('aria-disabled', 'true')
    const reason = screen.getByText('The + and the code set the country')
    expect(field.getAttribute('aria-describedby')).toContain(reason.id)
    expect(screen.getByLabelText('Phone')).toHaveValue('+598 99 123 456')
    await userEvent.click(field)
    expect(screen.queryByRole('button', { name: /^Chile/ })).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Name'), 'Nico')
    await clickSave()
    await screen.findByText('la ficha')
    expect(sentBody('POST')).toMatchObject({ phone: '+598 99 123 456', phone_country: 'UY' })
  })

  test('an unlisted code locks on Other', async () => {
    renderForm(CUSTOMER_NEW)
    await waitFor(async () => expect(await countryField()).toHaveTextContent('Argentina'))

    await userEvent.type(screen.getByLabelText('Phone'), '+491511234')

    expect(await countryField()).toHaveTextContent('Other (type + and the code)')
    expect(await countryField()).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByLabelText('Phone')).toHaveAttribute('placeholder', CUSTOMERS_TEXT.phoneHintNone)
  })

  test('deleting the + unlocks and keeps the last country; picking another sends it', async () => {
    api.mockResolvedValue(jsonResponse(201, SAVED))
    renderForm(CUSTOMER_NEW)
    const user = userEvent.setup()
    await waitFor(async () => expect(await countryField()).toHaveTextContent('Argentina'))
    await user.type(screen.getByLabelText('Phone'), '+598 99 123 456')
    expect(await countryField()).toHaveAttribute('aria-disabled', 'true')

    await user.clear(screen.getByLabelText('Phone'))
    await user.type(screen.getByLabelText('Phone'), '99 123 456')

    expect(await countryField()).toHaveTextContent('Uruguay (+598)')
    expect(await countryField()).not.toHaveAttribute('aria-disabled')
    await pickCountry(user, 'Argentina')
    expect(await countryField()).toHaveTextContent('Argentina (+54)')
    expect(screen.getByLabelText('Phone')).toHaveAttribute('placeholder', 'example AR')
    await user.type(screen.getByLabelText('Name'), 'Nico')
    await clickSave()
    await screen.findByText('la ficha')
    expect(sentBody('POST')).toMatchObject({ phone: '99 123 456', phone_country: 'AR' })
  })

  test('the placeholder follows the Selector, and Other has its own', async () => {
    renderForm(CUSTOMER_NEW)
    const user = userEvent.setup()
    await waitFor(async () => expect(await countryField()).toHaveTextContent('Argentina'))

    await pickCountry(user, 'Chile')
    expect(screen.getByLabelText('Phone')).toHaveAttribute('placeholder', 'example CL')
    await pickCountry(user, 'Other')
    expect(screen.getByLabelText('Phone')).toHaveAttribute('placeholder', CUSTOMERS_TEXT.phoneHintNone)
  })

  test('the list holds the eight served countries then Other, each code in a nowrap run', async () => {
    renderForm(CUSTOMER_NEW)
    await waitFor(async () => expect(await countryField()).toHaveTextContent('Argentina'))
    await userEvent.click(await countryField())

    const names = ['Argentina', 'Uruguay', 'Chile', 'Paraguay', 'Brazil', 'Mexico', 'Spain', 'United States', 'Other']
    for (const name of names) {
      expect(await screen.findByRole('button', { name: new RegExp(`^${name}`) })).toBeInTheDocument()
    }
    expect(screen.getByText('(+598)')).toHaveClass('selector__cifra')
  })

  test('Save is off and the Selector is busy while the list is on its way', async () => {
    let release: (response: Response) => void = () => undefined
    const held = new Promise<Response>((resolve) => {
      release = resolve
    })
    const base = globalThis.fetch
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
      input === '/phone-countries' ? held : base(input, init),
    )
    renderForm(CUSTOMER_NEW)

    expect(await countryField()).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Save and use' })).toBeDisabled()
    release(jsonResponse(200, PHONE_COUNTRIES))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save and use' })).toBeEnabled())
    expect(await countryField()).not.toHaveAttribute('aria-busy')
  })

  test('a failed list keeps Save off and shows the form load error', async () => {
    stubFetchWithSettings(true, true, [], null, 'fail')
    renderForm(CUSTOMER_NEW)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(await countryField()).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Save and use' })).toBeDisabled()
  })

  test('Edit on a +598 number opens locked on Uruguay and an untouched Save sends neither phone nor country', async () => {
    await openEdit7('+59899123456')

    expect(await countryField()).toHaveTextContent('Uruguay (+598)')
    expect(await countryField()).toHaveAttribute('aria-disabled', 'true')
    await clickSave()
    await screen.findByText('la ficha')
    expect(sentBody('PATCH')).not.toHaveProperty('phone')
    expect(sentBody('PATCH')).not.toHaveProperty('phone_country')
  })

  test('Edit of a number from an unlisted country opens locked on Other and saves untouched', async () => {
    await openEdit7('+4915112345678')

    expect(await countryField()).toHaveTextContent('Other (type + and the code)')
    expect(await countryField()).toHaveAttribute('aria-disabled', 'true')
    await clickSave()
    await screen.findByText('la ficha')
    expect(sentBody('PATCH')).toEqual({ name: 'Tincho', customer_type_id: null })
  })

  test.each(PHONE_COUNTRIES)('Edit of a $code number shows $code locked', async ({ code, calling_code }) => {
    await openEdit7(`+${calling_code}12345678`)

    const field = await countryField()
    expect(field).toHaveTextContent(`(+${calling_code})`)
    expect(field).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByLabelText('Phone')).toHaveValue(`+${calling_code}12345678`)
    expect(code).toHaveLength(2)
  })

  test('Edit of a customer without a number runs the detection', async () => {
    vi.mocked(deviceLanguages).mockReturnValue(['es-UY'])
    await openEdit7(null)

    await waitFor(async () => expect(await countryField()).toHaveTextContent('Uruguay (+598)'))
    expect(await countryField()).not.toHaveAttribute('aria-disabled')
  })

  test('Edit with a changed number sends the phone and the shown country', async () => {
    await openEdit7('+59899123456')
    const user = userEvent.setup()

    await user.clear(screen.getByLabelText('Phone'))
    await user.type(screen.getByLabelText('Phone'), '11 3178 5094')
    expect(await countryField()).toHaveTextContent('Uruguay (+598)')
    await pickCountry(user, 'Argentina')
    await clickSave()
    await screen.findByText('la ficha')
    expect(sentBody('PATCH')).toMatchObject({ phone: '11 3178 5094', phone_country: 'AR' })
  })

  test('a rejection names the country and joins several lengths with or', async () => {
    api.mockResolvedValue(jsonResponse(422, { detail: 'refused', code: 'customer.phone_invalid' }))
    renderForm(CUSTOMER_NEW)
    const user = userEvent.setup()
    await waitFor(async () => expect(await countryField()).toHaveTextContent('Argentina'))
    await pickCountry(user, 'Spain')
    await user.type(screen.getByLabelText('Phone'), '12')
    await user.type(screen.getByLabelText('Name'), 'Nico')
    await clickSave()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      "That doesn't look like a Spanish number. It needs 8, 9 or 10 digits after the country code.",
    )
    expect(alert).not.toHaveTextContent('12')
  })
})
describe('history', () => {
  const CARD7 = pathTo(CUSTOMER, { id: 7 })
  const EDIT7 = pathTo(CUSTOMER_EDIT, { id: 7 })

  async function openNew() {
    api = stubFetchWithSettings(true, true, TYPES)
    const router = renderForm(CUSTOMERS)
    const user = userEvent.setup()
    await user.click(screen.getByRole('link', { name: 'Abrir el formulario' }))
    await screen.findByLabelText('Name')
    return { router, user }
  }

  async function openEdit() {
    api = stubFetchWithSettings(true, true, TYPES)
    api.mockResolvedValue(jsonResponse(200, { id: 7, name: 'Tincho', phone: null, phone_display: null, vip: false, customer_type_id: null }))
    const router = renderForm(CARD7, CUSTOMERS)
    const user = userEvent.setup()
    await user.click(screen.getByRole('link', { name: 'Editar' }))
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Tincho'))
    return { router, user }
  }

  describe.each([
    ['new', openNew, CUSTOMER_NEW, CUSTOMERS],
    ['edit', openEdit, EDIT7, CARD7],
  ])('ClienteForm %s on the phone', (_name, open, here, parent) => {
    beforeEach(() => stubViewport('phone'))

    test('a clean form: back goes to the parent', async () => {
      const { router } = await open()
      await act(() => router.navigate(-1))
      expect(router.state.location.pathname).toBe(parent)
    })

    test('a dirty form: back asks LeaveConfirm and keeping stays', async () => {
      const { router, user } = await open()
      await user.type(screen.getByLabelText('Name'), ' Sol')
      await act(() => router.navigate(-1))
      expect(screen.getByRole('alertdialog')).toHaveTextContent('Discard the customer?')
      await user.click(screen.getByRole('button', { name: 'No, keep entering' }))
      expect(router.state.location.pathname).toBe(here)
    })

    test('with the list open back closes only the list, even with the form dirty', async () => {
      const { router, user } = await open()
      await user.type(screen.getByLabelText('Name'), ' Sol')
      await user.click(await typeField())
      expect(screen.getByRole('dialog', { name: 'Customer type options' })).toBeInTheDocument()
      await act(() => router.navigate(-1))
      expect(screen.queryByRole('dialog', { name: 'Customer type options' })).not.toBeInTheDocument()
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(router.state.location.pathname).toBe(here)
      expect((screen.getByLabelText('Name') as HTMLInputElement).value).toContain('Sol')
      await act(() => router.navigate(-1))
      expect(screen.getByRole('alertdialog')).toHaveTextContent('Discard the customer?')
    })
  })

  describe.each([
    ['new', openNew],
    ['edit', openEdit],
  ])('ClienteForm %s on the computer', (_name, open) => {
    beforeEach(() => stubViewport('computer'))

    test('Escape closes only the dropdown', async () => {
      const { router, user } = await open()
      const here = router.state.location.pathname
      await user.click(await typeField())
      expect(screen.getByRole('listbox')).toBeInTheDocument()
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(router.state.location.pathname).toBe(here)
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })
  })
})
