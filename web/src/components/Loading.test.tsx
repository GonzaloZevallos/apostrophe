import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import Loading, { LoadingAnuncio } from './Loading'

test('is a progressbar named Cargando, busy, with no value', () => {
  render(<Loading />)

  const bar = screen.getByRole('progressbar', { name: 'Loading' })
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

test('compacto draws only the short bar, aria-hidden, with no role and no text', () => {
  const { container } = render(<Loading compacto />)

  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  const root = container.firstElementChild
  expect(root).toHaveAttribute('aria-hidden', 'true')
  expect(root).not.toHaveAttribute('role')
  expect(container.querySelectorAll('.cargando__barra')).toHaveLength(1)
  expect(container.querySelector('.cargando__barra--corta')).not.toBeNull()
  expect(container.querySelector('.cargando__tarjeta')).toBeNull()
  expect(container.textContent).toBe('')
})

test('plain Loading is unchanged: three shapes and a progressbar', () => {
  const { container } = render(<Loading />)

  expect(container.querySelectorAll('.cargando__barra')).toHaveLength(2)
  expect(container.querySelectorAll('.cargando__tarjeta')).toHaveLength(2)
  expect(container.firstElementChild).not.toHaveAttribute('aria-hidden')
})

test('LoadingAnuncio is exactly one progressbar named Cargando, with no visible content', () => {
  const { container } = render(<LoadingAnuncio />)

  expect(screen.getAllByRole('progressbar')).toHaveLength(1)
  expect(screen.getByRole('progressbar', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true')
  expect(container.textContent).toBe('')
  expect(container.querySelector('.cargando__barra')).toBeNull()
})

test('compact markers beside a LoadingAnuncio leave a single progressbar and no digit or $', () => {
  const { container } = render(
    <>
      <LoadingAnuncio />
      <Loading compacto />
      <Loading compacto />
    </>,
  )

  expect(screen.getAllByRole('progressbar')).toHaveLength(1)
  expect(container.textContent).not.toMatch(/\d|\$/)
})
