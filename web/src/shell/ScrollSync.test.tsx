/**
 * `ScrollSync` at its seam: rendered under a memory router whose changes `watchScroll` decides,
 * with `window.scrollTo` spied. jsdom has no layout, so the page's height is given by hand.
 */

import { act, render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi, type MockInstance } from 'vitest'
import { consumePaymentReturn, setPaymentReturn } from '../paymentReturn'
import { CUSTOMER_PAYMENT, CUSTOMERS, HOME, SALES, pathTo } from '../routes'
import ScrollSync from './ScrollSync'
import { resetPlaces, watchScroll } from './scrollPlaces'

let scrollTo: MockInstance<typeof window.scrollTo>
let live = 0
let pinned = false
let stop: () => void = () => undefined

function mount(initial: string) {
  const router = createMemoryRouter([{ path: '*', element: <ScrollSync /> }], { initialEntries: [initial] })
  stop = watchScroll(router, { viewport: () => 'phone', scrollY: () => live, isPinned: () => pinned })
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: 5000, configurable: true })
  live = 0
  pinned = false
})

afterEach(() => {
  stop()
  resetPlaces()
  consumePaymentReturn()
  vi.restoreAllMocks()
})

test('the first render moves nothing', () => {
  mount(SALES)
  expect(scrollTo).not.toHaveBeenCalled()
})

test('a tab opens the new screen at the top', async () => {
  const router = mount(SALES)
  live = 700
  await act(() => router.navigate(CUSTOMERS))
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
})

test('a change inside the same screen moves nothing', async () => {
  const router = mount(SALES)
  live = 700
  await act(() => router.navigate(`${SALES}?q=rosa`))
  expect(scrollTo).not.toHaveBeenCalled()
})

test('a return goes to the offset the screen was left at', async () => {
  const router = mount(SALES)
  live = 700
  await act(() => router.navigate(CUSTOMERS))
  scrollTo.mockClear()
  live = 0
  await act(() => router.navigate(-1))
  expect(scrollTo).toHaveBeenCalledWith({ top: 700, left: 0, behavior: 'instant' })
})

test('a return to an entry with no saved offset goes to the top', async () => {
  const router = mount(SALES)
  await act(() => router.navigate(CUSTOMERS))
  // Left while pinned with nothing held: no offset is kept for Customers.
  pinned = true
  await act(() => router.navigate(HOME))
  pinned = false
  Object.defineProperty(window, 'scrollY', { value: 300, configurable: true })
  scrollTo.mockClear()
  await act(() => router.navigate(-1))
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
  Reflect.deleteProperty(window, 'scrollY')
})

test('leaving Record payment with its hand-off pending applies nothing when the decision is top', async () => {
  const router = mount(pathTo(CUSTOMER_PAYMENT, { id: 3 }))
  setPaymentReturn(3, 600)
  await act(() => router.navigate(HOME))
  expect(scrollTo).not.toHaveBeenCalled()
})

test('leaving Record payment with its hand-off pending applies nothing when the decision is restore', async () => {
  const router = mount(CUSTOMERS)
  live = 600
  await act(() => router.navigate(pathTo(CUSTOMER_PAYMENT, { id: 3 })))
  setPaymentReturn(3, 600)
  await act(() => router.navigate(-1))
  expect(scrollTo).not.toHaveBeenCalled()
})

test('a stale hand-off left from elsewhere does not stop a tab arrival from going to the top', async () => {
  const router = mount(HOME)
  setPaymentReturn(3, 600)
  await act(() => router.navigate(SALES))
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
})
