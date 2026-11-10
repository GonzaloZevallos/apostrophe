/**
 * `renderSaleBill`: the plain text a seller sends the customer, built from the `bill` of
 * the last `GET /sales/{id}` (ADR-0053). Pure and DOM-free. Every fixed word, the unit
 * included, comes from the injectable copy group; quantities go from integer hundredths
 * to `formatQuantity`, never through a float. It never works settlement out: the payment
 * state, the amount still owed and the balance are the server's. A product or business
 * name goes out exactly as stored.
 */

import type { BillRule, BillState, SaleBill, SaleBillLine } from '../api/sales'
import { SALE_BILL_TEXT, SALES_TEXT } from '../copy/sales'
import { formatDateShort } from '../format/dates'
import { formatQuantity } from '../format/money'
import { hundredthsOfApiGrams } from './pricing'

type BillText = typeof SALE_BILL_TEXT

/** The Sale bill is out of scope for the business's Money format (PRD): it keeps the whole-peso
 * form it always had, in this module-private writer, the one named exception to the literal guards. */
const SALE_BILL_AMOUNT = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

function saleBillFixedMoney(pesos: number): string {
  const rounded = Math.sign(pesos) * Math.round(Math.abs(pesos))
  return `$ ${SALE_BILL_AMOUNT.format(rounded === 0 ? 0 : rounded)}`
}

function assertNever(value: never): never {
  throw new Error(`unhandled sale bill case: ${String(value)}`)
}

function renderLine(line: SaleBillLine, text: BillText): string {
  const quantity = formatQuantity(hundredthsOfApiGrams(line.quantity))
  const rule: BillRule | null = line.rule
  switch (rule) {
    case null:
      return text.item(line.product, quantity, text.unit, saleBillFixedMoney(line.amount))
    case 'bulk':
      return text.bulk(
        line.product,
        quantity,
        text.unit,
        saleBillFixedMoney(line.unit_price ?? 0),
        saleBillFixedMoney(line.amount),
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
      return text.stillOwed(saleBillFixedMoney(bill.payment.still_owed ?? 0))
    case 'none':
      return null
  }
  return assertNever(state)
}

function balanceLine(balance: number | null, text: BillText): string | null {
  if (balance === null || balance === 0) return null
  return balance > 0 ? text.balance(saleBillFixedMoney(balance)) : text.credit(saleBillFixedMoney(Math.abs(balance)))
}

export function renderSaleBill(bill: SaleBill, text: BillText = SALE_BILL_TEXT): string {
  const header = text.header(
    bill.business_name,
    SALES_TEXT.saleNumber(bill.number),
    formatDateShort(bill.date),
  )
  const rows = [header, '']
  for (const line of bill.lines) rows.push(renderLine(line, text))
  if (bill.shipping_charged > 0) rows.push(text.shipping(saleBillFixedMoney(bill.shipping_charged)))
  rows.push('', text.total(saleBillFixedMoney(bill.total)))
  const payment = paymentLine(bill, text)
  if (payment !== null) rows.push(payment)
  const balance = balanceLine(bill.balance, text)
  if (balance !== null) rows.push(balance)
  return rows.join('\n')
}
