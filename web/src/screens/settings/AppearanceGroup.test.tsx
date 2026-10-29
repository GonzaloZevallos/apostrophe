/**
 * `AppearanceGroup` through what the person sees and does (ADR-0026): two choices, Claro
 * and Oscuro, as a radio group; a tap applies and remembers the choice at once, with no save
 * button, no toast and no unsaved-changes question; "Close" always closes at once.
 */

import { SETTINGS, SETTINGS_APPEARANCE } from '../../routes'
import { inAppState } from '../../components/inAppState'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, RouterProvider } from 'react-router'
import { beforeEach, expect, test } from 'vitest'
import { expectIconAndTextRule } from '../../test/iconAndTextRule'
import AppearanceGroup from './AppearanceGroup'

const html = document.documentElement

beforeEach(() => {
  localStorage.clear()
  html.removeAttribute('data-tema')
})

function renderGroup() {
  const router = createMemoryRouter(
    [
      {
        path: SETTINGS,
        element: (
          <main>
            <h1>Lista</h1>
            <Link to={SETTINGS_APPEARANCE} state={inAppState({ pathname: SETTINGS })}>
              Abrir
            </Link>
          </main>
        ),
      },
      { path: SETTINGS_APPEARANCE, element: <AppearanceGroup /> },
    ],
    { initialEntries: [SETTINGS] },
  )
  render(<RouterProvider router={router} />)
  return router
}

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('link', { name: 'Abrir' }))
  await screen.findByText('Appearance')
}

test('offers Claro and Oscuro as a radio group, Claro marked when nothing is stored', async () => {
  const user = userEvent.setup()
  renderGroup()
  await open(user)

  const group = screen.getByRole('radiogroup', { name: 'Theme' })
  expect(group).toBeInTheDocument()
  expect(screen.getAllByRole('radio').map((radio) => radio.textContent)).toEqual(['Light', 'Dark'])
  expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'false')
})

test('marks Oscuro when the page is already dark', async () => {
  html.setAttribute('data-tema', 'oscuro')
  const user = userEvent.setup()
  renderGroup()
  await open(user)

  expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'false')
})

test('tapping Oscuro applies and remembers it, with no save button and no toast', async () => {
  const user = userEvent.setup()
  renderGroup()
  await open(user)

  await user.click(screen.getByRole('radio', { name: 'Dark' }))

  expect(html.getAttribute('data-tema')).toBe('oscuro')
  expect(localStorage.getItem('tema')).toBe('oscuro')
  expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'false')
  expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('tapping Claro removes the attribute and stores claro', async () => {
  localStorage.setItem('tema', 'oscuro')
  html.setAttribute('data-tema', 'oscuro')
  const user = userEvent.setup()
  renderGroup()
  await open(user)

  await user.click(screen.getByRole('radio', { name: 'Light' }))

  expect(html.hasAttribute('data-tema')).toBe(false)
  expect(localStorage.getItem('tema')).toBe('claro')
  expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true')
})

test('"Close" closes at once after choosing, with no question', async () => {
  const user = userEvent.setup()
  const router = renderGroup()
  await open(user)
  await user.click(screen.getByRole('radio', { name: 'Dark' }))

  await user.click(screen.getByRole('button', { name: 'Close' }))

  await act(async () => undefined)
  expect(router.state.location.pathname).toBe(SETTINGS)
  expect(screen.queryByText('Discard the theme?')).not.toBeInTheDocument()
})

test('Claro and Oscuro are options (radios) and the group follows the icon and text rule', async () => {
  renderGroup()
  await open(userEvent.setup())
  expect(screen.getAllByRole('radio')).toHaveLength(2)
  expectIconAndTextRule(document.body)
})
