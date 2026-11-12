import { HOME } from '../routes'
import { render as renderBare, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type ReactElement, type ReactNode, useState } from 'react'
import { createMemoryRouter, RouterProvider, useNavigate } from 'react-router'
import { expect, test } from 'vitest'
import LeaveConfirm from './LeaveConfirm'
import { useLeaveGuard } from './useLeaveGuard'
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

/** A form that draws a guard with a sheet floor, and opens and closes sheets over itself. */
function SheetForm({ floor, dirty, disarmed }: { floor: number | undefined; dirty: boolean; disarmed?: boolean }) {
  const { blocker, disarm } = useLeaveGuard(dirty, floor === undefined ? undefined : { sheetFloor: floor })
  const first = useSheet(1)
  const second = useSheet(2)
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

function renderSheetForm(props: { floor: number | undefined; dirty: boolean; disarmed?: boolean }) {
  const router = createMemoryRouter(
    [
      {
        path: HOME,
        element: (
          <SheetStackProvider>
            <SheetForm {...props} />
          </SheetStackProvider>
        ),
      },
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
