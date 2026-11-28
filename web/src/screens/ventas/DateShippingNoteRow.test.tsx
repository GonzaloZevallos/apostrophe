/**
 * `DateShippingNoteRow` at its component seam: Testing Library with the real `useSaleDraft` and a
 * `MoneyFormatProvider`. The row reads and writes the draft only; no request is made.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import { SALE_NOTE_MAX_LENGTH } from '../../sales/saleBody'
import { useSaleDraft } from '../../sales/useSaleDraft'
import DateShippingNoteRow from './DateShippingNoteRow'

const TODAY = '2026-11-19'

interface HostProps {
  today?: string
  locked?: boolean
  decimals?: number
}

function Host({ today = TODAY, locked = false, decimals = 0 }: HostProps) {
  const draft = useSaleDraft({ today })
  return (
    <MoneyFormatProvider format={{ symbol: '$', decimals }}>
      <DateShippingNoteRow draft={draft} datesAndShippingLocked={locked} />
    </MoneyFormatProvider>
  )
}

const TITLE = 'Date, shipping and note'

function row() {
  return screen.getByRole('button', { name: new RegExp(TITLE) })
}

async function open(): Promise<void> {
  await userEvent.click(row())
}

function dateInput(): HTMLInputElement {
  return screen.getByLabelText('Date') as HTMLInputElement
}

function shippingInput(): HTMLInputElement {
  return screen.getByLabelText('Shipping charged') as HTMLInputElement
}

function noteInput(): HTMLInputElement {
  return screen.getByLabelText('Note') as HTMLInputElement
}

test('the row is collapsed on mount, titled as asked, and opens and closes with aria-expanded', async () => {
  render(<Host />)
  expect(row()).toHaveAttribute('aria-expanded', 'false')
  expect(row()).toHaveTextContent(/^Date, shipping and note$/)
  expect(screen.queryByLabelText('Date')).toBeNull()
  await open()
  expect(row()).toHaveAttribute('aria-expanded', 'true')
  expect(dateInput()).toBeInTheDocument()
  await open()
  expect(row()).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByLabelText('Date')).toBeNull()
})

test('with every value at default only the title shows', () => {
  render(<Host />)
  expect(row()).toHaveTextContent(/^Date, shipping and note$/)
})

test('the summary joins only the non-default parts, in order, and never shows the note text', async () => {
  render(<Host />)
  await open()
  fireEvent.change(dateInput(), { target: { value: '2026-11-03' } })
  expect(row()).toHaveTextContent(`${TITLE}03/11`)
  expect(row()).not.toHaveTextContent('·')
  await userEvent.type(noteInput(), 'secret words')
  expect(row()).toHaveTextContent('03/11 · Note')
  expect(row()).not.toHaveTextContent('secret')
  await userEvent.type(shippingInput(), '1500')
  expect(row()).toHaveTextContent('03/11 · Shipping $ 1.500 · Note')
  fireEvent.change(dateInput(), { target: { value: TODAY } })
  expect(row()).toHaveTextContent('Shipping $ 1.500 · Note')
  await userEvent.clear(noteInput())
  expect(row()).toHaveTextContent(`${TITLE}Shipping $ 1.500`)
  expect(row()).not.toHaveTextContent('·')
})

test('shipping alone, and note alone, are each the whole summary', async () => {
  render(<Host />)
  await open()
  await userEvent.type(shippingInput(), '700')
  expect(row()).toHaveTextContent(`${TITLE}Shipping $ 700`)
  await userEvent.clear(shippingInput())
  await userEvent.type(noteInput(), 'x')
  expect(row()).toHaveTextContent(`${TITLE}Note`)
  expect(row()).not.toHaveTextContent('Shipping')
})

test('blank, zero and unreadable shipping, and a blank note, add no part', async () => {
  render(<Host />)
  await open()
  await userEvent.type(shippingInput(), '0')
  expect(row()).toHaveTextContent(/^Date, shipping and note$/)
  await userEvent.clear(shippingInput())
  await userEvent.type(shippingInput(), 'abc')
  expect(row()).toHaveTextContent(/^Date, shipping and note$/)
  await userEvent.type(noteInput(), '   ')
  expect(row()).toHaveTextContent(/^Date, shipping and note$/)
})

test('unlocked: a past date is accepted; a later, a cleared and a malformed date snap back', async () => {
  render(<Host />)
  await open()
  expect(dateInput()).toHaveValue(TODAY)
  fireEvent.change(dateInput(), { target: { value: '2026-11-01' } })
  expect(dateInput()).toHaveValue('2026-11-01')
  fireEvent.change(dateInput(), { target: { value: '2026-11-20' } })
  expect(dateInput()).toHaveValue('2026-11-01')
  fireEvent.change(dateInput(), { target: { value: '' } })
  expect(dateInput()).toHaveValue('2026-11-01')
  fireEvent.change(dateInput(), { target: { value: '2026-13-45' } })
  expect(dateInput()).toHaveValue('2026-11-01')
})

test('max follows today: after today moves one day, that day is accepted', async () => {
  const { rerender } = render(<Host />)
  await open()
  expect(dateInput()).toHaveAttribute('max', TODAY)
  fireEvent.change(dateInput(), { target: { value: '2026-11-20' } })
  expect(dateInput()).toHaveValue(TODAY)
  rerender(<Host today="2026-11-20" />)
  expect(dateInput()).toHaveAttribute('max', '2026-11-20')
  fireEvent.change(dateInput(), { target: { value: '2026-11-20' } })
  expect(dateInput()).toHaveValue('2026-11-20')
})

test('locked: date and shipping are disabled, keep their values and point at the reason; the note stays editable', async () => {
  render(<Host locked />)
  await open()
  const reason = screen.getByText('Date and shipping cannot be changed here yet')
  for (const input of [dateInput(), shippingInput()]) {
    expect(input).toBeDisabled()
    expect(input).toHaveAttribute('aria-describedby', reason.id)
  }
  expect(dateInput()).toHaveValue(TODAY)
  expect(shippingInput()).toHaveValue('')
  expect(noteInput()).toBeEnabled()
  expect(noteInput()).not.toHaveAttribute('aria-describedby', reason.id)
  await userEvent.type(noteInput(), 'hello')
  expect(noteInput()).toHaveValue('hello')
  expect(row()).toHaveTextContent(`${TITLE}Note`)
})

test('unlocked: there is no reason text and nothing is disabled', async () => {
  render(<Host />)
  await open()
  expect(screen.queryByText('Date and shipping cannot be changed here yet')).toBeNull()
  expect(dateInput()).toBeEnabled()
  expect(shippingInput()).toBeEnabled()
  expect(dateInput()).not.toHaveAttribute('aria-describedby')
})

test('a note of the cap is kept and one more character is not accepted', async () => {
  render(<Host />)
  await open()
  expect(SALE_NOTE_MAX_LENGTH).toBe(200)
  await userEvent.click(noteInput())
  await userEvent.paste('a'.repeat(SALE_NOTE_MAX_LENGTH))
  expect(noteInput()).toHaveValue('a'.repeat(SALE_NOTE_MAX_LENGTH))
  await userEvent.type(noteInput(), 'b')
  expect(noteInput()).toHaveValue('a'.repeat(SALE_NOTE_MAX_LENGTH))
})

test.each([
  [0, 'numeric'],
  [2, 'decimal'],
])('phone attributes of each input, with %s decimals', async (decimals, inputMode) => {
  render(<Host decimals={decimals} />)
  await open()
  expect(dateInput()).toHaveAttribute('type', 'date')
  expect(dateInput()).toBeRequired()
  expect(dateInput()).toHaveAttribute('autocomplete', 'off')
  expect(dateInput()).toHaveAttribute('max', TODAY)
  expect(dateInput()).toHaveClass('campo__input')
  expect(shippingInput()).toHaveAttribute('autocomplete', 'off')
  expect(shippingInput()).toHaveAttribute('inputmode', inputMode)
  expect(shippingInput()).toHaveClass('campo__input')
  expect(noteInput()).toHaveAttribute('type', 'text')
  expect(noteInput()).toHaveAttribute('autocomplete', 'off')
  expect(noteInput()).toHaveAttribute('maxlength', String(SALE_NOTE_MAX_LENGTH))
  expect(noteInput()).toHaveClass('campo__input')
})
