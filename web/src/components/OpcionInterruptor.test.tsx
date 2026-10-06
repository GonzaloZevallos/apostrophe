/**
 * `OpcionInterruptor` at the component seam: Testing Library, through what the user
 * sees and does. The label is the accessible name; the switch toggles and obeys
 * `disabled`.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import OpcionInterruptor from './OpcionInterruptor'

test('is a switch named by its label, found by role and by label text', () => {
  render(<OpcionInterruptor label="Regalo" checked={false} onChange={() => {}} />)

  expect(screen.getByRole('switch', { name: 'Regalo' })).toBeInTheDocument()
  expect(screen.getByLabelText('Regalo')).toBe(screen.getByRole('switch'))
})

test('tells on/off by aria-checked, not by color', () => {
  const { rerender } = render(
    <OpcionInterruptor label="Regalo" checked={false} onChange={() => {}} />,
  )
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  expect(screen.getByRole('switch')).not.toBeChecked()

  rerender(<OpcionInterruptor label="Regalo" checked onChange={() => {}} />)
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('switch')).toBeChecked()
})

test('clicking the label text reports the opposite value', async () => {
  const onChange = vi.fn()
  render(<OpcionInterruptor label="Regalo" checked={false} onChange={onChange} />)

  await userEvent.click(screen.getByText('Regalo'))

  expect(onChange).toHaveBeenCalledWith(true)
})

test('turning off reports false', async () => {
  const onChange = vi.fn()
  render(<OpcionInterruptor label="Regalo" checked onChange={onChange} />)

  await userEvent.click(screen.getByRole('switch', { name: 'Regalo' }))

  expect(onChange).toHaveBeenCalledWith(false)
})

test('a disabled switch does not toggle', async () => {
  const onChange = vi.fn()
  render(<OpcionInterruptor label="Regalo" checked={false} disabled onChange={onChange} />)

  expect(screen.getByRole('switch')).toBeDisabled()
  await userEvent.click(screen.getByText('Regalo'))

  expect(onChange).not.toHaveBeenCalled()
})

test('renders no digit or currency symbol besides its label', () => {
  const { container } = render(
    <OpcionInterruptor label="Regalo" checked={false} onChange={() => {}} />,
  )
  expect(container.textContent).toBe('Regalo')
})
