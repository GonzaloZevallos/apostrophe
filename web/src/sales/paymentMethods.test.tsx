/**
 * `usePaymentMethodOptions`: the one list of Payment methods both screens read until GH-318.
 * Its test renders the Selector from the hook's whole result, so a widened type fails `tsc`.
 */

import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, expect, test } from 'vitest'
import Selector from '../components/Selector'
import { renderForm } from '../components/selectorTestKit'
import { stubViewport } from '../test-viewport'
import { paymentMethodOf, usePaymentMethodOptions } from './paymentMethods'

beforeEach(() => stubViewport('computer'))

function Field() {
  const [value, setValue] = useState<string | null>(null)
  return <Selector {...usePaymentMethodOptions()} label="Payment method" value={value} onChange={setValue} />
}

test('the Selector built from the hook lists Cash then Transfer, with no clearing row', async () => {
  const user = userEvent.setup()
  renderForm(<Field />)
  await user.click(screen.getByRole('button', { name: /^Payment method/ }))
  const options = screen.getAllByRole('option')
  expect(options.map((option) => option.textContent)).toEqual(['Cash', 'Transfer'])
})

test('a list with options never shows empty-set or loading text', async () => {
  const user = userEvent.setup()
  renderForm(<Field />)
  const field = screen.getByRole('button', { name: /^Payment method/ })
  expect(field).toBeEnabled()
  expect(field).not.toHaveAttribute('aria-busy')
  await user.click(field)
  expect(document.querySelector('.selector-lista__mensaje')).toBeNull()
})

test('the hook returns exactly the API values, cash then transfer, and a required built-in list', () => {
  function Probe() {
    const { options, builtIn, required } = usePaymentMethodOptions()
    return (
      <p>
        {options.map((option) => option.value).join(',')} builtIn={String(builtIn)} required={String(required)}
      </p>
    )
  }
  renderForm(<Probe />)
  expect(screen.getByText('cash,transfer builtIn=true required=true')).toBeInTheDocument()
})

test('a value that is not a method is never taken for one', () => {
  expect(paymentMethodOf('cash')).toBe('cash')
  expect(paymentMethodOf('transfer')).toBe('transfer')
  expect(paymentMethodOf('owing')).toBeNull()
  expect(paymentMethodOf(null)).toBeNull()
})
