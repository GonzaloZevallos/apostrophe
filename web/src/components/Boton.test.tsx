/**
 * `Boton` at the component seam (plan, "Components": "tests for... `Boton`'s
 * accessible names"). No screen writes its own button base styles (plan,
 * invariants) — every variant below renders through one of `styles/app.css`'s
 * own classes, never an inline style.
 */

import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import Boton from './Boton'

test('a primary button is named by its own text', () => {
  render(<Boton onClick={() => {}}>Guardá la venta</Boton>)
  expect(screen.getByRole('button', { name: 'Guardá la venta' })).toBeInTheDocument()
})

test('an icon-only button is named by its ariaLabel, with no visible text', () => {
  render(<Boton variant="icon" icon="agregar" ariaLabel="Agregar línea" onClick={() => {}} />)
  const button = screen.getByRole('button', { name: 'Agregar línea' })
  expect(button.className).toBe('boton-icono')
})

test('the link variant renders the design\'s underline class, not the filled .boton', () => {
  render(
    <Boton variant="link" onClick={() => {}}>
      Agregar otra variedad
    </Boton>,
  )
  const button = screen.getByRole('button', { name: 'Agregar otra variedad' })
  expect(button.className).toBe('boton--enlace')
})

test('the destructive variant carries both the base and the destructive class', () => {
  render(
    <Boton variant="destructive" onClick={() => {}}>
      Sí, borrala
    </Boton>,
  )
  const button = screen.getByRole('button', { name: 'Sí, borrala' })
  expect(button.className).toBe('boton boton--destructivo')
})

test('a secondary button with an icon still carries the icon beside its text', () => {
  render(
    <Boton variant="secondary" icon="agregar" onClick={() => {}}>
      Nueva entrada
    </Boton>,
  )
  const button = screen.getByRole('button', { name: 'Nueva entrada' })
  expect(button.querySelector('svg')).not.toBeNull()
})

test('disabled passes through to the native button', () => {
  render(<Boton disabled>Guardá la venta</Boton>)
  expect(screen.getByRole('button', { name: 'Guardá la venta' })).toBeDisabled()
})
