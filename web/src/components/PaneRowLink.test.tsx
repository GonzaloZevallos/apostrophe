/**
 * `PaneRowLink` under a real data router, `matchMedia` faked through the one viewport helper:
 * on a computer a pick replaces the history entry, on the phone it pushes one, and both carry
 * the in-app state. The viewport is read when the user picks, not when the list was drawn.
 */

import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { stubMovableViewport, stubViewport } from '../test-viewport'
import { inAppState } from './inAppState'
import PaneRowLink from './PaneRowLink'

const LIST = '/list'
const BEFORE = '/before'

function renderList() {
  const router = createMemoryRouter(
    [
      { path: BEFORE, element: <p>antes</p> },
      {
        path: LIST,
        element: (
          <nav>
            <PaneRowLink to="/list/1" className="fila" activeClassName="fila fila--activa">
              Ana
            </PaneRowLink>
            <PaneRowLink to="/list/2" className="fila" activeClassName="fila fila--activa">
              Beto
            </PaneRowLink>
          </nav>
        ),
        children: [{ path: ':id', element: null }],
      },
    ],
    { initialEntries: [BEFORE, LIST], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
  return router
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('on the phone a pick pushes an entry that carries the in-app state, and back returns to the list', async () => {
  stubViewport('phone')
  const router = renderList()

  await userEvent.click(screen.getByRole('link', { name: 'Ana' }))

  expect(router.state.location.pathname).toBe('/list/1')
  expect(router.state.historyAction).toBe('PUSH')
  expect(router.state.location.state).toEqual(inAppState({ pathname: LIST }))
  await act(() => router.navigate(-1))
  expect(router.state.location.pathname).toBe(LIST)
})

test('on a computer a pick replaces the entry and carries the in-app state', async () => {
  stubViewport('computer')
  const router = renderList()

  await userEvent.click(screen.getByRole('link', { name: 'Ana' }))

  expect(router.state.location.pathname).toBe('/list/1')
  expect(router.state.historyAction).toBe('REPLACE')
  expect(router.state.location.state).toEqual(inAppState({ pathname: LIST }))
})

test('on a computer, two picks and one back leave the list for the entry before it', async () => {
  stubViewport('computer')
  const router = renderList()

  await userEvent.click(screen.getByRole('link', { name: 'Ana' }))
  await userEvent.click(screen.getByRole('link', { name: 'Beto' }))
  expect(router.state.location.pathname).toBe('/list/2')
  await act(() => router.navigate(-1))

  expect(router.state.location.pathname).toBe(BEFORE)
})

test('each pick follows the viewport at that moment', async () => {
  const viewport = stubMovableViewport('phone')
  const router = renderList()
  await userEvent.click(screen.getByRole('link', { name: 'Ana' }))
  expect(router.state.historyAction).toBe('PUSH')

  viewport.set('computer')
  await userEvent.click(screen.getByRole('link', { name: 'Beto' }))
  expect(router.state.location.pathname).toBe('/list/2')
  expect(router.state.historyAction).toBe('REPLACE')

  await act(() => router.navigate(-1))
  expect(router.state.location.pathname).toBe(LIST)
})

test('the row is current, with the active class, while the URL is its path or under it', async () => {
  stubViewport('computer')
  renderList()

  expect(screen.getByRole('link', { name: 'Ana' }).getAttribute('aria-current')).toBeNull()
  await userEvent.click(screen.getByRole('link', { name: 'Ana' }))

  const ana = screen.getByRole('link', { name: 'Ana' })
  expect(ana.getAttribute('aria-current')).toBe('page')
  expect(ana.className).toBe('fila fila--activa')
  expect(screen.getByRole('link', { name: 'Beto' }).className).toBe('fila')
})
