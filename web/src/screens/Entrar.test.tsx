/**
 * `Entrar` at the screen seam (CODING_STANDARDS §10): Testing Library, the API faked
 * at `fetch`. The hint under the button is fixed, never a count of attempts; a lock
 * shows the brake message in its place.
 */

import { LOGIN } from '../routes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { expectIconAndTextRule } from '../test/iconAndTextRule'
import Entrar, { BRAKE_MESSAGE, CREDENTIALS_WRONG, LOGIN_HINT, RETRY_MESSAGE } from './Entrar'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderEntrar(queryClient: QueryClient) {
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[LOGIN]}>
        <Entrar />
      </MemoryRouter>
    </QueryClientProvider>,
  )
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
    jsonResponse(429, { detail: 'too many failed attempts', code: 'account.login_locked' }),
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
