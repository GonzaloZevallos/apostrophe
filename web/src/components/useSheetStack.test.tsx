import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test, vi } from 'vitest'
import LeaveConfirm from './LeaveConfirm'
import { useLeaveGuard } from './useLeaveGuard'
import { SheetRouterProvider, SheetStackProvider, useSheet } from './useSheetStack'

let latest: { closeAll: () => void } | null = null

function Screen({ startDirty }: { startDirty: boolean }) {
  const [dirty, setDirty] = useState(startDirty)
  const { blocker } = useLeaveGuard(dirty)
  const one = useSheet(1)
  const two = useSheet(2)
  const { closeAll } = two
  useEffect(() => {
    latest = { closeAll }
  }, [closeAll])
  return (
    <main>
      <h1>Formulario</h1>
      <button type="button" onClick={() => setDirty(true)}>
        Escribir
      </button>
      <button type="button" onClick={one.open}>
        Abrir uno
      </button>
      {one.isOpen && (
        <section aria-label="Uno">
          <button type="button" onClick={two.open}>
            Abrir dos
          </button>
          <button type="button" onClick={one.close}>
            Cerrar uno
          </button>
        </section>
      )}
      {two.isOpen && (
        <section aria-label="Dos">
          <button type="button" onClick={two.closeAll}>
            Cerrar todo
          </button>
        </section>
      )}
      {blocker.state === 'blocked' && (
        <LeaveConfirm
          blocker={blocker}
          question="¿Descartás la venta?"
          detail="Detalle"
          keepLabel="No, seguí cargando"
          discardLabel="Sí, descartala"
        />
      )}
    </main>
  )
}

function renderScreen(startDirty: boolean, initialState?: unknown) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <SheetStackProvider>
            <Screen startDirty={startDirty} />
          </SheetStackProvider>
        ),
      },
      { path: '/afuera', element: <h1>Afuera</h1> },
    ],
    {
      initialEntries: ['/afuera', { pathname: '/', state: initialState }],
      initialIndex: 1,
    },
  )
  render(
    <SheetRouterProvider router={router}>
      <RouterProvider router={router} />
    </SheetRouterProvider>,
  )
  return router
}

const sheets = () => [screen.queryByLabelText('Uno'), screen.queryByLabelText('Dos')]

test('back closes the top sheet only, level by level, without asking', async () => {
  const user = userEvent.setup()
  const router = renderScreen(true)

  await user.click(screen.getByRole('button', { name: 'Abrir uno' }))
  await user.click(screen.getByRole('button', { name: 'Abrir dos' }))
  expect(sheets()[1]).toBeInTheDocument()

  await act(() => router.navigate(-1))
  expect(sheets()[0]).toBeInTheDocument()
  expect(sheets()[1]).not.toBeInTheDocument()

  await act(() => router.navigate(-1))
  expect(sheets()).toEqual([null, null])
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/')
})

test('closeAll from level 2 leaves exactly the form entry, and the next back asks', async () => {
  const user = userEvent.setup()
  const router = renderScreen(true)

  await user.click(screen.getByRole('button', { name: 'Abrir uno' }))
  await user.click(screen.getByRole('button', { name: 'Abrir dos' }))
  await user.click(screen.getByRole('button', { name: 'Cerrar todo' }))

  expect(sheets()).toEqual([null, null])
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  await act(() => router.navigate(-1))
  expect(screen.getByRole('alertdialog', { name: '¿Descartás la venta?' })).toBeInTheDocument()
})

test('a dirty form asks on back, and asks again after keeping it', async () => {
  const user = userEvent.setup()
  const router = renderScreen(false)
  await user.click(screen.getByRole('button', { name: 'Escribir' }))

  await act(() => router.navigate(-1))
  expect(screen.getByRole('alertdialog', { name: '¿Descartás la venta?' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'No, seguí cargando' }))
  expect(router.state.location.pathname).toBe('/')

  await act(() => router.navigate(-1))
  expect(screen.getByRole('alertdialog', { name: '¿Descartás la venta?' })).toBeInTheDocument()
})

test('an entry that already carries a sheet on mount opens nothing and loses the marker', async () => {
  const user = userEvent.setup()
  const router = renderScreen(false, { sheet: 1 })

  await waitFor(() => expect(router.state.location.state).toEqual({}))
  expect(sheets()).toEqual([null, null])

  // One back now leaves the form, and a dirty one asks first.
  await user.click(screen.getByRole('button', { name: 'Escribir' }))
  await act(() => router.navigate(-1))
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/')
})

test('forward into a closed sheet entry does not reopen it', async () => {
  const user = userEvent.setup()
  const router = renderScreen(false)

  await user.click(screen.getByRole('button', { name: 'Abrir uno' }))
  await act(() => router.navigate(-1))
  await act(() => router.navigate(1))

  await waitFor(() => expect(router.state.location.state).toEqual({}))
  expect(sheets()).toEqual([null, null])
})

async function openTwo() {
  const user = userEvent.setup()
  const router = renderScreen(false)
  await user.click(screen.getByRole('button', { name: 'Abrir uno' }))
  await user.click(screen.getByRole('button', { name: 'Abrir dos' }))
  const deferred = latest?.closeAll
  if (!deferred) throw new Error('closeAll was not captured')
  return { router, deferred, spy: vi.spyOn(router, 'navigate') }
}

test('a deferred closeAll after the user pressed back twice does not navigate at all', async () => {
  const { router, deferred, spy } = await openTwo()
  await act(() => router.navigate(-1))
  await act(() => router.navigate(-1))
  spy.mockClear()

  deferred()
  await act(() => Promise.resolve())

  expect(spy).not.toHaveBeenCalled()
  expect(router.state.location.pathname).toBe('/')
})

test('a deferred closeAll after one back pops exactly one entry', async () => {
  const { router, deferred, spy } = await openTwo()
  await act(() => router.navigate(-1))
  spy.mockClear()

  deferred()
  await act(() => Promise.resolve())

  expect(spy).toHaveBeenCalledTimes(1)
  expect(spy).toHaveBeenCalledWith(-1)
  expect(sheets()).toEqual([null, null])
  expect(router.state.location.pathname).toBe('/')
})

test('useSheet outside a provider throws', () => {
  function Orphan() {
    useSheet(1)
    return null
  }
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  expect(() => render(<Orphan />)).toThrow('SheetStackProvider')
  quiet.mockRestore()
})
