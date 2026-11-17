/**
 * The Forgot sheet and its copy constants (GH-521). The sheet is fixed text, the same for
 * everyone: it reads nothing typed on Sign in and names no person, channel or contact.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SheetRouterProvider } from '../components/useSheetStack'
import { AUTH_TEXT, BRAKE_MESSAGE, FORGOT_SHEET_TEXT } from '../copy/auth'
import { LOGIN } from '../routes'
import Entrar from './Entrar'
import ForgotSheet from './ForgotSheet'

const PARAGRAPHS = Object.values(FORGOT_SHEET_TEXT)
const SHEET_TEXTS = [AUTH_TEXT.forgotPassword, ...PARAGRAPHS]

function renderEntrar() {
  const router = createMemoryRouter([{ path: LOGIN, element: <Entrar /> }], {
    initialEntries: [LOGIN],
  })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the copy guard', () => {
  const BANNED = [/operator/i, /whatsapp/i, /telegram/i, /@/, /\d{7,}/, /\+\d/, /unblock/i, /\blift/i]

  test.each(SHEET_TEXTS)('bans every channel, contact and block promise in: %s', (text) => {
    for (const banned of BANNED) expect(text).not.toMatch(banned)
  })

  test('the guard rejects a text that names a channel, a contact or a lifted block', () => {
    const offenders = [
      'Ask the operator',
      'Write on WhatsApp',
      'Message us on Telegram',
      'Write to help@x.com',
      'Call 5491155551234',
      'Call +54 11',
      'The reset will unblock you',
      'It lifts the block',
    ]
    for (const offender of offenders) expect(BANNED.some((banned) => banned.test(offender))).toBe(true)
  })

  test('says who gives the link, what to ask, once, 24 hours and no current password', () => {
    const all = SHEET_TEXTS.join(' ').toLowerCase()
    for (const required of ['24 hours', 'once', 'invitation', 'email you sign in with', 'current']) {
      expect(all).toContain(required)
    }
    expect(all).toMatch(/not|doesn't come by email/)
  })

  test('the brake message says nothing about the link', () => {
    expect(BRAKE_MESSAGE).not.toMatch(/link/i)
    expect(BRAKE_MESSAGE).not.toMatch(/reset/i)
  })
})

describe('the sheet', () => {
  test('is named by its title, holds only Close and the three paragraphs, and opens on Close', () => {
    render(<ForgotSheet onClose={() => undefined} />)

    expect(screen.getByRole('dialog', { name: AUTH_TEXT.forgotPassword })).toBeInTheDocument()
    for (const paragraph of PARAGRAPHS) expect(screen.getByText(paragraph)).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  test('Close calls onClose', async () => {
    const onClose = vi.fn()
    render(<ForgotSheet onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('has the same text with an empty form, a typed known email, a typed unknown email and a locked email', async () => {
    const texts: (string | null)[] = []
    const cases: { email: string; locked: boolean }[] = [
      { email: '', locked: false },
      { email: 'ana@x.com', locked: false },
      { email: 'nobody@nowhere.example', locked: false },
      { email: 'ana@x.com', locked: true },
    ]
    for (const { email, locked } of cases) {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ detail: 'x', code: 'account.login_locked' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      renderEntrar()
      if (email !== '') await userEvent.type(screen.getByLabelText('Email address'), email)
      if (locked) {
        await userEvent.type(screen.getByLabelText('Password'), 'wrongpass1')
        await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
        await screen.findByText(BRAKE_MESSAGE)
      }
      await userEvent.click(screen.getByRole('button', { name: AUTH_TEXT.forgotPassword }))
      texts.push(screen.getByRole('dialog', { name: AUTH_TEXT.forgotPassword }).textContent)
      cleanup()
    }

    expect(new Set(texts).size).toBe(1)
    expect(texts[0]).toContain(FORGOT_SHEET_TEXT.whatToAsk)
  })
})
