import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import Loading from './Loading'

test('is a progressbar named Cargando, busy, with no value', () => {
  render(<Loading />)

  const bar = screen.getByRole('progressbar', { name: 'Cargando' })
  expect(bar).toHaveAttribute('aria-busy', 'true')
  expect(bar).not.toHaveAttribute('aria-valuenow')
})

test('shows no visible text, digit or currency symbol, so it cannot be read as data', () => {
  const { container } = render(<Loading />)

  expect(container).toHaveTextContent('')
  expect(container.textContent).not.toMatch(/\d|\$/)
})

test('is never a status, which belongs to toasts and notices', () => {
  render(<Loading />)

  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
