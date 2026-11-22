/**
 * `NuevaVentaSheet`'s sale bar at the component seam (Testing Library, `fetch` faked, the shared harness
 * in `renderNuevaVentaSheet.tsx`): the four states of the status region, the total, and Collect, which
 * exists only in the total state.
 */

import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { moneyFormatter } from '../../format/money'
import type { CustomerView } from '../../sales/newSaleView'
import { priceSale } from '../../sales/pricing'
import { saleLineInputsOf } from '../../sales/saleDraft'
import {
  FORMAT,
  LATER,
  PRODUCTS,
  renderNuevaVentaSheet,
  type LineSpec,
  type SheetCase,
} from './renderNuevaVentaSheet'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const KNOWN: CustomerView = { kind: 'known', name: 'Ana', typeId: null, typeName: null }
const ROSA: LineSpec = { productId: 1, quantity: '2' }
const ARBOL: LineSpec = { productId: 2, quantity: '3' }
const UNPRICED: LineSpec = { productId: 3, quantity: '1' }
const money = moneyFormatter(FORMAT)

/** The compact Loading mark is the one `aria-hidden` element: it has no role and no text. */
const loadingMarks = (within: HTMLElement) => within.querySelectorAll('[aria-hidden="true"]')
const status = () => screen.getByRole('status')
const collect = () => screen.queryAllByRole('button', { name: /Collect/ })
const listed = () => screen.findByRole('heading', { name: 'In the sale · 1' })
/** Lets every pending read answer, so a state that must not change has had its chance to. */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 60)))

test('the empty bar asks for a product and has no Collect button of any kind', async () => {
  renderNuevaVentaSheet({ customer: KNOWN })
  await screen.findByRole('heading', { name: 'Most sold' })
  expect(status()).toHaveTextContent(/^Add a product to collect$/)
  expect(screen.queryByRole('button', { name: /Collect/ })).toBeNull()
  expect(document.querySelector('[aria-disabled]')).toBeNull()
  expect(screen.queryByText('Collect')).toBeNull()
})

test.each<[string, readonly LineSpec[], string]>([
  ['one line', [ROSA], '1 item'],
  ['several lines', [ROSA, ARBOL], '2 items'],
])('counting while the Customer is pending: the count for %s, and no Collect', async (_name, lines, text) => {
  renderNuevaVentaSheet({ customer: { kind: 'namePending' }, lines })
  await waitFor(() => expect(status()).toHaveTextContent(new RegExp(`^${text}$`)))
  await settle()
  expect(status()).toHaveTextContent(new RegExp(`^${text}$`))
  expect(collect()).toHaveLength(0)
  expect(loadingMarks(status())).toHaveLength(1)
})

test('loading is counting: the count with the Loading mark', async () => {
  renderNuevaVentaSheet({ customer: KNOWN, lines: [ROSA], held: ['products'] })
  await waitFor(() => expect(loadingMarks(status())).toHaveLength(1))
  expect(status().textContent).toBe('1 item')
})

test.each<[string, readonly LineSpec[], string]>([
  ['one line', [ROSA], '1 item'],
  ['several lines', [ROSA, ARBOL], '2 items'],
])('the status region for %s reads the count and the total', async (_name, lines, count) => {
  renderNuevaVentaSheet({ customer: KNOWN, lines })
  const total = priceSale({
    lines: saleLineInputsOf(lines.map((l) => ({ productId: l.productId, quantityHundredths: Number(l.quantity) * 100 }))),
    customerTypeId: null,
    pricingSettings: { bulk: true, vip: true },
    products: PRODUCTS,
    shippingCharged: 0,
  }).totals.total
  await waitFor(() => expect(status()).toHaveTextContent(`${count} · ${money.money(total)}`))
  expect(status().textContent).toBe(`${count} · ${money.money(total)}`)
})

