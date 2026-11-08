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
import { type PaymentMethodOptions, usePaymentMethodOptions } from './paymentMethods'

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
  const seen: { current?: PaymentMethodOptions } = {}
  function Probe() {
    seen.current = usePaymentMethodOptions()
    return null
  }
  renderForm(<Probe />)
  expect(seen.current?.options.map((option) => option.value)).toEqual(['cash', 'transfer'])
  expect(seen.current?.builtIn).toBe(true)
  expect(seen.current?.required).toBe(true)
})
