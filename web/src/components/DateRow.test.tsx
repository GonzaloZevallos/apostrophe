/**
 * `DateRow` at the component seam: Testing Library, through what the user sees and does. The row says
 * "Today" or dd/mm, the date input is named by the label, and the row only reports real days up to today.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import DateRow from './DateRow'

const TODAY = '2026-11-25'

function shown(value: string, onChange: (iso: string) => void = () => {}) {
  render(<DateRow value={value} today={TODAY} onChange={onChange} label="Date" />)
  return screen.getByLabelText('Date')
}

test('says Today when the day is today', () => {
  shown(TODAY)
  expect(screen.getByText('Today')).toBeInTheDocument()
})

test('says dd/mm for a past day', () => {
  shown('2026-11-03')
  expect(screen.getByText('03/11')).toBeInTheDocument()
  expect(screen.queryByText('Today')).not.toBeInTheDocument()
})

test('is a date input named by the label, capped at today, with autocomplete off', () => {
  const input = shown('2026-11-03')
  expect(input).toHaveAccessibleName('Date')
  expect(input).toHaveAttribute('type', 'date')
  expect(input).toHaveAttribute('max', TODAY)
  expect(input).toHaveAttribute('autocomplete', 'off')
  expect(input).toHaveValue('2026-11-03')
})

test('reports a past day as the ISO string', () => {
  const onChange = vi.fn()
  fireEvent.change(shown(TODAY, onChange), { target: { value: '2026-11-03' } })
  expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-11-03')
})

test('reports today itself', () => {
  const onChange = vi.fn()
  fireEvent.change(shown('2026-11-03', onChange), { target: { value: TODAY } })
  expect(onChange).toHaveBeenCalledExactlyOnceWith(TODAY)
})

test.each([
  ['cleared', ''],
  ['a future day', '2026-11-26'],
  ['not a real day', '2026-02-30'],
])('does not report %s, and the row keeps its text', (_name, typed) => {
  const onChange = vi.fn()
  const input = shown('2026-11-03', onChange)
  fireEvent.change(input, { target: { value: typed } })
  expect(onChange).not.toHaveBeenCalled()
  expect(screen.getByText('03/11')).toBeInTheDocument()
  expect(input).toHaveValue('2026-11-03')
})
