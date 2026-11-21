/**
 * `CollectSheet` (the closing step of New sale, unrouted) at its component seam: Testing Library
 * with `fetch` faked. The test host mounts it in a memory router with `SheetRouterProvider` and
 * `SheetStackProvider`, as `SelectorTestHost` does, and drives the Sale in progress through
 * `useSaleDraft`, the way the flip part's host will.
 */

import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SheetRouterProvider, SheetStackProvider } from '../../components/useSheetStack'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import { HOME } from '../../routes'
import type { PricedSale } from '../../sales/pricing'
import type { DraftChoice } from '../../sales/saleDraft'
import { type SaleDraftApi, useSaleDraft } from '../../sales/useSaleDraft'
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

/** The draft the host drives, the way the flip part's host will (the Sheet's Customer row is read-only). */
let driven: SaleDraftApi | null = null

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
  useEffect(() => {
    driven = draft
  }, [draft])
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
    { initialEntries: [HOME] },
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
  body: unknown
}
let sent: Sent[] = []
let methodReads = 0
let answerSave: ((response: Response) => void) | null = null

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

type Reply = 'held' | 'rejected' | (() => Response)

/**
 * `POST /sales` answers `reply` at once, or is held (`answerSave`); `replies` are taken in order
 * first. The methods list arrives, never does, fails with a 500, rejects, or arrives once and then
 * fails on every later read.
 */
function stubFetch({
  reply = () => json(201, { id: 55, total: 3000 }),
  replies = [],
  methods = 'arrived',
}: {
  reply?: Reply | Response
  replies?: Reply[]
  methods?: 'arrived' | 'pending' | 'error' | 'rejected' | 'then-error'
} = {}): void {
  sent = []
  methodReads = 0
  answerSave = null
  const queue = [...replies]
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/payment-methods') {
        methodReads += 1
        if (methods === 'pending') return new Promise<Response>(() => undefined)
        if (methods === 'error' || (methods === 'then-error' && methodReads > 1)) {
          return Promise.resolve(json(500, { detail: 'secret server words' }))
        }
        if (methods === 'rejected') return Promise.reject(new TypeError('network down'))
        return Promise.resolve(json(200, METHODS_ANSWER))
      }
      if ((init?.method ?? 'GET') !== 'POST' || path !== '/sales') return Promise.reject(new Error(`unexpected request: ${path}`))
      sent.push({ body: JSON.parse(String(init?.body)) })
      const next = queue.shift() ?? reply
      if (next === 'held') {
        return new Promise<Response>((resolve) => {
          answerSave = resolve
        })
      }
      if (next === 'rejected') return Promise.reject(new TypeError('network down'))
      return Promise.resolve(typeof next === 'function' ? next() : next)
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

/** Lets any later request arrive, then asserts how many saves were sent: a duplicate cannot slip in after the count. */
async function expectPosts(count: number): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50))
  })
  expect(sent).toHaveLength(count)
}

async function ready(): Promise<void> {
  await waitFor(() => expect(collect()).toBeEnabled())
}

beforeEach(() => stubFetch())
afterEach(() => {
  driven = null
  vi.unstubAllGlobals()
  onlineManager.setOnline(true)
})

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

const NOT_SAVED = 'The sale was not saved. Your lines are kept, so try again.'
const NO_METHOD = 'Choose how they pay to collect.'

test.each([
  ['a 500', { methods: 'error' as const }, false],
  ['a rejected fetch', { methods: 'rejected' as const }, false],
  ['a read paused while offline', { methods: 'arrived' as const }, true],
])('methods list failed (%s): Collect stays enabled, $0 saves with payment null', async (_name, stub, offline) => {
  stubFetch(stub)
  if (offline) onlineManager.setOnline(false)
  const user = userEvent.setup()
  mount({ priced: pricedOf(0) })
  expect(await screen.findByRole('button', { name: 'Collect $ 0' })).toBeEnabled()
  await user.click(collect())
  await waitFor(() => expect(sent).toHaveLength(1))
  await expectPosts(1)
  expect(sent[0]?.body).toMatchObject({ payment: null })
})

