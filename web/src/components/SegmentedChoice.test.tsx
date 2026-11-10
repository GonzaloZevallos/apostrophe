/**
 * `SegmentedChoice` at the component seam: a generic single-choice segmented control, a
 * `role="radiogroup"` of `role="radio"` buttons (what `SelectorPago` and Registrar cobro's
 * method are built on).
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { HOME_PERIODS, PAYMENT_STATES } from './fixedSets'
import SegmentedChoice from './SegmentedChoice'

const OPTIONS = HOME_PERIODS

test('is a radiogroup with the given name holding one radio per option', () => {
  render(<SegmentedChoice options={OPTIONS} value={null} onChange={() => {}} ariaLabel="Pick one" />)
  const group = screen.getByRole('radiogroup', { name: 'Pick one' })
  expect(group).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Today' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Week' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Month' })).toBeInTheDocument()
})

test('aria-checked follows the value, and null checks nothing', () => {
  const { rerender } = render(
    <SegmentedChoice options={OPTIONS} value={null} onChange={() => {}} ariaLabel="Pick one" />,
  )
  for (const radio of screen.getAllByRole('radio')) expect(radio).toHaveAttribute('aria-checked', 'false')

  rerender(<SegmentedChoice options={OPTIONS} value="week" onChange={() => {}} ariaLabel="Pick one" />)
  expect(screen.getByRole('radio', { name: 'Today' })).toHaveAttribute('aria-checked', 'false')
  expect(screen.getByRole('radio', { name: 'Week' })).toHaveAttribute('aria-checked', 'true')
})

test('a click calls onChange with that option\'s value', async () => {
  const onChange = vi.fn()
  render(<SegmentedChoice options={OPTIONS} value={null} onChange={onChange} ariaLabel="Pick one" />)
  await userEvent.click(screen.getByRole('radio', { name: 'Week' }))
  expect(onChange).toHaveBeenCalledExactlyOnceWith('week')
})

test('an option the overlay disables does nothing and is disabled to assistive technology too', async () => {
  const onChange = vi.fn()
  render(
    <SegmentedChoice
      options={OPTIONS}
      optionState={{ week: { disabled: true } }}
      value={null}
      onChange={onChange}
      ariaLabel="Pick one"
    />,
  )
  const week = screen.getByRole('radio', { name: 'Week' })
  await userEvent.click(week)
  expect(onChange).not.toHaveBeenCalled()
  expect(week).toBeDisabled()
  expect(week).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByRole('radio', { name: 'Today' })).toBeEnabled()
})

test('the overlay gives an option its own description, and only that option', () => {
  render(
    <>
      <span id="week-help">Week needs a note</span>
      <SegmentedChoice
        options={PAYMENT_STATES}
        optionState={{ owing: { describedBy: 'week-help' } }}
        value={null}
        onChange={() => {}}
        ariaLabel="Pick one"
      />
    </>,
  )
  expect(screen.getByRole('radio', { name: 'Owing' })).toHaveAccessibleDescription('Week needs a note')
  expect(screen.getByRole('radio', { name: 'Paid' })).not.toHaveAttribute('aria-describedby')
})
