/** `ExpenseRow` rendered with Testing Library: one tile per `OTHER_RECORDS` entry, in order. */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { SALES_TEXT } from '../../copy/sales'
import { OTHER_RECORDS } from '../../sales/otherRecords'
import { ExpenseRow } from './SaleExpenseSheet'

function renderRow(locked: boolean) {
  const onOpen = vi.fn()
  render(
    <ExpenseRow
      words={{ otherThingsToRecord: SALES_TEXT.otherThingsToRecord, expense: SALES_TEXT.expense }}
      rowRef={null}
      locked={locked}
      onOpen={onOpen}
    />,
  )
  return onOpen
}

test('offers one button per record of OTHER_RECORDS, in order, named by its word', () => {
  renderRow(false)
  const row = screen.getByRole('navigation', { name: 'Other things to record' })
  const names = within(row)
    .getAllByRole('button')
    .map((button) => button.textContent)
  expect(names).toEqual(OTHER_RECORDS.map((record) => SALES_TEXT[record]))
})

test('a tap on a tile opens its record', async () => {
  const onOpen = renderRow(false)
  await userEvent.click(screen.getByRole('button', { name: SALES_TEXT.expense }))
  expect(onOpen).toHaveBeenCalledTimes(1)
  expect(onOpen).toHaveBeenCalledWith('expense')
})

test('while locked a tap opens nothing', async () => {
  const onOpen = renderRow(true)
  await userEvent.click(screen.getByText(SALES_TEXT.expense))
  expect(onOpen).not.toHaveBeenCalled()
})
