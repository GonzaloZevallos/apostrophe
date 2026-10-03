/**
 * `Shell` at the screen seam: only destinations that exist show (PRD, "Nada
 * inventado"; metric M5) — Inicio, Clientes and Más, never Ventas or Stock, which
 * come with their own tasks.
 */

import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, test } from 'vitest'
import Shell from './Shell'

test('shows exactly Inicio, Clientes and Más in both navs', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<div>contenido</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

  const navs = screen.getAllByRole('navigation')
  expect(navs).toHaveLength(2)
  for (const nav of navs) {
    expect(nav).toHaveTextContent('Inicio')
    expect(nav).toHaveTextContent('Clientes')
    expect(nav).toHaveTextContent('Más')
    expect(nav).not.toHaveTextContent('Ventas')
    expect(nav).not.toHaveTextContent('Stock')
  }
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
