import { SALES } from '../routes'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import { GONE_DETAIL } from '../api/refusals'
import ErrorGenerico from './ErrorGenerico'
import GoneScreen from './GoneScreen'
import Notice from './Notice'
import SinConexion from './SinConexion'

test('the gone screen says one fixed line and offers one way back, with no data', () => {
  const { container } = render(
    <MemoryRouter>
      <GoneScreen label="Sales" to={SALES} />
    </MemoryRouter>,
  )

  expect(screen.getByText(GONE_DETAIL)).toBeInTheDocument()
  const links = screen.getAllByRole('link')
  expect(links).toHaveLength(1)
  expect(links[0]).toHaveTextContent('Back to Sales')
  expect(links[0]).toHaveAttribute('href', SALES)
  expect(screen.queryAllByRole('button')).toHaveLength(0)
  expect(container.textContent).not.toMatch(/\d/)
})

test('the gone screen builds its way back from the label it is given', () => {
  render(
    <MemoryRouter>
      <GoneScreen label="Customers" to={SALES} />
    </MemoryRouter>,
  )

  expect(screen.getByRole('link')).toHaveTextContent('Back to Customers')
})

test('"Sin conexión" is announced as one sentence in a status, promises no retry, and has nothing to press', () => {
  render(<SinConexion />)

  const status = screen.getByRole('status')
  expect(status).toHaveTextContent('Offline: check your internet and try again.')
  expect(status.textContent).not.toMatch(/retry|only|automatic/i)
  expect(status.querySelectorAll('.aviso-ambar__detalle')).toHaveLength(0)
  expect(screen.queryAllByRole('button')).toHaveLength(0)
})

test('the server-error retry is an alert with its fixed text and no data', () => {
  render(<ErrorGenerico />)

  const alert = screen.getByRole('alert')
  expect(alert).toHaveTextContent('Something went wrong. Try again.')
  expect(alert.textContent).not.toMatch(/\d/)
})

test('the notice for a gone record is announced like a toast, with no Deshacer and no Reintentar', () => {
  render(<Notice kind="notice" message="That is gone. The list is up to date." />)

  expect(screen.getByRole('status')).toHaveTextContent('That is gone. The list is up to date.')
  expect(screen.queryByText(/Deshacer|Reintentar/)).toBeNull()
  expect(screen.queryAllByRole('button')).toHaveLength(0)
})

test('a plain success toast is a status with its fixed text, never an action and never data', () => {
  const { container } = render(<Notice kind="toast" message="Sale deleted · the grams go back to stock" />)

  expect(screen.getByRole('status')).toHaveTextContent(
    'Sale deleted · the grams go back to stock',
  )
  expect(screen.queryAllByRole('button')).toHaveLength(0)
  expect(screen.queryByText(/Deshacer/)).toBeNull()
  expect(container.textContent).not.toMatch(/\d|\$/)
})
