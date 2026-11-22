/**
 * `DebtorsSlot` at the component seam (CODING_STANDARDS §10): Testing Library, no network. The
 * slot is the one always-mounted polite status region of the debtors notice; the button inside is
 * inserted by a passive effect and never remounted while shown.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { baselineText } from '../../i18n/testing'
import { DebtorsSlot } from './DebtorsUnavailable'

const SENTENCE = baselineText('customers.ts:CUSTOMERS_TEXT.debtorsUnavailable')

function slot(overrides: Partial<Parameters<typeof DebtorsSlot>[0]> = {}) {
  return (
    <DebtorsSlot drawn busy={false} errorUpdatedAt={1} onRetry={() => {}} {...overrides} />
  )
}

test('the sentence is the notice name, with no final period and one node in a polite status region', async () => {
  render(slot())

  const button = await screen.findByRole('button', { name: SENTENCE })
  expect(SENTENCE).toBe('Owed amounts did not load: tap to try again')
  expect(SENTENCE.endsWith('.')).toBe(false)
  expect(screen.getAllByText(SENTENCE)).toHaveLength(1)
  const region = screen.getByRole('status')
  expect(region).toContainElement(button)
  expect(region).not.toHaveAttribute('aria-live', 'assertive')
})

test('the Attention icon is decorative and the notice has no chevron', async () => {
  render(slot())

  const button = await screen.findByRole('button', { name: SENTENCE })
  const icons = button.querySelectorAll('svg')
  expect(icons).toHaveLength(1)
  expect(icons[0]).toHaveAttribute('aria-hidden', 'true')
})

test('not drawn, the status region stays mounted and empty, with no reservation and no place marker', () => {
  render(slot({ drawn: false }))

  const region = screen.getByRole('status')
  expect(region).toBeEmptyDOMElement()
  expect(region).not.toHaveAttribute('data-place')
  expect(region.className).not.toMatch(/reservado/)
})

test('drawn, the slot is reserved, marked as the return place and holds the button', async () => {
  const { rerender } = render(slot({ drawn: false }))
  const region = screen.getByRole('status')

  rerender(slot({ drawn: true }))

  expect(region.className).toMatch(/reservado/)
  expect(region).toHaveAttribute('data-place', 'debtors-notice')
  expect(await screen.findByRole('button', { name: SENTENCE })).toBeInTheDocument()
})

test('when the condition goes false the button and the reservation go together', async () => {
  const { rerender } = render(slot())
  await screen.findByRole('button', { name: SENTENCE })

  rerender(slot({ drawn: false }))

  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.getByRole('status').className).not.toMatch(/reservado/)
})

test('a tap calls the retry', async () => {
  const onRetry = vi.fn()
  render(slot({ onRetry }))

  await userEvent.click(await screen.findByRole('button', { name: SENTENCE }))

  expect(onRetry).toHaveBeenCalledTimes(1)
})

test('busy keeps the card and the sentence, and adds aria-busy and aria-disabled, with no native disabled', async () => {
  const { rerender } = render(slot())
  const button = await screen.findByRole('button', { name: SENTENCE })
  expect(button).not.toHaveAttribute('aria-busy')
  expect(button).not.toHaveAttribute('aria-disabled')

  rerender(slot({ busy: true }))

  expect(screen.getByRole('button', { name: SENTENCE })).toBe(button)
  expect(button).toHaveAttribute('aria-busy', 'true')
  expect(button).toHaveAttribute('aria-disabled', 'true')
  expect(button).not.toBeDisabled()
  expect(screen.getAllByText(SENTENCE)).toHaveLength(1)
})

test('a new failure replaces only the text span: the same button node stays and keeps its focus', async () => {
  const { rerender } = render(slot({ errorUpdatedAt: 1 }))
  const button = await screen.findByRole('button', { name: SENTENCE })
  button.focus()
  const before = screen.getByText(SENTENCE)

  rerender(slot({ errorUpdatedAt: 2 }))

  const after = screen.getByText(SENTENCE)
  expect(screen.getByRole('button', { name: SENTENCE })).toBe(button)
  expect(after).not.toBe(before)
  expect(document.activeElement).toBe(button)
})

test('a re-render with no new failure keeps the same text node', async () => {
  const { rerender } = render(slot({ errorUpdatedAt: 1 }))
  await screen.findByRole('button', { name: SENTENCE })
  const before = screen.getByText(SENTENCE)

  rerender(slot({ errorUpdatedAt: 1, busy: false }))

  expect(screen.getByText(SENTENCE)).toBe(before)
})
