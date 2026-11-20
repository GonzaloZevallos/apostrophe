/**
 * `CollectSheet` (the closing step of New sale, unrouted) at its component seam: Testing Library
 * with `fetch` faked. The test host mounts it in a memory router with `SheetRouterProvider` and
 * `SheetStackProvider`, as `SelectorTestHost` does, and drives the Sale in progress through
 * `useSaleDraft`, the way the flip part's host will.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SheetRouterProvider, SheetStackProvider } from '../../components/useSheetStack'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import { HOME } from '../../routes'
import type { PricedSale } from '../../sales/pricing'
import type { DraftChoice } from '../../sales/saleDraft'
import { useSaleDraft } from '../../sales/useSaleDraft'
import { METHODS_ANSWER } from '../../test-payment-methods'
import CollectSheet from './CollectSheet'

const PRICING = { rule: 'list' as const, pricePerGram: 1000, lineTotal: 2500, customerTypeId: null }

function pricedOf(total: number, lines = 1, shippingCharged = 500): PricedSale {
  return {
    lines: Array.from({ length: lines }, (_unused, index) => ({
      id: `l${index + 1}`,
      gift: false,
      gramsHundredths: 250,
      pricing: PRICING,
    })),
    totals: { goods: 2500, shippingCharged, total, gramsSoldHundredths: 250 * lines, gramsGiftedHundredths: 0 },
  }
}

interface HostProps {
  priced: PricedSale
  customerId?: number | null
  customerName?: string | null
  proposal?: number | null
  initialChoice?: DraftChoice
  shipping?: string
  note?: string
  onClose?: () => void
  onSaved?: (sale: unknown) => void
  onSavingChange?: (saving: boolean) => void
}

function Host({
  priced,
  customerId = null,
  customerName = null,
  proposal = null,
  initialChoice,
  shipping = '',
  note = '',
  onClose = () => undefined,
  onSaved = () => undefined,
  onSavingChange = () => undefined,
}: HostProps) {
  const draft = useSaleDraft({ today: '2026-10-02', customerId })
  const { proposeMethod, setChoice, addProduct, typeQuantity, setShipping, setNote } = draft
  useEffect(() => {
    proposeMethod(proposal)
    if (initialChoice !== undefined) setChoice(initialChoice)
    addProduct(7)
    typeQuantity(7, '2,5')
    addProduct(8)
    setShipping(shipping)
    setNote(note)
  }, [proposeMethod, setChoice, addProduct, typeQuantity, setShipping, setNote, proposal, initialChoice, shipping, note])
  return (
    <CollectSheet
      draft={draft}
      priced={priced}
      customerName={customerName}
      onClose={onClose}
      onSaved={onSaved}
      onSavingChange={onSavingChange}
      computer={false}
      computerClass="pantalla cobro-modal"
      computerDialog
    />
  )
}

function mount(props: HostProps) {
  const router = createMemoryRouter(
    [
      {
        path: HOME,
        element: (
          <SheetStackProvider>
            <Host {...props} />
          </SheetStackProvider>
        ),
      },
    ],
    { initialEntries: ['/'] },
  )
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MoneyFormatProvider format={{ symbol: '$', decimals: 0 }}>
        <SheetRouterProvider router={router}>
          <RouterProvider router={router} />
        </SheetRouterProvider>
      </MoneyFormatProvider>
    </QueryClientProvider>,
  )
}

interface Sent {
  path: string
  body: unknown
}
let sent: Sent[] = []
let answerSave: ((response: Response) => void) | null = null

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** `POST /sales` answers `reply` at once, or is held (`answerSave`); the methods list arrives or never does. */
function stubFetch({
  reply = json(201, { id: 55, total: 3000 }),
  methods = 'arrived',
}: { reply?: Response | 'held' | 'rejected'; methods?: 'arrived' | 'pending' } = {}): void {
  sent = []
  answerSave = null
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/payment-methods') {
        return methods === 'pending' ? new Promise<Response>(() => undefined) : Promise.resolve(json(200, METHODS_ANSWER))
      }
      if ((init?.method ?? 'GET') !== 'POST') return Promise.reject(new Error(`unexpected request: ${path}`))
      sent.push({ path, body: JSON.parse(String(init?.body)) })
      if (reply === 'held') {
        return new Promise<Response>((resolve) => {
          answerSave = resolve
        })
      }
      if (reply === 'rejected') return Promise.reject(new TypeError('network down'))
      return Promise.resolve(reply)
    }),
  )
}

const field = () => screen.getByRole('button', { name: /^How they pay/ })
const collect = (label: string | RegExp = /^Collect/) => screen.getByRole('button', { name: label })

