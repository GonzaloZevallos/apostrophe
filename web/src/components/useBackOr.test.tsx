import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, RouterProvider } from 'react-router'
import { expect, test } from 'vitest'
import { useBackOr } from './useBackOr'

function Child() {
  const back = useBackOr('/padre')
  return (
    <main>
      <h1>Hijo</h1>
      <button type="button" onClick={back}>
        Volver
      </button>
    </main>
  )
}

function renderAt(entries: { initialEntries: string[]; initialIndex?: number }) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <main>
            <Link to="/hijo" state={{ inApp: true }}>
              Ir marcado
            </Link>
            <Link to="/hijo">Ir sin marca</Link>
          </main>
        ),
      },
      { path: '/hijo', element: <Child /> },
      { path: '/padre', element: <h1>Padre</h1> },
    ],
    entries,
  )
  render(<RouterProvider router={router} />)
  return router
}

test('goes back in history when the entry was reached by an in-app link', async () => {
  const user = userEvent.setup()
  const router = renderAt({ initialEntries: ['/'] })

  await user.click(screen.getByRole('link', { name: 'Ir marcado' }))
  await user.click(screen.getByRole('button', { name: 'Volver' }))

  expect(router.state.location.pathname).toBe('/')
})

test('goes to the fixed parent, replacing the entry, when the entry carries no inApp state', async () => {
  const router = renderAt({ initialEntries: ['/', '/hijo'], initialIndex: 1 })

  await userEvent.setup().click(screen.getByRole('button', { name: 'Volver' }))

  expect(router.state.location.pathname).toBe('/padre')
  expect(router.state.historyAction).toBe('REPLACE')
})

test('a link without the in-app mark is not trusted: it goes to the parent even with history behind it', async () => {
  const user = userEvent.setup()
  const router = renderAt({ initialEntries: ['/'] })

  await user.click(screen.getByRole('link', { name: 'Ir sin marca' }))
  await user.click(screen.getByRole('button', { name: 'Volver' }))

  expect(router.state.location.pathname).toBe('/padre')
})
