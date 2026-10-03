/**
 * `Mas` at the screen seam: shows exactly Gastos, Variedades, Catálogo and Negocio
 * (PRD, "Nada inventado"; metric M5) — not Análisis, which comes later.
 */

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import Mas from './Mas'

test('shows exactly Gastos, Variedades, Catálogo and Negocio', () => {
  render(
    <MemoryRouter>
      <Mas />
    </MemoryRouter>,
  )

  const nav = screen.getByRole('navigation', { name: 'Más' })
  expect(nav).toHaveTextContent('Gastos')
  expect(nav).toHaveTextContent('Por mes y por categoría')
  expect(nav).toHaveTextContent('Variedades')
  expect(nav).toHaveTextContent('Precios y avisos de stock bajo')
  expect(nav).toHaveTextContent('Catálogo')
  expect(nav).toHaveTextContent('El mensaje de hoy, listo para copiar')
  expect(nav).toHaveTextContent('Negocio')
  expect(nav).not.toHaveTextContent('Análisis')
})