test('the total is priceSale totals.total with the shipping charged, in the Money format', async () => {
  renderNuevaVentaSheet({ customer: KNOWN, lines: [ROSA, ARBOL], shipping: '500' })
  const expected = priceSale({
    lines: saleLineInputsOf([
      { productId: 1, quantityHundredths: 200 },
      { productId: 2, quantityHundredths: 300 },
    ]),
    customerTypeId: null,
    pricingSettings: { bulk: true, vip: true },
    products: PRODUCTS,
    shippingCharged: 500,
  }).totals
  expect(expected.shippingCharged).toBeGreaterThan(0)
  await waitFor(() => expect(status()).toHaveTextContent(`2 items · ${money.money(expected.total)}`))
  const figure = within(status()).getByText(money.money(expected.total))
  expect(figure.className).toContain('cifra')
  expect(status().textContent).toBe(`2 items · ${money.money(expected.total)}`)
})

test('Collect sits beside the status region, never inside it, and raises onCollect with the sale', async () => {
  const { onCollect } = renderNuevaVentaSheet({ customer: KNOWN, lines: [ROSA], shipping: '500' })
  const button = await screen.findByRole('button', { name: 'Collect' })
  expect(status()).not.toContainElement(button)
  expect(button).toBeEnabled()
  expect(button).not.toHaveAttribute('aria-disabled')
  await userEvent.click(button)
  expect(onCollect).toHaveBeenCalledTimes(1)
  const sale = onCollect.mock.calls[0]?.[0]
  expect(sale?.lines).toHaveLength(1)
  expect(sale?.totals.shippingCharged).toBe(500)
})

test('touched follows the draft: a line makes the Sheet touched, and Close still leaves at once', async () => {
  const { onClose } = renderNuevaVentaSheet({ customer: KNOWN, lines: [ROSA] })
  await listed()
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('alertdialog')).toBeNull()
})

/** Each case has one line and must show neither Collect nor a figure. */
const NO_TOTAL: [string, SheetCase, string, number][] = [
  ['loading', { customer: KNOWN, lines: [ROSA], held: ['products'] }, '1 item', 1],
  ['the Customer pending', { customer: { kind: 'typePending', name: 'Ana' }, lines: [ROSA] }, '1 item', 1],
  ['a failed list', { customer: KNOWN, lines: [ROSA], broken: ['products'] }, '1 item', 0],
  ['a failed Customer read', { customer: { kind: 'failed', name: 'Ana' }, lines: [ROSA] }, '1 item', 0],
  ['a failed Customer read with no name', { customer: { kind: 'failed', name: null }, lines: [ROSA] }, '1 item', 0],
  ['an unreadable shipping charged', { customer: KNOWN, lines: [ROSA], shipping: 'abc' }, '1 item', 0],
  ['an unpriced line', { customer: KNOWN, lines: [ROSA, UNPRICED] }, '2 items', 0],
]

test.each(NO_TOTAL)('%s: the status region has the count only, and there is no Collect', async (_name, spec, count, marks) => {
  renderNuevaVentaSheet(spec)
  await waitFor(() => expect(status()).toHaveTextContent(new RegExp(`^${count}$`)))
  await settle()
  expect(status().textContent).toBe(count)
  expect(status().textContent).not.toContain('$')
  expect(loadingMarks(status())).toHaveLength(marks)
  expect(collect()).toHaveLength(0)
})

test('a failed Customer read keeps the list marks loading: no figure, no label, no Collect', async () => {
  renderNuevaVentaSheet({ customer: { kind: 'failed', name: 'Ana' }, lines: [ROSA] })
  await screen.findByRole('heading', { name: 'In the sale · 1' })
  await settle()
  const text = screen.getByRole('dialog', { name: 'New sale' }).textContent ?? ''
  expect(text).not.toContain('$')
  expect(text).not.toMatch(/No price|List prices|Prices for/)
  expect(collect()).toHaveLength(0)
})

test('refreshing: a date change under a loaded list drops the total and Collect, and ready brings them back', async () => {
  const rendered = renderNuevaVentaSheet({ customer: KNOWN, lines: [ROSA] })
  await screen.findByRole('button', { name: 'Collect' })
  rendered.hold('products')
  act(() => rendered.draft().setDate(LATER))
  await waitFor(() => expect(collect()).toHaveLength(0))
  expect(status().textContent).toBe('1 item')
  rendered.release('products')
  expect(await screen.findByRole('button', { name: 'Collect' })).toBeInTheDocument()
})
