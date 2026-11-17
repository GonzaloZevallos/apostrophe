import { EXPENSES, EXPENSE_NEW, HOME } from '../routes'
import { cleanup, render as renderBare, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type ReactElement, type ReactNode, useLayoutEffect, useState } from 'react'
import { createMemoryRouter, RouterProvider, useNavigate } from 'react-router'
import { describe, expect, test } from 'vitest'
import LeaveConfirm from './LeaveConfirm'
import { onlySheetChanges, useLeaveGuard } from './useLeaveGuard'
import ContentArea from './ContentArea'
import { SheetRouterProvider, SheetStackProvider, sheetDepth, useSheet } from './useSheetStack'
import { MoneyFormatProvider } from '../format/MoneyFormatProvider'

function Business({ children }: { children: ReactNode }) {
  return <MoneyFormatProvider format={{ symbol: '$', decimals: 0 }}>{children}</MoneyFormatProvider>
}

/** Rendered for a "$"/0-decimals business, the one the strings below were written for. */
function render(ui: ReactElement) {
  return renderBare(ui, { wrapper: Business })
}

function Form({ startDirty }: { startDirty: boolean }) {
  const [dirty, setDirty] = useState(startDirty)
  const { blocker, disarm } = useLeaveGuard(dirty)
  const navigate = useNavigate()
  return (
    <ContentArea as="main">
      <h1>Formulario</h1>
      <button type="button" onClick={() => setDirty(true)}>
        Escribir
      </button>
      <button type="button" onClick={() => navigate('/afuera')}>
        Salir
      </button>
      <button
        type="button"
        onClick={() => {
          disarm()
          navigate('/afuera')
        }}
      >
        Guardar y salir
      </button>
      {blocker.state === 'blocked' && (
        <LeaveConfirm
          blocker={blocker}
          question="Discard the changes?"
          detail="No vas a poder recuperarlos."
          keepLabel="No, keep editing"
          discardLabel="Sí, descartalos"
        />
      )}
    </ContentArea>
  )
}

function renderForm(startDirty: boolean) {
  const router = createMemoryRouter(
    [
      { path: HOME, element: <Form startDirty={startDirty} /> },
      { path: '/afuera', element: <h1>Afuera</h1> },
    ],
    { initialEntries: [HOME] },
  )
  render(<RouterProvider router={router} />)
  return router
}

test('an untouched form navigates freely', async () => {
  const user = userEvent.setup()
  const router = renderForm(false)

  await user.click(screen.getByRole('button', { name: 'Salir' }))

  expect(router.state.location.pathname).toBe('/afuera')
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('a dirty form blocks and asks with the caller wording; keeping stays, discarding leaves', async () => {
  const user = userEvent.setup()
  const router = renderForm(false)

  await user.click(screen.getByRole('button', { name: 'Escribir' }))
  await user.click(screen.getByRole('button', { name: 'Salir' }))

  expect(router.state.location.pathname).toBe(HOME)
  expect(screen.getByRole('alertdialog', { name: 'Discard the changes?' })).toBeInTheDocument()
  expect(screen.getByText('No vas a poder recuperarlos.')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'No, keep editing' }))
  expect(router.state.location.pathname).toBe(HOME)
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Salir' }))
  await user.click(screen.getByRole('button', { name: 'Sí, descartalos' }))
  expect(router.state.location.pathname).toBe('/afuera')
})

