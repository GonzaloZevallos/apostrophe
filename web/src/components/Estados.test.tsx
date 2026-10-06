import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import { GONE_DETAIL } from '../api/refusals'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from './ErrorGenerico'
import GoneScreen from './GoneScreen'
import Notice from './Notice'
import SinConexion, { SIN_CONEXION_DETALLE, SIN_CONEXION_TITULO } from './SinConexion'

test('the gone screen says one fixed line and offers one way back, with no data', () => {
  const { container } = render(
    <MemoryRouter>
      <GoneScreen label="Ventas" to="/ventas" />
    </MemoryRouter>,
  )

  expect(screen.getByText(GONE_DETAIL)).toBeInTheDocument()
  const links = screen.getAllByRole('link')
  expect(links).toHaveLength(1)
  expect(links[0]).toHaveTextContent('Volver a Ventas')
  expect(links[0]).toHaveAttribute('href', '/ventas')
  expect(screen.queryAllByRole('button')).toHaveLength(0)
  expect(container.textContent).not.toMatch(/\d/)
})

test('"Sin conexión" is announced as a status with its title and detail line, and nothing to press', () => {
  render(<SinConexion />)

  const status = screen.getByRole('status')
  expect(status).toHaveTextContent(SIN_CONEXION_TITULO)
  expect(status).toHaveTextContent(SIN_CONEXION_DETALLE)
  expect(screen.queryAllByRole('button')).toHaveLength(0)
})

test('the server-error retry is an alert with its fixed text and no data', () => {
  render(<ErrorGenerico />)

  const alert = screen.getByRole('alert')
  expect(alert).toHaveTextContent(ERROR_GENERICO_MENSAJE)
  expect(alert.textContent).not.toMatch(/\d/)
})

test('the notice for a gone record is announced like a toast, with no Deshacer and no Reintentar', () => {
  render(<Notice kind="notice" message="Eso ya no está. La lista ya está al día." />)

  expect(screen.getByRole('status')).toHaveTextContent('Eso ya no está. La lista ya está al día.')
  expect(screen.queryByText(/Deshacer|Reintentar/)).toBeNull()
  expect(screen.queryAllByRole('button')).toHaveLength(0)
})

test('a plain success toast is a status with its fixed text, never an action and never data', () => {
  const { container } = render(<Notice kind="toast" message="Venta eliminada · los gramos vuelven al stock" />)

  expect(screen.getByRole('status')).toHaveTextContent(
    'Venta eliminada · los gramos vuelven al stock',
  )
  expect(screen.queryAllByRole('button')).toHaveLength(0)
  expect(screen.queryByText(/Deshacer/)).toBeNull()
  expect(container.textContent).not.toMatch(/\d|\$/)
})
