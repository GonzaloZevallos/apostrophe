/**
 * `SettingsGroup`, the frame every Configuración group plugs into, under a memory data
 * router (`useBlocker` needs one): "Cerrar" goes back through `useBackOr('/settings')`, and
 * a dirty group asks before both "Cerrar" and the browser's own Back.
 */

import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, RouterProvider, useNavigate } from 'react-router'
import { expect, test } from 'vitest'
import SettingsGroup from './SettingsGroup'

const LEAVE = {
  question: '¿Descartás el nombre?',
  detail: 'Se pierde lo que cargaste: todavía no se guardó nada.',
  keepLabel: 'No, seguí editando',
  discardLabel: 'Sí, descartalo',
}

function SavingChild({ disarm }: { disarm: () => void }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => {
        disarm()
        void navigate('/afuera')
      }}
    >
      Guardar y salir
    </button>
  )
}

function Group({ dirty }: { dirty: boolean }) {
  return (
    <SettingsGroup title="Negocio" dirty={dirty} leave={LEAVE}>
      {({ disarm }) => <SavingChild disarm={disarm} />}
    </SettingsGroup>
  )
}

function renderGroup(options: { dirty: boolean; inApp: boolean }) {
  const router = createMemoryRouter(
    [
      {
        path: '/settings',
        element: (
          <main>
            <h1>Lista</h1>
            <Link to="/settings/business" state={{ inApp: true }}>
              Abrir
            </Link>
          </main>
        ),
      },
      { path: '/settings/business', element: <Group dirty={options.dirty} /> },
      { path: '/afuera', element: <h1>Afuera</h1> },
    ],
    options.inApp
      ? { initialEntries: ['/settings'] }
      : { initialEntries: ['/otro', '/settings/business'], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
  return router
}

async function open(inApp: boolean, dirty: boolean) {
  const user = userEvent.setup()
  const router = renderGroup({ dirty, inApp })
  if (inApp) await user.click(screen.getByRole('link', { name: 'Abrir' }))
  return { user, router }
}

test('shows the title and "Cerrar"', async () => {
  await open(true, false)

  expect(screen.getByText('Negocio')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
})

test('an untouched group closes at once: back in history when reached by an in-app link', async () => {
  const { user, router } = await open(true, false)

  await user.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(router.state.location.pathname).toBe('/settings')
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('an untouched group reached directly closes to /settings, replacing its entry', async () => {
  const { user, router } = await open(false, false)

  await user.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(router.state.location.pathname).toBe('/settings')
  expect(router.state.historyAction).toBe('REPLACE')
})

test('a dirty group asks before "Cerrar" with its own wording; keeping stays, discarding goes back', async () => {
  const { user, router } = await open(true, true)

  await user.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(router.state.location.pathname).toBe('/settings/business')
  expect(screen.getByRole('alertdialog', { name: '¿Descartás el nombre?' })).toBeInTheDocument()
  expect(screen.getByText(LEAVE.detail)).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'No, seguí editando' }))
  expect(router.state.location.pathname).toBe('/settings/business')

  await user.click(screen.getByRole('button', { name: 'Cerrar' }))
  await user.click(screen.getByRole('button', { name: 'Sí, descartalo' }))
  expect(router.state.location.pathname).toBe('/settings')
})

test('a dirty group reached directly asks too, and discarding lands on /settings', async () => {
  const { user, router } = await open(false, true)

  await user.click(screen.getByRole('button', { name: 'Cerrar' }))
  expect(router.state.location.pathname).toBe('/settings/business')

  await user.click(screen.getByRole('button', { name: 'Sí, descartalo' }))
  expect(router.state.location.pathname).toBe('/settings')
})

test('a dirty group also asks before the browser Back', async () => {
  const { router } = await open(true, true)

  await act(() => router.navigate(-1))

  expect(router.state.location.pathname).toBe('/settings/business')
  expect(screen.getByRole('alertdialog', { name: '¿Descartás el nombre?' })).toBeInTheDocument()
})

test('a save that disarms the guard leaves without asking even while dirty', async () => {
  const { user, router } = await open(true, true)

  await user.click(screen.getByRole('button', { name: 'Guardar y salir' }))

  expect(router.state.location.pathname).toBe('/afuera')
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})
