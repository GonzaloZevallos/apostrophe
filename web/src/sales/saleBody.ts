/**
 * The body of `POST /api/sales`, built in one place: no screen assembles a sale body literal.
 * It maps what the screen already parsed onto the wire keys and does no parsing of its own.
 */

import type { PaymentChoice } from './pricing'

export interface LineBody {
  product_id: number
  quantity: string
  gift: boolean
  special_price: number | null
}

export interface SaleBody {
  date: string
  customer_id: number | null
  shipping_charged: number
  note: string | null
  payment: PaymentChoice | null
  lines: LineBody[]
}

/** The wire body of a sale, keys in this order. A blank or whitespace-only note is `null`; any other
 * note is sent exactly as typed. */
export function saleBodyOf(input: {
  date: string
  customerId: number | null
  shippingCharged: number
  note: string
  payment: PaymentChoice | null
  lines: readonly { productId: number; quantity: string; gift: boolean; specialPrice: number | null }[]
}): SaleBody {
  return {
    date: input.date,
    customer_id: input.customerId,
    shipping_charged: input.shippingCharged,
    note: input.note.trim() === '' ? null : input.note,
    payment: input.payment,
    lines: input.lines.map((line) => ({
      product_id: line.productId,
      quantity: line.quantity,
      gift: line.gift,
      special_price: line.specialPrice,
    })),
  }
}
