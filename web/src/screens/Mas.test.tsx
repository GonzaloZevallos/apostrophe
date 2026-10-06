/**
 * `Mas` at the screen seam: shows exactly "+ Cargar gasto", Gastos, Análisis and
 * Configuración, in that order, each to its own route (PRD, "Más (phone)"; "Nada
 * inventado").
 */

import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import { paths } from '../routes/paths'
import Mas from './Mas'

function renderMas() {
  render(
    <MemoryRouter>
      <Mas />
    </MemoryRouter>,
  )
  return screen.getByRole('navigation', { name: 'Más' })
}

test('lists exactly "+ Cargar gasto", Gastos, Análisis and Configuración, in order', () => {
  const nav = renderMas()

  const links = within(nav).getAllByRole('link')
  expect(links.map((link) => link.textContent)).toEqual([
    '+ Cargar gastoCategoría, monto y detalle',
    'GastosPor mes y por categoría',
    'AnálisisVariedades, semanas, meses y días',
    'ConfiguraciónNegocio, usuarios, categorías y tu cuenta',
  ])
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    paths.newExpense(),
    paths.expenses(),
    paths.analysis(),
    paths.settings(),
  ])
})

test('no longer lists Catálogo, Variedades or Negocio', () => {
  const nav = renderMas()

  expect(within(nav).queryByText(/Catálogo/)).not.toBeInTheDocument()
  expect(within(nav).queryByText('Variedades')).not.toBeInTheDocument()
  expect(within(nav).queryByText('Negocio')).not.toBeInTheDocument()
})
