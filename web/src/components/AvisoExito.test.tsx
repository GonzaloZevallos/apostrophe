import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import AvisoExito from './AvisoExito'

test('announces the fixed toast text as a status, with no close or undo action', () => {
  render(<AvisoExito texto="Precio guardado" />)

  const status = screen.getByRole('status')
  expect(status).toHaveTextContent('Precio guardado')
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
