/**
 * `PaneRowLink` at the component seam: the row is the active one (`aria-current`, the active
 * class) while the URL is its record's page or anything under it, and it pushes or replaces
 * the history entry as it is told.
 */

import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import PaneRowLink from './PaneRowLink'

function renderRow(replace: boolean, entries: string[]) {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <PaneRowLink to="/cosas/3" replace={replace} className="fila" activeClassName="fila fila--activa">
            Tres
          </PaneRowLink>
        ),
      },
    ],
    { initialEntries: entries },
  )
  render(<RouterProvider router={router} />)
  return router
}

test('a row is not active away from its record, and is active on it and under it', async () => {
  const away = renderRow(false, ['/cosas'])
  let link = await screen.findByRole('link', { name: 'Tres' })
  expect(link).not.toHaveAttribute('aria-current')
  expect(link.className).toBe('fila')

  await act(() => away.navigate('/cosas/3/precios'))
  link = screen.getByRole('link', { name: 'Tres' })
  expect(link).toHaveAttribute('aria-current', 'page')
  expect(link.className).toBe('fila fila--activa')
})

test('a row for another record stays inactive', async () => {
  renderRow(false, ['/cosas/30'])
  const link = await screen.findByRole('link', { name: 'Tres' })
  expect(link).not.toHaveAttribute('aria-current')
})

test('replace swaps the history entry; without it the entry is pushed', async () => {
  const replacing = renderRow(true, ['/antes', '/cosas'])
  await userEvent.click(await screen.findByRole('link', { name: 'Tres' }))
  expect(replacing.state.location.pathname).toBe('/cosas/3')
  expect(replacing.state.historyAction).toBe('REPLACE')
  await act(() => replacing.navigate(-1))
  expect(replacing.state.location.pathname).toBe('/antes')
})

test('without replace the entry is pushed and back returns to the list', async () => {
  document.body.innerHTML = ''
  const pushing = renderRow(false, ['/antes', '/cosas'])
  await userEvent.click(await screen.findByRole('link', { name: 'Tres' }))
  expect(pushing.state.historyAction).toBe('PUSH')
  await act(() => pushing.navigate(-1))
  expect(pushing.state.location.pathname).toBe('/cosas')
})
