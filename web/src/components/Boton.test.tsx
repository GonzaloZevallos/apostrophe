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
  render(
    <Boton icon="agregar" onClick={() => {}}>
      Guardá la venta
    </Boton>,
  )
  expect(screen.getByRole('button', { name: 'Guardá la venta' })).toBeInTheDocument()
})

test('an icon-only button is named by its ariaLabel, with no visible text', () => {
  render(<Boton variant="icon" action="search" ariaLabel="Buscar" onClick={() => {}} />)
  const button = screen.getByRole('button', { name: 'Buscar' })
  expect(button.className).toBe('boton-icono')
  expect(button.textContent).toBe('')
})

test('an icon-only button draws the icon its action maps to, hidden from assistive technology', () => {
  render(
    <>
      <Boton variant="icon" action="delete" ariaLabel="Borrar venta" />
      <Boton variant="icon" action="search" ariaLabel="Buscar" />
    </>,
  )
  const drawing = (name: string) =>
    screen.getByRole('button', { name }).querySelector('svg')?.innerHTML
  expect(drawing('Borrar venta')).toBeTruthy()
  expect(drawing('Borrar venta')).not.toBe(drawing('Buscar'))
  expect(screen.getByRole('button', { name: 'Buscar' }).querySelector('svg')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
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
    <Boton variant="destructive" icon="tacho" onClick={() => {}}>
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

test('an icon next to a word is hidden, so the accessible name stays the word', () => {
  render(
    <Boton variant="secondary" icon="personaMas">
      Asignar cliente
    </Boton>,
  )
  const button = screen.getByRole('button', { name: 'Asignar cliente' })
  expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(button.getAttribute('aria-label')).toBeNull()
})

test('a text-only submit has no icon and is a submit button', () => {
  render(
    <Boton textOnly="submit" type="submit">
      Guardá la venta
    </Boton>,
  )
  const button = screen.getByRole('button', { name: 'Guardá la venta' })
  expect(button).toHaveAttribute('type', 'submit')
  expect(button.querySelector('svg')).toBeNull()
})

test.each([
  ['undo', 'Deshacer'],
  ['link', 'Ver todas'],
] as const)('the %s kind is text only, drawn as the underlined link', (variant, word) => {
  render(<Boton variant={variant}>{word}</Boton>)
  const button = screen.getByRole('button', { name: word })
  expect(button.className).toBe('boton--enlace')
  expect(button.querySelector('svg')).toBeNull()
})

test('disabled passes through to the native button', () => {
  render(
    <Boton icon="agregar" disabled>
      Guardá la venta
    </Boton>,
  )
  expect(screen.getByRole('button', { name: 'Guardá la venta' })).toBeDisabled()
})
