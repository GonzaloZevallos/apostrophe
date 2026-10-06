/**
 * `Mas` at the screen seam: shows exactly Gastos, Variedades, Catálogo, Análisis and
 * Configuración (PRD, "Nada inventado"; metric M5).
 */

import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import Mas from './Mas'

test('shows exactly Gastos, Variedades, Catálogo, Análisis and Configuración', () => {
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
  expect(nav).toHaveTextContent('Análisis')
  expect(nav).toHaveTextContent('Variedades, semanas, meses y días')
  expect(nav).toHaveTextContent('Configuración')
  expect(nav).toHaveTextContent('Negocio, usuarios, bot, catálogo, categorías, apariencia y tu cuenta')
  expect(within(nav).queryByRole('link', { name: /^Negocio$/ })).not.toBeInTheDocument()
  expect(within(nav).getByRole('link', { name: /^Configuración/ })).toHaveAttribute('href', '/settings')
})
