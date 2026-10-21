/**
 * `BotonLink` at the component seam: an in-app link that looks like `Boton` and follows
 * the same rule — the icon next to a word is hidden, the icon-only form needs its name.
 */

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import { HOME, SALE_NEW, SALES } from '../routes'
import BotonLink from './BotonLink'

function renderLink(node: React.ReactElement) {
  return render(<MemoryRouter>{node}</MemoryRouter>)
}

test('an icon + text link is an anchor named by its word, with its icon hidden', () => {
  renderLink(
    <BotonLink to={SALE_NEW} variant="secondary" icon="agregar">
      Nueva venta
    </BotonLink>,
  )
  const link = screen.getByRole('link', { name: 'Nueva venta' })
  expect(link).toHaveAttribute('href', SALE_NEW)
  expect(link.className).toBe('boton boton--suave')
  expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(link.getAttribute('aria-label')).toBeNull()
})

test('an icon-only link is named by its ariaLabel and is the 44 px icon control', () => {
  renderLink(<BotonLink to={HOME} variant="icon" action="search" ariaLabel="Buscar" />)
  const link = screen.getByRole('link', { name: 'Buscar' })
  expect(link.className).toBe('boton-icono')
  expect(link.textContent).toBe('')
  expect(link.querySelector('svg')).not.toBeNull()
})

test('a text link has no icon and the underlined class', () => {
  renderLink(
    <BotonLink to={SALES} variant="link">
      Ver todas
    </BotonLink>,
  )
  const link = screen.getByRole('link', { name: 'Ver todas' })
  expect(link.className).toBe('boton--enlace')
  expect(link.querySelector('svg')).toBeNull()
})

test('a notice link is the card class, named by its visible text, with no aria-label', () => {
  renderLink(
    <BotonLink to={HOME} variant="notice">
      Seguí con la configuración
    </BotonLink>,
  )
  const link = screen.getByRole('link', { name: 'Seguí con la configuración' })
  expect(link).toHaveAttribute('href', HOME)
  expect(link.className).toBe('boton-aviso')
  expect(link.getAttribute('aria-label')).toBeNull()
})
