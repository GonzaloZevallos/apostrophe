/**
 * `SelectorPago` at the component seam: the fixed Paid · Owing choice and, under Paid only, the
 * required Payment method Selector. Owing keeps its native `disabled` and its description when
 * there is no Customer (PM, adjustment 2 of the original swap), so `toBeDisabled()` still reads it.
 */

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { PayState } from '../sales/pricing'
import type { PaymentMethod } from '../api/payments'
import { stubViewport } from '../test-viewport'
import SelectorPago, { type SelectorPagoProps } from './SelectorPago'
import { renderForm, stubPaymentMethodsFetch } from './selectorTestKit'

beforeEach(() => {
  stubViewport('computer')
  stubPaymentMethodsFetch()
})

function Harness(props: Partial<SelectorPagoProps> & { initial?: PayState | null }) {
  const [payState, setPayState] = useState<PayState | null>(props.initial ?? null)
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  return (
    <SelectorPago
      payState={payState}
      onPayState={setPayState}
      method={method}
      onMethod={setMethod}
      {...props}
    />
  )
}

test('Paid · Owing is a radiogroup of exactly two radios, with none checked', () => {
  renderForm(<Harness />)
  expect(screen.getByRole('radiogroup', { name: 'How it was paid' })).toBeInTheDocument()
  expect(screen.getAllByRole('radio').map((radio) => radio.textContent)).toEqual(['Paid', 'Owing'])
  for (const radio of screen.getAllByRole('radio')) expect(radio).toHaveAttribute('aria-checked', 'false')
})

test('no Payment method field shows until Paid is chosen, and none shows under Owing', async () => {
  const user = userEvent.setup()
  renderForm(<Harness owingDescription="Pick a customer" />)
  expect(screen.queryByRole('button', { name: /^Payment method/ })).toBeNull()
  await user.click(screen.getByRole('radio', { name: 'Owing' }))
  expect(screen.queryByRole('button', { name: /^Payment method/ })).toBeNull()
  await user.click(screen.getByRole('radio', { name: 'Paid' }))
  expect(await screen.findByRole("button", { name: /^Payment method/ })).toBeInTheDocument()
})

test('the method is a Selector with Cash and Transfer, no clearing row, and no radio or pressed button holds them', async () => {
  const user = userEvent.setup()
  renderForm(<Harness initial="paid" />)
  expect(screen.queryByRole('radio', { name: 'Cash' })).toBeNull()
  expect(screen.queryByRole('radio', { name: 'Transfer' })).toBeNull()
  expect(document.querySelector('[aria-pressed]')).toBeNull()
  await user.click(await screen.findByRole('button', { name: /^Payment method/ }))
  expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['Cash', 'Transfer'])
})

test('choosing a method in the list reports it', async () => {
  const user = userEvent.setup()
  const onMethod = vi.fn()
  renderForm(<Harness initial="paid" onMethod={onMethod} />)
  await user.click(await screen.findByRole('button', { name: /^Payment method/ }))
  await user.click(await screen.findByRole('option', { name: 'Cash' }))
  expect(onMethod).toHaveBeenCalledWith(1)
})

test('a disabled Owing carries the caller\'s description as its accessible description', () => {
  renderForm(<Harness owingDisabled owingDescription="Para dejar debiendo elegí un cliente" />)
  const owing = screen.getByRole('radio', { name: 'Owing' })
  expect(owing).toBeDisabled()
  expect(owing).toHaveAccessibleDescription('Para dejar debiendo elegí un cliente')
  expect(screen.getByRole('radio', { name: 'Paid' })).toBeEnabled()
})

test('a disabled Owing never fires onPayState', async () => {
  const user = userEvent.setup()
  const onPayState = vi.fn()
  renderForm(<Harness owingDisabled owingDescription="x" onPayState={onPayState} />)
  await user.click(screen.getByRole('radio', { name: 'Owing' }))
  expect(onPayState).not.toHaveBeenCalled()
})

test('clicking Paid fires onPayState with paid', async () => {
  const user = userEvent.setup()
  const onPayState = vi.fn()
  renderForm(<Harness onPayState={onPayState} />)
  await user.click(screen.getByRole('radio', { name: 'Paid' }))
  expect(onPayState).toHaveBeenCalledWith('paid')
})

test('the refusal shows at the method field with the sentence, linked to the field', () => {
  renderForm(<Harness initial="paid" methodRefused />)
  const alert = screen.getByRole('alert')
  expect(alert).toHaveTextContent('Choose how they paid.')
  expect(alert.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByRole('button', { name: /^Payment method/ })).toHaveAccessibleDescription(
    'Choose how they paid.',
  )
})

test('no refusal shows when the method is not refused', () => {
  renderForm(<Harness initial="paid" />)
  expect(screen.queryByRole('alert')).toBeNull()
})

test('a methods list that failed says so on the field and a tap on it reads the list again', async () => {
  const user = userEvent.setup()
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 500 }))))
  renderForm(<Harness initial="paid" />)
  const field = await screen.findByRole('button', { name: /^Payment method/ })
  await waitFor(() => expect(field).toBeEnabled())

  stubPaymentMethodsFetch()
  await user.click(field)

  expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['Cash', 'Transfer'])
})

test('with no connection the sin conexión notice shows and the form keeps its state', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
  renderForm(<Harness initial="paid" />)

  expect(await screen.findByText(/^Offline/)).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Paid' })).toHaveAttribute('aria-checked', 'true')
})
