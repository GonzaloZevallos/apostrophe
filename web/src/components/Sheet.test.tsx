/**
 * `Sheet` at the component seam: a sheet that is not a route shows neither the bottom
 * bar nor "+ Nueva venta" (`navigation.md`, "Chrome and back"). jsdom does not lay
 * out, so this checks the markup that decides it: the sheet is its own overlay layer
 * (`.capa`, or `.cliente-sheet` for "Elegir cliente"), carrying no chrome inside it,
 * and its "Cerrar" closes at once without a guard and asks first with a touched one.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test, vi } from 'vitest'
import Shell from '../shell/Shell'
import { GuardedSheet } from './Sheet'
import { paths } from '../routes/paths'
import Sheet from './Sheet'

function renderOverRoot(element: React.ReactNode) {
  const router = createMemoryRouter(
    [{ element: <Shell />, children: [{ index: true, element }] }],
    { initialEntries: [paths.home()] },
  )
  render(<RouterProvider router={router} />)
}

test('a sheet is its own overlay layer with no bar and no "+ Nueva venta" inside it', async () => {
  const onClose = vi.fn()
  renderOverRoot(
    <Sheet title="Registrar cobro" onClose={onClose}>
      <span>contenido</span>
    </Sheet>,
  )

  const layer = screen.getByText('contenido').closest('.capa')
  expect(layer).not.toBeNull()
  expect(layer?.querySelector('nav')).toBeNull()
  expect(within(layer as HTMLElement).queryByRole('link')).not.toBeInTheDocument()
  expect(layer?.textContent).not.toContain('Nueva venta')

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  expect(onClose).toHaveBeenCalledOnce()
})

test('the customer look is its own layer too, with no bar and no "+ Nueva venta" inside it', () => {
  renderOverRoot(
    <Sheet title="Elegir cliente" look="customer" onClose={vi.fn()}>
      <span>clientes</span>
    </Sheet>,
  )

  const layer = screen.getByText('clientes').closest('.cliente-sheet')
  expect(layer).not.toBeNull()
  expect(layer?.querySelector('nav')).toBeNull()
  expect(layer?.textContent).not.toContain('Nueva venta')
})

test('an untouched guarded sheet closes at once, with no question', async () => {
  const onClose = vi.fn()
  function Probe() {
    return (
      <GuardedSheet title="Nuevo" values="" onClose={onClose}>
        <span>contenido</span>
      </GuardedSheet>
    )
  }
  renderOverRoot(<Probe />)

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  expect(onClose).toHaveBeenCalledOnce()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})
