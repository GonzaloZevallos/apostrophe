/**
 * `MarcaEstado` at the component seam (`stock.md`, "Status marks"): every status
 * renders its own word, so the mark never relies on shape or color alone — the
 * accessibility rule a `sold_out` row must pass just as much as an `ok` one.
 */

import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import MarcaEstado from './MarcaEstado'

test('a sold-out mark reads "sold out"', () => {
  render(<MarcaEstado estado="sold_out" />)
  expect(screen.getByText('sold out')).toBeInTheDocument()
})

test('a low mark reads "low", distinct from ok and sold out', () => {
  render(<MarcaEstado estado="low" />)
  expect(screen.getByText('low')).toBeInTheDocument()
  expect(screen.queryByText('sold out')).not.toBeInTheDocument()
  expect(screen.queryByText('ok')).not.toBeInTheDocument()
})

test('each status gets its own class, not a shared one', () => {
  const { container, unmount } = render(<MarcaEstado estado="no_entries" />)
  expect(container.querySelector('.marca-estado--no_entries')).not.toBeNull()
  unmount()
})
