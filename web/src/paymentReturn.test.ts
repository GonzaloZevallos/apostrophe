import { afterEach, expect, test } from 'vitest'
import { consumePaymentReturn, peekPaymentReturn, setPaymentReturn } from './paymentReturn'

afterEach(() => {
  consumePaymentReturn()
})

test('nothing is held until a payment link is followed', () => {
  expect(peekPaymentReturn()).toBeNull()
  expect(consumePaymentReturn()).toBeNull()
})

test('it holds a customer id and a scroll offset, and consuming gives them once', () => {
  setPaymentReturn(7, 412)

  expect(peekPaymentReturn()).toEqual({ customerId: 7, scrollY: 412 })
  expect(peekPaymentReturn()).toEqual({ customerId: 7, scrollY: 412 })
  expect(consumePaymentReturn()).toEqual({ customerId: 7, scrollY: 412 })
  expect(peekPaymentReturn()).toBeNull()
  expect(consumePaymentReturn()).toBeNull()
})

test('a later link replaces the one before it', () => {
  setPaymentReturn(7, 412)
  setPaymentReturn(9, 0)

  expect(consumePaymentReturn()).toEqual({ customerId: 9, scrollY: 0 })
})

test('it writes nothing to browser storage or the address', () => {
  const before = window.location.href
  setPaymentReturn(7, 412)

  expect(window.localStorage.length).toBe(0)
  expect(window.sessionStorage.length).toBe(0)
  expect(window.location.href).toBe(before)
  expect(window.history.state).toBeNull()
})
