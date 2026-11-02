/**
 * `SelectorPago` at the component seam: a `role="radiogroup"` named "Payment method" with one
 * `role="radio"` chip per active method of the business (read from `GET /payment-methods`),
 * then the "Owing" chip. Roles and accessible names are what a native radio group gives.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { paymentMethodsResponse } from '../test/paymentMethods'
import type { PaymentChoice } from '../sales/pricing'
import SelectorPago from './SelectorPago'

type Props = Partial<React.ComponentProps<typeof SelectorPago>>

function renderSelector(props: Props = {}, list: unknown = undefined) {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(list === undefined ? paymentMethodsResponse() : paymentMethodsResponse(list))))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <SelectorPago value={null} onChange={() => {}} {...props} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('while the methods load, the group is a busy progress bar named "Loading payment methods"', () => {
  renderSelector()
  const loading = screen.getByRole('progressbar', { name: 'Loading payment methods' })
  expect(loading).toHaveAttribute('aria-busy', 'true')
  expect(screen.queryByRole('radio')).not.toBeInTheDocument()
})

test('is a radiogroup named "Payment method": one radio per method in the seller\'s order, then Owing', async () => {
  renderSelector()
  expect(await screen.findByRole('radiogroup', { name: 'Payment method' })).toBeInTheDocument()
  const names = screen.getAllByRole('radio').map((radio) => radio.textContent)
  expect(names).toEqual(['Cash', 'Transfer', 'Mercado Pago', 'Owing'])
  expect(screen.getByRole('radio', { name: 'Mercado Pago' })).toBeInTheDocument()
})

test('Record payment passes allowOwing={false}: no Owing chip', async () => {
  renderSelector({ allowOwing: false })
  await screen.findByRole('radio', { name: 'Cash' })
  expect(screen.queryByRole('radio', { name: 'Owing' })).not.toBeInTheDocument()
})

test('allows no selection: none of the chips is checked', async () => {
  renderSelector()
  await screen.findByRole('radio', { name: 'Cash' })
  for (const radio of screen.getAllByRole('radio')) {
    expect(radio).toHaveAttribute('aria-checked', 'false')
  }
})

test('marks the chosen method checked, and only that one, with a check mark beside its name', async () => {
  const value: PaymentChoice = { kind: 'method', id: 1 }
  renderSelector({ value })
  const cash = await screen.findByRole('radio', { name: 'Cash' })
  expect(cash).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('radio', { name: 'Transfer' })).toHaveAttribute('aria-checked', 'false')
  expect(screen.getByRole('radio', { name: 'Owing' })).toHaveAttribute('aria-checked', 'false')
  expect(cash.querySelectorAll('svg')).toHaveLength(2)
  expect(screen.getByRole('radio', { name: 'Transfer' }).querySelectorAll('svg')).toHaveLength(1)
})

test('marks Owing checked when it is the choice', async () => {
  renderSelector({ value: { kind: 'owing' } })
  expect(await screen.findByRole('radio', { name: 'Owing' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('radio', { name: 'Cash' })).toHaveAttribute('aria-checked', 'false')
})

test('a method the seller renamed shows the name the list carries, whole', async () => {
  renderSelector({}, [{ id: 7, name: 'Billetera de la abuela Rosa', icon: 'wallet', position: 1, is_used: false }])
  expect(await screen.findByRole('radio', { name: 'Billetera de la abuela Rosa' })).toBeInTheDocument()
})

test('a disabled Owing carries the caller\'s description as its accessible description', async () => {
  renderSelector({ owingDisabled: true, owingDescription: 'Pick a customer to leave it owing' })
  const owing = await screen.findByRole('radio', { name: 'Owing' })
  expect(owing).toBeDisabled()
  expect(screen.getByText('Pick a customer to leave it owing')).toBeInTheDocument()
  const describedBy = owing.getAttribute('aria-describedby')
  expect(describedBy).not.toBeNull()
  expect(document.getElementById(describedBy as string)?.textContent).toBe('Pick a customer to leave it owing')
})

test('a disabled Owing never fires onChange', async () => {
  const onChange = vi.fn()
  renderSelector({ onChange, owingDisabled: true, owingDescription: 'x' })
  const owing = await screen.findByRole('radio', { name: 'Owing' })
  owing.click()
  expect(onChange).not.toHaveBeenCalled()
})

test('clicking a method fires onChange with its id, and Owing with the owing choice', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  renderSelector({ onChange })
  await user.click(await screen.findByRole('radio', { name: 'Transfer' }))
  expect(onChange).toHaveBeenCalledWith({ kind: 'method', id: 2 })
  await user.click(screen.getByRole('radio', { name: 'Owing' }))
  expect(onChange).toHaveBeenCalledWith({ kind: 'owing' })
})
