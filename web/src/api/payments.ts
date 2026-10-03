/**
 * The payments resource, over `api/client.ts` only (plan, invariants): no screen
 * calls `fetch` directly. Matches `app/payments/adapters/schemas.py` field for
 * field (plan, "Contract").
 *
 * `Standing` is the one sign-dependent label the front ever reads (plan,
 * invariants: "standing is derived only by standing_of ... every sign-dependent
 * label ... reads standing, still_owing or kind, never a comparison of balance or
 * running_balance"): screens branch on this field, `still_owing` or an
 * `AccountRow`'s own `kind`, never on whether a `balance` or `running_balance` is
 * negative.
 */

import { del, get, post } from './client'

export type PaymentMethod = 'cash' | 'transfer'
export type Standing = 'owes' | 'credit' | 'settled'
export type HowPaid = 'cash' | 'transfer' | 'owing' | 'none'

export interface AppliedTo {
  sale_id: number
  sale_date: string
  amount: number
}

export interface SettledState {
  balance: number
  owing_since: string | null
  standing: Standing
}

export interface Payment {
  id: number
  paid_on: string
  amount: number
  method: PaymentMethod
}

export interface PaymentCandidate {
  paid_on: string
  amount: number
}

export interface PaymentIn extends PaymentCandidate {
  method: PaymentMethod | null
}

export interface PaymentPreview {
  applied_to: AppliedTo[]
  after: SettledState
}

export interface RecordedPayment {
  payment: Payment
  applied_to: AppliedTo[]
  after: SettledState
}

interface AccountRowBase {
  date: string
  running_balance: number
  standing: Standing
}

export interface SaleAccountRow extends AccountRowBase {
  kind: 'sale'
  sale: { id: number; total: number; how_paid: HowPaid }
}

export interface PaymentAccountRow extends AccountRowBase {
  kind: 'payment'
  payment: Payment
  applied_to: AppliedTo
}

export interface CreditAccountRow extends AccountRowBase {
  kind: 'credit'
  payment: Payment
  amount: number
}

export type AccountRow = SaleAccountRow | PaymentAccountRow | CreditAccountRow

export interface Account {
  balance: number
  owing_since: string | null
  standing: Standing
  rows: AccountRow[]
}

export interface Debtor {
  customer: { id: number; name: string }
  balance: number
  owing_since: string | null
  standing: Standing
}

export interface Debtors {
  total_owed: number
  sales_owing_count: number
  debtors: Debtor[]
}

export function previewPayment(
  customerId: string,
  body: PaymentCandidate,
): Promise<PaymentPreview> {
  return post<PaymentPreview>(
    `/customers/${encodeURIComponent(customerId)}/payments/preview`,
    body,
  )
}

export function recordPayment(customerId: string, body: PaymentIn): Promise<RecordedPayment> {
  return post<RecordedPayment>(`/customers/${encodeURIComponent(customerId)}/payments`, body)
}

export function getAccount(customerId: string): Promise<Account> {
  return get<Account>(`/customers/${encodeURIComponent(customerId)}/account`)
}

export function deletePayment(id: string): Promise<void> {
  return del<void>(`/payments/${encodeURIComponent(id)}`)
}

export function getDebtors(): Promise<Debtors> {
  return get<Debtors>('/payments/debtors')
}