test.each([
  ['a 500', { methods: 'error' as const }, false],
  ['a rejected fetch', { methods: 'rejected' as const }, false],
  ['a read paused while offline', { methods: 'arrived' as const }, true],
])('methods list failed (%s): above $0 the no-method text shows, nothing is sent, focus goes to the Selector', async (_name, stub, offline) => {
  stubFetch(stub)
  if (offline) onlineManager.setOnline(false)
  const user = userEvent.setup()
  mount({ priced: pricedOf(3000) })
  await waitFor(() => expect(collect()).toBeEnabled())
  await user.click(collect())
  const refusal = await screen.findByRole('alert')
  expect(refusal).toHaveTextContent(NO_METHOD)
  expect(refusal.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(sent).toHaveLength(0)
  const group = screen.getByRole('group', { name: /^How they pay/ })
  expect(group.contains(document.activeElement)).toBe(true)
})

test('a methods read that never resolves while online does not block a $0 sale', async () => {
  stubFetch({ methods: 'pending' })
  const user = userEvent.setup()
  mount({ priced: pricedOf(0) })
  const button = await screen.findByRole('button', { name: 'Collect $ 0' })
  expect(button).toBeEnabled()
  await user.click(button)
  await waitFor(() => expect(sent).toHaveLength(1))
  await expectPosts(1)
  expect(sent[0]?.body).toMatchObject({ payment: null })
})

test('a 401 on save shows no Sheet text, releases the Sheet and lets Close work', async () => {
  stubFetch({ reply: () => json(401, { code: 'auth.session_expired' }) })
  const user = userEvent.setup()
  const onClose = vi.fn()
  const onSavingChange = vi.fn()
  mount({ priced: pricedOf(3000), proposal: 1, onClose, onSavingChange })
  await ready()
  await user.click(collect())
  await waitFor(() => expect(onSavingChange).toHaveBeenLastCalledWith(false))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByText(NOT_SAVED)).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(sent).toHaveLength(1)
})

test.each([
  ['a 500 with words of its own', () => json(500, { detail: 'secret server words' })],
  ['a refusal that is not the method', () => json(422, { code: 'sale.rule_broken', detail: 'secret server words' })],
  ['a network failure', 'rejected' as const],
  ['a malformed response', () => new Response('<html>', { status: 201, headers: { 'Content-Type': 'application/json' } })],
])('a failed save (%s) says it was not saved, keeps everything, and a retry is one more request', async (_name, failure) => {
  stubFetch({ replies: [failure, 'held'] })
  const user = userEvent.setup()
  const onClose = vi.fn()
  const onSavingChange = vi.fn()
  mount({ priced: pricedOf(3000), proposal: 2, onClose, onSavingChange })
  await ready()
  await user.click(collect())
  const notice = await screen.findByRole('alert')
  expect(notice).toHaveTextContent(NOT_SAVED)
  expect(notice.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.queryByText(/secret server words/)).not.toBeInTheDocument()
  expect(onSavingChange.mock.calls).toEqual([[true], [false]])
  expect(field()).toHaveTextContent('Transfer')
  expect(collect('Collect $ 3.000')).toBeEnabled()
  expect(collect('Collect $ 3.000')).toHaveFocus()
  expect(sent).toHaveLength(1)

  await user.click(collect())
  expect(await screen.findByRole('button', { name: 'Saving…' })).toBeInTheDocument()
  expect(screen.queryByText(NOT_SAVED)).not.toBeInTheDocument()
  expect(sent).toHaveLength(2)
  expect(sent[1]).toEqual(sent[0])
  await act(async () => answerSave?.(json(201, { id: 55 })))
  await waitFor(() => expect(onSavingChange).toHaveBeenLastCalledWith(false))
  await expectPosts(2)

  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('after a failed save, Close works again', async () => {
  stubFetch({ reply: () => json(500, {}) })
  const user = userEvent.setup()
  const onClose = vi.fn()
  mount({ priced: pricedOf(3000), proposal: 1, onClose })
  await ready()
  await user.click(collect())
  await screen.findByText(NOT_SAVED)
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalledTimes(1)
  await expectPosts(1)
})

test('a save that fails while offline rejects instead of pausing', async () => {
  stubFetch({ reply: 'rejected' })
  const user = userEvent.setup()
  const onSavingChange = vi.fn()
  mount({ priced: pricedOf(3000), proposal: 1, onSavingChange })
  await ready()
  onlineManager.setOnline(false)
  await user.click(collect())
  expect(await screen.findByText(NOT_SAVED)).toBeInTheDocument()
  expect(onSavingChange.mock.calls).toEqual([[true], [false]])
})

test('picking another method clears the not-saved text', async () => {
  stubFetch({ reply: () => json(500, {}) })
  const user = userEvent.setup()
  mount({ priced: pricedOf(3000), proposal: 1 })
  await ready()
  await user.click(collect())
  await screen.findByText(NOT_SAVED)
  await pickMethod(user, 'Transfer')
  expect(screen.queryByText(NOT_SAVED)).not.toBeInTheDocument()
})

test('the method-archived refusal marks the method, reads the list again and sends nothing more above $0', async () => {
  stubFetch({ methods: 'then-error', reply: () => json(404, { code: 'payment_method.unavailable' }) })
  const user = userEvent.setup()
  const onSavingChange = vi.fn()
  mount({ priced: pricedOf(3000), proposal: 1, onSavingChange })
  await ready()
  expect(methodReads).toBe(1)
  await user.click(collect())
  expect(await screen.findByText('no longer available')).toBeInTheDocument()
  expect(field()).toHaveTextContent('Cash')
  expect(screen.queryByText(NOT_SAVED)).not.toBeInTheDocument()
  await waitFor(() => expect(methodReads).toBeGreaterThan(1))
  expect(onSavingChange).toHaveBeenLastCalledWith(false)
  expect(collect('Collect $ 3.000')).toHaveFocus()

  await user.click(field())
  expect(screen.queryByRole('option', { name: 'Cash' })).not.toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Transfer' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Cash' })).not.toBeInTheDocument()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Transfer' })).not.toBeInTheDocument())
  await user.click(collect('Collect $ 3.000'))
  expect(await screen.findByText(NO_METHOD)).toBeInTheDocument()
  expect(sent).toHaveLength(1)
})

