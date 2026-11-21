/**
 * `CustomerSegments` at the component seam: the Customers All | Owed to you control with its
 * counts, not yet wired to a screen.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import CustomerSegments from './CustomerSegments'

function show(props: Partial<Parameters<typeof CustomerSegments>[0]> = {}) {
  const onChange = vi.fn()
  render(
    <CustomerSegments
      segment="all"
      onChange={onChange}
      customerCount={1234}
      debtorCount={5}
      pending={false}
      {...props}
    />,
  )
  return onChange
}

test('the group is named Customers view and the radios are named exactly All and Owed to you', () => {
  show()
  const group = screen.getByRole('radiogroup', { name: 'Customers view' })
  expect(group).toBeInTheDocument()
  expect(screen.getAllByRole('radio')).toHaveLength(2)
  expect(screen.getByRole('radio', { name: 'All' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Owed to you' })).toBeInTheDocument()
})

test('the counts come from the props: the description is the bare number, the visible text has the dot', () => {
  show()
  const all = screen.getByRole('radio', { name: 'All' })
  const owed = screen.getByRole('radio', { name: 'Owed to you' })
  expect(all).toHaveAccessibleDescription('1.234')
  expect(owed).toHaveAccessibleDescription('5')
  expect(all).toHaveTextContent('· 1.234')
  expect(owed).toHaveTextContent('· 5')
})

test('a real 0 shows as · 0 and is described as 0', () => {
  show({ debtorCount: 0 })
  const owed = screen.getByRole('radio', { name: 'Owed to you' })
  expect(owed).toHaveTextContent('· 0')
  expect(owed).toHaveAccessibleDescription('0')
})

test('while pending there is no digit, no dot and no description, whatever the props say', () => {
  show({ pending: true })
  const group = screen.getByRole('radiogroup', { name: 'Customers view' })
  expect(group).toHaveTextContent(/^AllOwed to you$/)
  expect(group.textContent).not.toMatch(/\d/)
  expect(group.textContent).not.toContain('·')
  for (const radio of screen.getAllByRole('radio')) expect(radio).not.toHaveAttribute('aria-describedby')
})

test('with a count of 0 both options are enabled and a click switches', async () => {
  const onChange = show({ customerCount: 0, debtorCount: 0 })
  const all = screen.getByRole('radio', { name: 'All' })
  const owed = screen.getByRole('radio', { name: 'Owed to you' })
  expect(all).toBeEnabled()
  expect(owed).toBeEnabled()
  await userEvent.click(owed)
  expect(onChange).toHaveBeenLastCalledWith('owed')
  await userEvent.click(all)
  expect(onChange).toHaveBeenLastCalledWith('all')
})

test('while pending both options are enabled and a click switches', async () => {
  const onChange = show({ pending: true })
  expect(screen.getByRole('radio', { name: 'All' })).toBeEnabled()
  expect(screen.getByRole('radio', { name: 'Owed to you' })).toBeEnabled()
  await userEvent.click(screen.getByRole('radio', { name: 'Owed to you' }))
  expect(onChange).toHaveBeenCalledExactlyOnceWith('owed')
})

test('aria-checked follows the segment', () => {
  show({ segment: 'owed' })
  expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'false')
  expect(screen.getByRole('radio', { name: 'Owed to you' })).toHaveAttribute('aria-checked', 'true')
})
