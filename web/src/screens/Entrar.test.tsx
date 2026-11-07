/**
 * `Entrar` at the screen seam (CODING_STANDARDS §10): Testing Library, the API faked
 * at `fetch`. The hint under the button is fixed, never a count of attempts; a lock
 * shows the brake message in its place.
 */

import { LOGIN } from '../routes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { SheetRouterProvider } from '../components/useSheetStack'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AUTH_TEXT, INVITE_ONLY_LINE } from '../copy/auth'
import { expectIconAndTextRule } from '../test/iconAndTextRule'
import Entrar, { BRAKE_MESSAGE, CREDENTIALS_WRONG, LOGIN_HINT, RETRY_MESSAGE } from './Entrar'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderEntrar(
  queryClient: QueryClient,
  initialEntries: (string | { pathname: string; state: unknown })[] = [LOGIN],
) {
  const router = createMemoryRouter(
    [
      { path: LOGIN, element: <Entrar /> },
      { path: '*', element: <p>elsewhere</p> },
    ],
    { initialEntries },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )
  return router
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('the submit is text only and the screen follows the icon and text rule', () => {
  renderEntrar(new QueryClient())
  expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('type', 'submit')
  // "Show" is PasswordField's own show/hide toggle, an option control.
  expectIconAndTextRule(document.body)
})

test('the email suggests the username and the password the current password', () => {
  renderEntrar(new QueryClient())

  expect(screen.getByLabelText('Email address')).toHaveAttribute('autocomplete', 'username')
  expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password')
})

test('shows the fixed hint under the button, never a count of attempts', () => {
  renderEntrar(new QueryClient())

  expect(screen.getByText(LOGIN_HINT)).toBeInTheDocument()
  expect(screen.queryByText(/attempts? (left|remaining)/i)).not.toBeInTheDocument()
})

test('a wrong email or password shows the same inline refusal, naming neither', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(401, { detail: 'nope' }))
  renderEntrar(new QueryClient())

  await userEvent.type(screen.getByLabelText('Email address'), 'ana@x.com')
  await userEvent.type(screen.getByLabelText('Password'), 'wrongpass1')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(CREDENTIALS_WRONG)
})

test('the lock shows the brake message in place of the fixed hint', async () => {
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(429, {
      detail: 'too many failed attempts',
      code: 'account.login_locked',
    }),
  )
  renderEntrar(new QueryClient())

  await userEvent.type(screen.getByLabelText('Email address'), 'ana@x.com')
  await userEvent.type(screen.getByLabelText('Password'), 'wrongpass1')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByText(BRAKE_MESSAGE)).toBeInTheDocument()
  expect(screen.queryByText(LOGIN_HINT)).not.toBeInTheDocument()
})

test('a server error shows the generic retry, never a refusal that blames the input', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response('internal error', { status: 500 }))
  renderEntrar(new QueryClient())

  await userEvent.type(screen.getByLabelText('Email address'), 'ana@x.com')
  await userEvent.type(screen.getByLabelText('Password'), 'secreta123')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(RETRY_MESSAGE)
})

test('a successful login clears the whole cache before landing on Inicio', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { token: 'tok' }))
  const queryClient = new QueryClient()
  queryClient.setQueryData(['me'], { businessName: 'stale' })
  renderEntrar(queryClient)

  await userEvent.type(screen.getByLabelText('Email address'), 'ana@x.com')
  await userEvent.type(screen.getByLabelText('Password'), 'secreta123')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  await vi.waitFor(() => {
    expect(queryClient.getQueryData(['me'])).toBeUndefined()
  })
  expect(fetch).toHaveBeenCalledWith(
    '/auth/login',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'ana@x.com', password: 'secreta123' }),
    }),
  )
})

test('shows the brand lockup at the top of the screen, named "apostrophe", with the tagline under it', () => {
  renderEntrar(new QueryClient())

  const main = screen.getByRole('main')
  const brand = within(main).getByRole('img', { name: 'apostrophe' })
  expect(brand.querySelector('img')).toHaveAttribute('src', '/icons/mark.svg')
  expect(brand).toHaveTextContent('apostrophe\u2019')
  expect(main.querySelector('.auth-page__columna')?.firstElementChild).toContainElement(brand)
})

test('the email input has the focus when the screen opens', () => {
  renderEntrar(new QueryClient())

  expect(screen.getByLabelText('Email address')).toHaveFocus()
})

