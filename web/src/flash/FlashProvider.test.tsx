/**
 * `FlashProvider` + `useFlash` through a memory data router: a toast armed before
 * `navigate(-1)` shows once on the destination, never on the origin, never again.
 */

import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { createMemoryRouter, Link, Outlet, RouterProvider, useNavigate } from 'react-router'
import FlashProvider, { DEFAULT_TOAST_MS, SALE_SAVED_TOAST_MS } from './FlashProvider'
import type { Flash } from './flashContext'
import { FOLLOWED_REDIRECT } from './flashReducer'
import { useFlash } from './useFlash'
import ContentArea from '../components/ContentArea'

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
    <ContentArea as="main">
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
    </ContentArea>
  )
}

function Destination() {
  return (
    <ContentArea as="main">
      <h1>Destino</h1>
      <Link to="/origin">ir al origen</Link>
      <Link to="/other">ir a otra</Link>
    </ContentArea>
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

/** A page that raises the sale-saved toast and records how often its handler runs. */
function Raiser({ onUndo }: { onUndo: () => void }) {
  const flash = useFlash()
  const navigate = useNavigate()
  return (
    <ContentArea as="main">
      <h1>Raiser</h1>
      <button
        onClick={() =>
          flash.showNow(
            { kind: 'saleSaved', name: 'Ana' },
            { durationMs: SALE_SAVED_TOAST_MS, action: { label: 'Undo', onPress: onUndo } },
          )
        }
      >
        raise sale
      </button>
      <button onClick={() => flash.showNow('Expense deleted')}>raise text</button>
      <button
        onClick={() => {
          void navigate('/next')
          void Promise.resolve().then(() => flash.showNow('Expense deleted'))
        }}
      >
        navigate then raise late
      </button>
    </ContentArea>
  )
}

function renderRaiser(onUndo: () => void = () => {}) {
  const router = createMemoryRouter(
    [
      {
        element: <Layout />,
        children: [
          { path: '/raiser', element: <Raiser onUndo={onUndo} /> },
          { path: '/next', element: <Link to="/raiser">back</Link> },
        ],
      },
    ],
    { initialEntries: ['/raiser'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

test('the sale-saved toast is there at 4.9 s and gone at 5 s', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderRaiser()
  await user.click(screen.getByRole('button', { name: 'raise sale' }))

  act(() => {
    vi.advanceTimersByTime(SALE_SAVED_TOAST_MS - 100)
  })
  expect(screen.getByRole('status')).toHaveTextContent('Sale to Ana saved')
  act(() => {
    vi.advanceTimersByTime(100)
  })

  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('a string toast is there just before 2.5 s and gone at 2.5 s', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderRaiser()
  await user.click(screen.getByRole('button', { name: 'raise text' }))

  act(() => {
    vi.advanceTimersByTime(DEFAULT_TOAST_MS - 100)
  })
  expect(screen.getByRole('status')).toBeInTheDocument()
  act(() => {
    vi.advanceTimersByTime(100)
  })

  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('a string toast has its text and no button, and the sale-saved one is the only floating layer', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderRaiser()
  await user.click(screen.getByRole('button', { name: 'raise text' }))

  expect(screen.getByRole('status')).toHaveTextContent('Expense deleted')
  expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  expect(screen.getByRole('status').parentElement).toBe(document.body.firstElementChild)
  expect(screen.getByRole('status').closest('.aviso-flotante')).toBeNull()
})

test('a followed redirect does not restart the clock: the sale-saved toast still goes at 5 s', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const router = renderRaiser()
  await user.click(screen.getByRole('button', { name: 'raise sale' }))
  act(() => {
    vi.advanceTimersByTime(4000)
  })

  await act(async () => {
    await router.navigate('/next', { replace: true, state: FOLLOWED_REDIRECT })
  })
  expect(screen.getByRole('status')).toBeInTheDocument()
  act(() => {
    vi.advanceTimersByTime(1000)
  })

  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('a new toast replaces the previous one and takes its own full duration', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderRaiser()
  await user.click(screen.getByRole('button', { name: 'raise sale' }))
  act(() => {
    vi.advanceTimersByTime(4000)
  })

  await user.click(screen.getByRole('button', { name: 'raise text' }))

  expect(screen.getAllByRole('status')).toHaveLength(1)
  expect(screen.getByRole('status')).toHaveTextContent('Expense deleted')
  act(() => {
    vi.advanceTimersByTime(DEFAULT_TOAST_MS - 100)
  })
  expect(screen.getByRole('status')).toBeInTheDocument()
  act(() => {
    vi.advanceTimersByTime(100)
  })
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

/** A page that raises each Undo result, each with an action it must ignore. */
function UndoRaiser() {
  const flash = useFlash()
  const withAction = { action: { label: 'Undo', onPress: () => {} } }
  return (
    <ContentArea as="main">
      <h1>Undo raiser</h1>
      <button onClick={() => flash.showNow({ kind: 'undoResult', result: 'deleted' }, withAction)}>raise deleted</button>
      <button onClick={() => flash.showNow({ kind: 'undoResult', result: 'gone' }, withAction)}>raise gone</button>
      <button onClick={() => flash.showNow({ kind: 'undoResult', result: 'offline' }, withAction)}>
        raise offline
      </button>
      <button onClick={() => flash.showNow({ kind: 'undoResult', result: 'failed' }, withAction)}>raise failed</button>
      <button onClick={() => flash.showNow('Expense deleted')}>raise text</button>
      <button onClick={() => flash.showNow({ kind: 'saleSaved', name: 'Ana' })}>raise sale</button>
    </ContentArea>
  )
}

function renderUndoRaiser() {
  const router = createMemoryRouter([{ element: <Layout />, children: [{ path: '/undo', element: <UndoRaiser /> }] }], {
    initialEntries: ['/undo'],
  })
  render(<RouterProvider router={router} />)
}

const UNDO_RESULTS = [
  { result: 'deleted', role: 'status', text: 'Sale deleted · the grams go back to stock' },
  { result: 'gone', role: 'status', text: 'That is gone. The list is up to date.' },
  { result: 'offline', role: 'status', text: 'Offline: check your internet and try again.' },
  { result: 'failed', role: 'alert', text: 'Something went wrong. Try again.' },
] as const

describe('the undoResult toast', () => {
  it.each(UNDO_RESULTS)('$result shows its element inside the floating area and is gone at 2.5 s', async (row) => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderUndoRaiser()
    await user.click(screen.getByRole('button', { name: `raise ${row.result}` }))

    act(() => {
      vi.advanceTimersByTime(DEFAULT_TOAST_MS - 100)
    })
    const toast = screen.getByRole(row.role)
    expect(toast).toHaveTextContent(row.text)
    expect(toast.closest('.aviso-flotante')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
    if (row.result !== 'deleted') expect(toast).not.toHaveTextContent('Sale deleted')
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(screen.queryByRole(row.role)).not.toBeInTheDocument()
  })

  it.each(UNDO_RESULTS)('a string toast replaces $result and is the only one visible', async (row) => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderUndoRaiser()
    await user.click(screen.getByRole('button', { name: `raise ${row.result}` }))

    await user.click(screen.getByRole('button', { name: 'raise text' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('Expense deleted')
  })

  it('is replaced by a sale-saved toast', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderUndoRaiser()
    await user.click(screen.getByRole('button', { name: 'raise failed' }))

    await user.click(screen.getByRole('button', { name: 'raise sale' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('Sale to Ana saved')
  })

  it('replaced at 2400 ms, the new toast takes its own full duration', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderUndoRaiser()
    await user.click(screen.getByRole('button', { name: 'raise deleted' }))
    act(() => {
      vi.advanceTimersByTime(2400)
    })

    await user.click(screen.getByRole('button', { name: 'raise text' }))
    act(() => {
      vi.advanceTimersByTime(DEFAULT_TOAST_MS - 100)
    })
    expect(screen.getByRole('status')).toHaveTextContent('Expense deleted')
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

test('showNow and armAfterLeaving keep one identity across two location changes', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const seen: Flash[] = []
  function Probe() {
    seen.push(useFlash())
    return <Link to="/b">to b</Link>
  }
  const router = createMemoryRouter(
    [
      {
        element: <Layout />,
        children: [
          { path: '/a', element: <Probe /> },
          { path: '/b', element: <Link to="/c">to c</Link> },
          { path: '/c', element: <Probe /> },
        ],
      },
    ],
    { initialEntries: ['/a'] },
  )
  render(<RouterProvider router={router} />)

  await user.click(screen.getByRole('link', { name: 'to b' }))
  await user.click(screen.getByRole('link', { name: 'to c' }))

  expect(seen.length).toBeGreaterThanOrEqual(2)
  for (const flash of seen) {
    expect(flash.showNow).toBe(seen[0]?.showNow)
    expect(flash.armAfterLeaving).toBe(seen[0]?.armAfterLeaving)
  }
})

test('after navigate, showNow from a resolved promise shows on the new location and survives a re-render', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderRaiser()

  await user.click(screen.getByRole('button', { name: 'navigate then raise late' }))

  expect(screen.getByRole('link', { name: 'back' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Expense deleted')
  await act(async () => {
    await Promise.resolve()
  })
  expect(screen.getByRole('status')).toHaveTextContent('Expense deleted')
})

test('Tab reaches Undo, Enter calls the handler once and the toast is gone', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const onUndo = vi.fn()
  renderRaiser(onUndo)
  await user.click(screen.getByRole('button', { name: 'raise sale' }))
  const undo = screen.getByRole('button', { name: 'Undo' })
  expect(screen.getByRole('status')).not.toContainElement(undo)

  // The toast comes after the page in the document: two more buttons first, then Undo.
  await user.tab()
  await user.tab()
  await user.tab()
  expect(undo).toHaveFocus()
  await user.keyboard('{Enter}')

  expect(onUndo).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
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
