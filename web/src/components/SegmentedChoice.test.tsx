/**
 * `SegmentedChoice` at the component seam: a generic single-choice segmented control, a
 * `role="radiogroup"` of `role="radio"` buttons (what `SelectorPago` and Registrar cobro's
 * method are built on).
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import SegmentedChoice from './SegmentedChoice'

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
]

test('is a radiogroup with the given name holding one radio per option', () => {
  render(<SegmentedChoice options={OPTIONS} value={null} onChange={() => {}} ariaLabel="Pick one" />)
  const group = screen.getByRole('radiogroup', { name: 'Pick one' })
  expect(group).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Alpha' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Beta' })).toBeInTheDocument()
})

test('aria-checked follows the value, and null checks nothing', () => {
  const { rerender } = render(
    <SegmentedChoice options={OPTIONS} value={null} onChange={() => {}} ariaLabel="Pick one" />,
  )
  for (const radio of screen.getAllByRole('radio')) expect(radio).toHaveAttribute('aria-checked', 'false')

  rerender(<SegmentedChoice options={OPTIONS} value="b" onChange={() => {}} ariaLabel="Pick one" />)
  expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'false')
  expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'true')
})

test('a click calls onChange with that option\'s value', async () => {
  const onChange = vi.fn()
  render(<SegmentedChoice options={OPTIONS} value={null} onChange={onChange} ariaLabel="Pick one" />)
  await userEvent.click(screen.getByRole('radio', { name: 'Beta' }))
  expect(onChange).toHaveBeenCalledExactlyOnceWith('b')
})

test('a disabled option does nothing and is disabled to assistive technology too', async () => {
  const onChange = vi.fn()
  render(
    <SegmentedChoice
      options={[OPTIONS[0]!, { ...OPTIONS[1]!, disabled: true }]}
      value={null}
      onChange={onChange}
      ariaLabel="Pick one"
    />,
  )
  const beta = screen.getByRole('radio', { name: 'Beta' })
  await userEvent.click(beta)
  expect(onChange).not.toHaveBeenCalled()
  expect(beta).toBeDisabled()
  expect(beta).toHaveAttribute('aria-disabled', 'true')
})

test('renders aria-required and aria-describedby on the group, and an option\'s own description', () => {
  render(
    <>
      <span id="why">Choose one</span>
      <span id="beta-help">Beta needs a note</span>
      <SegmentedChoice
        options={[OPTIONS[0]!, { ...OPTIONS[1]!, describedBy: 'beta-help' }]}
        value={null}
        onChange={() => {}}
        ariaLabel="Pick one"
        required
        describedBy="why"
      />
    </>,
  )
  const group = screen.getByRole('radiogroup', { name: 'Pick one' })
  expect(group).toHaveAttribute('aria-required', 'true')
  expect(group).toHaveAccessibleDescription('Choose one')
  expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAccessibleDescription('Beta needs a note')
})

test('a group that is not required carries no aria-required', () => {
  render(<SegmentedChoice options={OPTIONS} value={null} onChange={() => {}} ariaLabel="Pick one" />)
  expect(screen.getByRole('radiogroup')).not.toHaveAttribute('aria-required')
})
