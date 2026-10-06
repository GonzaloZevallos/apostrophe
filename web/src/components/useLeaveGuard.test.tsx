import { HOME } from '../routes'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider, useNavigate } from 'react-router'
import { expect, test } from 'vitest'
import LeaveConfirm from './LeaveConfirm'
import { useLeaveGuard } from './useLeaveGuard'

function Form({ startDirty }: { startDirty: boolean }) {
  const [dirty, setDirty] = useState(startDirty)
  const { blocker, disarm } = useLeaveGuard(dirty)
  const navigate = useNavigate()
  return (
    <main>
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
          question="¿Descartás los cambios?"
          detail="No vas a poder recuperarlos."
          keepLabel="No, seguí editando"
          discardLabel="Sí, descartalos"
        />
      )}
    </main>
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
  expect(screen.getByRole('alertdialog', { name: '¿Descartás los cambios?' })).toBeInTheDocument()
  expect(screen.getByText('No vas a poder recuperarlos.')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'No, seguí editando' }))
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