test('at $0 the next Collect after a method refusal saves with payment null', async () => {
  stubFetch({
    methods: 'then-error',
    replies: [() => json(404, { code: 'payment_method.unavailable' })],
  })
  const user = userEvent.setup()
  mount({ priced: pricedOf(0), proposal: 1 })
  await ready()
  await user.click(collect())
  expect(await screen.findByText('no longer available')).toBeInTheDocument()
  await user.click(collect())
  await waitFor(() => expect(sent).toHaveLength(2))
  expect(sent[1]?.body).toMatchObject({ payment: null })
})

test('picking a different method after a refusal clears the mark and sends it', async () => {
  stubFetch({ replies: [() => json(404, { code: 'payment_method.unavailable' })] })
  const user = userEvent.setup()
  mount({ priced: pricedOf(3000), proposal: 1 })
  await ready()
  await user.click(collect())
  await screen.findByText('no longer available')
  await pickMethod(user, 'Transfer')
  expect(screen.queryByText('no longer available')).not.toBeInTheDocument()
  await user.click(collect())
  await waitFor(() => expect(sent).toHaveLength(2))
  expect(sent[1]?.body).toMatchObject({ payment: { kind: 'paid', payment_method_id: 2 } })
})

test('a refused method is never offered or sent again, even when the list is not read again, and after a second refusal', async () => {
  stubFetch({
    methods: 'then-error',
    replies: [() => json(404, { code: 'payment_method.unavailable' }), () => json(404, { code: 'payment_method.unavailable' })],
  })
  const user = userEvent.setup()
  mount({ priced: pricedOf(3000), proposal: 1 })
  await ready()
  await user.click(collect())
  await screen.findByText('no longer available')
  await waitFor(() => expect(methodReads).toBeGreaterThan(1))

  await pickMethod(user, 'Transfer')
  expect(screen.queryByText('no longer available')).not.toBeInTheDocument()
  await user.click(field())
  expect(screen.queryByText('Cash')).not.toBeInTheDocument()
  // The field and the open list both read Transfer.
  await waitFor(() => expect(screen.getAllByText('Transfer').length).toBeGreaterThan(1))
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.getAllByText('Transfer')).toHaveLength(1))

  await user.click(collect())
  await waitFor(() => expect(sent).toHaveLength(2))
  expect(sent[1]?.body).toMatchObject({ payment: { kind: 'paid', payment_method_id: 2 } })
  expect(await screen.findByText('no longer available')).toBeInTheDocument()

  await user.click(field())
  expect(screen.queryByText('Cash')).not.toBeInTheDocument()
  // Only the field's own mark names Transfer: no list row offers it.
  expect(screen.getAllByText('Transfer')).toHaveLength(1)
  await user.keyboard('{Escape}')
  await user.click(collect('Collect $ 3.000'))
  expect(await screen.findByText(NO_METHOD)).toBeInTheDocument()
  await expectPosts(2)
  expect(sent[0]?.body).toMatchObject({ payment: { payment_method_id: 1 } })
  expect(sent[1]?.body).toMatchObject({ payment: { payment_method_id: 2 } })
})

test('a successful save after a failure clears the not-saved text', async () => {
  stubFetch({ replies: [() => json(500, {}), () => json(201, { id: 55 })] })
  const user = userEvent.setup()
  const onSaved = vi.fn()
  mount({ priced: pricedOf(3000), proposal: 1, onSaved })
  await ready()
  await user.click(collect())
  await screen.findByText(NOT_SAVED)
  await user.click(collect())
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  expect(screen.queryByText(NOT_SAVED)).not.toBeInTheDocument()
  await expectPosts(2)
})

