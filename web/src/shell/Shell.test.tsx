/**
 * `Shell` at the screen seam: only destinations that exist show (PRD, "Nada
 * inventado"; metric M5) — Inicio, Clientes, Ventas and Más, never Stock, which
 * comes with its own task (accounts.md, "Shell"). The fixed "Nueva venta" button,
 * separate from the tabs, shows on every signed-in screen except the sale form
 * itself (accounts.md: "It shows on every signed-in screen except the sale form
 * itself and its customer sheet" — the sheet shares `NuevaVenta`'s own route, so
 * hiding on that one path covers both).
 */

import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, test } from 'vitest'
import Shell from './Shell'

function renderShell(initialPath: string) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<div>contenido</div>} />
          <Route path="ventas/nueva" element={<div>Nueva venta</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

test('shows exactly Inicio, Clientes, Ventas and Más in both navs', () => {
  renderShell('/')

  const navs = screen.getAllByRole('navigation')
  expect(navs).toHaveLength(2)
  for (const nav of navs) {
    expect(nav).toHaveTextContent('Inicio')
    expect(nav).toHaveTextContent('Clientes')
    expect(nav).toHaveTextContent('Ventas')
    expect(nav).toHaveTextContent('Más')
    expect(nav).not.toHaveTextContent('Stock')
  }
})

test('the fixed "Nueva venta" button shows outside the sale form, once per nav rail', () => {
  renderShell('/')

  const links = screen.getAllByRole('link', { name: 'Nueva venta' })
  expect(links).toHaveLength(2)
  for (const link of links) {
    expect(link).toHaveAttribute('href', '/ventas/nueva')
  }
})

test('the fixed "Nueva venta" button is gone on the sale form itself', () => {
  renderShell('/ventas/nueva')

  expect(screen.queryByRole('link', { name: 'Nueva venta' })).not.toBeInTheDocument()
})

test('marks the active item by more than color: a distinct class the other items do not get', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<div>contenido</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

  const inicioLinks = screen.getAllByRole('link', { name: 'Inicio' })
  const clientesLinks = screen.getAllByRole('link', { name: 'Clientes' })
  for (const link of inicioLinks) {
    expect(link.className).toMatch(/--activo/)
  }
  for (const link of clientesLinks) {
    expect(link.className).not.toMatch(/--activo/)
  }
})
