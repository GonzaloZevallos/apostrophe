import { inAppState } from './inAppState'
import { HOME } from '../routes'
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
        path: HOME,
        element: (
          <main>
            <Link to="/hijo" state={inAppState({ pathname: HOME })}>
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
  const router = renderAt({ initialEntries: [HOME] })

  await user.click(screen.getByRole('link', { name: 'Ir marcado' }))
  await user.click(screen.getByRole('button', { name: 'Volver' }))

  expect(router.state.location.pathname).toBe(HOME)
})

test('goes to the fixed parent, replacing the entry, when the entry carries no inApp state', async () => {
  const router = renderAt({ initialEntries: [HOME, '/hijo'], initialIndex: 1 })

  await userEvent.setup().click(screen.getByRole('button', { name: 'Volver' }))

  expect(router.state.location.pathname).toBe('/padre')
  expect(router.state.historyAction).toBe('REPLACE')
})

test('a link without the in-app mark is not trusted: it goes to the parent even with history behind it', async () => {
  const user = userEvent.setup()
  const router = renderAt({ initialEntries: [HOME] })

  await user.click(screen.getByRole('link', { name: 'Ir sin marca' }))
  await user.click(screen.getByRole('button', { name: 'Volver' }))

  expect(router.state.location.pathname).toBe('/padre')
})

test('the lazy fallback is called when back is tapped, so it answers what is true then', async () => {
  let parent = '/padre'
  const calls: string[] = []
  function LazyChild() {
    const back = useBackOr(() => {
      calls.push(parent)
      return parent
    })
    return (
      <button type="button" onClick={back}>
        Volver
      </button>
    )
  }
  const router = createMemoryRouter(
    [
      { path: '/hijo', element: <LazyChild /> },
      { path: '/padre', element: <h1>Padre</h1> },
      { path: '/archivadas', element: <h1>Archivadas</h1> },
    ],
    { initialEntries: ['/hijo'] },
  )
  render(<RouterProvider router={router} />)
  expect(calls).toEqual([])

  parent = '/archivadas'
  await userEvent.setup().click(screen.getByRole('button', { name: 'Volver' }))

  expect(calls).toEqual(['/archivadas'])
  expect(router.state.location.pathname).toBe('/archivadas')
  expect(router.state.historyAction).toBe('REPLACE')
})

test('the lazy fallback is not called when the entry is in-app: back goes through history', async () => {
  const user = userEvent.setup()
  let called = false
  function LazyChild() {
    const back = useBackOr(() => {
      called = true
      return '/padre'
    })
    return (
      <button type="button" onClick={back}>
        Volver
      </button>
    )
  }
  const router = createMemoryRouter(
    [
      {
        path: HOME,
        element: (
          <Link to="/hijo" state={inAppState({ pathname: HOME })}>
            Ir marcado
          </Link>
        ),
      },
      { path: '/hijo', element: <LazyChild /> },
    ],
    { initialEntries: [HOME] },
  )
  render(<RouterProvider router={router} />)

  await user.click(screen.getByRole('link', { name: 'Ir marcado' }))
  await user.click(screen.getByRole('button', { name: 'Volver' }))

  expect(router.state.location.pathname).toBe(HOME)
  expect(called).toBe(false)
})
