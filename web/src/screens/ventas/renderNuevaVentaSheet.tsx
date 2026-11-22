/**
 * Test harness for `NuevaVentaSheet` (unrouted): the real `useSaleDraft` the flip part's host will
 * drive, `fetch` faked (Products, Pricing settings, suggestions and Stock) with reads a test can
 * hold back or break, and the callbacks as mocks. Shared by the row and the bar tests.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render } from '@testing-library/react'
import { useEffect } from 'react'
import { vi } from 'vitest'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import type { CompleteSale } from '../../sales/newSalePricing'
import type { CustomerView } from '../../sales/newSaleView'
import { type SaleDraftApi, useSaleDraft } from '../../sales/useSaleDraft'
import type { Variety } from '../Variedades'
import NuevaVentaSheet from './NuevaVentaSheet'

export const TODAY = '2026-10-02'
export const LATER = '2026-10-05'
export const FORMAT = { symbol: '$', decimals: 0 }

type PriceEntry = NonNullable<Variety['current_price']>
const price = (list: number): PriceEntry => ({
  id: 1,
  effective_from: '2026-09-01',
  list_price: list,
  bulk_price: null,
  bulk_minimum: null,
  vip_price: null,
})
const product = (id: number, name: string, current_price: PriceEntry | null): Variety => ({
  id,
  name,
  archived: false,
  current_price,
})

/** Rosa and Árbol are priced; "Sin precio" has no price on any date. */
export const PRODUCTS: Variety[] = [product(1, 'Rosa', price(1000)), product(2, 'Árbol', price(500)), product(3, 'Sin precio', null)]

export type Read = 'products' | 'settings' | 'suggestions' | 'stock'

export interface LineSpec {
  productId: number
  /** As typed in the quantity field. */
  quantity: string
}

export interface SheetCase {
  customer?: CustomerView
  lines?: readonly LineSpec[]
  shipping?: string
  /** The Customer types switch of the Pricing settings. */
  vip?: boolean
  /** Reads that never answer until `release`. */
  held?: readonly Read[]
  /** Reads that fail with a 500. */
  broken?: readonly Read[]
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function readOf(path: string): Read | null {
  if (path === '/pricing-settings') return 'settings'
  if (path === '/stock') return 'stock'
  if (path.startsWith('/api/sales/suggestions')) return 'suggestions'
  if (path.startsWith('/api/products')) return 'products'
  return null
}

function answerOf(read: Read, vip: boolean): Response {
  switch (read) {
    case 'settings':
      return json(200, { is_bulk_pricing: true, is_vip_customers: vip })
    case 'stock':
      return json(200, { total: 0, entries: [], products: [] })
    case 'suggestions':
      return json(200, { recent_customer_ids: [], most_sold_product_ids: [1, 2, 3], last_payment_method_id: null })
    case 'products':
      return json(200, PRODUCTS)
    default: {
      const unreachable: never = read
      return unreachable
    }
  }
}

export interface RenderedSheet {
  onClose: ReturnType<typeof vi.fn<() => void>>
  onChangeCustomer: ReturnType<typeof vi.fn<() => void>>
  onCollect: ReturnType<typeof vi.fn<(sale: CompleteSale) => void>>
  /** The draft the Sheet is driven by. */
  draft: () => SaleDraftApi
  /** Holds a read back from now on (a request already answered is not undone). */
  hold: (read: Read) => void
  release: (read: Read) => void
}

/** Mounts the Sheet as a phone sheet (`computer` false) with the lines of `spec` typed in the draft. */
export function renderNuevaVentaSheet(spec: SheetCase = {}): RenderedSheet {
  const { customer = { kind: 'none' }, lines = [], shipping = '0', vip = true, held = [], broken = [] } = spec
  const holding = new Set<Read>(held)
  const gates = new Map<Read, () => void>()
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const read = readOf(String(input))
      if (read === null) return Promise.resolve(json(404, {}))
      if (broken.includes(read)) return Promise.resolve(json(500, {}))
      if (holding.has(read)) {
        return new Promise<Response>((resolve) => {
          gates.set(read, () => resolve(answerOf(read, vip)))
        })
      }
      return Promise.resolve(answerOf(read, vip))
    }),
  )
  const onClose = vi.fn<() => void>()
  const onChangeCustomer = vi.fn<() => void>()
  const onCollect = vi.fn<(sale: CompleteSale) => void>()
  let current: SaleDraftApi | null = null

  function Host() {
    const draft = useSaleDraft({ today: TODAY })
    const { addProduct, typeQuantity, setShipping } = draft
    useEffect(() => {
      for (const line of lines) {
        addProduct(line.productId)
        typeQuantity(line.productId, line.quantity)
      }
      setShipping(shipping)
    }, [addProduct, typeQuantity, setShipping])
    useEffect(() => {
      current = draft
    }, [draft])
    return (
      <NuevaVentaSheet
        draft={draft}
        customer={customer}
        onClose={onClose}
        onChangeCustomer={onChangeCustomer}
        onCollect={onCollect}
        computer={false}
        computerClass="pantalla cobro-modal"
        computerDialog
      />
    )
  }

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MoneyFormatProvider format={FORMAT}>
        <Host />
      </MoneyFormatProvider>
    </QueryClientProvider>,
  )
  return {
    onClose,
    onChangeCustomer,
    onCollect,
    draft: () => {
      if (current === null) throw new Error('the Sheet is not mounted')
      return current
    },
    hold: (read) => holding.add(read),
    release: (read) => {
      const open = gates.get(read)
      if (open === undefined) throw new Error(`${read} was not asked for`)
      gates.delete(read)
      holding.delete(read)
      act(() => open())
    },
  }
}
