/**
 * `Mas` at the screen seam: "+ Cargar gasto", Gastos and Análisis come first and in
 * that order, each linking to a route the table mounts; the entries that have not
 * moved yet stay after them, and Configuración closes the list (PRD, "Más (phone)"; metric criterion 2).
 */

import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import { matchRoutes } from 'react-router'
import { router } from '../router'
import { ANALYSIS, EXPENSE_NEW, EXPENSES, WITHDRAWAL_NEW } from '../routes'
import Mas from './Mas'

function renderMas() {
  render(
    <MemoryRouter>
      <Mas />
    </MemoryRouter>,
  )
  return screen.getByRole('navigation', { name: 'Más' })
}

test('lists "+ Cargar gasto", "Sacar del stock" second, Gastos and Análisis first, in that order, then the entries not moved yet, Configuración last', () => {
  const entries = within(renderMas()).getAllByRole('link')

  expect(entries.map((entry) => entry.querySelector('.mas__item-rotulo')?.textContent)).toEqual([
    '+ Cargar gasto',
    'Sacar del stock',
    'Gastos',
    'Análisis',
    'Variedades',
    'Catálogo',
    'Configuración',
  ])
  expect(entries[0]).toHaveTextContent('Categoría, monto y detalle')
  expect(entries[1]).toHaveAttribute('href', WITHDRAWAL_NEW)
  expect(entries[2]).toHaveTextContent('Por mes y por categoría')
  expect(entries[3]).toHaveTextContent('Variedades, semanas, meses y días')
  expect(entries[6]).toHaveTextContent(
    'Negocio, usuarios, bot, catálogo, categorías, apariencia y tu cuenta',
  )
  expect(entries[6]).toHaveAttribute('href', '/settings')
})

test('every entry opens a route the table mounts: no placeholder, nothing not built', () => {
  const nav = renderMas()
  const entries = within(nav).getAllByRole('link')

  const targets = entries.map((entry) => entry.getAttribute('href'))
  expect(targets.slice(0, 4)).toEqual([EXPENSE_NEW, WITHDRAWAL_NEW, EXPENSES, ANALYSIS])
  for (const target of targets) {
    const leaf = matchRoutes(router.routes, target ?? '')?.at(-1)
    expect(leaf?.route.path, `${target} reaches the catch-all`).not.toBe('*')
    expect(leaf).toBeDefined()
  }
  expect(within(nav).queryByRole('link', { name: /^Negocio$/ })).not.toBeInTheDocument()
})