async function pickMethod(user: ReturnType<typeof userEvent.setup>, name: string): Promise<void> {
  await user.click(await screen.findByRole('button', { name: /^How they pay/ }))
  const option = screen.queryByRole('option', { name }) ?? (await screen.findByRole('button', { name }))
  await user.click(option)
  await waitFor(() => expect(option).not.toBeInTheDocument())
}

async function ready(): Promise<void> {
  await waitFor(() => expect(collect()).toBeEnabled())
}

beforeEach(() => stubFetch())
afterEach(() => vi.unstubAllGlobals())

test('shows the title with the line count, singular for one line', async () => {
  mount({ priced: pricedOf(3000, 3) })
  expect(await screen.findByText('The sale · 3 items')).toBeInTheDocument()
})

test('the title uses the singular for one line', async () => {
  mount({ priced: pricedOf(3000, 1) })
  expect(await screen.findByText('The sale · 1 item')).toBeInTheDocument()
})

test('the customer row shows the name, or No customer without one', async () => {
  const view = mount({ priced: pricedOf(3000), customerId: 4, customerName: 'Ana Paz' })
  expect(await screen.findByText('Ana Paz')).toBeInTheDocument()
  expect(screen.queryByText('No customer')).not.toBeInTheDocument()
  view.unmount()
  mount({ priced: pricedOf(3000) })
  expect(await screen.findByText('No customer')).toBeInTheDocument()
})

test('a customer whose name has not arrived shows no "No customer"', async () => {
  mount({ priced: pricedOf(3000), customerId: 4, customerName: null })
  await ready()
  expect(screen.queryByText('No customer')).not.toBeInTheDocument()
})

test('the proposal, when it is offered, is shown and sent', async () => {
  const user = userEvent.setup()
  mount({ priced: pricedOf(3000), proposal: 2 })
  await ready()
  expect(field()).toHaveTextContent('Transfer')
  await user.click(collect())
  await waitFor(() => expect(sent).toHaveLength(1))
  expect(sent[0]?.body).toMatchObject({ payment: { kind: 'paid', payment_method_id: 2 } })
})

test('a proposal that is not offered gives an empty field', async () => {
  mount({ priced: pricedOf(3000), proposal: 99 })
  await ready()
  expect(field()).toHaveTextContent('Choose a method')
  expect(field()).not.toHaveTextContent('Transfer')
})

test('picking a method sends it', async () => {
  const user = userEvent.setup()
  mount({ priced: pricedOf(3000), proposal: 2 })
  await ready()
  await pickMethod(user, 'Cash')
  await user.click(collect())
  await waitFor(() => expect(sent).toHaveLength(1))
  expect(sent[0]?.body).toMatchObject({ payment: { kind: 'paid', payment_method_id: 1 } })
})

test('a draft already owing shows an empty field and is refused above $0 like no method', async () => {
  const user = userEvent.setup()
  mount({ priced: pricedOf(3000), customerId: 4, customerName: 'Ana', initialChoice: { kind: 'owing' } })
  await ready()
  expect(field()).toHaveTextContent('Choose a method')
  await user.click(collect())
  expect(await screen.findByText('Choose how they pay to collect.')).toBeInTheDocument()
  expect(sent).toHaveLength(0)
})

