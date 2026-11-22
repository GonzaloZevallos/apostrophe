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
import {
  choiceOfValue,
  collectableChoice,
  howTheyPayView,
  OWING_VALUE,
  paymentMethodOf,
  paymentMethodValue,
  selectorValueOf,
  usePaymentMethodOptions,
} from './paymentMethods'

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
  const { selector, failure, reload, offeredIds } = usePaymentMethodOptions()
  return (
    <>
      <p>failure={String(failure)}</p>
      <p>offered={offeredIds === null ? 'none' : offeredIds.join(',')}</p>
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

test('the offered ids are the ids of the list, and null while there is no list', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(answer(500, {}))))
  renderForm(<Field />)
  expect(await screen.findByText('failure=server')).toBeInTheDocument()
  expect(screen.getByText('offered=none')).toBeInTheDocument()
})

test('the offered ids arrive in the server order', async () => {
  renderForm(<Field />)
  expect(await screen.findByText('offered=4,9')).toBeInTheDocument()
})

test('every choice is collectable as given, owing included', () => {
  expect(collectableChoice({ kind: 'owing' })).toEqual({ kind: 'owing' })
  expect(collectableChoice({ kind: 'paid', payment_method_id: 4 })).toEqual({ kind: 'paid', payment_method_id: 4 })
  expect(collectableChoice(null)).toBeNull()
})

test('a Selector value and a draft choice round-trip', () => {
  expect(choiceOfValue('4')).toEqual({ kind: 'paid', payment_method_id: 4 })
  expect(choiceOfValue(null)).toEqual({ kind: 'unset' })
  expect(choiceOfValue(OWING_VALUE)).toEqual({ kind: 'owing' })
  expect(selectorValueOf(choiceOfValue('4'), null, [4, 9])).toBe('4')
})

test('the Selector value of a choice: the proposal only when offered, OWING_VALUE for owing', () => {
  expect(selectorValueOf({ kind: 'unset' }, 9, [4, 9])).toBe('9')
  expect(selectorValueOf({ kind: 'unset' }, 7, [4, 9])).toBeNull()
  expect(selectorValueOf({ kind: 'unset' }, 9, null)).toBeNull()
  expect(selectorValueOf({ kind: 'unset' }, null, [4, 9])).toBeNull()
  expect(selectorValueOf({ kind: 'owing' }, 9, [4, 9])).toBe(OWING_VALUE)
  expect(selectorValueOf({ kind: 'paid', payment_method_id: 4 }, 9, [4, 9])).toBe('4')
})

test('a value that is not a method id is never taken for one', () => {
  expect(paymentMethodOf('4')).toBe(4)
  expect(paymentMethodOf('cash')).toBeNull()
  expect(paymentMethodOf('owing')).toBeNull()
  expect(paymentMethodOf(null)).toBeNull()
  expect(paymentMethodValue(4)).toBe('4')
  expect(paymentMethodValue(null)).toBeNull()
})

const METHOD_OPTIONS = [
  { value: '4', label: 'Cash' },
  { value: '9', label: 'Wallet app' },
]

function view(overrides: Partial<Parameters<typeof howTheyPayView>[0]> = {}) {
  return howTheyPayView({
    choice: { kind: 'unset' },
    customerId: 3,
    proposedMethodId: null,
    offeredIds: [4, 9],
    methodOptions: METHOD_OPTIONS,
    refusedIds: [],
    methodGone: null,
    owesItLabel: 'Owes it',
    ...overrides,
  })
}

test('howTheyPayView with a Customer offers Owes it last and shows it when owing', () => {
  const shown = view({ choice: { kind: 'owing' } })
  expect(shown.options.map((option) => option.label)).toEqual(['Cash', 'Wallet app', 'Owes it'])
  expect(shown.value).toBe(OWING_VALUE)
  expect(shown.selected).toBeUndefined()
})

test('howTheyPayView with a Customer and a paid choice shows the method', () => {
  const shown = view({ choice: { kind: 'paid', payment_method_id: 9 } })
  expect(shown.value).toBe('9')
  expect(shown.options.at(-1)).toEqual({ value: OWING_VALUE, label: 'Owes it' })
})

test('howTheyPayView without a Customer never offers Owes it', () => {
  const shown = view({ customerId: null, choice: { kind: 'unset' }, proposedMethodId: 9 })
  expect(shown.options.map((option) => option.label)).toEqual(['Cash', 'Wallet app'])
  expect(shown.value).toBe('9')
})

test('howTheyPayView owing with no Customer keeps Owes it as the shown value, outside the options', () => {
  const shown = view({ customerId: null, choice: { kind: 'owing' } })
  expect(shown.options.map((option) => option.label)).toEqual(['Cash', 'Wallet app'])
  expect(shown.value).toBe(OWING_VALUE)
  expect(shown.selected).toEqual({ value: OWING_VALUE, label: 'Owes it' })
})

test('howTheyPayView hides a refused proposal and drops refused ids from the options', () => {
  const shown = view({ proposedMethodId: 9, refusedIds: [9] })
  expect(shown.value).toBeNull()
  expect(shown.options.map((option) => option.label)).toEqual(['Cash', 'Owes it'])
})

test('howTheyPayView keeps the method the server refused as the selected entry', () => {
  const shown = view({
    choice: { kind: 'paid', payment_method_id: 4 },
    refusedIds: [4],
    methodGone: { id: 4, name: 'Cash' },
  })
  expect(shown.value).toBe('4')
  expect(shown.selected).toEqual({ value: '4', label: 'Cash' })
  expect(shown.options.map((option) => option.label)).toEqual(['Wallet app', 'Owes it'])
})