const FORGOT = AUTH_TEXT.forgotPassword

async function fillIn() {
  await userEvent.type(screen.getByLabelText('Email address'), 'ana@x.com')
  await userEvent.type(screen.getByLabelText('Password'), 'secreta123')
}

async function openTheSheet() {
  await userEvent.click(screen.getByRole('button', { name: FORGOT }))
  return screen.getByRole('dialog', { name: FORGOT })
}

function expectIntact() {
  expect(screen.getByLabelText('Email address')).toHaveValue('ana@x.com')
  expect(screen.getByLabelText('Password')).toHaveValue('secreta123')
  expect(screen.getByRole('button', { name: FORGOT })).toHaveFocus()
  expect(fetch).not.toHaveBeenCalled()
}

test('the trigger is a plain button outside the password field, before Sign in', () => {
  renderEntrar(new QueryClient())

  const trigger = screen.getByRole('button', { name: FORGOT })
  expect(trigger).toHaveAttribute('type', 'button')
  expect(trigger.closest('label')).toBeNull()
  const buttons = screen.getAllByRole('button').map((button) => button.textContent)
  expect(buttons.indexOf(FORGOT)).toBeGreaterThan(buttons.indexOf('Show'))
  expect(buttons.indexOf(FORGOT)).toBeLessThan(buttons.indexOf('Sign in'))
  expect(screen.getByText(AUTH_TEXT.tagline)).toBeInTheDocument()
  expect(screen.getByText(INVITE_ONLY_LINE)).toBeInTheDocument()
})

test('Close, Escape and the system back each close the sheet, keeping what was typed and sending nothing', async () => {
  const router = renderEntrar(new QueryClient())
  await fillIn()

  await openTheSheet()
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expectIntact()

  await openTheSheet()
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expectIntact()

  await openTheSheet()
  await act(() => router.navigate(-1))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(router.state.location.pathname).toBe(LOGIN)
  expectIntact()
})

test('the sheet is a history entry of the same path, not a route', async () => {
  const router = renderEntrar(new QueryClient())

  await openTheSheet()

  expect(router.state.location.pathname).toBe(LOGIN)
  expect(router.state.location.state).toEqual({ sheet: 1 })
})

test('the inline refusal survives opening and closing the sheet', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(401, { detail: 'nope' }))
  renderEntrar(new QueryClient())
  await fillIn()
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByText(CREDENTIALS_WRONG)

  await openTheSheet()
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  expect(screen.getByText(CREDENTIALS_WRONG)).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('the brake message survives, and the trigger is still there to open the sheet', async () => {
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(429, {
      detail: 'too many failed attempts',
      code: 'account.login_locked',
    }),
  )
  renderEntrar(new QueryClient())
  await fillIn()
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByText(BRAKE_MESSAGE)

  await openTheSheet()
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  expect(screen.getByText(BRAKE_MESSAGE)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: FORGOT })).toBeVisible()
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('while the sheet is open Sign in is inert and tabbing never leaves the sheet; closing lifts it', async () => {
  renderEntrar(new QueryClient())
  await openTheSheet()

  const main = screen.getByRole('main')
  expect(main).toHaveAttribute('inert')
  const close = screen.getByRole('button', { name: 'Close' })
  expect(close).toHaveFocus()
  // jsdom's Tab ignores `inert`; browsers skip everything inside it, so each control outside the sheet must sit in it.
  for (const outside of [
    screen.getByLabelText('Email address'),
    screen.getByLabelText('Password'),
    screen.getByRole('button', { name: FORGOT, hidden: true }),
    screen.getByRole('button', { name: 'Sign in', hidden: true }),
  ]) {
    expect(outside.closest('[inert]')).toBe(main)
  }
  expect(main).not.toContainElement(screen.getByRole('dialog'))
  await userEvent.click(close)

  expect(screen.getByRole('main')).not.toHaveAttribute('inert')
})

test('a sheet entry that was not opened here (reload, shared address) draws no sheet and is dropped', async () => {
  const router = renderEntrar(new QueryClient(), [{ pathname: LOGIN, state: { sheet: 1 } }])

  await vi.waitFor(() => expect(router.state.location.state).not.toHaveProperty('sheet'))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Email address')).toHaveFocus()
  expect(screen.getByRole('button', { name: FORGOT })).not.toHaveFocus()
})
