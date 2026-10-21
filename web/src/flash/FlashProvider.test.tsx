/**
 * `FlashProvider` + `useFlash` through a memory data router: a toast armed before
 * `navigate(-1)` shows once on the destination, never on the origin, never again.
 */

import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createMemoryRouter, Link, Outlet, RouterProvider, useNavigate } from 'react-router'
import FlashProvider from './FlashProvider'
import { useFlash } from './useFlash'

function Layout() {
  return (
    <FlashProvider>
      <Outlet />
    </FlashProvider>
  )
}

function Origin() {
  const flash = useFlash()
  const navigate = useNavigate()
  return (
    <main>
      <h1>Origen</h1>
      <button
        onClick={() => {
          flash.armAfterLeaving('Expense saved')
          void navigate(-1)
        }}
      >
        guardar y volver
      </button>
      <button onClick={() => flash.armAfterLeaving('Expense saved')}>armar y quedarse</button>
      <button onClick={() => flash.showNow('Expense deleted')}>mostrar ya</button>
    </main>
  )
}

function Destination() {
  return (
    <main>
      <h1>Destino</h1>
      <Link to="/origin">ir al origen</Link>
      <Link to="/other">ir a otra</Link>
    </main>
  )
}

function renderApp() {
  const router = createMemoryRouter(
    [
      {
        element: <Layout />,
        children: [
          { path: '/destination', element: <Destination /> },
          { path: '/origin', element: <Origin /> },
          { path: '/other', element: <Link to="/destination">volver al destino</Link> },
        ],
      },
    ],
    { initialEntries: ['/destination'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-01-05T12:00:00Z'), shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

test('a toast armed before navigate(-1) shows on the destination only, and not again', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderApp()
  await user.click(screen.getByRole('link', { name: 'ir al origen' }))
  expect(screen.getByRole('heading', { name: 'Origen' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'guardar y volver' }))

  expect(screen.getByRole('heading', { name: 'Destino' })).toBeInTheDocument()
  expect(screen.getAllByRole('status')).toHaveLength(1)
  expect(screen.getByRole('status')).toHaveTextContent('Expense saved')

  await user.click(screen.getByRole('link', { name: 'ir a otra' }))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: 'volver al destino' }))
  expect(screen.getByRole('heading', { name: 'Destino' })).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('an armed toast shows nothing on the route that armed it', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderApp()
  await user.click(screen.getByRole('link', { name: 'ir al origen' }))

  await user.click(screen.getByRole('button', { name: 'armar y quedarse' }))

  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('showNow shows in place and the one timer dismisses it', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderApp()
  await user.click(screen.getByRole('link', { name: 'ir al origen' }))

  await user.click(screen.getByRole('button', { name: 'mostrar ya' }))
  expect(screen.getByRole('status')).toHaveTextContent('Expense deleted')

  act(() => {
    vi.advanceTimersByTime(2500)
  })
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('a toast shown after leaving is dismissed by the timer too', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderApp()
  await user.click(screen.getByRole('link', { name: 'ir al origen' }))
  await user.click(screen.getByRole('button', { name: 'guardar y volver' }))
  expect(screen.getByRole('status')).toBeInTheDocument()

  act(() => {
    vi.advanceTimersByTime(2500)
  })

  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
