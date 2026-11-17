import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import PriceFields from '../screens/varieties/PriceFields'
import { readPriceValues, type PriceValues } from '../screens/varieties/priceFieldRules'
import { MoneyFormatProvider } from '../format/MoneyFormatProvider'
import type { MoneyFormat } from '../format/money'

const SETTINGS = { is_bulk_pricing: false, is_vip_customers: false }
const NONE: PriceValues = { listPrice: '', bulkPrice: '', bulkMinimum: '', vipPrice: '' }

function Host({ format }: { format: MoneyFormat }) {
  const [values, setValues] = useState<PriceValues>(NONE)
  const read = readPriceValues(values, SETTINGS, format)
  return (
    <MoneyFormatProvider format={format}>
      <PriceFields
        settings={SETTINGS}
        values={values}
        errors={read.ok ? {} : read.errors}
        onChange={(field, value) => setValues((previous) => ({ ...previous, [field]: value }))}
      />
      <output>{read.ok ? `read ${read.amounts.list_price}` : 'refused'}</output>
    </MoneyFormatProvider>
  )
}

test('under 2 decimals the amount field opens a decimal keyboard, accepts 11,50 and shows it back with the symbol', async () => {
  render(<Host format={{ symbol: 'US$', decimals: 2 }} />)
  const field = screen.getByRole('textbox', { name: /List price/ })
  expect(field).toHaveAttribute('inputmode', 'decimal')
  await userEvent.type(field, '11,5')
  expect(screen.getByRole('status')).toHaveTextContent('read 11.5')
  await userEvent.tab()
  expect(field).toHaveValue('11,50')
  expect(screen.getByText('US$')).toBeInTheDocument()
})

test('under 2 decimals a third decimal is refused with the decimals rule', async () => {
  render(<Host format={{ symbol: '$', decimals: 2 }} />)
  await userEvent.type(screen.getByRole('textbox', { name: /List price/ }), '11,505')
  expect(screen.getByRole('alert')).toHaveTextContent('Use up to 2 decimals.')
})

test('under 0 decimals the field is digits only, refuses a fraction and keeps what was typed on leaving', async () => {
  render(<Host format={{ symbol: '$', decimals: 0 }} />)
  const field = screen.getByRole('textbox', { name: /List price/ })
  expect(field).toHaveAttribute('inputmode', 'numeric')
  await userEvent.type(field, '11,5')
  expect(screen.getByRole('status')).toHaveTextContent('refused')
  await userEvent.tab()
  expect(field).toHaveValue('11,5')
})
