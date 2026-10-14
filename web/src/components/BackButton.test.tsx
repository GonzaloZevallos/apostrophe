/**
 * `BackButton` at the component seam (GH-135, B1): the one renderer of a back control. A
 * button when it gets an `onClick`, an in-app link when it gets a `to`; the word is
 * "‹ <parent>", and only Análisis's bare "‹" takes an `ariaLabel`.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, test, vi } from 'vitest'
import BackButton, { BACK_GLYPH } from './BackButton'

test('with an onClick it is a button named "‹ <parent>" that calls it', async () => {
  const onClick = vi.fn()
  render(<BackButton title="Variedades" onClick={onClick} />)

  const button = screen.getByRole('button', { name: '‹ Variedades' })
  await userEvent.click(button)

  expect(onClick).toHaveBeenCalledTimes(1)
})

test('with a `to` it is an in-app link to the parent, named the same way', () => {
  render(
    <MemoryRouter>
      <BackButton title="Archivadas" to="/variedades/archivadas" />
    </MemoryRouter>,
  )

  expect(screen.getByRole('link', { name: '‹ Archivadas' })).toHaveAttribute(
    'href',
    '/variedades/archivadas',
  )
})

test('it keeps the look the back variant of Boton had', () => {
  render(<BackButton title="Variedades" onClick={() => {}} />)

  const button = screen.getByRole('button')
  expect(button.className).toBe('boton--enlace')
  expect(button.textContent).toBe(`${BACK_GLYPH} Variedades`)
})

test('a bare arrow is named by its ariaLabel, not by the glyph', () => {
  render(
    <MemoryRouter>
      <BackButton to="/mas" ariaLabel="Volver" />
    </MemoryRouter>,
  )

  const link = screen.getByRole('link', { name: 'Volver' })
  expect(link.textContent).toBe('‹')
})
