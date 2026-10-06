/**
 * `Configuracion` at the screen seam: the list shows exactly Negocio, Usuarios,
 * Tu cuenta and Categorías de gastos, in that order, each linking where `paths`
 * says, and nothing else (`navigation.md`, "Configuración").
 */

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import { paths } from '../../routes/paths'
import Configuracion from './Configuracion'

test('lists exactly the four groups, in order, each linking to its path', () => {
  render(
    <MemoryRouter>
      <Configuracion />
    </MemoryRouter>,
  )

  const links = screen.getAllByRole('link')
  expect(links.map((link) => link.textContent)).toEqual([
    'Negocio',
    'Usuarios',
    'Tu cuenta',
    'Categorías de gastos',
  ])
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    paths.settingsBusiness(),
    paths.settingsUsers(),
    paths.settingsAccount(),
    paths.expenseCategories(),
  ])
})

test('has no entry for what is not built and no "coming soon"', () => {
  render(
    <MemoryRouter>
      <Configuracion />
    </MemoryRouter>,
  )

  for (const absent of ['Integraciones', 'Mensaje del catálogo', 'Apariencia', 'Próximamente']) {
    expect(screen.queryByText(absent, { exact: false })).not.toBeInTheDocument()
  }
})