const OWING_HINT = 'To leave it owing, pick a customer'

function drive(action: (draft: SaleDraftApi) => void): void {
  act(() => {
    if (driven === null) throw new Error('the host is not mounted')
    action(driven)
  })
}

test('Owes it is offered only with a Customer, last in the list, and sends the owing choice', async () => {
  const user = userEvent.setup()
  mount({ priced: pricedOf(3000), customerId: 4, customerName: 'Ana' })
  await ready()
  await user.click(field())
  const list = (await screen.findByRole('button', { name: 'Cash' })).parentElement
  const names = within(list as HTMLElement)
    .getAllByRole('button')
    .map((row) => row.textContent)
  expect(names).toEqual(['Cash', 'Transfer', 'Owes it'])
  await user.click(screen.getByRole('button', { name: 'Owes it' }))
  await waitFor(() => expect(field()).toHaveTextContent('Owes it'))
  await user.click(collect())
  await waitFor(() => expect(sent).toHaveLength(1))
  expect(sent[0]?.body).toMatchObject({ customer_id: 4, payment: { kind: 'owing' } })
})

test('without a Customer Owes it is not offered', async () => {
  const user = userEvent.setup()
  mount({ priced: pricedOf(3000) })
  await ready()
  await user.click(field())
  await screen.findByRole('button', { name: 'Cash' })
  expect(screen.queryByRole('button', { name: 'Owes it' })).not.toBeInTheDocument()
})

test('pick B, then Owes it, then back to unset: the field shows the proposal, not B, and Collect sends it', async () => {
  const user = userEvent.setup()
  mount({ priced: pricedOf(3000), customerId: 4, customerName: 'Ana', proposal: 2 })
  await ready()
  await pickMethod(user, 'Cash')
  await pickMethod(user, 'Owes it')
  expect(field()).toHaveTextContent('Owes it')
  // The Selector is required and has no clearing row: unset is reached through the draft.
  drive((draft) => draft.setChoice({ kind: 'unset' }))
  await waitFor(() => expect(field()).toHaveTextContent('Transfer'))
  expect(field()).not.toHaveTextContent('Cash')
  await user.click(collect())
  await waitFor(() => expect(sent).toHaveLength(1))
  expect(sent[0]?.body).toMatchObject({ payment: { kind: 'paid', payment_method_id: 2 } })
})

test('Owes it, then a method, sends that method', async () => {
  const user = userEvent.setup()
  mount({ priced: pricedOf(3000), customerId: 4, customerName: 'Ana' })
  await ready()
  await pickMethod(user, 'Owes it')
  await pickMethod(user, 'Cash')
  await user.click(collect())
  await waitFor(() => expect(sent).toHaveLength(1))
  expect(sent[0]?.body).toMatchObject({ payment: { kind: 'paid', payment_method_id: 1 } })
})

test('a draft that arrives owing with a Customer shows Owes it and saves', async () => {
  const user = userEvent.setup()
  mount({ priced: pricedOf(3000), customerId: 4, customerName: 'Ana', initialChoice: { kind: 'owing' } })
  await ready()
  expect(field()).toHaveTextContent('Owes it')
  await user.click(collect())
  await waitFor(() => expect(sent).toHaveLength(1))
  expect(sent[0]?.body).toMatchObject({ payment: { kind: 'owing' } })
})

test('owing with the Customer cleared: marked, refused with 0 requests, focused; put back it saves; cleared again it is quiet', async () => {
  const user = userEvent.setup()
  mount({ priced: pricedOf(3000), customerId: 4, customerName: 'Ana', initialChoice: { kind: 'owing' } })
  await ready()
  drive((draft) => draft.removeCustomer())
  expect(await screen.findByText('no longer available')).toBeInTheDocument()
  expect(field()).toHaveTextContent('Owes it')
  await user.click(collect())
  const refusal = await screen.findByRole('alert')
  expect(refusal).toHaveTextContent(OWING_HINT)
  expect(field()).toHaveFocus()
  expect(field()).toHaveAccessibleDescription(OWING_HINT)
  expect(sent).toHaveLength(0)

  drive((draft) => draft.chooseCustomer(4))
  await waitFor(() => expect(screen.queryByText(OWING_HINT)).not.toBeInTheDocument())
  expect(screen.queryByText('no longer available')).not.toBeInTheDocument()

  drive((draft) => draft.removeCustomer())
  expect(screen.queryByText(OWING_HINT)).not.toBeInTheDocument()

  drive((draft) => draft.chooseCustomer(4))
  await user.click(collect())
  await waitFor(() => expect(sent).toHaveLength(1))
  expect(sent[0]?.body).toMatchObject({ customer_id: 4, payment: { kind: 'owing' } })
})

