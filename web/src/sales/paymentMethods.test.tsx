/**
 * `usePaymentMethodOptions`: the business's own offered list, read by both screens. Its test renders
 * the Selector from the hook's `selector` result, so a widened type fails `tsc`.
 */

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'
import Selector from '../components/Selector'
import { renderForm } from '../components/selectorTestKit'
import { stubViewport } from '../test-viewport'
import { paymentMethodOf, paymentMethodValue, usePaymentMethodOptions } from './paymentMethods'

const LIST = [
  { id: 4, name: 'Cash', icon: 'banknote', position: 1, in_use: false },
  { id: 9, name: 'Wallet app', icon: 'wallet', position: 2, in_use: false },
]

function answer(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  stubViewport('computer')
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(answer(200, LIST))))
})

function Field() {
  const [value, setValue] = useState<string | null>(null)
  const { selector, failure, reload } = usePaymentMethodOptions()
  return (
    <>
      <p>failure={String(failure)}</p>
      <button type="button" onClick={reload}>
        Retry
      </button>
      <Selector {...selector} label="Payment method" value={value} onChange={setValue} />
    </>
  )
}

test('the Selector lists the business methods in the server order, with no clearing row', async () => {
  const user = userEvent.setup()
  renderForm(<Field />)
  const field = await screen.findByRole('button', { name: /^Payment method/ })
  await waitFor(() => expect(field).toBeEnabled())
  await user.click(field)
  expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['Cash', 'Wallet app'])
})

test('a server error is reported and reloading reads the list again', async () => {
  const user = userEvent.setup()
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(answer(500, {}))))
  renderForm(<Field />)
  expect(await screen.findByText('failure=server')).toBeInTheDocument()

  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(answer(200, LIST))))
  await user.click(screen.getByRole('button', { name: 'Retry' }))

  expect(await screen.findByText('failure=null')).toBeInTheDocument()
})

test('a dropped network is reported as offline, not as a server error', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
  renderForm(<Field />)

  expect(await screen.findByText('failure=offline')).toBeInTheDocument()
})

test('a value that is not a method id is never taken for one', () => {
  expect(paymentMethodOf('4')).toBe(4)
  expect(paymentMethodOf('cash')).toBeNull()
  expect(paymentMethodOf('owing')).toBeNull()
  expect(paymentMethodOf(null)).toBeNull()
  expect(paymentMethodValue(4)).toBe('4')
  expect(paymentMethodValue(null)).toBeNull()
})
