/**
 * The Collect Sheet's Received/Change helper, its Total row and the Collect label fallback, at the
 * component seam (Testing Library, `fetch` faked, the same mounting as `CollectSheet.test.tsx`) and
 * at the request-body seam (the one `POST /sales` body captured at fetch). Owing is reached through
 * the draft, since the "Owes it" option arrives with GH-944.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SheetRouterProvider, SheetStackProvider } from '../../components/useSheetStack'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import { HOME } from '../../routes'
import type { PricedSale } from '../../sales/pricing'
import { bodyLinesOf, saleBodyOf } from '../../sales/saleBody'
import type { DraftChoice } from '../../sales/saleDraft'
import { type SaleDraftApi, useSaleDraft } from '../../sales/useSaleDraft'
import { METHODS_ANSWER } from '../../test-payment-methods'
import CollectSheet from './CollectSheet'

const PRICING = { rule: 'list' as const, pricePerGram: 1000, lineTotal: 2500, customerTypeId: null }

function pricedOf(total: number, shippingCharged = 500): PricedSale {
  return {
    lines: [{ id: 'l1', gift: false, gramsHundredths: 250, pricing: PRICING }],
    totals: { goods: 2500, shippingCharged, total, gramsSoldHundredths: 250, gramsGiftedHundredths: 0 },
  }
}

interface HostProps {
  priced: PricedSale
  decimals?: number
  proposal?: number | null
  initialChoice?: DraftChoice
  onDraft?: (draft: SaleDraftApi) => void
}

function Host({ priced, proposal = null, initialChoice, onDraft }: Omit<HostProps, 'decimals'>) {
  const draft = useSaleDraft({ today: '2026-10-02', customerId: 4 })
  const { proposeMethod, setChoice, addProduct, typeQuantity, setShipping, setNote } = draft
  useEffect(() => {
    proposeMethod(proposal)
    if (initialChoice !== undefined) setChoice(initialChoice)
    addProduct(7)
    typeQuantity(7, '2,5')
    setShipping('')
    setNote('')
  }, [proposeMethod, setChoice, addProduct, typeQuantity, setShipping, setNote, proposal, initialChoice])
  useEffect(() => {
    onDraft?.(draft)
  }, [onDraft, draft])
  return (
    <CollectSheet
      draft={draft}
      priced={priced}
      customerName="Ana Paz"
      onClose={() => undefined}
      onSaved={() => undefined}
      onSavingChange={() => undefined}
      computer={false}
      computerClass="pantalla cobro-modal"
      computerDialog
    />
  )
}

function mount({ decimals = 0, ...props }: HostProps) {
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
      <MoneyFormatProvider format={{ symbol: '$', decimals }}>
        <SheetRouterProvider router={router}>
          <RouterProvider router={router} />
        </SheetRouterProvider>
      </MoneyFormatProvider>
    </QueryClientProvider>,
  )
}

let sent: unknown[] = []

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function stubFetch(reply: 'accepted' | 'rejected' = 'accepted'): void {
  sent = []
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/payment-methods') return Promise.resolve(json(200, METHODS_ANSWER))
      if ((init?.method ?? 'GET') !== 'POST' || path !== '/sales') return Promise.reject(new Error(`unexpected request: ${path}`))
      sent.push(JSON.parse(String(init?.body)))
      if (reply === 'rejected') return Promise.reject(new TypeError('network down'))
      return Promise.resolve(json(201, { id: 55 }))
    }),
  )
}

const received = () => screen.getByRole('textbox', { name: 'Received' })
const change = () => screen.getByRole('status')
const collect = (label: string | RegExp = /^Collect/) => screen.getByRole('button', { name: label })

async function ready(): Promise<void> {
  await waitFor(() => expect(collect()).toBeEnabled())
}

async function pickMethod(user: ReturnType<typeof userEvent.setup>, name: string): Promise<void> {
  await user.click(await screen.findByRole('button', { name: /^How they pay/ }))
  const option = screen.queryByRole('option', { name }) ?? (await screen.findByRole('button', { name }))
  await user.click(option)
  await waitFor(() => expect(option).not.toBeInTheDocument())
}

beforeEach(() => stubFetch())
afterEach(() => vi.unstubAllGlobals())

describe('the Received/Change helper', () => {
  test('Received starts empty, is labelled, has its help line and shows no Change', async () => {
    mount({ priced: pricedOf(3000) })
    await ready()
    expect(received()).toHaveValue('')
    expect(received()).toHaveAttribute('autocomplete', 'off')
    expect(received()).toHaveAccessibleDescription("Type what they hand over to see the change. It isn't saved.")
    expect(change()).toBeEmptyDOMElement()
  })

  test.each(['', '2999', '0', 'abc', '12x', '3.5.5', '-3000'])('Received %j shows no Change, no alert', async (text) => {
    const user = userEvent.setup()
    mount({ priced: pricedOf(3000) })
    await ready()
    if (text !== '') await user.type(received(), text)
    expect(change()).toBeEmptyDOMElement()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/owed/i)).not.toBeInTheDocument()
  })

  test('Received equal to the total shows Change 0, and a larger one the difference', async () => {
    const user = userEvent.setup()
    mount({ priced: pricedOf(3000) })
    await ready()
    await user.type(received(), '3000')
    expect(change()).toHaveTextContent('Change $ 0')
    await user.clear(received())
    await user.type(received(), '3500')
    expect(change()).toHaveTextContent('Change $ 500')
    await user.clear(received())
    await user.type(received(), '2999')
    expect(change()).toBeEmptyDOMElement()
  })

  test('at 2 decimals the keyboard is decimal and the difference is exact', async () => {
    const user = userEvent.setup()
    mount({ priced: pricedOf(30.1), decimals: 2 })
    await ready()
    expect(received()).toHaveAttribute('inputmode', 'decimal')
    await user.type(received(), '30,10')
    expect(change()).toHaveTextContent('Change $ 0,00')
    await user.clear(received())
    await user.type(received(), '50,3')
    expect(change()).toHaveTextContent('Change $ 20,20')
  })

  test('at 0 decimals the keyboard is numeric', async () => {
    mount({ priced: pricedOf(3000) })
    await ready()
    expect(received()).toHaveAttribute('inputmode', 'numeric')
  })

  test('a $0 sale shows the helper: Received 0 gives Change 0 and any amount is all change', async () => {
    const user = userEvent.setup()
    mount({ priced: pricedOf(0) })
    await ready()
    await user.type(received(), '0')
    expect(change()).toHaveTextContent('Change $ 0')
    await user.clear(received())
    await user.type(received(), '5')
    expect(change()).toHaveTextContent('Change $ 5')
  })

  test('Received 0 shows no Change on a sale above $0', async () => {
    const user = userEvent.setup()
    mount({ priced: pricedOf(3000) })
    await ready()
    await user.type(received(), '0')
    expect(change()).toBeEmptyDOMElement()
  })

  test('the helper shows for any chosen method and is gone only while owing', async () => {
    const user = userEvent.setup()
    const held: { draft: SaleDraftApi | null } = { draft: null }
    mount({ priced: pricedOf(3000), onDraft: (api) => (held.draft = api) })
    await ready()
    await pickMethod(user, 'Cash')
    expect(received()).toBeInTheDocument()
    await pickMethod(user, 'Transfer')
    expect(received()).toBeInTheDocument()
    act(() => held.draft?.setChoice({ kind: 'owing' }))
    expect(screen.queryByRole('textbox', { name: 'Received' })).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText(/Type what they hand over/)).not.toBeInTheDocument()
  })

  test('a draft that already owes starts with the helper hidden', async () => {
    mount({ priced: pricedOf(3000), initialChoice: { kind: 'owing' } })
    await ready()
    expect(screen.queryByRole('textbox', { name: 'Received' })).not.toBeInTheDocument()
    expect(screen.queryByText('Change')).not.toBeInTheDocument()
  })

  test('what was typed is kept across a method change and across owing and back', async () => {
    const user = userEvent.setup()
    const held: { draft: SaleDraftApi | null } = { draft: null }
    mount({ priced: pricedOf(3000), onDraft: (api) => (held.draft = api) })
    await ready()
    await user.type(received(), '3500')
    await pickMethod(user, 'Cash')
    expect(received()).toHaveValue('3500')
    await pickMethod(user, 'Transfer')
    expect(received()).toHaveValue('3500')
    act(() => held.draft?.setChoice({ kind: 'owing' }))
    expect(screen.queryByRole('textbox', { name: 'Received' })).not.toBeInTheDocument()
    act(() => held.draft?.setChoice({ kind: 'paid', payment_method_id: 1 }))
    expect(received()).toHaveValue('3500')
    expect(change()).toHaveTextContent('Change $ 500')
  })

  test('what was typed is kept after a failed save', async () => {
    stubFetch('rejected')
    const user = userEvent.setup()
    mount({ priced: pricedOf(3000), proposal: 1 })
    await ready()
    await user.type(received(), '3500')
    await user.click(collect())
    await waitFor(() => expect(sent).toHaveLength(1))
    await waitFor(() => expect(collect('Collect $ 3.000')).toBeEnabled())
    expect(received()).toHaveValue('3500')
    expect(change()).toHaveTextContent('Change $ 500')
  })
})

describe('the request body', () => {
  test('is the one saleBodyOf builds, with no Received or Change in it', async () => {
    const user = userEvent.setup()
    const held: { draft: SaleDraftApi | null } = { draft: null }
    const priced = pricedOf(3000)
    mount({ priced, proposal: 1, onDraft: (api) => (held.draft = api) })
    await ready()
    await user.type(received(), '3500')
    expect(change()).toHaveTextContent('Change $ 500')
    await user.click(collect())
    await waitFor(() => expect(sent).toHaveLength(1))
    const state = held.draft?.state
    if (state === undefined) throw new Error('the draft was not captured')
    expect(sent[0]).toEqual(
      JSON.parse(
        JSON.stringify(
          saleBodyOf({
            date: state.date,
            customerId: state.customerId,
            shippingCharged: priced.totals.shippingCharged,
            note: state.note,
            payment: { kind: 'paid', payment_method_id: 1 },
            lines: bodyLinesOf(state.lines),
          }),
        ),
      ),
    )
    const text = JSON.stringify(sent[0]).toLowerCase()
    expect(text).not.toContain('received')
    expect(text).not.toContain('change')
    expect(text).not.toContain('3500')
  })
})

describe('the Total row and the Collect label fallback', () => {
  type Callback = () => void
  let callbacks: Callback[] = []

  beforeEach(() => {
    callbacks = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: Callback) {
          callbacks.push(callback)
        }
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    )
  })

  function labelOf(): HTMLElement {
    const label = screen.getByText('Collect $ 3.000').parentElement
    if (label === null) throw new Error('the label has no element around its text')
    return label
  }

  function measure(label: HTMLElement, scrollWidth: number, clientWidth: number): void {
    Object.defineProperty(label, 'scrollWidth', { configurable: true, value: scrollWidth })
    Object.defineProperty(label, 'clientWidth', { configurable: true, value: clientWidth })
    act(() => callbacks.forEach((callback) => callback()))
  }

  test('the Total row shows the total above How they pay at every width', async () => {
    mount({ priced: pricedOf(3000) })
    await ready()
    const row = screen.getByText('Total').parentElement
    expect(row).toHaveTextContent('Total $ 3.000')
    const field = screen.getByRole('button', { name: /^How they pay/ })
    expect(row?.compareDocumentPosition(field)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  test('the full label shows while it fits, with its full name', async () => {
    mount({ priced: pricedOf(3000) })
    await ready()
    expect(screen.queryByText('Collect')).not.toBeInTheDocument()
    expect(collect('Collect $ 3.000')).toBeInTheDocument()
  })

  test('when it does not fit it falls back to Collect, keeps its full name and the Total row, and comes back', async () => {
    mount({ priced: pricedOf(3000) })
    await ready()
    const label = labelOf()
    measure(label, 200, 100)
    expect(within(label).getByText('Collect')).toBeVisible()
    expect(screen.getByText('Collect $ 3.000')).toHaveAttribute('aria-hidden', 'true')
    expect(collect('Collect $ 3.000')).toBeInTheDocument()
    expect(screen.getByText('Total').parentElement).toHaveTextContent('Total $ 3.000')
    measure(label, 100, 100)
    expect(screen.queryByText('Collect')).not.toBeInTheDocument()
    expect(screen.getByText('Collect $ 3.000')).not.toHaveAttribute('aria-hidden')
  })
})