test('two refusals in a row: the method line goes when owing arrives with no Customer, and the field points at the line shown', async () => {
  const user = userEvent.setup()
  mount({ priced: pricedOf(3000) })
  await ready()
  await user.click(collect())
  expect(await screen.findByText(NO_METHOD)).toBeInTheDocument()
  expect(field()).toHaveAccessibleDescription(NO_METHOD)

  drive((draft) => draft.setChoice({ kind: 'owing' }))
  await waitFor(() => expect(screen.queryByText(NO_METHOD)).not.toBeInTheDocument())
  expect(field()).not.toHaveAccessibleDescription(NO_METHOD)

  await user.click(collect())
  expect(await screen.findByText(OWING_HINT)).toBeInTheDocument()
  expect(field()).toHaveAccessibleDescription(OWING_HINT)
  expect(sent).toHaveLength(0)
})

test('methods list failed with a Customer: Owes it is offered, the failure line shows and Collect with it saves', async () => {
  stubFetch({ methods: 'error' })
  const user = userEvent.setup()
  mount({ priced: pricedOf(3000), customerId: 4, customerName: 'Ana' })
  const failure = await screen.findByRole('alert')
  expect(failure).toHaveTextContent('Could not load the payment methods. Tap to try again.')
  expect(field()).toHaveAccessibleDescription('Could not load the payment methods. Tap to try again.')
  await user.click(field())
  await user.click(await screen.findByRole('button', { name: 'Owes it' }))
  await user.click(collect())
  await waitFor(() => expect(sent).toHaveLength(1))
  expect(sent[0]?.body).toMatchObject({ payment: { kind: 'owing' } })
})

test('methods request held: neither empty wording shows; answered with [] the no-methods text is help, not a refusal', async () => {
  let release: ((response: Response) => void) | null = null
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) => {
      if (path === '/api/payment-methods') {
        return new Promise<Response>((resolve) => {
          release = resolve
        })
      }
      return Promise.reject(new Error(`unexpected request: ${path}`))
    }),
  )
  mount({ priced: pricedOf(3000), customerId: 4, customerName: 'Ana' })
  await screen.findByRole('button', { name: /^How they pay/ })
  expect(screen.queryByText(/No payment methods yet/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Could not load the payment methods/)).not.toBeInTheDocument()
  await act(async () => release?.(json(200, [])))
  expect(await screen.findByText(/No payment methods yet/)).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('with no Customer and an empty list the Sheet adds no empty-list line of its own', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) =>
      path === '/api/payment-methods' ? Promise.resolve(json(200, [])) : Promise.reject(new Error(path)),
    ),
  )
  mount({ priced: pricedOf(3000) })
  await waitFor(() => expect(collect()).toBeEnabled())
  expect(screen.queryByText(/No payment methods yet/)).not.toBeInTheDocument()
})

test('only method A, refused by the server, the list read again still holding A: the unavailable line shows with no empty-list text, and Owes it clears it', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/payment-methods') return Promise.resolve(json(200, [METHODS_ANSWER[0]]))
      if (init?.method === 'POST' && path === '/sales') {
        sent.push({ body: JSON.parse(String(init.body)) })
        return Promise.resolve(
          sent.length === 1 ? json(404, { code: 'payment_method.unavailable' }) : json(201, { id: 55 }),
        )
      }
      return Promise.reject(new Error(path))
    }),
  )
  sent = []
  const user = userEvent.setup()
  mount({ priced: pricedOf(3000), customerId: 4, customerName: 'Ana', proposal: 1 })
  await ready()
  await user.click(collect())
  expect(await screen.findByText('no longer available')).toBeInTheDocument()
  await waitFor(() => expect(screen.getAllByText('Cash').length).toBeGreaterThan(0))
  expect(screen.queryByText(/No payment methods yet/)).not.toBeInTheDocument()

  await pickMethod(user, 'Owes it')
  expect(screen.queryByText('no longer available')).not.toBeInTheDocument()
  expect(screen.queryByText(/No payment methods yet/)).not.toBeInTheDocument()
  await user.click(collect())
  await waitFor(() => expect(sent).toHaveLength(2))
  expect(sent[1]?.body).toMatchObject({ payment: { kind: 'owing' } })
})
