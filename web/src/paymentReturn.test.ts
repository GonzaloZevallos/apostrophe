import { afterEach, expect, test } from 'vitest'
import { consumePaymentReturn, peekPaymentReturn, setPaymentReturn } from './paymentReturn'

afterEach(() => {
  consumePaymentReturn()
})

test('nothing is held until a payment is saved', () => {
  expect(peekPaymentReturn()).toBeNull()
  expect(consumePaymentReturn()).toBeNull()
})

test('it holds a customer id only, and consuming gives them once', () => {
  setPaymentReturn(7)

  expect(peekPaymentReturn()).toEqual({ customerId: 7 })
  expect(peekPaymentReturn()).toEqual({ customerId: 7 })
  expect(consumePaymentReturn()).toEqual({ customerId: 7 })
  expect(peekPaymentReturn()).toBeNull()
  expect(consumePaymentReturn()).toBeNull()
})

test('a later link replaces the one before it', () => {
  setPaymentReturn(7)
  setPaymentReturn(9)

  expect(consumePaymentReturn()).toEqual({ customerId: 9 })
})

test('it writes nothing to browser storage or the address', () => {
  const before = window.location.href
  setPaymentReturn(7)

  expect(window.localStorage.length).toBe(0)
  expect(window.sessionStorage.length).toBe(0)
  expect(window.location.href).toBe(before)
  expect(window.history.state).toBeNull()
})
