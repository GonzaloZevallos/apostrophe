/**
 * `Mas` at the screen seam: shows exactly Gastos, Variedades and Negocio (PRD,
 * "Nada inventado"; metric M5) — not Análisis, not Catálogo, which come later.
 */

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import Mas from './Mas'

test('shows exactly Gastos, Variedades and Negocio', () => {
  render(
    <MemoryRouter>
      <Mas />
    </MemoryRouter>,
  )

  const nav = screen.getByRole('navigation', { name: 'Más' })
  expect(nav).toHaveTextContent('Gastos')
  expect(nav).toHaveTextContent('Variedades')
  expect(nav).toHaveTextContent('Negocio')
  expect(nav).not.toHaveTextContent('Análisis')
  expect(nav).not.toHaveTextContent('Catálogo')
})
