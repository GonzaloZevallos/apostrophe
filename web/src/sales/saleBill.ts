/**
 * `renderSaleBill`: the plain text a seller sends the customer, built from the `bill` of
 * the last `GET /sales/{id}` (ADR-0053). Pure and DOM-free. Every fixed word, the unit
 * included, comes from the injectable copy group; quantities go from integer hundredths
 * to `formatQuantity`, never through a float. It never works settlement out: the payment
 * state, the amount still owed and the balance are the server's. A product or business
 * name goes out exactly as stored.
 */

import type { BillRule, BillState, SaleBill, SaleBillLine } from '../api/sales'
import { SALE_BILL_TEXT } from '../copy/sales'
import { formatDateShort } from '../format/dates'
import { formatMoney, formatQuantity } from '../format/money'
import { hundredthsOfApiGrams } from './pricing'

type BillText = typeof SALE_BILL_TEXT

function assertNever(value: never): never {
  throw new Error(`unhandled sale bill case: ${String(value)}`)
}

function renderLine(line: SaleBillLine, text: BillText): string {
  const quantity = formatQuantity(hundredthsOfApiGrams(line.quantity))
  const rule: BillRule | null = line.rule
  switch (rule) {
    case null:
      return text.item(line.product, quantity, text.unit, formatMoney(line.amount))
    case 'bulk':
      return text.bulk(
        line.product,
        quantity,
        text.unit,
        formatMoney(line.unit_price ?? 0),
        formatMoney(line.amount),
      )
    case 'gift':
      return text.gift(line.product, quantity, text.unit)
  }
  return assertNever(rule)
}

function paymentLine(bill: SaleBill, text: BillText): string | null {
  const state: BillState = bill.payment.state
  switch (state) {
    case 'cash':
      return text.paidCash
    case 'transfer':
      return text.paidTransfer
    case 'paid':
      return text.paid
    case 'owed':
      return text.stillOwed(formatMoney(bill.payment.still_owed ?? 0))
    case 'none':
      return null
  }
  return assertNever(state)
}

function balanceLine(balance: number | null, text: BillText): string | null {
  if (balance === null || balance === 0) return null
  return balance > 0 ? text.balance(formatMoney(balance)) : text.credit(formatMoney(Math.abs(balance)))
}

export function renderSaleBill(bill: SaleBill, text: BillText = SALE_BILL_TEXT): string {
  const rows = [text.header(bill.business_name, formatDateShort(bill.date)), '']
  for (const line of bill.lines) rows.push(renderLine(line, text))
  if (bill.shipping_charged > 0) rows.push(text.shipping(formatMoney(bill.shipping_charged)))
  rows.push('', text.total(formatMoney(bill.total)))
  const payment = paymentLine(bill, text)
  if (payment !== null) rows.push(payment)
  const balance = balanceLine(bill.balance, text)
  if (balance !== null) rows.push(balance)
  return rows.join('\n')
}