test('no method above $0 sends nothing, says so with the Attention icon and focuses the field', async () => {
  const user = userEvent.setup()
  mount({ priced: pricedOf(3000) })
  await ready()
  await user.click(collect())
  const refusal = await screen.findByRole('alert')
  expect(refusal).toHaveTextContent('Choose how they pay to collect.')
  expect(refusal.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(sent).toHaveLength(0)
  expect(field()).toHaveFocus()
  expect(field()).toHaveAccessibleDescription('Choose how they pay to collect.')
})

test('a $0 sale with no method saves with payment null', async () => {
  const user = userEvent.setup()
  mount({ priced: pricedOf(0) })
  await ready()
  await user.click(collect())
  await waitFor(() => expect(sent).toHaveLength(1))
  expect(sent[0]?.body).toMatchObject({ payment: null })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a $0 sale with a chosen method sends it', async () => {
  const user = userEvent.setup()
  mount({ priced: pricedOf(0) })
  await ready()
  await pickMethod(user, 'Cash')
  await user.click(collect())
  await waitFor(() => expect(sent).toHaveLength(1))
  expect(sent[0]?.body).toMatchObject({ payment: { kind: 'paid', payment_method_id: 1 } })
})

test('while the methods list is pending, Collect is disabled and keeps its label', async () => {
  stubFetch({ methods: 'pending' })
  mount({ priced: pricedOf(3000) })
  expect(await screen.findByRole('button', { name: 'Collect $ 3.000' })).toBeDisabled()
})

test('the payload: shipping from priced, a blank note null, the lines as quantities', async () => {
  const user = userEvent.setup()
  mount({ priced: pricedOf(3000, 2, 500), customerId: 4, proposal: 1, shipping: '300', note: '   ' })
  await ready()
  await user.click(collect())
  await waitFor(() => expect(sent).toHaveLength(1))
  expect(sent[0]).toEqual({
    path: '/sales',
    body: {
      date: '2026-10-02',
      customer_id: 4,
      shipping_charged: 500,
      note: null,
      payment: { kind: 'paid', payment_method_id: 1 },
      lines: [
        { product_id: 7, quantity: '2.5', gift: false, special_price: null },
        { product_id: 8, quantity: '1', gift: false, special_price: null },
      ],
    },
  })
})

test('the payload sends the typed note as typed and shipping from priced when the draft has none', async () => {
  const user = userEvent.setup()
  mount({ priced: pricedOf(3000, 2, 500), proposal: 1, shipping: '', note: 'Leave at the door' })
  await ready()
  await user.click(collect())
  await waitFor(() => expect(sent).toHaveLength(1))
  expect(sent[0]?.body).toMatchObject({ shipping_charged: 500, note: 'Leave at the door', customer_id: null })
})

test('the label shows the total of priced even when it does not match its lines', async () => {
  mount({ priced: pricedOf(7777, 1) })
  expect(await screen.findByRole('button', { name: 'Collect $ 7.777' })).toBeInTheDocument()
})

test('while saving it says Saving…, takes no second request, and Close does nothing', async () => {
  stubFetch({ reply: 'held' })
  const user = userEvent.setup()
  const onClose = vi.fn()
  const onSavingChange = vi.fn()
  mount({ priced: pricedOf(3000), proposal: 1, onClose, onSavingChange })
  await ready()
  await act(async () => {
    collect().click()
    collect().click()
  })
  expect(await screen.findByRole('button', { name: 'Saving…' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Saving…' }))
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(sent).toHaveLength(1)
  expect(onClose).not.toHaveBeenCalled()
  expect(screen.getByText('The sale · 1 item')).toBeInTheDocument()
  expect(onSavingChange.mock.calls).toEqual([[true]])
  await act(async () => answerSave?.(json(201, { id: 55 })))
  await waitFor(() => expect(onSavingChange.mock.calls).toEqual([[true], [false]]))
})

test('onSaved receives the response untouched, after onSavingChange(false)', async () => {
  const order: string[] = []
  const user = userEvent.setup()
  const response = { id: 55, total: 1234, extra: { kept: true } }
  stubFetch({ reply: json(201, response) })
  mount({
    priced: pricedOf(3000),
    proposal: 1,
    onSavingChange: (saving) => order.push(`saving:${saving}`),
    onSaved: (sale) => order.push(`saved:${JSON.stringify(sale)}`),
  })
  await ready()
  await user.click(collect())
  await waitFor(() => expect(order).toHaveLength(3))
  expect(order).toEqual(['saving:true', 'saving:false', `saved:${JSON.stringify(response)}`])
})

test('a rejected request ends the saving, shows no text and lets Close work again', async () => {
  stubFetch({ reply: 'rejected' })
  const user = userEvent.setup()
  const onClose = vi.fn()
  const onSavingChange = vi.fn()
  mount({ priced: pricedOf(3000), proposal: 1, onClose, onSavingChange })
  await ready()
  await user.click(collect())
  await waitFor(() => expect(onSavingChange.mock.calls).toEqual([[true], [false]]))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(collect('Collect $ 3.000')).toBeEnabled()
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('with an unpriced line a tap does nothing: no request, no Saving…, no text, no onSavingChange', async () => {
  const user = userEvent.setup()
  const onSavingChange = vi.fn()
  const priced = pricedOf(3000, 2)
  priced.lines[1] = { id: 'l2', gift: false, gramsHundredths: 100, pricing: null }
  mount({ priced, proposal: 1, onSavingChange })
  await ready()
  await user.click(collect())
  expect(sent).toHaveLength(0)
  expect(screen.queryByRole('button', { name: 'Saving…' })).not.toBeInTheDocument()
  expect(onSavingChange).not.toHaveBeenCalled()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('an unpriced line with no method above $0 still shows no text', async () => {
  const user = userEvent.setup()
  const priced = pricedOf(3000, 1)
  priced.lines[0] = { id: 'l1', gift: false, gramsHundredths: 100, pricing: null }
  mount({ priced })
  await ready()
  await user.click(collect())
  expect(sent).toHaveLength(0)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByText('Choose how they pay to collect.')).not.toBeInTheDocument()
})