test('disarm followed by navigate in the same tick is not blocked while dirty is still true', async () => {
  const user = userEvent.setup()
  const router = renderForm(true)

  await user.click(screen.getByRole('button', { name: 'Guardar y salir' }))

  expect(router.state.location.pathname).toBe('/afuera')
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

interface SheetFormProps {
  floor: number | undefined
  dirty: boolean
  sheetDirty?: boolean
  disarmed?: boolean
}

/** A form that draws a guard with a sheet floor, and opens and closes sheets over itself. */
function SheetForm({ floor, dirty, sheetDirty, disarmed }: SheetFormProps) {
  const { blocker, disarm } = useLeaveGuard(dirty, {
    ...(floor === undefined ? {} : { sheetFloor: floor }),
    ...(sheetDirty === undefined ? {} : { sheetDirty }),
  })
  const first = useSheet(1)
  const second = useSheet(2)
  const navigate = useNavigate()
  return (
    <ContentArea as="main">
      <h1>Formulario</h1>
      <button type="button" onClick={first.open}>
        Abrir
      </button>
      <button type="button" onClick={second.open}>
        Abrir otra
      </button>
      <button type="button" onClick={second.close}>
        Cerrar la otra
      </button>
      <button type="button" onClick={first.close}>
        Cerrar
      </button>
      <button type="button" onClick={() => navigate('/afuera')}>
        Salir
      </button>
      <button
        type="button"
        onClick={() => {
          if (disarmed === true) disarm()
          first.close()
        }}
      >
        Cerrar desarmado
      </button>
      {blocker.state === 'blocked' && (
        <LeaveConfirm
          blocker={blocker}
          question="Discard the changes?"
          detail="No vas a poder recuperarlos."
          keepLabel="No, keep editing"
          discardLabel="Sí, descartalos"
        />
      )}
    </ContentArea>
  )
}

function renderSheetForm(props: SheetFormProps, Host: (props: SheetFormProps) => ReactElement = SheetForm) {
  const router = createMemoryRouter(
    [
      {
        path: HOME,
        element: (
          <SheetStackProvider>
            <Host {...props} />
          </SheetStackProvider>
        ),
      },
      { path: '/afuera', element: <h1>Afuera</h1> },
    ],
    { initialEntries: [HOME] },
  )
  render(
    <SheetRouterProvider router={router}>
      <RouterProvider router={router} />
    </SheetRouterProvider>,
  )
  return { router, depth: () => sheetDepth(router.state.location.state) }
}

test('with a sheet floor, a dirty form blocks the pop of its own sheet and asks', async () => {
  const user = userEvent.setup()
  const { depth } = renderSheetForm({ floor: 1, dirty: true })
  await user.click(screen.getByRole('button', { name: 'Abrir' }))
  expect(depth()).toBe(1)

  await user.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(depth()).toBe(1)
  expect(screen.getByRole('alertdialog', { name: 'Discard the changes?' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'No, keep editing' }))
  expect(depth()).toBe(1)
  await user.click(screen.getByRole('button', { name: 'Cerrar' }))
  await user.click(screen.getByRole('button', { name: 'Sí, descartalos' }))
  expect(depth()).toBe(0)
})

test('with a sheet floor, a clean form is never blocked', async () => {
  const user = userEvent.setup()
  const { depth } = renderSheetForm({ floor: 1, dirty: false })
  await user.click(screen.getByRole('button', { name: 'Abrir' }))

  await user.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(depth()).toBe(0)
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('with a sheet floor, a pop that stays at or above the floor is not blocked', async () => {
  const user = userEvent.setup()
  const { depth } = renderSheetForm({ floor: 1, dirty: true })
  await user.click(screen.getByRole('button', { name: 'Abrir' }))
  await user.click(screen.getByRole('button', { name: 'Abrir otra' }))
  expect(depth()).toBe(2)

  await user.click(screen.getByRole('button', { name: 'Cerrar la otra' }))

  expect(depth()).toBe(1)
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('without the option a sheet-only pop of a dirty form is not blocked', async () => {
  const user = userEvent.setup()
  const { depth } = renderSheetForm({ floor: undefined, dirty: true })
  await user.click(screen.getByRole('button', { name: 'Abrir' }))

  await user.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(depth()).toBe(0)
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('a disarmed guard with a sheet floor never blocks', async () => {
  const user = userEvent.setup()
  const { depth } = renderSheetForm({ floor: 1, dirty: true, disarmed: true })
  await user.click(screen.getByRole('button', { name: 'Abrir' }))

  await user.click(screen.getByRole('button', { name: 'Cerrar desarmado' }))

  expect(depth()).toBe(0)
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('a sheet-only pop below the floor is not blocked while sheetDirty is false, even if dirty is true', async () => {
  const user = userEvent.setup()
  const { depth } = renderSheetForm({ floor: 1, dirty: true, sheetDirty: false })
  await user.click(screen.getByRole('button', { name: 'Abrir' }))

  await user.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(depth()).toBe(0)
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('a sheet-only pop below the floor is blocked while sheetDirty is true, even if dirty is false', async () => {
  const user = userEvent.setup()
  const { depth } = renderSheetForm({ floor: 1, dirty: false, sheetDirty: true })
  await user.click(screen.getByRole('button', { name: 'Abrir' }))

  await user.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(depth()).toBe(1)
  expect(screen.getByRole('alertdialog', { name: 'Discard the changes?' })).toBeInTheDocument()
})

test('a navigation to another path blocks on dirty alone, whatever sheetDirty says', async () => {
  const user = userEvent.setup()
  const dirtyOnly = renderSheetForm({ floor: 1, dirty: true, sheetDirty: false })
  await user.click(screen.getByRole('button', { name: 'Salir' }))
  expect(dirtyOnly.router.state.location.pathname).toBe(HOME)
  expect(screen.getByRole('alertdialog', { name: 'Discard the changes?' })).toBeInTheDocument()
  cleanup()

  const sheetOnly = renderSheetForm({ floor: 1, dirty: false, sheetDirty: true })
  await user.click(screen.getByRole('button', { name: 'Salir' }))
  expect(sheetOnly.router.state.location.pathname).toBe('/afuera')
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('a pop that stays at or above the floor is not blocked even with sheetDirty true', async () => {
  const user = userEvent.setup()
  const { depth } = renderSheetForm({ floor: 1, dirty: true, sheetDirty: true })
  await user.click(screen.getByRole('button', { name: 'Abrir' }))
  await user.click(screen.getByRole('button', { name: 'Abrir otra' }))

  await user.click(screen.getByRole('button', { name: 'Cerrar la otra' }))

  expect(depth()).toBe(1)
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

/** Holds the `sheetDirty` it hands the form in state, so a button can drop it after the first render. */
function ForgetfulHost(props: SheetFormProps) {
  const [sheetDirty, setSheetDirty] = useState(props.sheetDirty)
  return (
    <>
      <button type="button" onClick={() => setSheetDirty(undefined)}>
        Olvidar sheetDirty
      </button>
      <SheetForm {...props} sheetDirty={sheetDirty} />
    </>
  )
}

test('when sheetDirty is dropped on a later render it falls back to dirty', async () => {
  const user = userEvent.setup()
  const { depth } = renderSheetForm({ floor: 1, dirty: true, sheetDirty: false }, ForgetfulHost)
  await user.click(screen.getByRole('button', { name: 'Abrir' }))
  await user.click(screen.getByRole('button', { name: 'Olvidar sheetDirty' }))

  await user.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(depth()).toBe(1)
  expect(screen.getByRole('alertdialog', { name: 'Discard the changes?' })).toBeInTheDocument()
})

/**
 * Calls the hook first and declares its own layout effect after it, which pops as soon as the
 * floor is 1: the pop runs in the same commit that gave the guard its floor.
 */
function SameCommitHost({ dirty }: SheetFormProps) {
  const [floor, setFloor] = useState<number | undefined>(undefined)
  const [popNow, setPopNow] = useState(false)
  const { blocker } = useLeaveGuard(dirty, floor === undefined ? undefined : { sheetFloor: floor })
  const first = useSheet(1)
  const navigate = useNavigate()
  useLayoutEffect(() => {
    if (floor === 1 && popNow) void navigate(-1)
  }, [floor, popNow, navigate])
  return (
    <ContentArea as="main">
      <h1>Formulario</h1>
      <button type="button" onClick={first.open}>
        Abrir
      </button>
      <button
        type="button"
        onClick={() => {
          setFloor(1)
          setPopNow(true)
        }}
      >
        Fijar el piso y volver
      </button>
      {blocker.state === 'blocked' && (
        <LeaveConfirm
          blocker={blocker}
          question="Discard the changes?"
          detail="No vas a poder recuperarlos."
          keepLabel="No, keep editing"
          discardLabel="Sí, descartalos"
        />
      )}
    </ContentArea>
  )
}

// Guards the layout effect and the stable callback: the floor and the pop land in one commit, so
// the pop reaches `shouldBlock` before any passive effect could have written the new floor into
// its ref. With a passive effect, or a callback rebuilt on `[sheetFloor]`, this pop goes through.
test('a pop in the same commit that sets the floor is blocked', async () => {
  const user = userEvent.setup()
  const { depth } = renderSheetForm({ floor: undefined, dirty: true }, SameCommitHost)
  await user.click(screen.getByRole('button', { name: 'Abrir' }))
  expect(depth()).toBe(1)

  await user.click(screen.getByRole('button', { name: 'Fijar el piso y volver' }))

  expect(depth()).toBe(1)
  expect(screen.getByRole('alertdialog', { name: 'Discard the changes?' })).toBeInTheDocument()
})

describe('onlySheetChanges', () => {
  const at = (pathname: string, search: string, sheet?: number) => ({
    pathname,
    search,
    state: sheet === undefined ? null : { sheet },
  })

  test('the same path and search with a different depth is a sheet-only change', () => {
    expect(onlySheetChanges(at(EXPENSE_NEW, '', 0), at(EXPENSE_NEW, '', 1))).toBe(true)
  })

  test('a different path is not, even at the same depth', () => {
    expect(onlySheetChanges(at(EXPENSES, '', 1), at(EXPENSE_NEW, '', 1))).toBe(false)
  })

  test('a different search is not, even with a different depth', () => {
    expect(onlySheetChanges(at(EXPENSES, '?mes=2026-10', 0), at(EXPENSES, '?mes=2026-09', 1))).toBe(false)
  })

  test('the same path and search with no state on either side is not', () => {
    expect(onlySheetChanges(at(EXPENSES, ''), at(EXPENSES, ''))).toBe(false)
  })
})
