import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import AvisoAmbar from './AvisoAmbar'
import ErrorGenerico from './ErrorGenerico'
import SinConexion from './SinConexion'

test('with attention the icon sits beside the sentence, hidden, and the sentence is the name', () => {
  render(
    <AvisoAmbar attention role="status">
      <span>Desactualizado</span>
    </AvisoAmbar>,
  )
  const notice = screen.getByRole('status')
  expect(notice.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(notice).toHaveTextContent('Out of date')
})

test('without attention there is no icon: "Up to date" and the like stay informational', () => {
  render(
    <AvisoAmbar role="status">
      <span>Al día</span>
    </AvisoAmbar>,
  )
  expect(screen.getByRole('status').querySelector('svg')).toBeNull()
})

test('Sin conexión and the server-error retry carry the attention icon', () => {
  const { container } = render(
    <>
      <SinConexion />
      <ErrorGenerico />
    </>,
  )
  expect(container.querySelectorAll('.aviso-ambar svg[aria-hidden="true"]')).toHaveLength(2)
})
